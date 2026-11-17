export interface ModelHubItem {
  id: string;
  name: string;
  filename: string;
  author: string;
  description: string;
  parameterSize: string; // e.g. "1.5B", "3B", "7B", "8B", "14B"
  quantization: string;  // e.g. "Q4_K_M", "Q8_0"
  fileSizeBytes: number;
  totalLayers: number;
  downloadUrl: string;
  tags: string[];
  category: 'coding' | 'reasoning' | 'vision' | 'general';
}

export interface ModelCompatibility {
  status: 'full-gpu' | 'hybrid' | 'cpu-only' | 'exceeds';
  statusLabel: string;
  badgeColor: string;
  recommendedNgl: number;
  estimatedVramMb: number;
  estimatedRamMb: number;
  estimatedSpeed: string;
  description: string;
}

export const CURATED_MODELS: ModelHubItem[] = [
  // Coding Specialists
  {
    id: 'qwen2.5-coder-7b-instruct-q4',
    name: 'Qwen 2.5 Coder 7B Instruct',
    filename: 'Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf',
    author: 'Qwen',
    description: 'Mô hình lập trình chuyên biệt hàng đầu thế giới mã nguồn mở. Huấn luyện trên 5.5T code tokens, mạnh tương đương GPT-4o về code refactor, fix bug và viết tests.',
    parameterSize: '7B',
    quantization: 'Q4_K_M',
    fileSizeBytes: 4_680_000_000,
    totalLayers: 28,
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF',
    tags: ['Coding', 'Refactor', 'TypeScript', 'Python'],
    category: 'coding',
  },
  {
    id: 'qwen2.5-coder-1.5b-instruct-q4',
    name: 'Qwen 2.5 Coder 1.5B Instruct',
    filename: 'Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf',
    author: 'Qwen',
    description: 'Phiên bản lập trình siêu nhẹ, tốc độ cực nhanh (>65 token/giây trên GTX 1650), load 100% vào VRAM không tốn RAM hệ thống.',
    parameterSize: '1.5B',
    quantization: 'Q4_K_M',
    fileSizeBytes: 1_150_000_000,
    totalLayers: 28,
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF',
    tags: ['Coding', 'Fast', '100% GPU'],
    category: 'coding',
  },
  {
    id: 'qwen2.5-coder-14b-instruct-q4',
    name: 'Qwen 2.5 Coder 14B Instruct',
    filename: 'Qwen2.5-Coder-14B-Instruct-Q4_K_M.gguf',
    author: 'Qwen',
    description: 'Mô hình lập trình cấp cao kiến trúc 14B, độ chính xác thuật toán rất cao. Phù hợp máy có RAM >= 16GB (chạy Hybrid với CPU).',
    parameterSize: '14B',
    quantization: 'Q4_K_M',
    fileSizeBytes: 9_100_000_000,
    totalLayers: 48,
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-Coder-14B-Instruct-GGUF',
    tags: ['Coding', 'Advanced', '14B'],
    category: 'coding',
  },

  // Reasoning & Thinking (<think>)
  {
    id: 'deepseek-r1-distill-qwen-8b-q4',
    name: 'DeepSeek-R1 Distill Qwen 8B',
    filename: 'DeepSeek-R1-Distill-Qwen-8B-Q4_K_M.gguf',
    author: 'DeepSeek',
    description: 'Mô hình suy luận đỉnh cao mã nguồn mở. Tự động xuất chuỗi suy nghĩ sâu (<think>) từng bước trước khi trả lời, giải toán và logic phức tạp xuất sắc.',
    parameterSize: '8B',
    quantization: 'Q4_K_M',
    fileSizeBytes: 4_920_000_000,
    totalLayers: 32,
    downloadUrl: 'https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-8B-GGUF',
    tags: ['Reasoning', 'Math', 'Logic', 'Thinking'],
    category: 'reasoning',
  },
  {
    id: 'deepseek-r1-distill-qwen-1.5b-q4',
    name: 'DeepSeek-R1 Distill Qwen 1.5B',
    filename: 'DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf',
    author: 'DeepSeek',
    description: 'Mô hình suy luận nhẹ nhất có tính năng Deep Thinking. Vừa vặn 100% trong GTX 1650 4GB với tốc độ phản hồi tức thì.',
    parameterSize: '1.5B',
    quantization: 'Q4_K_M',
    fileSizeBytes: 1_200_000_000,
    totalLayers: 28,
    downloadUrl: 'https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF',
    tags: ['Reasoning', 'Fast', '100% GPU'],
    category: 'reasoning',
  },
  {
    id: 'deepseek-r1-distill-qwen-14b-q4',
    name: 'DeepSeek-R1 Distill Qwen 14B',
    filename: 'DeepSeek-R1-Distill-Qwen-14B-Q4_K_M.gguf',
    author: 'DeepSeek',
    description: 'Bản suy luận 14B mạnh mẽ ngang ngửa o1-mini trên các bài test toán học AIME và lập trình giải thuật.',
    parameterSize: '14B',
    quantization: 'Q4_K_M',
    fileSizeBytes: 9_200_000_000,
    totalLayers: 48,
    downloadUrl: 'https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-14B-GGUF',
    tags: ['Reasoning', 'Deep Think', 'AIME'],
    category: 'reasoning',
  },

  // Vision & Multimodal
  {
    id: 'qwen2-vl-7b-instruct-q4',
    name: 'Qwen2-VL 7B Instruct (Vision)',
    filename: 'Qwen2-VL-7B-Instruct-Q4_K_M.gguf',
    author: 'Qwen',
    description: 'Mô hình thị giác máy học đa phương tiện hàng đầu. Nhận diện hình ảnh, sơ đồ thiết kế UI, OCR ảnh tài liệu và trích xuất code trực tiếp từ ảnh chụp.',
    parameterSize: '7B',
    quantization: 'Q4_K_M',
    fileSizeBytes: 4_700_000_000,
    totalLayers: 28,
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2-VL-7B-Instruct-GGUF',
    tags: ['Vision', 'OCR', 'Image-to-Code', 'Multimodal'],
    category: 'vision',
  },
  {
    id: 'minicpm-v-2.6-q4',
    name: 'MiniCPM-V 2.6 (8B Vision)',
    filename: 'MiniCPM-V-2_6-Q4_K_M.gguf',
    author: 'OpenBMB',
    description: 'Mô hình thị giác nổi tiếng xử lý độ phân giải cao và video clip, chất lượng OCR vượt trội cho văn bản tiếng Việt và biểu đồ.',
    parameterSize: '8B',
    quantization: 'Q4_K_M',
    fileSizeBytes: 5_200_000_000,
    totalLayers: 32,
    downloadUrl: 'https://huggingface.co/openbmb/MiniCPM-V-2_6-gguf',
    tags: ['Vision', 'OCR', 'High-Res'],
    category: 'vision',
  },

  // Fast Conversational & General
  {
    id: 'qwen2.5-3b-instruct-q4',
    name: 'Qwen 2.5 3B Instruct',
    filename: 'Qwen2.5-3B-Instruct-Q4_K_M.gguf',
    author: 'Qwen',
    description: 'Mô hình đa nhiệm siêu nhanh, hỗ trợ hơn 29 ngôn ngữ bao gồm tiếng Việt. Hoàn hảo cho chat thường ngày và tóm tắt văn bản.',
    parameterSize: '3B',
    quantization: 'Q4_K_M',
    fileSizeBytes: 2_100_000_000,
    totalLayers: 28,
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF',
    tags: ['Fast', 'Low VRAM', 'Chat', '100% GPU'],
    category: 'general',
  },
  {
    id: 'llama-3.2-3b-instruct-q4',
    name: 'Llama 3.2 3B Instruct',
    filename: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    author: 'Meta',
    description: 'Mô hình 3B chính thức mới nhất của Meta. Khả năng tuân thủ chỉ dẫn prompt cực tốt, mượt mà trên GPU phổ thông.',
    parameterSize: '3B',
    quantization: 'Q4_K_M',
    fileSizeBytes: 2_200_000_000,
    totalLayers: 28,
    downloadUrl: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF',
    tags: ['Meta', 'General', 'Compact', '100% GPU'],
    category: 'general',
  },
  {
    id: 'llama-3.2-1b-instruct-q4',
    name: 'Llama 3.2 1B Instruct',
    filename: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    author: 'Meta',
    description: 'Mô hình 1B siêu tốc độ (~80 token/giây), chỉ chiếm ~1.3GB VRAM, thích hợp làm model route hoặc agent kiểm tra cú pháp nhanh.',
    parameterSize: '1B',
    quantization: 'Q4_K_M',
    fileSizeBytes: 850_000_000,
    totalLayers: 16,
    downloadUrl: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF',
    tags: ['Meta', 'Ultra-Fast', '1B'],
    category: 'general',
  },
  {
    id: 'gemma-2-2b-instruct-q4',
    name: 'Gemma 2 2B Instruct',
    filename: 'gemma-2-2b-it-Q4_K_M.gguf',
    author: 'Google',
    description: 'Mô hình nhỏ gọn của Google DeepMind với kiến trúc sliding window attention, chất lượng đàm thoại vượt trội so với kích cỡ 2B.',
    parameterSize: '2B',
    quantization: 'Q4_K_M',
    fileSizeBytes: 1_650_000_000,
    totalLayers: 26,
    downloadUrl: 'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF',
    tags: ['Google', 'DeepMind', '100% GPU'],
    category: 'general',
  },
  {
    id: 'gemma-2-9b-instruct-q4',
    name: 'Gemma 2 9B Instruct',
    filename: 'gemma-2-9b-it-Q4_K_M.gguf',
    author: 'Google',
    description: 'Mô hình 9B danh giá của Google DeepMind, đánh bại nhiều mô hình 13B và 20B trên bảng xếp hạng LMSYS Chatbot Arena.',
    parameterSize: '9B',
    quantization: 'Q4_K_M',
    fileSizeBytes: 5_800_000_000,
    totalLayers: 42,
    downloadUrl: 'https://huggingface.co/bartowski/gemma-2-9b-it-GGUF',
    tags: ['Google', 'Arena-Top', 'High-Quality'],
    category: 'general',
  },
  {
    id: 'mistral-7b-instruct-v0.3-q4',
    name: 'Mistral 7B Instruct v0.3',
    filename: 'Mistral-7B-Instruct-v0.3-Q4_K_M.gguf',
    author: 'Mistral AI',
    description: 'Mô hình 7B kinh điển nổi tiếng với khả năng gọi hàm (function calling) và hiểu logic hệ thống.',
    parameterSize: '7B',
    quantization: 'Q4_K_M',
    fileSizeBytes: 4_400_000_000,
    totalLayers: 32,
    downloadUrl: 'https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF',
    tags: ['Mistral', 'Versatile', 'Tool-Calling'],
    category: 'general',
  },
  {
    id: 'phi-3.5-mini-instruct-q4',
    name: 'Phi 3.5 Mini Instruct (3.8B)',
    filename: 'Phi-3.5-mini-instruct-Q4_K_M.gguf',
    author: 'Microsoft',
    description: 'Mô hình nhỏ thông minh của Microsoft với ngữ cảnh 128K token, mạnh về suy luận toán học và logic.',
    parameterSize: '3.8B',
    quantization: 'Q4_K_M',
    fileSizeBytes: 2_400_000_000,
    totalLayers: 32,
    downloadUrl: 'https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF',
    tags: ['Microsoft', '128k Context', 'Math'],
    category: 'general',
  },
  {
    id: 'vistral-7b-chat-q4',
    name: 'Vistral 7B Chat (Vietnamese)',
    filename: 'vistral-7b-chat-Q4_K_M.gguf',
    author: 'VietAI',
    description: 'Mô hình được tối ưu riêng biệt cho tiếng Việt và văn hóa Việt Nam, hành văn trôi chảy tự nhiên.',
    parameterSize: '7B',
    quantization: 'Q4_K_M',
    fileSizeBytes: 4_350_000_000,
    totalLayers: 32,
    downloadUrl: 'https://huggingface.co/Viet-AI/vistral-7b-chat-gguf',
    tags: ['Vietnamese', 'VietAI', 'Natural-Lang'],
    category: 'general',
  },
];

