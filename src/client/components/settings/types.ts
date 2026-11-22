import type { ModelHubItem, ModelCompatibility } from '../../../model-hub.js';
import type { ProviderConfig, HardwareStats, LocalSkill } from '../../../types.js';
import type { Language, Translations } from '../../i18n.js';

export type SettingsCategory =
  | 'models'
  | 'cuda'
  | 'hardware'
  | 'inference'
  | 'sampling'
  | 'providers'
  | 'skills'
  | 'storage'
  | 'appearance'
  | 'shortcuts'
  | 'rag'
  | 'about';

export interface EnrichedModelItem extends ModelHubItem {
  compatibility: ModelCompatibility;
}

export interface ModelConfigFileState {
  temperature: number;
  topP: number;
  repeatPenalty: number;
  gpuLayers: number;
  contextSize: number;
  systemPromptMode: 'standard' | 'merge_to_user' | 'none';
  description?: string;
}

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  skills: LocalSkill[];
  skillFolders: string[];
  providers: ProviderConfig[];
  hardwareStats: HardwareStats | null;
  onAddSkillFolder: (folderPath: string) => void;
  onSaveProvider: (provider: ProviderConfig) => void;
  onDeleteProvider?: (id: string) => Promise<void>;
  onSyncProvider: (id: string) => Promise<any>;
  lang?: Language;
  t?: Translations;
  onToggleLanguage?: (l: Language) => void;
}
