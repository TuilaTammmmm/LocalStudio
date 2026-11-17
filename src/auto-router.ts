export interface AutoRouteConfig {
  enabled: boolean;
  generalModel: string;  // e.g. "LFM-3B-Instruct" or "Qwen2.5-3B"
  coderModel: string;    // e.g. "Qwen2.5-Coder-7B" or "LFM-3B-Coder"
  reasonerModel: string; // e.g. "DeepSeek-R1-Distill-8B"
  visionModel: string;   // e.g. "Qwen2-VL-7B-Instruct-GGUF" (Multimodal / Vision)
  heavyModel: string;    // e.g. "llama-3.3-70b-instruct (FreeLLM)"
}

export const DEFAULT_AUTO_ROUTE_CONFIG: AutoRouteConfig = {
  enabled: false,
  generalModel: '',
  coderModel: '',
  reasonerModel: '',
  visionModel: '',
  heavyModel: '',
};

export class AutoModelRouter {
  public static routePrompt(
    prompt: string,
    contextTokens = 0,
    hasImageAttachment = false,
    config: AutoRouteConfig = DEFAULT_AUTO_ROUTE_CONFIG
  ): { targetModel: string; category: 'general' | 'coder' | 'reasoner' | 'vision' | 'heavy'; reason: string } {
    const lower = prompt.toLowerCase();

    // 1. Multimodal / Vision Detection
    const visionPatterns = [
      /\b(ảnh|hình|hình ảnh|bức ảnh|chụp|screenshot|diagram|chart|sơ đồ|ocr|infographic|picture|photo)\b/i,
      /\b(nhìn|xem ảnh|đọc ảnh|miêu tả ảnh|trích xuất chữ từ ảnh)\b/i,
    ];
    if (hasImageAttachment || visionPatterns.some((pattern) => pattern.test(lower))) {
      return {
        targetModel: config.visionModel,
        category: 'vision',
        reason: 'Detected image/visual analysis intent. Auto-routed to Vision Multimodal Model (Qwen2-VL).',
      };
    }

    // 2. Heavy context threshold (> 6000 tokens) -> Offload to high capacity cloud/FreeLLM
    if (contextTokens > 6000) {
      return {
        targetModel: config.heavyModel,
        category: 'heavy',
        reason: `Context size (${contextTokens} tokens) exceeds 4GB VRAM safety buffer. Auto-routed to Heavy Model.`,
      };
    }

    // 3. Coding keywords
    const codePatterns = [
      /\b(code|function|class|bug|error|refactor|fix|const|def|import|ts|tsx|js|python|rust|sql|endpoint|api|component)\b/i,
      /```[\s\S]*?```/,
      /\{[\s\S]*?\}/,
    ];
    if (codePatterns.some((pattern) => pattern.test(lower))) {
      return {
        targetModel: config.coderModel,
        category: 'coder',
        reason: 'Detected coding / debugging intent. Auto-routed to specialized Coding Model.',
      };
    }

    // 4. Reasoning / Logic keywords
    const reasoningPatterns = [
      /\b(suy luận|giải thích logic|chứng minh|tại sao|nguyên nhân|từng bước|step-by-step|algorithm|math|phân tích sâu)\b/i,
      /\b(why|prove|reasoning|derive|deduce|logic)\b/i,
    ];
    if (reasoningPatterns.some((pattern) => pattern.test(lower))) {
      return {
        targetModel: config.reasonerModel,
        category: 'reasoner',
        reason: 'Detected complex logic / reasoning intent. Auto-routed to Reasoning Model (<think> active).',
      };
    }

    // 5. Default: Fast General Model
    return {
      targetModel: config.generalModel,
      category: 'general',
      reason: 'General inquiry / quick conversation. Routed to lightweight ultra-fast 3B model (~45 t/s).',
    };
  }
}
