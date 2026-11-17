import type { ProviderConfig, ChatMessage } from './types.js';

export interface StreamChunk {
  content: string;
  thinking?: string;
  done: boolean;
  model?: string;
}

export class ProviderClient {
  /**
   * Fetch available models from an OpenAI-compatible endpoint
   */
  public static async fetchModels(provider: ProviderConfig): Promise<string[]> {
    const url = `${provider.baseUrl.replace(/\/+$/, '')}/models`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...provider.customHeaders,
    };

    if (provider.apiKey) {
      headers['Authorization'] = `Bearer ${provider.apiKey}`;
    }

    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data: any = await res.json();
      if (Array.isArray(data.data)) {
        return data.data.map((m: any) => m.id || m.name);
      }
      if (Array.isArray(data.models)) {
        return data.models.map((m: any) => m.name || m.id);
      }
      return [];
    } catch (err: any) {
      throw new Error(`Failed to fetch models from ${provider.name}: ${err.message}`);
    }
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

    const formattedMessages: Array<{ role: string; content: string }> = [];
    if (options.systemPrompt) {
      formattedMessages.push({ role: 'system', content: options.systemPrompt });
    }
    for (const msg of messages) {
      formattedMessages.push({ role: msg.role, content: msg.content });
    }

    const isLocal =
      provider.type === 'llama-server' ||
      provider.id === 'local-llama' ||
      /127\.0\.0\.1|localhost/.test(provider.baseUrl);

    const payload: Record<string, unknown> = {
      model: options.model || provider.selectedModel,
      messages: formattedMessages,
      stream: true,
      temperature: options.temperature ?? 0.6,
      top_p: options.topP ?? 0.9,
      max_tokens: options.maxTokens || 4096,
    };

    if (isLocal) {
      // llama.cpp native anti-repetition samplers
      payload.repeat_penalty = Math.min(options.repeatPenalty ?? 1.1, 1.2);
      payload.repeat_last_n = 256;
      payload.min_p = 0.05;
      payload.dry_multiplier = 0.8; // DRY: chặn lặp cụm từ/câu dài
      payload.dry_base = 1.75;
      payload.dry_allowed_length = 2;
      payload.dry_penalty_last_n = 0; // 0 = an toàn, tương thích với schema 0 <= val <= 2147483647
    } else {
      payload.frequency_penalty = 0.3;
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
