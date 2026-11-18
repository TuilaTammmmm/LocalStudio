import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { Workspace, ChatSession, ChatMessage, ProviderConfig, LocalSkill, AppSettings } from './types.js';
import type { ModelHubItem } from './model-hub.js';

interface AppDatabase {
  workspaces: Record<string, Workspace>;
  sessions: Record<string, ChatSession>;
  messages: Record<string, ChatMessage[]>; // Keyed by sessionId
  providers: Record<string, ProviderConfig>;
  skillFolders: string[];
  skills: Record<string, LocalSkill>;
  customHubModels?: Record<string, ModelHubItem>;
  settings?: AppSettings;
  activeWorkspaceId: string | null;
  activeSessionId: string | null;
  activeProviderId: string | null;
  deletedProviderIds?: string[];
}

const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: 'local-llama',
    name: 'Local llama.cpp (CUDA + CPU)',
    type: 'llama-server',
    baseUrl: 'http://127.0.0.1:8080/v1',
    models: [],
    selectedModel: '',
    isDefault: true,
    enabled: true,
  },
  {
    id: 'ollama-local',
    name: 'Ollama (Local Port 11434)',
    type: 'ollama',
    baseUrl: 'http://127.0.0.1:11434/v1',
    models: [],
    selectedModel: '',
    isDefault: false,
    enabled: false,
  },
  {
    id: 'lmstudio-local',
    name: 'LM Studio (Local Port 1234)',
    type: 'custom',
    baseUrl: 'http://127.0.0.1:1234/v1',
    models: [],
    selectedModel: '',
    isDefault: false,
    enabled: false,
  },
  {
    id: 'freellm-api',
    name: 'FreeLLM API (High-Performance)',
    type: 'freellm',
    baseUrl: 'https://api.freellm.example/v1',
    apiKey: '',
    models: [],
    selectedModel: '',
    isDefault: false,
    enabled: false,
  },
];

export class DatabaseService {
  private dataDir: string;
  private dbFilePath: string;
  private db: AppDatabase;

  constructor(dataDir = path.resolve(process.cwd(), '.data')) {
    this.dataDir = dataDir;
    this.dbFilePath = path.join(this.dataDir, 'database.json');
    this.db = this.init();
  }

  private init(): AppDatabase {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    if (fs.existsSync(this.dbFilePath)) {
      try {
        const raw = fs.readFileSync(this.dbFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed.customHubModels) {
          parsed.customHubModels = {};
        }
        if (!parsed.deletedProviderIds) {
          parsed.deletedProviderIds = [];
        }
        for (const dp of DEFAULT_PROVIDERS) {
          if (!parsed.providers[dp.id] && !parsed.deletedProviderIds.includes(dp.id)) {
            parsed.providers[dp.id] = dp;
          }
        }
        if (parsed.providers && parsed.providers['local-llama']) {
          const modelsDir = (parsed.settings && parsed.settings.modelsDir) || path.resolve(process.cwd(), 'models');
          let files: string[] = [];
          if (fs.existsSync(modelsDir)) {
            try {
              files = fs.readdirSync(modelsDir)
                .filter((f) => f.toLowerCase().endsWith('.gguf'));
            } catch {}
          }
          parsed.providers['local-llama'].models = files;
          if (!files.includes(parsed.providers['local-llama'].selectedModel)) {
            parsed.providers['local-llama'].selectedModel = files[0] || '';
          }
          this.persist(parsed);
        }
        return parsed;
      } catch (err) {
        console.error('Failed to parse database file, resetting with defaults:', err);
      }
    }

    const initialDb: AppDatabase = {
      workspaces: {},
      sessions: {},
      messages: {},
      providers: Object.fromEntries(DEFAULT_PROVIDERS.map((p) => [p.id, p])),
      skillFolders: [],
      skills: {},
      activeWorkspaceId: null,
      activeSessionId: null,
      activeProviderId: 'local-llama',
    };

    this.persist(initialDb);
    return initialDb;
  }

  public getModelsDir(): string {
    const custom = this.db?.settings?.modelsDir;
    if (custom && fs.existsSync(custom)) {
      return custom;
    }
    if (process.env.LOCALAI_MODELS_DIR && fs.existsSync(process.env.LOCALAI_MODELS_DIR)) {
      return process.env.LOCALAI_MODELS_DIR;
    }
    // Permanent user directory, NEVER inside Temp
    const home = process.env.USERPROFILE || process.env.HOME || os.homedir() || 'C:\\';
    const defaultDir = path.join(home, 'LocalAI', 'models');

    if (!fs.existsSync(defaultDir)) {
      try {
        fs.mkdirSync(defaultDir, { recursive: true });
      } catch {}
    }
    return defaultDir;
  }

