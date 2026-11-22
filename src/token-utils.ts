/**
 * Token calculation and Context Budget utilities for LocalAI Studio
 * Accurately estimates tokens for mixed Vietnamese, English, and source code.
 */

export interface TokenBreakdown {
  systemPromptTokens: number;
  rulesTokens: number;
  skillsTokens: number;
  workspaceTokens: number;
  contextFilesTokens: number;
  historyTokens: number;
  userPromptTokens: number;
  totalPromptTokens: number;
  contextLimit: number;
  maxGenTokens: number;
  remainingTokens: number;
  engine?: 'rust' | 'llama-server' | 'heuristic';
}

/**
 * Accurately estimate token count for mixed Vietnamese, English, and source code.
 * In BPE tokenizers (like Qwen, Llama 3, DeepSeek, Gemma):
 * - English text: ~3.2 - 3.8 chars/token
 * - Code & symbols: ~2.8 - 3.2 chars/token
 * - Vietnamese & accented characters (multi-byte UTF-8): ~1.6 - 2.2 chars/token
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let asciiCount = 0;
  let nonAsciiCount = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) < 128) {
      asciiCount++;
    } else {
      nonAsciiCount++;
    }
  }
  // Safe conservative estimate:
  // Non-ASCII characters (Vietnamese diacritics, CJK, emojis) consume ~1.6 chars per token
  // ASCII characters (English, code, symbols) consume ~3.0 chars per token
  const charBased = Math.ceil(asciiCount / 3.0 + nonAsciiCount / 1.6);
  // Word count heuristic: each whitespace-separated unit is at least 1.25 tokens
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(charBased, Math.ceil(words * 1.25));
}

/**
 * Clamps a text string so that its token count does not exceed maxTokens.
 * Appends a clean ellipsis indicator if clamped.
 */
export function clampToTokens(text: string, maxTokens: number, ellipsisSuffix = '\n\n...[Nội dung được tinh gọn để vừa bộ nhớ ngữ cảnh]...'): string {
  if (!text || maxTokens <= 0) return '';
  const currentTokens = estimateTokens(text);
  if (currentTokens <= maxTokens) return text;

  // Approximate allowed character length
  const ratio = maxTokens / currentTokens;
  const targetChars = Math.max(50, Math.floor(text.length * ratio * 0.95));
  let sliced = text.slice(0, targetChars);

  // Refine slice if still over
  while (estimateTokens(sliced + ellipsisSuffix) > maxTokens && sliced.length > 50) {
    sliced = sliced.slice(0, Math.floor(sliced.length * 0.9));
  }

  return `${sliced}${ellipsisSuffix}`;
}
