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
import { api, getApiUrl } from './api.js';
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
  const [isOnline, setIsOnline] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Agent Workshop Swarm State
  const [activeAgent, setActiveAgent] = useState<'coordinator' | 'coder' | 'critic' | 'harness' | null>(null);
  const [agentThoughts, setAgentThoughts] = useState<Record<string, string>>({});
  const [harnessLogs, setHarnessLogs] = useState<string>('');
  const [isWorkshopExpanded, setIsWorkshopExpanded] = useState<boolean>(() => {
    return localStorage.getItem('localai_workshop_expanded') === 'true';
  });

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
        setIsOnline(Boolean(hw || provData.providers.length > 0));

        // If no workspaces, start in General Chat mode (No Project needed)
        if (wsList.length === 0) {
          setActiveWorkspace(null);
        } else {
          setActiveWorkspace(wsList[0]);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      }
    };

    loadInitialData();

    // Poll hardware stats every 5 seconds with diff check (prevents redundant full-app re-renders)
    const interval = setInterval(() => {
      api.getHardware().then((hw) => {
        if (!hw?.stats) return;
        setHardwareStats((prev) => {
          if (!prev) return hw.stats;
          if (
            Math.abs(prev.vramUsedMb - hw.stats.vramUsedMb) < 20 &&
            prev.gpuUtilPercent === hw.stats.gpuUtilPercent
          ) {
            return prev;
          }
          return hw.stats;
        });
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Prevent default browser right-click menu (Back, Reload, Inspect, Print...) in desktop app
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener('contextmenu', handleContextMenu);
    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // Workspace & Session Rename Handlers
  const handleRenameSession = async (sessionId: string, newTitle: string) => {
    try {
      const updated = await api.updateSession(sessionId, { title: newTitle });
      if (updated && updated.id) {
        setSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));
        if (activeSession?.id === sessionId) {
          setActiveSession(updated);
        }
      }
    } catch (err) {
      console.error('Failed to rename session:', err);
    }
  };

  const handleRenameWorkspace = async (workspaceId: string, newName: string) => {
    try {
      const updated = await api.updateWorkspace(workspaceId, { name: newName });
      if (updated && updated.id) {
        setWorkspaces((prev) => prev.map((w) => (w.id === workspaceId ? updated : w)));
        if (activeWorkspace?.id === workspaceId) {
          setActiveWorkspace(updated);
        }
      }
    } catch (err) {
      console.error('Failed to rename workspace:', err);
    }
  };

  const handleDeleteWorkspace = async (workspaceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteWorkspace(workspaceId);
      setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));
      if (activeWorkspace?.id === workspaceId) {
        const remaining = workspaces.filter((w) => w.id !== workspaceId);
        setActiveWorkspace(remaining.length > 0 ? remaining[0] : null);
      }
    } catch (err) {
      console.error('Failed to delete workspace:', err);
    }
  };

  // 2. When active workspace changes: Load tree, sessions & pinned files (supports No-Project mode)
  useEffect(() => {
    const wsId = activeWorkspace?.id || 'no-project';

    if (activeWorkspace) {
      setPinnedFiles(activeWorkspace.pinnedFiles || []);
      api.getWorkspaceTree(activeWorkspace.id).then((res) => {
        setFileTree(res.tree || []);
      }).catch(() => setFileTree([]));
    } else {
      setPinnedFiles([]);
      setFileTree([]);
    }

    const handleFileSaved = () => {
      if (activeWorkspace) {
        api.getWorkspaceTree(activeWorkspace.id).then((res) => {
          setFileTree(res.tree || []);
        }).catch(() => {});
      }
    };
    window.addEventListener('localai:file-saved', handleFileSaved);

    api.getSessions(wsId).then((sessList) => {
      setSessions(sessList);
      if (sessList.length > 0) {
        setActiveSession(sessList[0]);
      } else {
        const defaultTitle = lang === 'vi' ? 'Cuộc trò chuyện mới' : 'New Chat';
        api.createSession(wsId, defaultTitle).then((newSess) => {
          setSessions([newSess]);
          setActiveSession(newSess);
        }).catch(() => {});
      }
    }).catch(() => setSessions([]));

    return () => {
      window.removeEventListener('localai:file-saved', handleFileSaved);
    };
  }, [activeWorkspace?.id, lang]);

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
        const routeRes = await fetch(getApiUrl('/api/auto-route/classify'), {
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

    const isSwarm = promptText.trim().startsWith('/swarm');
    const cleanPrompt = isSwarm
      ? promptText.replace(/^\/swarm\s*/i, '').trim() || promptText
      : promptText;

    if (isSwarm) {
      setIsWorkshopExpanded(true);
      localStorage.setItem('localai_workshop_expanded', 'true');
      setActiveAgent('coordinator');
      setAgentThoughts({});
      setHarnessLogs('');
    } else {
      setActiveAgent(null);
      setAgentThoughts({});
      setHarnessLogs('');
    }

    const assistantPlaceholder: ChatMessage = {
      id: assistantTempId,
      sessionId: activeSession.id,
      role: 'assistant',
      content: '',
      thinking: '',
      modelUsed: isSwarm ? 'Biệt đội AI (Swarm)' : activeModelName,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, assistantPlaceholder]);
    setIsStreaming(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const streamEndpoint = isSwarm ? '/api/swarm/execute-stream' : '/api/chat/stream';

    try {
      const response = await fetch(getApiUrl(streamEndpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSession.id,
          prompt: cleanPrompt,
          contextFiles: pinnedFiles,
          workspaceId: activeWorkspace?.id,
          model: activeModelName,
          conciseMode: localStorage.getItem('localai_concise_mode') === 'true',
          sampling: localStorage.getItem('localai_temperature')
            ? {
                temperature: Number(localStorage.getItem('localai_temperature')),
                topP: Number(localStorage.getItem('localai_topP') || '0.9'),
                maxTokens: Number(localStorage.getItem('localai_maxTokens') || '4096'),
                repeatPenalty: Number(localStorage.getItem('localai_repeatPenalty') || '1.1'),
              }
            : undefined,
          defaultSystemPrompt: localStorage.getItem('localai_defaultSystemPrompt') || '',
        }),
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}: Failed to stream`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      // High-performance streaming: Accumulate chunks and flush at 60fps via requestAnimationFrame
      let pendingContent = '';
      let pendingThinking = '';
      let rafHandle: number | null = null;

      const scheduleFlush = () => {
        if (rafHandle !== null) return;
        rafHandle = requestAnimationFrame(() => {
          rafHandle = null;
          if (!pendingContent && !pendingThinking) return;
          const chunkContent = pendingContent;
          const chunkThinking = pendingThinking;
          pendingContent = '';
          pendingThinking = '';

          setMessages((prev) =>
            prev.map((m) => {
              if (m.id === assistantTempId) {
                return {
                  ...m,
                  content: m.content + chunkContent,
                  thinking: (m.thinking || '') + chunkThinking,
                };
              }
              return m;
            })
          );
        });
      };

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

              // Multi-agent Swarm & Harness streaming events
              if (chunk.type === 'agent_step') {
                if (chunk.agent) setActiveAgent(chunk.agent);
                if (chunk.thought) {
                  setAgentThoughts((prev) => ({
                    ...prev,
                    [chunk.agent]: (prev[chunk.agent] ? prev[chunk.agent] + '\n' : '') + chunk.thought,
                  }));
                }
                if (chunk.chunk) {
                  pendingContent += chunk.chunk;
                }
                if (chunk.status === 'done' && chunk.agent === 'harness') {
                  setActiveAgent(null);
                }
              } else if (chunk.type === 'harness_result') {
                setHarnessLogs(chunk.logs || (chunk.passed ? 'All tests passed (exit 0)' : `Tests failed (exit ${chunk.exitCode})`));
                if (chunk.passed) {
                  setActiveAgent(null);
                }
              }

              // Custom Skill Activation notification
              if (chunk.trigger && chunk.name) {
                pendingContent += `> 💡 **Kỹ năng đã kích hoạt**: \`${chunk.trigger}\` — *${chunk.name}*\n\n`;
              }

              if (chunk.content) pendingContent += chunk.content;
              if (chunk.thinking) pendingThinking += chunk.thinking;
              if (chunk.message || chunk.error) {
                pendingContent += `\n⚠️ [Lỗi]: ${chunk.message || chunk.error}`;
              }
              scheduleFlush();
            } catch {}
          }
        }
      }

      // Cancel any remaining RAF and flush immediately upon stream completion
      if (rafHandle !== null) {
        cancelAnimationFrame(rafHandle);
        rafHandle = null;
      }
      if (pendingContent || pendingThinking) {
        const chunkContent = pendingContent;
        const chunkThinking = pendingThinking;
        pendingContent = '';
        pendingThinking = '';
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === assistantTempId) {
              return {
                ...m,
                content: m.content + chunkContent,
                thinking: (m.thinking || '') + chunkThinking,
              };
            }
            return m;
          })
        );
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
      setActiveAgent(null);
      abortControllerRef.current = null;
    }
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleNewChat = async () => {
    const wsId = activeWorkspace?.id || 'no-project';
    const session = await api.createSession(wsId, `Chat ${sessions.length + 1}`);
    setSessions((prev) => [session, ...prev]);
    setActiveSession(session);
  };

  useEffect(() => {
    const handleAskAiError = (e: any) => {
      const { command, error } = e.detail || {};
      if (command && error) {
        handleSendMessage(
          `Lệnh terminal \`${command}\` vừa chạy bị lỗi như sau:\n\`\`\`bash\n${error}\n\`\`\`\nHãy phân tích nguyên nhân và đưa ra giải pháp sửa lỗi cụ thể.`
        );
      }
    };
    window.addEventListener('localai:ask-ai-error', handleAskAiError);
    return () => window.removeEventListener('localai:ask-ai-error', handleAskAiError);
  }, [handleSendMessage]);

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSession?.id === id) {
      const remaining = sessions.filter((s) => s.id !== id);
      setActiveSession(remaining.length > 0 ? remaining[0] : null);
    }
  };

  const lastRegenerateRef = useRef<number>(0);
  const handleRegenerateMessage = (messageId?: string, prompt?: string) => {
    const now = Date.now();
    if (now - lastRegenerateRef.current < 400) return;
    lastRegenerateRef.current = now;

    let promptText = prompt;
    if (messageId) {
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx !== -1) {
        if (messages[idx].role === 'assistant') {
          for (let i = idx - 1; i >= 0; i--) {
            if (messages[i].role === 'user') {
              promptText = messages[i].content;
              break;
            }
          }
        } else {
          promptText = messages[idx].content;
        }
      }
    }
    if (!promptText) {
      const lastUser = [...messages].reverse().find((m) => m.role === 'user');
      promptText = lastUser?.content;
    }
    if (promptText) {
      handleSendMessage(promptText);
    }
  };

  useEffect(() => {
    const handleRegenEvent = (e: any) => {
      const detail = e.detail;
      const messageId = typeof detail === 'string' ? detail : detail?.messageId;
      const promptText = typeof detail === 'object' ? detail?.prompt : '';
      handleRegenerateMessage(messageId, promptText);
    };
    window.addEventListener('localai:regenerate-message', handleRegenEvent);
    return () => window.removeEventListener('localai:regenerate-message', handleRegenEvent);
  }, [messages, handleSendMessage]);

  const handleTogglePinFile = (relPath: string) => {
    setPinnedFiles((prev) => {
      const next = prev.includes(relPath) ? prev.filter((f) => f !== relPath) : [...prev, relPath];
      if (activeWorkspace) {
        api.updateWorkspace(activeWorkspace.id, { pinnedFiles: next }).catch(() => {});
      }
      return next;
    });
  };

  // Global Hotkeys: Ctrl+, (Settings), Ctrl+N (New Chat), Ctrl+O (New/Open Workspace), Ctrl+B (Toggle Right Sidebar), Esc (Close modals)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (isCtrlOrCmd && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen((prev) => !prev);
      } else if (isCtrlOrCmd && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        handleNewChat();
      } else if (isCtrlOrCmd && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        setIsRightSidebarOpen((prev) => !prev);
      } else if (isCtrlOrCmd && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        setIsNewWorkspaceOpen(true);
      } else if (e.key === 'Escape') {
        if (isSettingsOpen) {
          // Handled hierarchically inside SettingsModal (e.g. sub-modals like delete confirm first)
          return;
        }
        if (isNewWorkspaceOpen) {
          setIsNewWorkspaceOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isSettingsOpen, isNewWorkspaceOpen, activeWorkspace, sessions.length]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0d1117] text-[#e6edf3]">
      {/* 1. Top Header */}
      <Header
        providers={providers}
        activeProvider={activeProvider}
        activeWorkspace={activeWorkspace}
        hardwareStats={hardwareStats}
        isRightSidebarOpen={isRightSidebarOpen}
        autoRouteEnabled={autoRouteConfig.enabled}
        isOnline={isOnline}
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
        onOpenSettings={() => setIsSettingsOpen(true)}
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
          onDeleteWorkspace={handleDeleteWorkspace}
          onRenameSession={handleRenameSession}
          onRenameWorkspace={handleRenameWorkspace}
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
          onRegenerateMessage={handleRegenerateMessage}
          isStreaming={isStreaming}
          onStopStreaming={handleStopStreaming}
          onRemovePinnedFile={handleTogglePinFile}
          onAttachFile={(filePath) => {
            setPinnedFiles((prev) => (prev.includes(filePath) ? prev : [...prev, filePath]));
          }}
          activeAgent={activeAgent}
          agentThoughts={agentThoughts}
          harnessLogs={harnessLogs}
          isWorkshopExpanded={isWorkshopExpanded}
          onToggleWorkshopExpand={() => {
            setIsWorkshopExpanded((prev) => {
              const next = !prev;
              localStorage.setItem('localai_workshop_expanded', String(next));
              return next;
            });
          }}
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
        onClose={async () => {
          setIsSettingsOpen(false);
          try {
            const provData = await api.getProviders();
            setProviders(provData.providers);
            if (provData.activeProvider) {
              setActiveProvider(provData.activeProvider);
            }
          } catch {}
        }}
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
          setProviders((prev) => {
            const exists = prev.some((item) => item.id === saved.id);
            if (exists) return prev.map((item) => (item.id === saved.id ? saved : item));
            return [...prev, saved];
          });
          if (activeProvider?.id === saved.id || p.isDefault) setActiveProvider(saved);
        }}
        onDeleteProvider={async (id) => {
          setProviders((prev) => prev.filter((item) => item.id !== id));
          if (activeProvider?.id === id) {
            setActiveProvider(null);
          }
          try {
            await api.deleteProvider(id);
            const provData = await api.getProviders();
            setProviders(provData.providers);
            if (provData.activeProvider) {
              setActiveProvider(provData.activeProvider);
            }
          } catch (err) {
            console.error('Failed to delete provider', err);
          }
        }}
        onSyncProvider={async (id) => {
          const res = await api.syncProvider(id);
          try {
            const provData = await api.getProviders();
            setProviders(provData.providers);
            if (provData.activeProvider) {
              setActiveProvider(provData.activeProvider);
            }
          } catch {}
          return res;
        }}
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
