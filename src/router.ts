import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { DatabaseService } from './db.js';
import type { LlamaProcessManager } from './llama-process.js';
import { ProviderClient, type StreamChunk } from './provider-client.js';
import type { ProviderConfig, ChatMessage } from './types.js';

export class MultiProviderRouter {
  private db: DatabaseService;
  private llamaManager: LlamaProcessManager;

  constructor(db: DatabaseService, llamaManager: LlamaProcessManager) {
    this.db = db;
    this.llamaManager = llamaManager;
  }

  public findModelPath(modelFilename?: string): string | null {
    const home = process.env.USERPROFILE || process.env.HOME || os.homedir() || 'C:\\';
    const candidateDirs = [
      this.db.getModelsDir(),
      path.join(home, 'LocalAI', 'models'),
      path.resolve(process.cwd(), 'models'),
    ];

    for (const dir of candidateDirs) {
      if (!dir || !fs.existsSync(dir)) continue;

      if (modelFilename) {
        // 1. Exact match
        const exact = path.join(dir, modelFilename);
        if (fs.existsSync(exact)) return exact;

        // 2. Case-insensitive or pattern match
        try {
          const files = fs.readdirSync(dir);
          const match = files.find((f) => {
            const fl = f.toLowerCase();
            const target = modelFilename.toLowerCase();
            return (
              fl === target ||
              fl === `${target}.gguf` ||
              fl.replace(/-/g, '_') === target.replace(/-/g, '_') ||
              (target.endsWith('.gguf') && fl === target.replace('.gguf', ''))
            );
          });
          if (match) return path.join(dir, match);
        } catch {}
      }

      // 3. Fallback: pick any available .gguf file
      try {
        const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.gguf'));
        if (files.length > 0) {
          return path.join(dir, files[0]);
        }
      } catch {}
    }

    return null;
  }

  public getActiveProvider(): ProviderConfig {
    const { activeProviderId } = this.db.getActiveState();
    const providers = this.db.listProviders();
    const active = providers.find((p) => p.id === activeProviderId) || providers.find((p) => p.isDefault) || providers[0];
    if (!active) {
      throw new Error('No AI provider configured');
    }
    return active;
  }

  public async switchProvider(providerId: string): Promise<ProviderConfig> {
    const provider = this.db.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    this.db.setActiveState({ activeProviderId: providerId });
    return provider;
  }

  public async testAndSyncProvider(providerId: string): Promise<{
    success: boolean;
    models: string[];
    latencyMs: number;
    error?: string;
  }> {
    const provider = this.db.getProvider(providerId);
    if (!provider) {
      return { success: false, models: [], latencyMs: 0, error: 'Provider not found' };
    }

    if (provider.id === 'local-llama' || provider.type === 'llama-server') {
      this.db.syncLocalModels(provider);
      return {
        success: true,
        models: provider.models,
        latencyMs: 1,
      };
    }

    const start = Date.now();
    try {
      const models = await ProviderClient.fetchModels(provider);
      const latencyMs = Date.now() - start;

      // Update provider with fetched models
      if (models.length > 0) {
        provider.models = models;
        if (!models.includes(provider.selectedModel)) {
          provider.selectedModel = models[0];
        }
        this.db.saveProvider(provider);
      }

      return { success: true, models, latencyMs };
    } catch (err: any) {
      return {
        success: false,
        models: provider.models,
        latencyMs: Date.now() - start,
        error: err.message,
      };
    }
  }

  public async *executeChatStream(
    sessionId: string,
    userPrompt: string,
    options: {
      systemPrompt?: string;
      contextFiles?: Array<{ path: string; content: string }>;
      temperature?: number;
    } = {}
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const provider = this.getActiveProvider();

    // 1. Prepare User Message with Context Files if tagged
    let finalPrompt = userPrompt;
    if (options.contextFiles && options.contextFiles.length > 0) {
      const filesContext = options.contextFiles
        .map((f) => `--- File: ${f.path} ---\n${f.content}\n--- End File ---`)
        .join('\n\n');
      finalPrompt = `${filesContext}\n\nUser Question:\n${userPrompt}`;
    }

    // 2. Save user message to database
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sessionId,
      role: 'user',
      content: userPrompt, // Save original prompt for UI
      createdAt: Date.now(),
    };
    this.db.addMessage(userMsg);

    // 3. Collect historical session messages
    const history = this.db.getMessages(sessionId);
    // Replace last message content with context-injected prompt for the LLM
    const apiMessages = history.slice(0, -1);
    apiMessages.push({ ...userMsg, content: finalPrompt });