export class ModelHubService {
  /**
   * Dynamically evaluate compatibility based on actual model parameters,
   * totalLayers and chosen gpuLayers (-ngl).
   */
  public static evaluateCompatibility(
    model: ModelHubItem,
    vramTotalMb = 4096,
    vramFreeMb = 3600,
    chosenGpuLayers?: number
  ): ModelCompatibility {
    const sizeMb = Math.round(model.fileSizeBytes / (1024 * 1024));
    const totalLayers = model.totalLayers || 32;
    const ngl = chosenGpuLayers !== undefined ? chosenGpuLayers : (sizeMb <= 2600 ? totalLayers : 21);

    // Calculate approximate VRAM consumption based on offloaded layers
    const layerMb = (sizeMb * 0.9) / totalLayers;
    const kvCacheMb = 350; // KV cache for 4096 ctx
    const estimatedVramMb = Math.round(ngl === 0 ? 0 : (ngl * layerMb) + kvCacheMb);
    const estimatedRamMb = Math.round(Math.max(300, sizeMb - (ngl * layerMb) + 300));

    // Case 1: Exceeds total available VRAM -> Risk of OOM
    if (estimatedVramMb > vramTotalMb) {
      return {
        status: 'exceeds',
        statusLabel: 'Exceeds VRAM (OOM Risk)',
        badgeColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
        recommendedNgl: Math.floor((vramTotalMb - 800) / layerMb),
        estimatedVramMb,
        estimatedRamMb,
        estimatedSpeed: 'Slow (Pagefile)',
        description: `Cần ~${estimatedVramMb} MB VRAM nhưng GPU chỉ có ${vramTotalMb} MB. Hãy hạ số GPU layers (-ngl) xuống để tránh tràn bộ nhớ.`,
      };
    }

    // Case 2: 0 layers on GPU -> CPU Only
    if (ngl === 0) {
      return {
        status: 'cpu-only',
        statusLabel: 'CPU Only (0 Layers GPU)',
        badgeColor: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
        recommendedNgl: 0,
        estimatedVramMb: 0,
        estimatedRamMb: sizeMb + 400,
        estimatedSpeed: '4 - 7 tokens/s',
        description: 'Chạy hoàn toàn trên CPU và RAM hệ thống, không dùng tài nguyên GPU.',
      };
    }

    // Case 3: 100% of layers on GPU
    if (ngl >= totalLayers) {
      return {
        status: 'full-gpu',
        statusLabel: 'Full GPU Offload (100% VRAM)',
        badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        recommendedNgl: totalLayers,
        estimatedVramMb,
        estimatedRamMb: 400,
        estimatedSpeed: '45 - 65 tokens/s',
        description: `Tất cả ${totalLayers} layers nằm trọn trong VRAM card GTX 1650. Tốc độ cực nhanh, mượt mà và không tốn RAM.`,
      };
    }

    // Case 4: Hybrid GPU + CPU
    const cpuLayers = totalLayers - ngl;
    return {
      status: 'hybrid',
      statusLabel: `Hybrid: GPU (${ngl}) + CPU (${cpuLayers})`,
      badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      recommendedNgl: ngl,
      estimatedVramMb,
      estimatedRamMb,
      estimatedSpeed: '12 - 18 tokens/s',
      description: `Offload ${ngl}/${totalLayers} layers vào CUDA GPU (~${estimatedVramMb} MB) và ${cpuLayers} layers còn lại trên CPU+RAM với Flash Attention.`,
    };
  }
}

