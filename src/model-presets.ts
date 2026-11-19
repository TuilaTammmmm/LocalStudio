import type { ModelPresetConfig } from './types.js';

export interface SmartPresetHeuristic {
  family: string;
  temperature: number;
  topP: number;
  repeatPenalty: number;
  systemPromptMode: 'standard' | 'merge_to_user' | 'none';
  recommendedNgl: number;
  recommendedCtxSize: number;
  description: string;
}

/**
 * Detect model family and compute intelligent hardware + inference presets
 * tailored for GTX 1650 (4GB VRAM) and system safety.
 */
export function getSmartModelPreset(filename: string, fileSizeBytes?: number): SmartPresetHeuristic {
  const lower = filename.toLowerCase();

  // 1. Detect Model Family
  let family = 'general';
  let temp = 0.3;
  let topP = 0.85;
  let repeatPenalty = 1.05;
  let systemPromptMode: 'standard' | 'merge_to_user' | 'none' = 'standard';
  let description = 'Cấu hình tiêu chuẩn, ổn định và chống bịa đặt.';

  if (lower.includes('gemma')) {
    family = 'gemma';
    temp = 0.6;
    topP = 0.90;
    repeatPenalty = 1.0; // Gemma 2 degrades with high repeat penalties
    systemPromptMode = 'merge_to_user'; // Gemma 2 has strict no-system turn template
    description = 'Gemma 2: Tự động gộp prompt hệ thống vào User, tắt phạt lặp để giữ logic mượt mà.';
  } else if (lower.includes('r1') || lower.includes('reason') || lower.includes('deepseek')) {
    family = 'deepseek-r1';
    temp = 0.6;
    topP = 0.95;
    repeatPenalty = 1.0; // Avoid breaking <think> tokens
    systemPromptMode = 'standard';
    description = 'DeepSeek-R1: Suy luận logic chuyên sâu, phản hồi ngắn gọn trọng tâm.';
  } else if (lower.includes('coder') || lower.includes('code') || lower.includes('starcoder')) {
    family = 'coding';
    temp = 0.2;
    topP = 0.85;
    repeatPenalty = 1.05;
    systemPromptMode = 'standard';
    description = 'Lập trình chuyên sâu: Nhiệt độ thấp (0.2) giúp sinh cú pháp code chuẩn xác, ít lỗi.';
  } else if (lower.includes('qwen')) {
    family = 'qwen';
    temp = 0.7;
    topP = 0.80;
    repeatPenalty = 1.05;
    systemPromptMode = 'standard';
    description = 'Qwen 2.5: Đa năng, hỗ trợ tiếng Việt xuất sắc, phản hồi tự nhiên.';
  } else if (lower.includes('llama')) {
    family = 'llama';
    temp = 0.4;
    topP = 0.90;
    repeatPenalty = 1.10;
    systemPromptMode = 'standard';
    description = 'Llama 3/3.1/3.2: Tuân thủ chỉ dẫn khắt khe, đàm thoại chuẩn mực.';
  }

  // 2. Compute Hardware Allocation for GTX 1650 (4GB VRAM limit)
  // Approximate based on filename or file size
  let recommendedNgl = 20;
  let recommendedCtxSize = 4096;

  const isSmall = lower.includes('1b') || lower.includes('1.5b') || lower.includes('2b') || lower.includes('3b') || (fileSizeBytes && fileSizeBytes < 2.5 * 1024 * 1024 * 1024);
  const isLarge = lower.includes('8b') || lower.includes('9b') || (fileSizeBytes && fileSizeBytes > 4.8 * 1024 * 1024 * 1024);

  if (isSmall) {
    // 1B - 3B fits entirely in 4GB VRAM; allocate 8192 context size safely for ample headspace
    recommendedNgl = 99;
    recommendedCtxSize = 8192;
  } else if (isLarge) {
    // 8B - 9B (~5.4GB) requires hybrid offloading: 18-20 layers into 4GB VRAM, rest on CPU RAM
    recommendedNgl = 18;
    recommendedCtxSize = 2048; // Safe context size to prevent host RAM starvation
  } else {
    // 7B (~4.5GB)
    recommendedNgl = 22;
    recommendedCtxSize = 4096;
  }

  return {
    family,
    temperature: temp,
    topP,
    repeatPenalty,
    systemPromptMode,
    recommendedNgl,
    recommendedCtxSize,
    description,
  };
}
