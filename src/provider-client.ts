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

    const payload = {
      model: options.model || provider.selectedModel,
      messages: formattedMessages,
      stream: true,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
    };

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
            const content = delta.content || '';
            // Support reasoning/thinking tokens (DeepSeek-R1 / Qwen / etc.)
            const thinking = delta.reasoning_content || delta.thinking || undefined;

            if (content || thinking) {
              yield {
                content,
                thinking,
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
