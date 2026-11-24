import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Database, { type Database as SQLiteDatabase } from 'better-sqlite3';
import type { Workspace, ChatSession, ChatMessage, ProviderConfig, LocalSkill, AppSettings, ModelPresetConfig } from './types.js';
import type { ModelHubItem } from './model-hub.js';

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
  private sqlite: SQLiteDatabase;

  constructor(customDataDir?: string) {
    if (customDataDir) {
      this.dataDir = customDataDir;
    } else {
      const home = process.env.USERPROFILE || process.env.HOME || os.homedir() || 'C:\\';
      const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(home, 'Library', 'Application Support') : path.join(home, '.config'));
      const persistentDir = path.join(appData, 'LocalAI', 'data');
      this.dataDir = persistentDir;
    }

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    this.dbFilePath = path.join(this.dataDir, 'localai.sqlite');
    this.sqlite = new Database(this.dbFilePath);

    // High performance and durability pragmas
    this.sqlite.pragma('journal_mode = WAL');
    this.sqlite.pragma('synchronous = NORMAL');
    this.sqlite.pragma('foreign_keys = ON');

    this.initSchema();
    this.migrateLegacyJson();
    this.seedDefaultProviders();
  }

  private initSchema(): void {
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        folder_path TEXT NOT NULL,
        system_prompt TEXT,
        pinned_files TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        thinking TEXT,
        tokens_used INTEGER,
        tokens_per_sec REAL,
        ttft_ms REAL,
        model_used TEXT,
        token_breakdown TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS providers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        base_url TEXT NOT NULL,
        api_key TEXT,
        models TEXT,
        selected_model TEXT,
        custom_headers TEXT,
        is_default INTEGER NOT NULL DEFAULT 0,
        enabled INTEGER NOT NULL DEFAULT 1,
        gpu_layers INTEGER,
        context_size INTEGER,
        cpu_threads INTEGER,
        flash_attention INTEGER
      );

      CREATE TABLE IF NOT EXISTS kv_store (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
    `);
  }

  private seedDefaultProviders(): void {
    const deleted = this.getKV<string[]>('deletedProviderIds') || [];
    const stmtCheck = this.sqlite.prepare('SELECT id FROM providers WHERE id = ?');
    const stmtInsert = this.sqlite.prepare(`
      INSERT INTO providers (id, name, type, base_url, api_key, models, selected_model, custom_headers, is_default, enabled, gpu_layers, context_size, cpu_threads, flash_attention)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTx = this.sqlite.transaction(() => {
      for (const dp of DEFAULT_PROVIDERS) {
        if (deleted.includes(dp.id)) continue;
        const exists = stmtCheck.get(dp.id);
        if (!exists) {
          stmtInsert.run(
            dp.id,
            dp.name,
            dp.type,
            dp.baseUrl,
            dp.apiKey || '',
            JSON.stringify(dp.models || []),
            dp.selectedModel || '',
            JSON.stringify(dp.customHeaders || {}),
            dp.isDefault ? 1 : 0,
            dp.enabled ? 1 : 0,
            dp.gpuLayers ?? null,
            dp.contextSize ?? null,
            dp.cpuThreads ?? null,
            dp.flashAttention ? 1 : 0
          );
        }
      }
    });
    insertTx();
  }

  private migrateLegacyJson(): void {
    // Check if legacy database.json exists
    const legacyDbFile = path.join(this.dataDir, 'database.json');
    if (!fs.existsSync(legacyDbFile)) return;

    try {
      const raw = fs.readFileSync(legacyDbFile, 'utf-8');
      const parsed = JSON.parse(raw);
      console.log('🔄 Migrating legacy database.json to SQLite...');

      const tx = this.sqlite.transaction(() => {
        // Workspaces
        if (parsed.workspaces) {
          const stmt = this.sqlite.prepare(`
            INSERT OR REPLACE INTO workspaces (id, name, folder_path, system_prompt, pinned_files, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);
          for (const ws of Object.values(parsed.workspaces) as Workspace[]) {
            stmt.run(
              ws.id,
              ws.name,
              ws.folderPath,
              ws.systemPrompt || null,
              JSON.stringify(ws.pinnedFiles || []),
              ws.createdAt || Date.now(),
              ws.updatedAt || Date.now()
            );
          }
        }

        // Sessions
        if (parsed.sessions) {
          const stmt = this.sqlite.prepare(`
            INSERT OR REPLACE INTO sessions (id, workspace_id, title, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
          `);
          for (const s of Object.values(parsed.sessions) as ChatSession[]) {
            stmt.run(s.id, s.workspaceId || null, s.title, s.createdAt || Date.now(), s.updatedAt || Date.now());
          }
        }

        // Messages
        if (parsed.messages) {
          const stmt = this.sqlite.prepare(`
            INSERT OR REPLACE INTO messages (id, session_id, role, content, thinking, tokens_used, tokens_per_sec, ttft_ms, model_used, token_breakdown, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const msgList of Object.values(parsed.messages) as ChatMessage[][]) {
            for (const m of msgList) {
              stmt.run(
                m.id,
                m.sessionId,
                m.role,
                m.content,
                m.thinking || null,
                m.tokensUsed ?? null,
                m.tokensPerSec ?? null,
                m.timeToFirstTokenMs ?? null,
                m.modelUsed || null,
                m.tokenBreakdown ? JSON.stringify(m.tokenBreakdown) : null,
                m.createdAt || Date.now()
              );
            }
          }
        }

        // Providers
        if (parsed.providers) {
          const stmt = this.sqlite.prepare(`
            INSERT OR REPLACE INTO providers (id, name, type, base_url, api_key, models, selected_model, custom_headers, is_default, enabled, gpu_layers, context_size, cpu_threads, flash_attention)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const p of Object.values(parsed.providers) as ProviderConfig[]) {
            stmt.run(
              p.id,
              p.name,
              p.type,
              p.baseUrl,
              p.apiKey || '',
              JSON.stringify(p.models || []),
              p.selectedModel || '',
              JSON.stringify(p.customHeaders || {}),
              p.isDefault ? 1 : 0,
              p.enabled ? 1 : 0,
              p.gpuLayers ?? null,
              p.contextSize ?? null,
              p.cpuThreads ?? null,
              p.flashAttention ? 1 : 0
            );
          }
        }

        // KV states
        if (parsed.activeWorkspaceId) this.setKV('activeWorkspaceId', parsed.activeWorkspaceId);
        if (parsed.activeSessionId) this.setKV('activeSessionId', parsed.activeSessionId);
        if (parsed.activeProviderId) this.setKV('activeProviderId', parsed.activeProviderId);
        if (parsed.deletedProviderIds) this.setKV('deletedProviderIds', parsed.deletedProviderIds);
        if (parsed.skillFolders) this.setKV('skillFolders', parsed.skillFolders);
        if (parsed.customHubModels) this.setKV('customHubModels', parsed.customHubModels);
        if (parsed.settings) this.setKV('settings', parsed.settings);
      });

      tx();
      // Rename legacy file to .migrated so we do not re-migrate
      fs.renameSync(legacyDbFile, `${legacyDbFile}.migrated`);
      console.log('✅ Legacy database.json migration to SQLite completed successfully.');
    } catch (err) {
      console.error('Failed to migrate legacy database.json:', err);
    }
  }

  // KV helpers
  public getKV<T>(key: string): T | undefined {
    const row = this.sqlite.prepare('SELECT value FROM kv_store WHERE key = ?').get(key) as { value: string } | undefined;
    if (!row) return undefined;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return undefined;
    }
  }

  public setKV<T>(key: string, value: T): void {
    const stmt = this.sqlite.prepare('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)');
    stmt.run(key, JSON.stringify(value));
  }

  public deleteKV(key: string): void {
    this.sqlite.prepare('DELETE FROM kv_store WHERE key = ?').run(key);
  }

  // Workspaces
  public listWorkspaces(): Workspace[] {
    const rows = this.sqlite.prepare('SELECT * FROM workspaces ORDER BY updated_at DESC').all() as any[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      folderPath: r.folder_path,
      systemPrompt: r.system_prompt || undefined,
      pinnedFiles: r.pinned_files ? JSON.parse(r.pinned_files) : [],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public getWorkspace(id: string): Workspace | undefined {
    const r = this.sqlite.prepare('SELECT * FROM workspaces WHERE id = ?').get(id) as any;
    if (!r) return undefined;
    return {
      id: r.id,
      name: r.name,
      folderPath: r.folder_path,
      systemPrompt: r.system_prompt || undefined,
      pinnedFiles: r.pinned_files ? JSON.parse(r.pinned_files) : [],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  public saveWorkspace(workspace: Workspace): Workspace {
    const normalizedTarget = path.normalize(workspace.folderPath).toLowerCase();
    const existingRows = this.listWorkspaces();
    const existing = existingRows.find(
      (w) => w.id !== workspace.id && path.normalize(w.folderPath).toLowerCase() === normalizedTarget
    );

    const now = Date.now();
    if (existing) {
      existing.name = workspace.name;
      existing.updatedAt = now;
      this.sqlite.prepare('UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?').run(
        existing.name,
        existing.updatedAt,
        existing.id
      );
      return existing;
    }

    const wsToSave: Workspace = { ...workspace, updatedAt: now };
    const stmt = this.sqlite.prepare(`
      INSERT OR REPLACE INTO workspaces (id, name, folder_path, system_prompt, pinned_files, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      wsToSave.id,
      wsToSave.name,
      wsToSave.folderPath,
      wsToSave.systemPrompt || null,
      JSON.stringify(wsToSave.pinnedFiles || []),
      wsToSave.createdAt || now,
      wsToSave.updatedAt
    );

    const activeId = this.getKV<string>('activeWorkspaceId');
    if (!activeId) {
      this.setKV('activeWorkspaceId', wsToSave.id);
    }
    return wsToSave;
  }

  public deleteWorkspace(id: string): void {
    const tx = this.sqlite.transaction(() => {
      // Find all sessions in this workspace
      const sessionRows = this.sqlite.prepare('SELECT id FROM sessions WHERE workspace_id = ?').all(id) as { id: string }[];
      for (const s of sessionRows) {
        this.sqlite.prepare('DELETE FROM messages WHERE session_id = ?').run(s.id);
      }
      this.sqlite.prepare('DELETE FROM sessions WHERE workspace_id = ?').run(id);
      this.sqlite.prepare('DELETE FROM workspaces WHERE id = ?').run(id);

      const activeId = this.getKV<string>('activeWorkspaceId');
      if (activeId === id) {
        const remaining = this.sqlite.prepare('SELECT id FROM workspaces LIMIT 1').get() as { id: string } | undefined;
        this.setKV('activeWorkspaceId', remaining ? remaining.id : null);
      }
    });
    tx();
  }

  // Sessions
  public listSessions(workspaceId?: string): ChatSession[] {
    let rows: any[];
    if (!workspaceId) {
      rows = this.sqlite.prepare('SELECT * FROM sessions ORDER BY updated_at DESC').all();
    } else if (workspaceId === 'no-project') {
      rows = this.sqlite
        .prepare('SELECT * FROM sessions WHERE workspace_id IS NULL OR workspace_id = ? ORDER BY updated_at DESC')
        .all('no-project');
    } else {
      rows = this.sqlite.prepare('SELECT * FROM sessions WHERE workspace_id = ? ORDER BY updated_at DESC').all(workspaceId);
    }

    return rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspace_id || undefined,
      title: r.title,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public getSession(id: string): ChatSession | undefined {
    const r = this.sqlite.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as any;
    if (!r) return undefined;
    return {
      id: r.id,
      workspaceId: r.workspace_id || undefined,
      title: r.title,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  public saveSession(session: ChatSession): ChatSession {
    const now = Date.now();
    const sessToSave: ChatSession = { ...session, updatedAt: now };
    this.sqlite.prepare(`
      INSERT OR REPLACE INTO sessions (id, workspace_id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      sessToSave.id,
      sessToSave.workspaceId || null,
      sessToSave.title,
      sessToSave.createdAt || now,
      sessToSave.updatedAt
    );
    this.setKV('activeSessionId', sessToSave.id);
    return sessToSave;
  }

  public deleteSession(id: string): void {
    const tx = this.sqlite.transaction(() => {
      this.sqlite.prepare('DELETE FROM messages WHERE session_id = ?').run(id);
      this.sqlite.prepare('DELETE FROM sessions WHERE id = ?').run(id);
      const activeId = this.getKV<string>('activeSessionId');
      if (activeId === id) {
        this.setKV('activeSessionId', null);
      }
    });
    tx();
  }

  // Messages
  public getMessages(sessionId: string): ChatMessage[] {
    const rows = this.sqlite
      .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC')
      .all(sessionId) as any[];

    return rows.map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      role: r.role,
      content: r.content,
      thinking: r.thinking || undefined,
      tokensUsed: r.tokens_used ?? undefined,
      tokensPerSec: r.tokens_per_sec ?? undefined,
      timeToFirstTokenMs: r.ttft_ms ?? undefined,
      modelUsed: r.model_used || undefined,
      tokenBreakdown: r.token_breakdown ? JSON.parse(r.token_breakdown) : undefined,
      createdAt: r.created_at,
    }));
  }

  public addMessage(message: ChatMessage): ChatMessage {
    const stmt = this.sqlite.prepare(`
      INSERT OR REPLACE INTO messages (id, session_id, role, content, thinking, tokens_used, tokens_per_sec, ttft_ms, model_used, token_breakdown, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      message.id,
      message.sessionId,
      message.role,
      message.content,
      message.thinking || null,
      message.tokensUsed ?? null,
      message.tokensPerSec ?? null,
      message.timeToFirstTokenMs ?? null,
      message.modelUsed || null,
      message.tokenBreakdown ? JSON.stringify(message.tokenBreakdown) : null,
      message.createdAt || Date.now()
    );

    // Update session timestamp
    this.sqlite.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(Date.now(), message.sessionId);
    return message;
  }

  // Providers
  public syncLocalModels(provider: ProviderConfig): void {
    if (provider.id === 'local-llama' || provider.type === 'llama-server') {
      const candidateDirs = this.getAllModelDirs();

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
      const nextSelected = files.includes(provider.selectedModel) ? provider.selectedModel : (files[0] || '');
      const changed =
        JSON.stringify(provider.models) !== JSON.stringify(files) ||
        provider.selectedModel !== nextSelected;

      provider.models = files;
      provider.selectedModel = nextSelected;

      if (changed) {
        this.sqlite
          .prepare('UPDATE providers SET models = ?, selected_model = ? WHERE id = ?')
          .run(JSON.stringify(files), nextSelected, provider.id);
      }
    }
  }

  public listProviders(): ProviderConfig[] {
    const rows = this.sqlite.prepare('SELECT * FROM providers').all() as any[];
    const list: ProviderConfig[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      baseUrl: r.base_url,
      apiKey: r.api_key || undefined,
      models: r.models ? JSON.parse(r.models) : [],
      selectedModel: r.selected_model || '',
      customHeaders: r.custom_headers ? JSON.parse(r.custom_headers) : undefined,
      isDefault: Boolean(r.is_default),
      enabled: Boolean(r.enabled),
      gpuLayers: r.gpu_layers ?? undefined,
      contextSize: r.context_size ?? undefined,
      cpuThreads: r.cpu_threads ?? undefined,
      flashAttention: Boolean(r.flash_attention),
    }));

    for (const p of list) {
      if (p.id === 'local-llama') {
        this.syncLocalModels(p);
      }
    }
    return list;
  }

  public getProvider(id: string): ProviderConfig | undefined {
    const r = this.sqlite.prepare('SELECT * FROM providers WHERE id = ?').get(id) as any;
    if (!r) return undefined;
    const provider: ProviderConfig = {
      id: r.id,
      name: r.name,
      type: r.type,
      baseUrl: r.base_url,
      apiKey: r.api_key || undefined,
      models: r.models ? JSON.parse(r.models) : [],
      selectedModel: r.selected_model || '',
      customHeaders: r.custom_headers ? JSON.parse(r.custom_headers) : undefined,
      isDefault: Boolean(r.is_default),
      enabled: Boolean(r.enabled),
      gpuLayers: r.gpu_layers ?? undefined,
      contextSize: r.context_size ?? undefined,
      cpuThreads: r.cpu_threads ?? undefined,
      flashAttention: Boolean(r.flash_attention),
    };

    if (provider.id === 'local-llama') {
      this.syncLocalModels(provider);
    }
    return provider;
  }

  public saveProvider(provider: ProviderConfig): ProviderConfig {
    const tx = this.sqlite.transaction(() => {
      if (provider.isDefault) {
        const existing = this.sqlite
          .prepare('SELECT is_default FROM providers WHERE id = ?')
          .get(provider.id) as { is_default: number } | undefined;
        const wasAlreadyDefault = Boolean(existing?.is_default);
        this.sqlite.prepare('UPDATE providers SET is_default = 0').run();
        if (!wasAlreadyDefault || !this.getKV<string>('activeProviderId')) {
          this.setKV('activeProviderId', provider.id);
        }
      }

      this.sqlite.prepare(`
        INSERT OR REPLACE INTO providers (id, name, type, base_url, api_key, models, selected_model, custom_headers, is_default, enabled, gpu_layers, context_size, cpu_threads, flash_attention)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        provider.id,
        provider.name,
        provider.type,
        provider.baseUrl,
        provider.apiKey || '',
        JSON.stringify(provider.models || []),
        provider.selectedModel || '',
        JSON.stringify(provider.customHeaders || {}),
        provider.isDefault ? 1 : 0,
        provider.enabled ? 1 : 0,
        provider.gpuLayers ?? null,
        provider.contextSize ?? null,
        provider.cpuThreads ?? null,
        provider.flashAttention ? 1 : 0
      );
    });
    tx();
    return provider;
  }

  public deleteProvider(id: string): boolean {
    if (id === 'local-llama') {
      return false; // Embedded local llama cannot be deleted
    }

    const deleted = this.getKV<string[]>('deletedProviderIds') || [];
    if (!deleted.includes(id)) {
      deleted.push(id);
      this.setKV('deletedProviderIds', deleted);
    }

    this.sqlite.prepare('DELETE FROM providers WHERE id = ?').run(id);

    const activeId = this.getKV<string>('activeProviderId');
    if (activeId === id) {
      this.setKV('activeProviderId', 'local-llama');
    }
    return true;
  }

  // Models directory & Multi-folder scanning
  public getModelsDir(): string {
    const settings = this.getKV<AppSettings>('settings');
    const custom = settings?.modelsDir;
    if (custom && fs.existsSync(custom)) {
      return custom;
    }
    if (process.env.LOCALAI_MODELS_DIR && fs.existsSync(process.env.LOCALAI_MODELS_DIR)) {
      return process.env.LOCALAI_MODELS_DIR;
    }
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
    const settings = this.getKV<AppSettings>('settings') || {};
    settings.modelsDir = dir;
    this.setKV('settings', settings);

    const localLlama = this.getProvider('local-llama');
    if (localLlama) {
      this.syncLocalModels(localLlama);
    }
    return dir;
  }

  public getCustomModelDirs(): string[] {
    const settings = this.getKV<AppSettings>('settings');
    return settings?.customModelDirs || [];
  }

  public addCustomModelDir(dir: string): string[] {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {}
    }
    const settings = this.getKV<AppSettings>('settings') || {};
    if (!settings.customModelDirs) {
      settings.customModelDirs = [];
    }
    if (!settings.customModelDirs.includes(dir)) {
      settings.customModelDirs.push(dir);
      this.setKV('settings', settings);
    }
    const localLlama = this.getProvider('local-llama');
    if (localLlama) {
      this.syncLocalModels(localLlama);
    }
    return settings.customModelDirs;
  }

  public removeCustomModelDir(dir: string): string[] {
    const settings = this.getKV<AppSettings>('settings') || {};
    if (settings.customModelDirs) {
      settings.customModelDirs = settings.customModelDirs.filter((d) => d !== dir);
      this.setKV('settings', settings);
    }
    const localLlama = this.getProvider('local-llama');
    if (localLlama) {
      this.syncLocalModels(localLlama);
    }
    return settings.customModelDirs || [];
  }

  public getAllModelDirs(): string[] {
    const home = process.env.USERPROFILE || process.env.HOME || os.homedir() || 'C:\\';
    const dirs = new Set<string>();
    dirs.add(this.getModelsDir());
    dirs.add(path.join(home, 'LocalAI', 'models'));
    dirs.add(path.resolve(process.cwd(), 'models'));
    for (const d of this.getCustomModelDirs()) {
      if (d && fs.existsSync(d)) {
        dirs.add(d);
      }
    }
    return Array.from(dirs);
  }

  // Custom Hub Models
  public listCustomHubModels(): ModelHubItem[] {
    const map = this.getKV<Record<string, ModelHubItem>>('customHubModels') || {};
    return Object.values(map);
  }

  public saveCustomHubModel(model: ModelHubItem): ModelHubItem {
    const map = this.getKV<Record<string, ModelHubItem>>('customHubModels') || {};
    map[model.id] = model;
    this.setKV('customHubModels', map);
    return model;
  }

  public deleteCustomHubModel(id: string): boolean {
    const map = this.getKV<Record<string, ModelHubItem>>('customHubModels') || {};
    if (map[id]) {
      delete map[id];
      this.setKV('customHubModels', map);
      return true;
    }
    return false;
  }

  // Skill Folders
  public listSkillFolders(): string[] {
    return this.getKV<string[]>('skillFolders') || [];
  }

  public addSkillFolder(folderPath: string): string[] {
    const list = this.listSkillFolders();
    if (!list.includes(folderPath)) {
      list.push(folderPath);
      this.setKV('skillFolders', list);
    }
    return list;
  }

  public removeSkillFolder(folderPath: string): string[] {
    let list = this.listSkillFolders();
    list = list.filter((f) => f !== folderPath);
    this.setKV('skillFolders', list);
    return list;
  }

  // Active state
  public getActiveState() {
    return {
      activeWorkspaceId: this.getKV<string>('activeWorkspaceId') || null,
      activeSessionId: this.getKV<string>('activeSessionId') || null,
      activeProviderId: this.getKV<string>('activeProviderId') || 'local-llama',
    };
  }

  public setActiveState(state: { activeWorkspaceId?: string; activeSessionId?: string; activeProviderId?: string }) {
    if (state.activeWorkspaceId !== undefined) this.setKV('activeWorkspaceId', state.activeWorkspaceId);
    if (state.activeSessionId !== undefined) this.setKV('activeSessionId', state.activeSessionId);
    if (state.activeProviderId !== undefined) this.setKV('activeProviderId', state.activeProviderId);
  }

  // Model-specific preset configurations
  public getModelConfig(filename: string): ModelPresetConfig | undefined {
    const settings = this.getKV<AppSettings>('settings');
    return settings?.modelConfigs?.[filename];
  }

  public saveModelConfig(filename: string, config: ModelPresetConfig): void {
    const settings = this.getKV<AppSettings>('settings') || {};
    if (!settings.modelConfigs) {
      settings.modelConfigs = {};
    }
    settings.modelConfigs[filename] = {
      ...settings.modelConfigs[filename],
      ...config,
      updatedAt: Date.now(),
    };
    this.setKV('settings', settings);
  }

  public deleteModelConfig(filename: string): void {
    const settings = this.getKV<AppSettings>('settings');
    if (settings?.modelConfigs?.[filename]) {
      delete settings.modelConfigs[filename];
      this.setKV('settings', settings);
    }
  }

  public close(): void {
    try {
      this.sqlite.close();
    } catch {}
  }
}
