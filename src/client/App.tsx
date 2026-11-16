import React, { useState, useEffect, useRef } from 'react';
import type {
  Workspace,
  ChatSession,
  ChatMessage,
  ProviderConfig,
  LocalSkill,
  HardwareStats,
} from '../types.js';
import type { FileNode } from '../workspace-fs.js';
import { api } from './api.js';
import { Header } from './components/Header.js';
import { LeftSidebar } from './components/LeftSidebar.js';
import { RightSidebar } from './components/RightSidebar.js';
import { ChatView } from './components/ChatView.js';
import { SettingsModal } from './components/SettingsModal.js';
import { NewWorkspaceModal } from './components/NewWorkspaceModal.js';
import { type AutoRouteConfig, DEFAULT_AUTO_ROUTE_CONFIG } from '../auto-router.js';
import { type Language, type Translations, dictionaries, getLanguage, setLanguage } from './i18n.js';

export default function App() {
  // Bilingual localization state
  const [lang, setLang] = useState<Language>(() => getLanguage());
  const t = dictionaries[lang];
  const handleToggleLanguage = (newLang: Language) => {
    setLanguage(newLang);
    setLang(newLang);
  };

  // Core State
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [activeProvider, setActiveProvider] = useState<ProviderConfig | null>(null);
  const [skills, setSkills] = useState<LocalSkill[]>([]);
  const [skillFolders, setSkillFolders] = useState<string[]>([]);
  const [hardwareStats, setHardwareStats] = useState<HardwareStats | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [pinnedFiles, setPinnedFiles] = useState<string[]>([]);

  // UI state
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [autoRouteConfig, setAutoRouteConfig] = useState<AutoRouteConfig>(DEFAULT_AUTO_ROUTE_CONFIG);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewWorkspaceOpen, setIsNewWorkspaceOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 1. Initial Data Load
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [hw, wsList, provData, skillsData] = await Promise.all([
          api.getHardware().catch(() => null),
          api.getWorkspaces().catch(() => []),
          api.getProviders().catch(() => ({ providers: [], activeProvider: null })),
          api.getSkills().catch(() => ({ folders: [], skills: [] })),
        ]);

        if (hw) setHardwareStats(hw.stats);
        setWorkspaces(wsList);
        setProviders(provData.providers);
        setActiveProvider(provData.activeProvider);
        setSkills(skillsData.skills);
        setSkillFolders(skillsData.folders);

        // If no workspaces, create default workspace for this repo
        if (wsList.length === 0) {
          const defaultWs = await api.createWorkspace({
            name: 'LocalAI Workspace',
            folderPath: 'c:\\Tam\\Code\\LocalAI',
          });
          setWorkspaces([defaultWs]);
          setActiveWorkspace(defaultWs);
        } else {
          setActiveWorkspace(wsList[0]);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      }
    };

    loadInitialData();

    // Poll hardware stats every 5 seconds
    const interval = setInterval(() => {
      api.getHardware().then((hw) => setHardwareStats(hw.stats)).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // 2. When active workspace changes: Load tree & sessions
  useEffect(() => {
    if (!activeWorkspace) return;

    api.getWorkspaceTree(activeWorkspace.id).then((res) => {
      setFileTree(res.tree || []);
    }).catch(() => setFileTree([]));

    api.getSessions(activeWorkspace.id).then((sessList) => {
      setSessions(sessList);
      if (sessList.length > 0) {
        setActiveSession(sessList[0]);
      } else {
        // Auto-create initial chat session
        api.createSession(activeWorkspace.id, 'Welcome & General Discussion').then((newSess) => {
          setSessions([newSess]);
          setActiveSession(newSess);
        });
      }
    }).catch(() => setSessions([]));
  }, [activeWorkspace?.id]);

  // 3. When active session changes: Load messages
  useEffect(() => {
    if (!activeSession) {
      setMessages([]);
      return;
    }
    api.getMessages(activeSession.id).then(setMessages).catch(() => setMessages([]));
  }, [activeSession?.id]);

  // Handler: Send Message & SSE Streaming
  const handleSendMessage = async (promptText: string, hasImage = false) => {
    if (!activeSession || isStreaming) return;

    const userTempMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      sessionId: activeSession.id,
      role: 'user',
      content: promptText,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, userTempMsg]);

    const assistantTempId = `stream-${Date.now()}`;
    let activeModelName = activeProvider?.selectedModel;
    if (autoRouteConfig.enabled) {
      try {
        const routeRes = await fetch('/api/auto-route/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: promptText,
            hasImageAttachment: hasImage,
            config: autoRouteConfig,
          }),
        });
        const routeData = await routeRes.json();
        if (routeData.targetModel) {
          activeModelName = routeData.targetModel;
        }
      } catch {}
    }

    const assistantPlaceholder: ChatMessage = {
      id: assistantTempId,
      sessionId: activeSession.id,
      role: 'assistant',
      content: '',
      thinking: '',
      modelUsed: activeModelName,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, assistantPlaceholder]);
    setIsStreaming(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSession.id,
          prompt: promptText,
          contextFiles: pinnedFiles,
          workspaceId: activeWorkspace?.id,
          model: activeModelName,
        }),
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}: Failed to stream`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data:')) {
            const jsonStr = line.slice(5).trim();
            if (!jsonStr) continue;

            try {
              const chunk = JSON.parse(jsonStr);
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id === assistantTempId) {
                    return {
                      ...m,
                      content: m.content + (chunk.content || ''),
                      thinking: (m.thinking || '') + (chunk.thinking || ''),
                    };
                  }
                  return m;
                })
              );
            } catch {}
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantTempId
              ? { ...m, content: m.content + `\n\n[Error: ${err.message}]` }
              : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleNewChat = async () => {
    if (!activeWorkspace) return;
    const session = await api.createSession(activeWorkspace.id, `Chat ${sessions.length + 1}`);
    setSessions((prev) => [session, ...prev]);
    setActiveSession(session);
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSession?.id === id) {
      const remaining = sessions.filter((s) => s.id !== id);
      setActiveSession(remaining.length > 0 ? remaining[0] : null);
    }
  };

  const handleTogglePinFile = (relPath: string) => {
    setPinnedFiles((prev) =>
      prev.includes(relPath) ? prev.filter((f) => f !== relPath) : [...prev, relPath]
    );
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0d1117] text-[#e6edf3]">
      {/* 1. Top Header */}
      <Header
        providers={providers}
        activeProvider={activeProvider}
        hardwareStats={hardwareStats}
        isRightSidebarOpen={isRightSidebarOpen}
        autoRouteEnabled={autoRouteConfig.enabled}
        lang={lang}
        t={t}
        onToggleLanguage={handleToggleLanguage}
        onToggleAutoRoute={() =>
          setAutoRouteConfig((prev) => ({ ...prev, enabled: !prev.enabled }))
        }
        onSwitchProvider={async (id) => {
          const switched = await api.setActiveProvider(id);
          setActiveProvider(switched);
        }}
        onSelectModel={(model) => {
          if (activeProvider) {
            const updated = { ...activeProvider, selectedModel: model };
            api.saveProvider(updated).then(setActiveProvider);
          }
        }}
        onToggleRightSidebar={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
      />

      {/* 2. Main Workspace 3-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat Sessions & Workspace Switcher */}
        <LeftSidebar
          workspaces={workspaces}
          activeWorkspace={activeWorkspace}
          sessions={sessions}
          activeSession={activeSession}
          lang={lang}
          t={t}
          onSelectWorkspace={setActiveWorkspace}
          onSelectSession={setActiveSession}
          onNewChat={handleNewChat}
          onNewWorkspace={() => setIsNewWorkspaceOpen(true)}
          onDeleteSession={handleDeleteSession}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Center: Main Chat View */}
        <ChatView
          activeSession={activeSession}
          activeWorkspace={activeWorkspace}
          messages={messages}
          pinnedFiles={pinnedFiles}
          availableSkills={skills}
          fileTree={fileTree}
          providers={providers}
          activeProvider={activeProvider}
          lang={lang}
          t={t}
          onSwitchProvider={async (id) => {
            const switched = await api.setActiveProvider(id);
            setActiveProvider(switched);
          }}
          activeModelName={activeProvider?.selectedModel}
          isAutoRoute={autoRouteConfig.enabled}
          availableModels={activeProvider?.models || []}
          onSelectModel={(modelName, isAuto) => {
            if (isAuto) {
              setAutoRouteConfig((prev) => ({ ...prev, enabled: true }));
            } else {
              setAutoRouteConfig((prev) => ({ ...prev, enabled: false }));
              if (activeProvider) {
                const updated = { ...activeProvider, selectedModel: modelName };
                api.saveProvider(updated).then(setActiveProvider);
              }
            }
          }}
          onSendMessage={handleSendMessage}
          isStreaming={isStreaming}
          onStopStreaming={handleStopStreaming}
          onRemovePinnedFile={handleTogglePinFile}
        />

        {/* Right: Folder Tools (FileTree, Shell/Terminal, Web/Browser, RAG, Prompt) */}
        <RightSidebar
          activeWorkspace={activeWorkspace}
          fileTree={fileTree}
          pinnedFiles={pinnedFiles}
          isOpen={isRightSidebarOpen}
          lang={lang}
          t={t}
          onToggle={() => setIsRightSidebarOpen(false)}
          onTogglePinFile={handleTogglePinFile}
          onUpdateSystemPrompt={(prompt) => {
            if (activeWorkspace) {
              const updated = { ...activeWorkspace, systemPrompt: prompt };
              api.createWorkspace(updated).then(setActiveWorkspace);
            }
          }}
        />
      </div>

      {/* 3. Settings Studio Modal (Model Hub, Auto-Route, Skills, Providers, CUDA Hardware) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        skills={skills}
        skillFolders={skillFolders}
        providers={providers}
        hardwareStats={hardwareStats}
        autoRouteConfig={autoRouteConfig}
        lang={lang}
        t={t}
        onToggleLanguage={handleToggleLanguage}
        onUpdateAutoRouteConfig={setAutoRouteConfig}
        onAddSkillFolder={async (folder) => {
          const res = await api.addSkillFolder(folder);
          setSkillFolders(res.folders);
          const updatedSkills = await api.getSkills();
          setSkills(updatedSkills.skills);
        }}
        onSaveProvider={async (p) => {
          const saved = await api.saveProvider(p);
          setProviders((prev) => prev.map((item) => (item.id === saved.id ? saved : item)));
          if (activeProvider?.id === saved.id) setActiveProvider(saved);
        }}
        onSyncProvider={(id) => api.syncProvider(id)}
      />

      {/* 4. New Workspace Modal */}
      <NewWorkspaceModal
        isOpen={isNewWorkspaceOpen}
        onClose={() => setIsNewWorkspaceOpen(false)}
        lang={lang}
        t={t}
        onCreate={async (name, folderPath) => {
          const created = await api.createWorkspace({ name, folderPath });
          setWorkspaces((prev) => [created, ...prev]);
          setActiveWorkspace(created);
        }}
      />
    </div>
  );
}
