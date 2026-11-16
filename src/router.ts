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

    // 4. Stream response
    let accumulatedContent = '';
    let accumulatedThinking = '';

    for await (const chunk of ProviderClient.streamChat(provider, apiMessages, {
      systemPrompt: options.systemPrompt,
      temperature: options.temperature,
    })) {
      if (chunk.content) accumulatedContent += chunk.content;
      if (chunk.thinking) accumulatedThinking += chunk.thinking;
      yield chunk;
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
