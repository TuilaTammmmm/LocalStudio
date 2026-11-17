import type {
  Workspace,
  ChatSession,
  ChatMessage,
  ProviderConfig,
  LocalSkill,
  HardwareStats,
} from '../types.js';
import type { FileNode } from '../workspace-fs.js';

export function getApiUrl(endpoint: string): string {
  const clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (typeof window !== 'undefined') {
    const isTauri =
      !!(window as any).__TAURI_INTERNALS__ ||
      window.location.protocol === 'tauri:' ||
      window.location.hostname === 'tauri.localhost';
    if (isTauri || (window.location.port !== '3000' && window.location.port !== '3001')) {
      return `http://127.0.0.1:3001${clean}`;
    }
  }
  return clean;
}

export const API_BASE = getApiUrl('/api');

export const api = {
  // Hardware
  async getHardware(): Promise<{
    stats: HardwareStats;
    recommendations: Record<string, { ngl: number; threads: number; strategy: string }>;
    llamaProcess: { isRunning: boolean; loadedLayers?: { gpu: number; total: number } };
  }> {
    const res = await fetch(`${API_BASE}/hardware`);
    return res.json();
  },

  // Workspaces
  async getWorkspaces(): Promise<Workspace[]> {
    const res = await fetch(`${API_BASE}/workspaces`);
    return res.json();
  },

  async createWorkspace(data: { name: string; folderPath: string; systemPrompt?: string }): Promise<Workspace> {
    const res = await fetch(`${API_BASE}/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteWorkspace(id: string): Promise<void> {
    await fetch(`${API_BASE}/workspaces/${id}`, { method: 'DELETE' });
  },

  async updateWorkspace(id: string, data: Partial<Workspace>): Promise<Workspace> {
    const res = await fetch(`${API_BASE}/workspaces/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async getWorkspaceTree(id: string): Promise<{ rootPath: string; tree: FileNode[] }> {
    const res = await fetch(`${API_BASE}/workspaces/${id}/tree`);
    return res.json();
  },

  // Sessions
  async getSessions(workspaceId: string): Promise<ChatSession[]> {
    const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/sessions`);
    return res.json();
  },

  async createSession(workspaceId: string, title: string): Promise<ChatSession> {
    const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    return res.json();
  },

  async deleteSession(id: string): Promise<void> {
    await fetch(`${API_BASE}/sessions/${id}`, { method: 'DELETE' });
  },

  async updateSession(id: string, data: Partial<ChatSession>): Promise<ChatSession> {
    const res = await fetch(`${API_BASE}/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Messages
  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/messages`);
    return res.json();
  },

  // Providers
  async getProviders(): Promise<{ providers: ProviderConfig[]; activeProvider: ProviderConfig }> {
    const res = await fetch(`${API_BASE}/providers`);
    return res.json();
  },

  async saveProvider(provider: ProviderConfig): Promise<ProviderConfig> {
    const res = await fetch(`${API_BASE}/providers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(provider),
    });
    return res.json();
  },

  async syncProvider(id: string): Promise<{ success: boolean; models: string[]; latencyMs: number; error?: string }> {
    const res = await fetch(`${API_BASE}/providers/${id}/sync`, { method: 'POST' });
    return res.json();
  },

  async setActiveProvider(providerId: string): Promise<ProviderConfig> {
    const res = await fetch(`${API_BASE}/providers/active`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId }),
    });
    return res.json();
  },

  async deleteProvider(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/providers/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // Skills
  async getSkills(): Promise<{ folders: string[]; skills: LocalSkill[] }> {
    const res = await fetch(`${API_BASE}/skills`);
    return res.json();
  },

  async addSkillFolder(folderPath: string): Promise<{ folders: string[] }> {
    const res = await fetch(`${API_BASE}/skills/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath }),
    });
    return res.json();
  },
};
