import fs from 'node:fs';
import path from 'node:path';
import type { Workspace, ChatSession, ChatMessage, ProviderConfig, LocalSkill } from './types.js';
import type { ModelHubItem } from './model-hub.js';

interface AppDatabase {
  workspaces: Record<string, Workspace>;
  sessions: Record<string, ChatSession>;
  messages: Record<string, ChatMessage[]>; // Keyed by sessionId
  providers: Record<string, ProviderConfig>;
  skillFolders: string[];
  skills: Record<string, LocalSkill>;
  customHubModels?: Record<string, ModelHubItem>;
  activeWorkspaceId: string | null;
  activeSessionId: string | null;
  activeProviderId: string | null;
}

const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: 'local-llama',
    name: 'Local llama.cpp (CUDA + CPU)',
    type: 'llama-server',
    baseUrl: 'http://127.0.0.1:8080/v1',
    models: ['DeepSeek-R1-Distill-Qwen-8B-Q4_K_M.gguf', 'Qwen2.5-3B-Instruct-Q4_K_M.gguf'],
    selectedModel: 'DeepSeek-R1-Distill-Qwen-8B-Q4_K_M.gguf',
    isDefault: true,
    enabled: true,
  },
  {
    id: 'ollama-local',
    name: 'Ollama (Local Port 11434)',
    type: 'ollama',
    baseUrl: 'http://127.0.0.1:11434/v1',
    models: ['llama3:latest', 'qwen2.5:latest'],
    selectedModel: 'llama3:latest',
    isDefault: false,
    enabled: true,
  },
  {
    id: 'lmstudio-local',
    name: 'LM Studio (Local Port 1234)',
    type: 'custom',
    baseUrl: 'http://127.0.0.1:1234/v1',
    models: ['qwen2.5-coder-7b-instruct', 'meta-llama-3.1-8b-instruct'],
    selectedModel: 'qwen2.5-coder-7b-instruct',
    isDefault: false,
    enabled: true,
  },
  {
    id: 'freellm-api',
    name: 'FreeLLM API (High-Performance)',
    type: 'freellm',
    baseUrl: 'https://api.freellm.example/v1',
    apiKey: '',
    models: ['llama-3.3-70b-instruct', 'deepseek-v3', 'qwen-2.5-72b'],
    selectedModel: 'llama-3.3-70b-instruct',
    isDefault: false,
    enabled: true,
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
        for (const dp of DEFAULT_PROVIDERS) {
          if (!parsed.providers[dp.id]) {
            parsed.providers[dp.id] = dp;
          }
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
  public listProviders(): ProviderConfig[] {
    return Object.values(this.db.providers);
  }

  public getProvider(id: string): ProviderConfig | undefined {
    return this.db.providers[id];
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
    if (this.db.providers[id]) {
      delete this.db.providers[id];
      if (this.db.activeProviderId === id) {
        this.db.activeProviderId = 'local-llama';
      }
      this.persist();
      return true;
    }
    return false;
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
}
