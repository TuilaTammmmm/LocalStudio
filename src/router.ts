import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { DatabaseService } from './db.js';
import type { LlamaProcessManager } from './llama-process.js';
import { ProviderClient, type StreamChunk } from './provider-client.js';
import type { ProviderConfig, ChatMessage } from './types.js';
import { getSmartModelPreset } from './model-presets.js';

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
      topP?: number;
      maxTokens?: number;
      repeatPenalty?: number;
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

    // 3. Resolve context limits and token budget before preparing messages
    const modelPath = this.findModelPath(provider.selectedModel);
    const modelFilename = modelPath ? path.basename(modelPath) : (provider.selectedModel || '');
    const savedConfig = this.db.getModelConfig(modelFilename);
    const smartPreset = getSmartModelPreset(modelFilename);

    const effectiveNgl = savedConfig?.gpuLayers ?? provider.gpuLayers ?? smartPreset.recommendedNgl;
    const effectiveCtxSize = savedConfig?.contextSize ?? provider.contextSize ?? smartPreset.recommendedCtxSize;
    const effectiveTemp = savedConfig?.temperature ?? options.temperature ?? smartPreset.temperature;
    const effectiveTopP = savedConfig?.topP ?? options.topP ?? smartPreset.topP;
    const effectiveRepeatPenalty = savedConfig?.repeatPenalty ?? options.repeatPenalty ?? smartPreset.repeatPenalty;

    // Safe hardware clamping for 4GB VRAM cards (e.g. GTX 1650)
    const isMediumOrLargeLocal = /7b|8b|9b|14b/i.test(modelFilename);
    let safeNgl = effectiveNgl;
    let safeCtxSize = effectiveCtxSize;
    if (isMediumOrLargeLocal && (provider.id === 'local-llama' || provider.type === 'llama-server')) {
      if (safeNgl > 24) safeNgl = 21;
      if (safeCtxSize > 4096) safeCtxSize = 4096;
    }

    const totalCtxLimit = safeCtxSize || 4096;
    const maxGenTokens = Math.min(1024, options.maxTokens || 1024);
    // Hard ceiling for prompt tokens: total context minus generation space minus 200 safety buffer
    const maxPromptBudget = Math.max(800, totalCtxLimit - maxGenTokens - 200);

    // Approximate token count: ~3.5 chars per token for mixed Vietnamese & code
    const estimateTokens = (text: string) => Math.ceil((text || '').length / 3.5);

    // 1) Clamp systemPrompt if it takes more than 25% of maxPromptBudget
    let effectiveSystemPrompt = options.systemPrompt || '';
    const maxSystemTokens = Math.floor(maxPromptBudget * 0.25);
    if (estimateTokens(effectiveSystemPrompt) > maxSystemTokens) {
      const maxChars = Math.floor(maxSystemTokens * 3.5);
      effectiveSystemPrompt = effectiveSystemPrompt.slice(0, maxChars) + '\n\n...[Chỉ dẫn hệ thống được tinh gọn]...';
    }

    // 2) History Reservation: Reserve up to 40% of maxPromptBudget for recent conversation history
    // so that attached files / long prompts do not completely wipe out conversation memory!
    const history = this.db.getMessages(sessionId);
    const cleanedHistory = history
      .slice(0, -1)
      .map((m) =>
        m.role === 'assistant'
          ? {
              ...m,
              content: (m.content || '')
                .replace(/<think>[\s\S]*?<\/think>/g, '')
                .replace(/^(🚀|🔄|✅) \[LocalAI\].*$/gm, '')
                .replace(/\n⚠️ \[Lỗi\][\s\S]*$/, '')
                .trim(),
            }
          : m
      )
      .filter((m) => m.content);

    const minHistoryBudget = Math.min(1000, Math.floor(maxPromptBudget * 0.40));
    const budgetedMessages: ChatMessage[] = [];
    let historyTokens = 0;

    // Accumulate the most recent messages up to minHistoryBudget
    for (let i = cleanedHistory.length - 1; i >= 0; i--) {
      const msg = cleanedHistory[i];
      const msgTokens = estimateTokens(msg.content);
      if (historyTokens + msgTokens > minHistoryBudget && budgetedMessages.length >= 2) {
        break; // Ensure at least 2 recent messages are kept
      }
      budgetedMessages.unshift(msg);
      historyTokens += msgTokens;
      if (historyTokens >= minHistoryBudget) break;
    }

    // 3) Allocate remaining budget for sanitizedFinalPrompt
    const systemTokens = estimateTokens(effectiveSystemPrompt);
    const remainingForPrompt = Math.max(300, maxPromptBudget - systemTokens - historyTokens);

    let sanitizedFinalPrompt = finalPrompt;
    if (estimateTokens(sanitizedFinalPrompt) > remainingForPrompt) {
      const allowedChars = Math.floor(remainingForPrompt * 3.5);
      sanitizedFinalPrompt = sanitizedFinalPrompt.slice(0, allowedChars) + '\n\n...[Nội dung tóm lược để vừa vặn bộ nhớ]...';
    }

    const apiMessages = [...budgetedMessages, { ...userMsg, content: sanitizedFinalPrompt }];

    // 4. Check & Auto-start local llama-server if selected
    if (provider.id === 'local-llama' || provider.type === 'llama-server') {
      this.llamaManager.resetIdleTimer();
      const isHealthy = await this.llamaManager.isHealthy();
      const currentStatus = this.llamaManager.getStatus();

      const isHardwareConfigChanged = !!(
        currentStatus.isRunning &&
        (currentStatus.ngl !== safeNgl ||
         currentStatus.ctxSize !== safeCtxSize ||
         currentStatus.threads !== (provider.cpuThreads ?? 4) ||
         currentStatus.flashAttention !== (provider.flashAttention ?? true))
      );

      const isDifferentModel = !!(
        currentStatus.isRunning &&
        currentStatus.modelPath &&
        modelPath &&
        path.normalize(currentStatus.modelPath).toLowerCase() !== path.normalize(modelPath).toLowerCase()
      );

      if (!isHealthy || isDifferentModel || isHardwareConfigChanged) {
        const binaryPath = this.llamaManager.findBinaryPath();
        if (binaryPath) {
          if (modelPath) {
            const actionText = isDifferentModel
              ? `🔄 [LocalAI]: Đang chuyển đổi sang mô hình "${path.basename(modelPath)}" (khởi động lại GPU CUDA)...\n`
              : isHardwareConfigChanged
              ? `⚙️ [LocalAI]: Đang áp dụng cấu hình phần cứng mới (khởi động lại GPU CUDA)...\n`
              : '🚀 [LocalAI]: Đang tự động khởi động tiến trình llama-server (GPU CUDA) trên cổng 8080...\n';
            yield { content: actionText, done: false };

            const started = await this.llamaManager.startServer({
              binaryPath,
              modelPath,
              port: 8080,
              host: '127.0.0.1',
              ngl: safeNgl,
              ctxSize: safeCtxSize,
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

      // 5. Stream response with effective model parameters
      let accumulatedContent = '';
      let accumulatedThinking = '';

      try {
        for await (const chunk of ProviderClient.streamChat(provider, apiMessages, {
          systemPrompt: options.systemPrompt,
          temperature: effectiveTemp,
          topP: effectiveTopP,
          maxTokens: options.maxTokens,
          repeatPenalty: effectiveRepeatPenalty,
          model: provider.selectedModel,
        })) {
          if (chunk.content) accumulatedContent += chunk.content;
          if (chunk.thinking) accumulatedThinking += chunk.thinking;
          yield chunk;
        }
      } catch (err: any) {
        let friendlyError = err.message;
        if (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED')) {
          friendlyError = `Không thể kết nối tới mô hình AI Local (Port 8080). Tiến trình llama-server chưa chạy trên cổng 8080.
💡 Gợi ý giải pháp:
1. Chuyển Provider: Nhấp vào nút Provider bên dưới khung chat (đang là "Local llama.cpp") và chuyển sang "FreeLLM API" (hoặc Ollama / LM Studio) để trò chuyện ngay.
2. Hoặc khởi động llama-server: Chạy lệnh \`llama-server -m <đường_dẫn_tệp_gguf> --port 8080\` nếu bạn muốn suy luận offline trực tiếp qua GPU máy tính.`;
        }
        accumulatedContent += `\n⚠️ [Lỗi]: ${friendlyError}`;
        yield { content: `\n⚠️ [Lỗi]: ${friendlyError}`, done: true };
      }

      // Save assistant message to database
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
      return;
    }

    // 5. Stream response for Non-Local Providers
    let accumulatedContent = '';
    let accumulatedThinking = '';

    try {
      for await (const chunk of ProviderClient.streamChat(provider, apiMessages, {
        systemPrompt: options.systemPrompt,
        temperature: options.temperature,
        topP: options.topP,
        maxTokens: options.maxTokens,
        repeatPenalty: options.repeatPenalty,
      })) {
        if (chunk.content) accumulatedContent += chunk.content;
        if (chunk.thinking) accumulatedThinking += chunk.thinking;
        yield chunk;
      }
    } catch (err: any) {
      let friendlyError = err.message;
      if (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED')) {
        friendlyError = `Không thể kết nối tới provider "${provider.name}". Vui lòng kiểm tra lại URL hoặc API Key trong Cài đặt.`;
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

  public async *executeStatelessStream(
    prompt: string,
    options: {
      systemPrompt?: string;
      temperature?: number;
      topP?: number;
      maxTokens?: number;
      repeatPenalty?: number;
      model?: string;
    } = {}
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const provider = this.getActiveProvider();

    // 1. Check & Auto-start local llama-server if local provider
    if (provider.id === 'local-llama' || provider.type === 'llama-server') {
      this.llamaManager.resetIdleTimer();
      const isHealthy = await this.llamaManager.isHealthy();
      const currentStatus = this.llamaManager.getStatus();
      const modelPath = this.findModelPath(provider.selectedModel);
      const modelFilename = modelPath ? path.basename(modelPath) : (provider.selectedModel || '');

      const savedConfig = this.db.getModelConfig(modelFilename);
      const smartPreset = getSmartModelPreset(modelFilename);

      const effectiveNgl = savedConfig?.gpuLayers ?? provider.gpuLayers ?? smartPreset.recommendedNgl;
      const effectiveCtxSize = savedConfig?.contextSize ?? provider.contextSize ?? smartPreset.recommendedCtxSize;
      const effectiveTemp = savedConfig?.temperature ?? options.temperature ?? smartPreset.temperature;
      const effectiveTopP = savedConfig?.topP ?? options.topP ?? smartPreset.topP;
      const effectiveRepeatPenalty = savedConfig?.repeatPenalty ?? options.repeatPenalty ?? smartPreset.repeatPenalty;

      const isMediumOrLargeLocal = /7b|8b|9b|14b/i.test(modelFilename);
      let safeNgl = effectiveNgl;
      let safeCtxSize = effectiveCtxSize;
      if (isMediumOrLargeLocal && (provider.id === 'local-llama' || provider.type === 'llama-server')) {
        if (safeNgl > 24) safeNgl = 21;
        if (safeCtxSize > 4096) safeCtxSize = 4096;
      }

      const isHardwareConfigChanged = !!(
        currentStatus.isRunning &&
        (currentStatus.ngl !== safeNgl ||
         currentStatus.ctxSize !== safeCtxSize ||
         currentStatus.threads !== (provider.cpuThreads ?? 4) ||
         currentStatus.flashAttention !== (provider.flashAttention ?? true))
      );

      const isDifferentModel = !!(
        currentStatus.isRunning &&
        currentStatus.modelPath &&
        modelPath &&
        path.normalize(currentStatus.modelPath).toLowerCase() !== path.normalize(modelPath).toLowerCase()
      );

      if (!isHealthy || isDifferentModel || isHardwareConfigChanged) {
        const binaryPath = this.llamaManager.findBinaryPath();
        if (binaryPath && modelPath) {
          await this.llamaManager.startServer({
            binaryPath,
            modelPath,
            port: 8080,
            host: '127.0.0.1',
            ngl: safeNgl,
            ctxSize: safeCtxSize,
            threads: provider.cpuThreads ?? 4,
            flashAttention: provider.flashAttention ?? true,
          });
        }
      }

      // Safe token budgeting for stateless stream
      const estimateTokens = (text: string) => Math.ceil((text || '').length / 3.5);
      const maxPromptBudget = Math.max(800, safeCtxSize - Math.min(1024, options.maxTokens || 1024) - 200);

      let effectiveSystemPrompt = options.systemPrompt || '';
      const maxSystemTokens = Math.floor(maxPromptBudget * 0.35);
      if (estimateTokens(effectiveSystemPrompt) > maxSystemTokens) {
        effectiveSystemPrompt = effectiveSystemPrompt.slice(0, Math.floor(maxSystemTokens * 3.5)) + '\n\n...[Rút gọn]...';
      }

      let sanitizedPrompt = prompt;
      if (estimateTokens(sanitizedPrompt) + estimateTokens(effectiveSystemPrompt) > maxPromptBudget) {
        const allowedChars = Math.floor(Math.max(300, maxPromptBudget - estimateTokens(effectiveSystemPrompt) - 50) * 3.5);
        sanitizedPrompt = sanitizedPrompt.slice(0, allowedChars) + '\n\n...[Tóm lược]...';
      }

      const apiMessages: ChatMessage[] = [
        {
          id: `stateless-${Date.now()}`,
          sessionId: '',
          role: 'user',
          content: sanitizedPrompt,
          createdAt: Date.now(),
        },
      ];

      for await (const chunk of ProviderClient.streamChat(provider, apiMessages, {
        systemPrompt: effectiveSystemPrompt,
        temperature: effectiveTemp,
        topP: effectiveTopP,
        maxTokens: options.maxTokens,
        repeatPenalty: effectiveRepeatPenalty,
        model: provider.selectedModel,
      })) {
        yield chunk;
      }
      return;
    }

    const apiMessages: ChatMessage[] = [
      {
        id: `stateless-${Date.now()}`,
        sessionId: '',
        role: 'user',
        content: prompt,
        createdAt: Date.now(),
      },
    ];

    for await (const chunk of ProviderClient.streamChat(provider, apiMessages, {
      systemPrompt: options.systemPrompt,
      temperature: options.temperature,
      topP: options.topP,
      maxTokens: options.maxTokens,
      repeatPenalty: options.repeatPenalty,
      model: options.model,
    })) {
      yield chunk;
    }
  }
}