    // 4. Check & Auto-start local llama-server if selected
    if (provider.id === 'local-llama' || provider.type === 'llama-server') {
      const isHealthy = await this.llamaManager.isHealthy();
      const currentStatus = this.llamaManager.getStatus();
      const modelPath = this.findModelPath(provider.selectedModel);
      const isDifferentModel = !!(
        currentStatus.isRunning &&
        currentStatus.modelPath &&
        modelPath &&
        path.normalize(currentStatus.modelPath).toLowerCase() !== path.normalize(modelPath).toLowerCase()
      );

      if (!isHealthy || isDifferentModel) {
        const binaryPath = this.llamaManager.findBinaryPath();
        if (binaryPath) {
          if (modelPath) {
            const actionText = isDifferentModel
              ? `🔄 [LocalAI]: Đang chuyển đổi sang mô hình "${path.basename(modelPath)}" (khởi động lại GPU CUDA)...\n`
              : '🚀 [LocalAI]: Đang tự động khởi động tiến trình llama-server (GPU CUDA) trên cổng 8080...\n';
            yield { content: actionText, done: false };

            const started = await this.llamaManager.startServer({
              binaryPath,
              modelPath,
              port: 8080,
              host: '127.0.0.1',
              ngl: provider.gpuLayers ?? 21,
              ctxSize: provider.contextSize ?? 4096,
              threads: provider.cpuThreads ?? 4,
              flashAttention: provider.flashAttention ?? true,
            });
            if (!started) {
              const logs = this.llamaManager.getStatus().recentLogs.slice(-4).join('\n');
              throw new Error(`Khởi động llama-server thất bại.\nChi tiết lỗi từ tiến trình:\n${logs || 'Không có log phản hồi'}`);
            }
            yield { content: '✅ [LocalAI]: llama-server đã sẵn sàng! Đang sinh phản hồi...\n\n', done: false };
          } else {
            throw new Error(
              `Chưa có tệp mô hình GGUF "${provider.selectedModel || ''}" trên ổ cứng.\n\n` +
              `👉 Vui lòng vào Cài đặt ➔ Model Hub để tải mô hình GGUF trước khi trò chuyện offline.`
            );
          }
        } else {
          const home = process.env.USERPROFILE || process.env.HOME || os.homedir() || 'C:\\';
          const expectedPath = path.join(home, 'LocalAI', 'bin', 'llama-server.exe');
          throw new Error(
            `Chưa tìm thấy tệp thực thi "llama-server.exe" để tự động khởi động.\n\n` +
            `👉 Để LocalAI tự động chạy Offline trên GPU, bạn chỉ cần tải "llama-server.exe" và đặt vào thư mục:\n` +
            `   ${expectedPath}\n\n` +
            `💡 Hoặc nhanh nhất: Nhấp vào nút Provider màu vàng ở thanh công cụ bên dưới và chọn "FreeLLM API" để trò chuyện ngay lập tức mà không cần GPU hay cài đặt thêm phần mềm!`
          );
        }
      }
    }

    // 5. Stream response
    let accumulatedContent = '';
    let accumulatedThinking = '';

    try {
      for await (const chunk of ProviderClient.streamChat(provider, apiMessages, {
        systemPrompt: options.systemPrompt,
        temperature: options.temperature,
      })) {
        if (chunk.content) accumulatedContent += chunk.content;
        if (chunk.thinking) accumulatedThinking += chunk.thinking;
        yield chunk;
      }
    } catch (err: any) {
      let friendlyError = err.message;
      if (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED')) {
        if (provider.id === 'local-llama' || provider.type === 'llama-server') {
          friendlyError = `Không thể kết nối tới mô hình AI Local (Port 8080). Tiến trình llama-server chưa chạy trên cổng 8080.
💡 Gợi ý giải pháp:
1. Chuyển Provider: Nhấp vào nút Provider bên dưới khung chat (đang là "Local llama.cpp") và chuyển sang "FreeLLM API" (hoặc Ollama / LM Studio) để trò chuyện ngay.
2. Hoặc khởi động llama-server: Chạy lệnh \`llama-server -m <đường_dẫn_tệp_gguf> --port 8080\` nếu bạn muốn suy luận offline trực tiếp qua GPU máy tính.`;
        } else {
          friendlyError = `Không thể kết nối tới provider "${provider.name}". Vui lòng kiểm tra lại URL hoặc API Key trong Cài đặt.`;
        }
      }
      accumulatedContent += `\n⚠️ [Lỗi]: ${friendlyError}`;
      yield { content: `\n⚠️ [Lỗi]: ${friendlyError}`, done: true };
    }

    // 5. Save assistant message to database
    const assistantMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sessionId,
      role: 'assistant',
      content: accumulatedContent,
      thinking: accumulatedThinking || undefined,
      modelUsed: provider.selectedModel,
      createdAt: Date.now(),
    };
    this.db.addMessage(assistantMsg);
  }
}
