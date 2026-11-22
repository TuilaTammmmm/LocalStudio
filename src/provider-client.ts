import type { ProviderConfig, ChatMessage } from './types.js';

export interface StreamChunk {
  content: string;
  thinking?: string;
  done: boolean;
  model?: string;
}

export class ProviderClient {
  /**
   * Fetch available models from an OpenAI-compatible endpoint or Ollama
   */
  public static async fetchModels(provider: ProviderConfig): Promise<string[]> {
    const cleanBase = provider.baseUrl.replace(/\/+$/, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...provider.customHeaders,
    };

    if (provider.apiKey) {
      headers['Authorization'] = `Bearer ${provider.apiKey}`;
    }

    const tryFetchUrl = async (targetUrl: string): Promise<string[] | null> => {
      try {
        const res = await fetch(targetUrl, { headers, signal: AbortSignal.timeout(6000) });
        if (!res.ok) return null;
        const data: any = await res.json();
        if (Array.isArray(data.data)) {
          return data.data.map((m: any) => m.id || m.name).filter(Boolean);
        }
        if (Array.isArray(data.models)) {
          return data.models.map((m: any) => m.name || m.id || m.model).filter(Boolean);
        }
        if (Array.isArray(data)) {
          return data.map((m: any) => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean);
        }
        return null;
      } catch {
        return null;
      }
    };

    // 1. Try direct /models endpoint
    let models = await tryFetchUrl(`${cleanBase}/models`);
    if (models && models.length > 0) return models;

    // 2. Try with /v1/models if not already ending with /v1
    if (!cleanBase.endsWith('/v1')) {
      models = await tryFetchUrl(`${cleanBase}/v1/models`);
      if (models && models.length > 0) return models;
    }

    // 3. Try Ollama native /api/tags
    const ollamaBase = cleanBase.replace(/\/v1\/?$/, '');
    models = await tryFetchUrl(`${ollamaBase}/api/tags`);
    if (models && models.length > 0) return models;

    throw new Error(
      `Không thể đọc danh sách model từ ${provider.name}. Vui lòng kiểm tra lại URL endpoint (${provider.baseUrl}) hoặc Khóa API.`
    );
  }