  public setModelsDir(dir: string): string {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!this.db.settings) {
      this.db.settings = {};
    }
    this.db.settings.modelsDir = dir;
    this.persist();
    const localLlama = this.db.providers['local-llama'];
    if (localLlama) {
      this.syncLocalModels(localLlama);
    }
    return dir;
  }

  private persist(data = this.db): void {
    const tmpPath = `${this.dbFilePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, this.dbFilePath);
  }

  // Workspaces
  public listWorkspaces(): Workspace[] {
    return Object.values(this.db.workspaces).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public getWorkspace(id: string): Workspace | undefined {
    return this.db.workspaces[id];
  }

  public saveWorkspace(workspace: Workspace): Workspace {
    // If a workspace with the exact folder path already exists, update its name instead of duplicating
    const normalizedTarget = path.normalize(workspace.folderPath).toLowerCase();
    const existing = Object.values(this.db.workspaces).find(
      (w) => w.id !== workspace.id && path.normalize(w.folderPath).toLowerCase() === normalizedTarget
    );
    if (existing) {
      existing.name = workspace.name;
      existing.updatedAt = Date.now();
      this.persist();
      return existing;
    }

    this.db.workspaces[workspace.id] = { ...workspace, updatedAt: Date.now() };
    if (!this.db.activeWorkspaceId) {
      this.db.activeWorkspaceId = workspace.id;
    }
    this.persist();
    return this.db.workspaces[workspace.id];
  }

  public deleteWorkspace(id: string): void {
    delete this.db.workspaces[id];
    // Delete associated sessions
    for (const [sessId, session] of Object.entries(this.db.sessions)) {
      if (session.workspaceId === id) {
        delete this.db.sessions[sessId];
        delete this.db.messages[sessId];
      }
    }
    if (this.db.activeWorkspaceId === id) {
      const remaining = Object.keys(this.db.workspaces);
      this.db.activeWorkspaceId = remaining.length > 0 ? remaining[0] : null;
    }
    this.persist();
  }

  // Sessions
  public listSessions(workspaceId?: string): ChatSession[] {
    const sessions = Object.values(this.db.sessions);
    if (!workspaceId) return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    if (workspaceId === 'no-project') {
      return sessions
        .filter((s) => !s.workspaceId || s.workspaceId === 'no-project')
        .sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return sessions
      .filter((s) => s.workspaceId === workspaceId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public getSession(id: string): ChatSession | undefined {
    return this.db.sessions[id];
  }

  public saveSession(session: ChatSession): ChatSession {
    this.db.sessions[session.id] = { ...session, updatedAt: Date.now() };
    this.db.activeSessionId = session.id;
    this.persist();
    return this.db.sessions[session.id];
  }

  public deleteSession(id: string): void {
    delete this.db.sessions[id];
    delete this.db.messages[id];
    if (this.db.activeSessionId === id) {
      this.db.activeSessionId = null;
    }
    this.persist();
  }

  // Messages
  public getMessages(sessionId: string): ChatMessage[] {
    return this.db.messages[sessionId] || [];
  }

  public addMessage(message: ChatMessage): ChatMessage {
    if (!this.db.messages[message.sessionId]) {
      this.db.messages[message.sessionId] = [];
    }
    this.db.messages[message.sessionId].push(message);
    if (this.db.sessions[message.sessionId]) {
      this.db.sessions[message.sessionId].updatedAt = Date.now();
    }
    this.persist();
    return message;
  }

  // Providers
  public syncLocalModels(provider: ProviderConfig): void {
    if (provider.id === 'local-llama' || provider.type === 'llama-server') {
      const home = process.env.USERPROFILE || process.env.HOME || os.homedir() || 'C:\\';
      const candidateDirs = [
        this.getModelsDir(),
        path.join(home, 'LocalAI', 'models'),
        path.resolve(process.cwd(), 'models'),
      ];

      const foundFiles = new Set<string>();
      for (const dir of candidateDirs) {
        if (dir && fs.existsSync(dir)) {
          try {
            const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.gguf'));
            for (const f of files) {
              foundFiles.add(f);
            }
          } catch {}
        }
      }

      const files = Array.from(foundFiles);
      provider.models = files;
      if (!files.includes(provider.selectedModel)) {
        provider.selectedModel = files[0] || '';
      }
      if (this.db) {
        this.persist();
      }
    }
  }

  public listProviders(): ProviderConfig[] {
    const list = Object.values(this.db.providers);
    for (const p of list) {
      if (p.id === 'local-llama') {
        this.syncLocalModels(p);
      }
    }
    return list;
  }

  public getProvider(id: string): ProviderConfig | undefined {
    const provider = this.db.providers[id];
    if (provider && provider.id === 'local-llama') {
      this.syncLocalModels(provider);
    }
    return provider;
  }

  public saveProvider(provider: ProviderConfig): ProviderConfig {
    this.db.providers[provider.id] = provider;
    if (provider.isDefault) {
      for (const key of Object.keys(this.db.providers)) {
        if (key !== provider.id) {
          this.db.providers[key].isDefault = false;
        }
      }
      this.db.activeProviderId = provider.id;
    }
    this.persist();
    return provider;
  }

  public deleteProvider(id: string): boolean {
    if (id === 'local-llama') {
      return false; // Embedded local llama cannot be deleted
    }
    if (!this.db.deletedProviderIds) {
      this.db.deletedProviderIds = [];
    }
    if (!this.db.deletedProviderIds.includes(id)) {
      this.db.deletedProviderIds.push(id);
    }
    delete this.db.providers[id];
    if (this.db.activeProviderId === id) {
      this.db.activeProviderId = 'local-llama';
    }
    this.persist();
    return true;
  }

  // Custom Hub Models (User-added from Hugging Face or URL)
  public listCustomHubModels(): ModelHubItem[] {
    return Object.values(this.db.customHubModels || {});
  }

  public saveCustomHubModel(model: ModelHubItem): ModelHubItem {
    if (!this.db.customHubModels) {
      this.db.customHubModels = {};
    }
    this.db.customHubModels[model.id] = model;
    this.persist();
    return model;
  }

  public deleteCustomHubModel(id: string): boolean {
    if (this.db.customHubModels && this.db.customHubModels[id]) {
      delete this.db.customHubModels[id];
      this.persist();
      return true;
    }
    return false;
  }

  // Skill Folders
  public listSkillFolders(): string[] {
    return this.db.skillFolders;
  }

  public addSkillFolder(folderPath: string): string[] {
    if (!this.db.skillFolders.includes(folderPath)) {
      this.db.skillFolders.push(folderPath);
      this.persist();
    }
    return this.db.skillFolders;
  }

  public removeSkillFolder(folderPath: string): string[] {
    this.db.skillFolders = this.db.skillFolders.filter((f) => f !== folderPath);
    this.persist();
    return this.db.skillFolders;
  }

  // Active state
  public getActiveState() {
    return {
      activeWorkspaceId: this.db.activeWorkspaceId,
      activeSessionId: this.db.activeSessionId,
      activeProviderId: this.db.activeProviderId,
    };
  }

  public setActiveState(state: { activeWorkspaceId?: string; activeSessionId?: string; activeProviderId?: string }) {
    if (state.activeWorkspaceId !== undefined) this.db.activeWorkspaceId = state.activeWorkspaceId;
    if (state.activeSessionId !== undefined) this.db.activeSessionId = state.activeSessionId;
    if (state.activeProviderId !== undefined) this.db.activeProviderId = state.activeProviderId;
    this.persist();
  }

  // Model-specific preset configurations
  public getModelConfig(filename: string): import('./types.js').ModelPresetConfig | undefined {
    return this.db.settings?.modelConfigs?.[filename];
  }

  public saveModelConfig(filename: string, config: import('./types.js').ModelPresetConfig): void {
    if (!this.db.settings) {
      this.db.settings = {};
    }
    if (!this.db.settings.modelConfigs) {
      this.db.settings.modelConfigs = {};
    }
    this.db.settings.modelConfigs[filename] = {
      ...this.db.settings.modelConfigs[filename],
      ...config,
      updatedAt: Date.now(),
    };
    this.persist();
  }

  public deleteModelConfig(filename: string): void {
    if (this.db.settings?.modelConfigs?.[filename]) {
      delete this.db.settings.modelConfigs[filename];
      this.persist();
    }
  }
}
