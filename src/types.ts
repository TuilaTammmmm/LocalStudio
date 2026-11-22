/**
 * Core Data Types & Interfaces for Local AI Core Backend
 */

export interface Workspace {
  id: string;
  name: string;
  folderPath: string; // Absolute path to the folder on machine
  systemPrompt?: string;
  pinnedFiles: string[]; // List of relative file paths in workspace
  createdAt: number;
  updatedAt: number;
}

export interface ChatSession {
  id: string;
  workspaceId?: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  thinking?: string; // DeepSeek-R1 / Qwen reasoning steps
  tokensUsed?: number;
  tokensPerSec?: number; // LM Studio style inference speed
  timeToFirstTokenMs?: number; // Time to First Token
  modelUsed?: string;
  tokenBreakdown?: {
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
  };
  createdAt: number;
}

export type ProviderType = 'llama-server' | 'freellm' | 'openai' | 'ollama' | 'custom';

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKey?: string;
  models: string[];
  selectedModel: string;
  customHeaders?: Record<string, string>;
  isDefault: boolean;
  enabled: boolean;
  gpuLayers?: number;
  contextSize?: number;
  cpuThreads?: number;
  flashAttention?: boolean;
}

export interface LocalSkill {
  id: string;
  name: string;
  description: string;
  dirPath: string;
  skillFilePath: string; // Path to SKILL.md
  enabled: boolean;
  safeExecution: boolean; // Ask confirmation before running scripts
  systemInstructions: string;
  triggers: string[]; // e.g. ["/code-review", "review"]
}

export interface HardwareStats {
  gpuName: string;
  vramTotalMb: number;
  vramUsedMb: number;
  vramFreeMb: number;
  gpuUtilPercent: number;
  cpuPercent: number;
  ramTotalMb: number;
  ramUsedMb: number;
  ramFreeMb: number;
}

export interface LlamaServerConfig {
  binaryPath: string;
  modelPath: string;
  port: number;
  host: string;
  ngl: number; // GPU layers offload (e.g. 20 for GTX 1650 4GB)
  ctxSize: number; // Context size e.g. 4096
  threads: number; // CPU threads e.g. 4
  flashAttention: boolean;
  kvCacheQuant?: 'f16' | 'q8_0' | 'q4_0';
}

export interface ModelPresetConfig {
  temperature?: number;
  topP?: number;
  repeatPenalty?: number;
  gpuLayers?: number;
  contextSize?: number;
  systemPromptMode?: 'standard' | 'merge_to_user' | 'none';
  customInstructions?: string;
  updatedAt?: number;
}

export interface AppSettings {
  modelsDir?: string;
  customModelDirs?: string[];
  modelConfigs?: Record<string, ModelPresetConfig>;
}