  /**
   * Stream chat completions using standard SSE (Server-Sent Events)
   */
  public static async *streamChat(
    provider: ProviderConfig,
    messages: ChatMessage[],
    options: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      repeatPenalty?: number;
      systemPrompt?: string;
      model?: string;
    } = {}
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const url = `${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...provider.customHeaders,
    };

    if (provider.apiKey) {
      headers['Authorization'] = `Bearer ${provider.apiKey}`;
    }

    const modelName = (options.model || provider.selectedModel || '').toLowerCase();
    const isGemma = modelName.includes('gemma');

    // Format & normalize messages to satisfy strict model Chat Templates (e.g. Gemma 2, Qwen/R1):
    // 1. Gemma 2 does not support 'system' role. Prepend system prompt to the first user message.
    // 2. Strict alternation: merge consecutive messages from the same role to prevent Jinja 400 errors.
    const rawMessages: Array<{ role: string; content: string }> = [];
    if (options.systemPrompt && options.systemPrompt.trim()) {
      if (isGemma) {
        // Gemma 2: prepend system prompt into the first user message instead of a separate 'system' role
        rawMessages.push({ role: 'user', content: `[Instructions]: ${options.systemPrompt.trim()}` });
      } else {
        rawMessages.push({ role: 'system', content: options.systemPrompt.trim() });
      }
    }

    for (const msg of messages) {
      if (!msg.content || !msg.content.trim()) continue;
      // If Gemma and a 'system' role was sent in messages, convert it to user prefix
      if (isGemma && msg.role === 'system') {
        rawMessages.push({ role: 'user', content: `[Instructions]: ${msg.content.trim()}` });
      } else {
        rawMessages.push({ role: msg.role, content: msg.content.trim() });
      }
    }

    // Merge consecutive same-role messages
    const formattedMessages: Array<{ role: string; content: string }> = [];
    for (const m of rawMessages) {
      if (formattedMessages.length > 0 && formattedMessages[formattedMessages.length - 1].role === m.role) {
        formattedMessages[formattedMessages.length - 1].content += `\n\n${m.content}`;
      } else {
        formattedMessages.push({ ...m });
      }
    }

    // Ensure first message is 'user' for models that don't accept starting with 'assistant'
    if (formattedMessages.length > 0 && formattedMessages[0].role === 'assistant') {
      formattedMessages.unshift({ role: 'user', content: 'Hello' });
    }

    const isLocal =
      provider.type === 'llama-server' ||
      provider.id === 'local-llama' ||
      /127\.0\.0\.1|localhost/.test(provider.baseUrl);

    // Optimized sampling parameters:
    // Lower temperature (0.3) and top_p (0.85) to eliminate hallucinations and off-topic outputs.
    const defaultTemp = isLocal ? 0.3 : 0.6;
    const defaultTopP = isLocal ? 0.85 : 0.9;

    const payload: Record<string, unknown> = {
      model: options.model || provider.selectedModel,
      messages: formattedMessages,
      stream: true,
      temperature: options.temperature ?? defaultTemp,
      top_p: options.topP ?? defaultTopP,
      max_tokens: Math.min(options.maxTokens || (isLocal ? 2048 : 4096), 4096),
      stop: ['<|im_end|>', '<|eot_id|>', '<end_of_turn>', '</s>', '\nNgười dùng:', '\nUser:'],
    };

    if (isLocal) {
      // Repetition control: repeat_last_n = 256 covers the entire previous code block/paragraph to prevent infinite loops
      payload.repeat_penalty = Math.min(Math.max(options.repeatPenalty ?? 1.10, 1.05), 1.15);
      payload.repeat_last_n = 256;
      payload.min_p = 0.05;
      // Do NOT set dry_multiplier by default as it severely penalizes Gemma 2 & DeepSeek-R1 logic chains
    } else {
      payload.frequency_penalty = 0.3;
      payload.presence_penalty = 0.1;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Chat request failed [${res.status}]: ${errText}`);
    }

    if (!res.body) {
      throw new Error('Response body is null, cannot stream');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let insideThinkTag = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (jsonStr === '[DONE]') {
            yield { content: '', done: true };
            return;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const choice = parsed.choices?.[0];
            if (!choice) continue;

            const delta = choice.delta || {};
            let rawContent = delta.content || '';
            let rawThinking = delta.reasoning_content || delta.thinking || undefined;

            // Stream state-machine parser for <think>...</think> (DeepSeek-R1 raw output)
            if (rawContent) {
              if (rawContent.includes('<think>')) {
                insideThinkTag = true;
                const parts = rawContent.split('<think>');
                if (parts[0]) yield { content: parts[0], done: false, model: parsed.model };
                rawContent = parts[1] || '';
              }

              if (insideThinkTag) {
                if (rawContent.includes('</think>')) {
                  insideThinkTag = false;
                  const parts = rawContent.split('</think>');
                  const thinkPart = parts[0] || '';
                  const afterThinkContent = parts[1] || '';
                  if (thinkPart) {
                    yield { content: '', thinking: thinkPart, done: false, model: parsed.model };
                  }
                  if (afterThinkContent) {
                    yield { content: afterThinkContent, done: false, model: parsed.model };
                  }
                  continue;
                } else {
                  yield { content: '', thinking: rawContent, done: false, model: parsed.model };
                  continue;
                }
              }
            }

            if (rawContent || rawThinking) {
              yield {
                content: rawContent,
                thinking: rawThinking,
                done: false,
                model: parsed.model,
              };
            }
          } catch {
            // Incomplete JSON chunk, skip
          }
        }
      }

      yield { content: '', done: true };
    } finally {
      reader.releaseLock();
    }
  }
}
