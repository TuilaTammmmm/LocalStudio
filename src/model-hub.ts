export interface ModelHubItem {
  id: string;
  name: string;
  author: string;
  description: string;
  parameterSize: string; // e.g. "3B", "7B", "8B", "14B"
  quantization: string;  // e.g. "Q4_K_M", "Q8_0"
  fileSizeBytes: number;
  downloadUrl: string;
  tags: string[];
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
  {
    id: 'qwen2.5-3b-instruct-q4',
    name: 'Qwen 2.5 3B Instruct',
    author: 'Qwen',
    description: 'Ultra-fast, multilingual, lightweight model. Ideal for instant chat and low-latency workflows.',
    parameterSize: '3B',
    quantization: 'Q4_K_M',
    fileSizeBytes: 2_100_000_000,
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF',
    tags: ['Fast', 'Low VRAM', 'Chat', '100% GPU'],
  },
  {
    id: 'deepseek-r1-distill-qwen-8b-q4',
    name: 'DeepSeek-R1 Distill Qwen 8B',
    author: 'DeepSeek',
    description: 'State-of-the-art open reasoning model. Produces detailed chain-of-thought (<think>) for complex problems.',
    parameterSize: '8B',
    quantization: 'Q4_K_M',
    fileSizeBytes: 4_900_000_000,
    downloadUrl: 'https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-8B-GGUF',
    tags: ['Reasoning', 'Math', 'Logic', 'Thinking'],
  },
  {
    id: 'qwen2.5-coder-7b-instruct-q4',
    name: 'Qwen 2.5 Coder 7B Instruct',
    author: 'Qwen',
    description: 'Premier code generation & debugging model. Trained on 5.5T code tokens, rivaling larger coding models.',
    parameterSize: '7B',
    quantization: 'Q4_K_M',
    fileSizeBytes: 4_680_000_000,
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF',
    tags: ['Coding', 'Refactor', 'TypeScript', 'Python'],
  },
  {
    id: 'llama-3.2-3b-instruct-q4',
    name: 'Llama 3.2 3B Instruct',
    author: 'Meta',
    description: 'Compact official Meta model with strong instruction following and high responsiveness.',
    parameterSize: '3B',
    quantization: 'Q4_K_M',
    fileSizeBytes: 2_200_000_000,
    downloadUrl: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF',
    tags: ['Meta', 'General', 'Compact'],
  },
  {
    id: 'phi-3.5-mini-instruct-q4',
    name: 'Phi 3.5 Mini Instruct (3.8B)',
    author: 'Microsoft',
    description: 'High-reasoning small model by Microsoft with 128k context window support.',
    parameterSize: '3.8B',
    quantization: 'Q4_K_M',
    fileSizeBytes: 2_400_000_000,
    downloadUrl: 'https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF',
    tags: ['Microsoft', '128k Context', 'Math'],
  },
  {
    id: 'mistral-7b-instruct-v0.3-q4',
    name: 'Mistral 7B Instruct v0.3',
    author: 'Mistral AI',
    description: 'Renowned versatile 7B foundation model with native function calling support.',
    parameterSize: '7B',
    quantization: 'Q4_K_M',
    fileSizeBytes: 4_400_000_000,
    downloadUrl: 'https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF',
    tags: ['Mistral', 'Versatile', 'Tool-Calling'],
  },
];

export class ModelHubService {
  /**
   * LM Studio-style Hardware Compatibility Analyzer
   * Evaluates if model fits in GTX 1650 (4GB VRAM) and 8GB RAM
   */
  public static evaluateCompatibility(
    model: ModelHubItem,
    vramTotalMb = 4096,
    vramFreeMb = 3600
  ): ModelCompatibility {
    const sizeMb = Math.round(model.fileSizeBytes / (1024 * 1024));

    // Case 1: 3B models (< 2600 MB) -> 100% Full GPU Offload
    if (sizeMb <= 2600 && vramFreeMb >= 2200) {
      return {
        status: 'full-gpu',
        statusLabel: 'Full GPU Offload',
        badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        recommendedNgl: 99,
        estimatedVramMb: sizeMb + 300,
        estimatedRamMb: 400,
        estimatedSpeed: '45 - 60 tokens/s',
        description: 'Fits 100% inside your GTX 1650 VRAM. Maximum speed and silky smooth responsiveness.',
      };
    }

    // Case 2: 7B - 8B models (4200 - 5200 MB) -> Hybrid Offload (CUDA + CPU)
    if (sizeMb <= 5500) {
      // Usable VRAM with 1000MB safety buffer: ~2600MB
      // 21 layers on GPU (~2625MB), 11 layers on CPU
      return {
        status: 'hybrid',
        statusLabel: 'Hybrid: GPU + CPU',
        badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
        recommendedNgl: 21,
        estimatedVramMb: 2800,
        estimatedRamMb: 2600,
        estimatedSpeed: '9 - 14 tokens/s',
        description: 'Offloads 21 layers into CUDA GPU and 11 layers to CPU. Runs stably without OOM.',
      };
    }

    // Case 3: 14B or larger
    return {
      status: 'cpu-only',
      statusLabel: 'Heavy CPU Offload',
      badgeColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
      recommendedNgl: 8,
      estimatedVramMb: 3000,
      estimatedRamMb: 5000,
      estimatedSpeed: '3 - 6 tokens/s',
      description: 'Model exceeds 4GB VRAM. Runs primarily on CPU RAM with slower generation speed.',
    };
  }
}