export interface ParsedModelInfo {
  name: string;
  author: string;
  parameterSize: string;
  quantization: string;
  category: 'coding' | 'reasoning' | 'vision' | 'general';
  totalLayers: number;
  estimatedGb: number;
  fileSizeBytes: number;
  normalizedUrl: string;
}

/**
 * Automatically parse model metadata (parameter size, quantization, author, category, layers, size)
 * directly from a Hugging Face / GGUF download URL or model name.
 */
export function parseModelMetadata(url: string, manualName?: string): ParsedModelInfo {
  const cleanUrl = (url || '').trim();
  let normalizedUrl = cleanUrl;
  if (normalizedUrl.includes('huggingface.co/') && normalizedUrl.includes('/blob/')) {
    normalizedUrl = normalizedUrl.replace('/blob/', '/resolve/');
  }

  // Extract filename or path segment
  const urlPath = cleanUrl.split('?')[0].split('#')[0];
  const segments = urlPath.split('/').filter(Boolean);
  const rawFilename = segments[segments.length - 1] || '';
  const isDirectGguf = rawFilename.toLowerCase().endsWith('.gguf');
  const baseNameFromUrl = isDirectGguf ? rawFilename.slice(0, -5) : rawFilename;

  // Extract author from Hugging Face URL
  let author = 'HuggingFace';
  const hfParts = cleanUrl.replace(/^https?:\/\/(?:www\.)?huggingface\.co\//i, '').split('/');
  if (hfParts.length >= 1 && hfParts[0] && !['models', 'datasets', 'spaces'].includes(hfParts[0].toLowerCase())) {
    author = hfParts[0];
  }

  // Combined string for heuristic regex matching
  const searchStr = `${cleanUrl} ${manualName || ''}`.replace(/[\/\\_\-\.]/g, ' ');

  // 1. Parameter size (e.g. 0.5B, 1.5B, 3B, 7B, 8B, 9B, 14B, 32B, 70B)
  let parameterSize = '7B';
  const paramMatch = searchStr.match(/\b(\d+(?:\.\d+)?)\s*[bB]\b/);
  if (paramMatch) {
    parameterSize = `${paramMatch[1].toUpperCase()}B`;
  }

  // 2. Quantization (e.g. Q4_K_M, Q8_0, Q4_0, Q6_K, IQ4_XS, BF16, FP16)
  let quantization = 'Q4_K_M';
  const quantMatch = cleanUrl.match(/(?:^|[\/\-_.\s])((?:I?Q[0-9]_[A-Z0-9_]+)|(?:Q[0-9]_[0-9])|(?:BF16)|(?:FP16)|(?:F16)|(?:F32))(?:[\/\-_.\s]|$|\.gguf)/i)
    || searchStr.match(/\b((?:I?Q[0-9]_[A-Z0-9_]+)|(?:Q[0-9]_[0-9])|(?:BF16)|(?:FP16)|(?:F16)|(?:F32))\b/i);
  if (quantMatch) {
    quantization = quantMatch[1].toUpperCase();
  }

  // 3. Category
  let category: 'coding' | 'reasoning' | 'vision' | 'general' = 'general';
  const lowerSearch = searchStr.toLowerCase();
  if (/coder|coding|code|starcoder|dev\b/.test(lowerSearch)) {
    category = 'coding';
  } else if (/r1|reason|math|logic|think/.test(lowerSearch)) {
    category = 'reasoning';
  } else if (/vl|vision|ocr|cpm|multimodal|llava/.test(lowerSearch)) {
    category = 'vision';
  }

  // 4. Layers
  const numB = parseFloat(parameterSize) || 7;
  let totalLayers = 32;
  if (numB <= 2) totalLayers = 24;
  else if (numB <= 4) totalLayers = 28;
  else if (numB <= 9) totalLayers = 32;
  else if (numB <= 16) totalLayers = 48;
  else if (numB <= 36) totalLayers = 64;
  else totalLayers = 80;

  // 5. Estimated File Size
  let bytesPerParam = 0.65; // Baseline for Q4 in GB per billion params
  const qUpper = quantization.toUpperCase();
  if (qUpper.includes('Q8') || qUpper.includes('F8')) bytesPerParam = 1.1;
  else if (qUpper.includes('Q6')) bytesPerParam = 0.85;
  else if (qUpper.includes('Q5')) bytesPerParam = 0.75;
  else if (qUpper.includes('Q3')) bytesPerParam = 0.52;
  else if (qUpper.includes('Q2') || qUpper.includes('IQ2')) bytesPerParam = 0.4;
  else if (qUpper.includes('16')) bytesPerParam = 2.1;

  const estimatedGb = Math.max(0.5, Math.round(numB * bytesPerParam * 10) / 10);
  const fileSizeBytes = Math.round(estimatedGb * 1024 * 1024 * 1024);

  // 6. Name
  let name = (manualName || '').trim();
  if (!name) {
    if (baseNameFromUrl) {
      name = baseNameFromUrl
        .replace(new RegExp(`[_-]?${quantization}`, 'i'), '')
        .replace(/[_-]/g, ' ')
        .trim();
    } else {
      name = `Custom ${parameterSize} ${quantization}`;
    }
  }

  return {
    name,
    author,
    parameterSize,
    quantization,
    category,
    totalLayers,
    estimatedGb,
    fileSizeBytes,
    normalizedUrl,
  };
}
