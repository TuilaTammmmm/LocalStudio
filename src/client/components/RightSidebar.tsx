import React, { useState, useEffect } from 'react';
import type { Workspace } from '../../types.js';
import type { FileNode } from '../../workspace-fs.js';
import { type Language, type Translations, dictionaries, getLanguage } from '../i18n.js';
import {
  Folder,
  FileCode,
  Pin,
  Check,
  ChevronRight,
  ChevronDown,
  Layers,
  Sparkles,
  BookOpen,
  PanelRightClose,
  Database,
  FileText,
  Terminal as TerminalIcon,
  Globe,
  Play,
  RotateCw,
  ExternalLink,
  Plus,
  X,
  Trash2,
} from 'lucide-react';

interface RightSidebarProps {
  activeWorkspace: Workspace | null;
  fileTree: FileNode[];
  pinnedFiles: string[];
  isOpen: boolean;
  lang?: Language;
  t?: Translations;
  onToggle?: () => void;
  onTogglePinFile: (relativePath: string) => void;
  onUpdateSystemPrompt: (prompt: string) => void;
}

type ToolTabId = 'files' | 'terminal' | 'browser' | 'rag' | 'prompt' | 'new';

export const RightSidebar: React.FC<RightSidebarProps> = React.memo(({
  activeWorkspace,
  fileTree,
  pinnedFiles,
  isOpen,
  lang,
  t: propT,
  onToggle,
  onTogglePinFile,
  onUpdateSystemPrompt,
}) => {
  const currentLang = lang || getLanguage();
  const tr = propT || dictionaries[currentLang];

  const ALL_TOOLS: Array<{ id: 'files' | 'terminal' | 'browser' | 'rag' | 'prompt'; label: string; desc: string; icon: React.ReactNode }> = [
    { id: 'files', label: tr.filesLabel, desc: tr.filesDesc, icon: <FileCode className="w-3.5 h-3.5 text-sky-400" /> },
    { id: 'terminal', label: tr.shellLabel, desc: tr.shellDesc, icon: <TerminalIcon className="w-3.5 h-3.5 text-rose-400" /> },
    { id: 'browser', label: tr.webLabel, desc: tr.webDesc, icon: <Globe className="w-3.5 h-3.5 text-emerald-400" /> },
    { id: 'rag', label: tr.ragLabel, desc: tr.ragDesc, icon: <Database className="w-3.5 h-3.5 text-indigo-400" /> },
    { id: 'prompt', label: tr.promptLabel, desc: tr.promptDesc, icon: <FileText className="w-3.5 h-3.5 text-amber-400" /> },
  ];

  const [width, setWidth] = useState(380);
  const [isResizing, setIsResizing] = useState(false);
  const [openTabs, setOpenTabs] = useState<ToolTabId[]>(['files']);
  const [activeTab, setActiveTab] = useState<ToolTabId>('files');
  const [systemPrompt, setSystemPrompt] = useState(activeWorkspace?.systemPrompt || '');
  const [isPromptSaved, setIsPromptSaved] = useState(false);

  // Terminal state - clean without verbose boilerplate
  const [command, setCommand] = useState('');
  const [terminalLogs, setTerminalLogs] = useState<Array<{ text: string; isError?: boolean }>>([]);
  const [isRunning, setIsRunning] = useState(false);

  // Browser state
  const [browserUrl, setBrowserUrl] = useState('http://localhost:3000');
  const [iframeKey, setIframeKey] = useState(0);

  // Resizing mouse handlers - 60fps throttled via requestAnimationFrame
  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    let rafId: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth >= 280 && newWidth <= 900) {
          setWidth(newWidth);
        }
        rafId = null;
      });
    };

    const handleMouseUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isResizing]);

  if (!isOpen) return null;

  const openToolTab = (id: 'files' | 'terminal' | 'browser' | 'rag' | 'prompt') => {
    if (!openTabs.includes(id)) {
      setOpenTabs((prev) => [...prev.filter((t) => t !== 'new'), id]);
    }
    setActiveTab(id);
  };

  const closeToolTab = (id: ToolTabId, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = openTabs.filter((t) => t !== id);
    setOpenTabs(remaining);
    if (activeTab === id) {
      if (remaining.length > 0) {
        setActiveTab(remaining[remaining.length - 1]);
      } else {
        setActiveTab('new');
      }
    }
  };

  const handleRunCommand = async (cmdToRun = command) => {
    if (!cmdToRun.trim() || isRunning) return;
    const cmd = cmdToRun.trim();
    setTerminalLogs((prev) => [...prev, { text: `> ${cmd}` }]);
    setCommand('');
    setIsRunning(true);

    try {
      const res = await fetch('/api/terminal/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, cwd: activeWorkspace?.folderPath }),
      });
      const data = await res.json();
      if (data.stdout) {
        setTerminalLogs((prev) => [...prev, { text: data.stdout }]);
      }
      if (data.stderr) {
        setTerminalLogs((prev) => [...prev, { text: data.stderr, isError: true }]);
      }
    } catch (err: any) {
      setTerminalLogs((prev) => [...prev, { text: `Error: ${err.message}`, isError: true }]);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <aside
      style={{ width: `${width}px` }}
      className="h-full glass-panel border-l border-white/10 flex flex-col justify-between shrink-0 select-none animate-fade-in shadow-2xl relative transition-none"
    >
      {/* Resizer Handle on Left Border */}
      <div
        onMouseDown={startResizing}
        className="absolute -left-1 top-0 bottom-0 w-2 cursor-col-resize hover:bg-sky-500/60 active:bg-sky-500 z-30 transition-colors"
        title="Kéo sang trái/phải để thay đổi độ rộng Workspace Tools"
      />

      {/* 1. Header (Cleaned up: No pixel width, no redundant open tools count) */}
      <div className="p-2.5 px-3.5 border-b border-white/10 flex items-center justify-between relative z-30 bg-black/20">
        <div className="flex items-center space-x-2 truncate">
          <Layers className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="font-bold text-xs tracking-wide text-white truncate">
            {tr.workspaceToolsTitle}
          </span>
        </div>
      </div>

      {/* 2. Dynamic Open Tabs Bar with [+] Tool Launcher Button */}
      <div className="flex items-center border-b border-white/10 bg-black/40 text-xs px-2 py-1.5 space-x-1.5 overflow-x-auto relative z-40">
        {openTabs.map((tabId) => {
          if (tabId === 'new') return null;
          const tool = ALL_TOOLS.find((t) => t.id === tabId);
          if (!tool) return null;
          const isCur = activeTab === tabId;
          return (
            <div
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all group shrink-0 cursor-pointer select-none ${
                isCur
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.05] border border-transparent'
              }`}
            >
              {tool.icon}
              <span className="font-semibold">{tool.label}</span>
              {tabId === 'files' && pinnedFiles.length > 0 && (
                <span className="bg-sky-500/30 text-sky-300 text-[9px] px-1 rounded-full font-mono">
                  {pinnedFiles.length}
                </span>
              )}
              <button
                type="button"
                onClick={(e) => closeToolTab(tabId, e)}
                title={tr.close}
                className="hover:text-red-400 hover:bg-white/10 rounded-full p-0.5 ml-0.5 opacity-60 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        {/* [+] Tool Launcher Tab Button */}
        <button
          type="button"
          onClick={() => setActiveTab('new')}
          title={tr.addToolBtn}
          className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-all ${
            activeTab === 'new'
              ? 'bg-sky-500/25 text-sky-300 border border-sky-500/50 shadow-sm'
              : 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/25'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="text-[11px] font-bold">Tool</span>
        </button>
      </div>

      {/* 3. Tab Contents */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* LAUNCHER VIEW: Displayed when clicking +Tool or when no tabs open */}
        {(activeTab === 'new' || openTabs.length === 0) && (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-4 animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-xl shadow-sky-500/10">
              <Layers className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{tr.noToolActive}</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs">{tr.chooseToolDesc}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-sm pt-2">
              {ALL_TOOLS.map((tool) => {
                const isOpen = openTabs.includes(tool.id);
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => openToolTab(tool.id)}
                    className="flex flex-col text-left p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-sky-500/40 transition-all group shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {tool.icon}
                        <span className="font-bold text-xs text-white group-hover:text-sky-300">{tool.label}</span>
                      </div>
                      {isOpen && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-mono">
                          {tr.active}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">{tool.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 1: FILES EXPLORER */}
        {openTabs.includes('files') && activeTab === 'files' && (
          <div className="space-y-1 animate-fade-in">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>{activeWorkspace?.name || 'Project'} Explorer</span>
              <span className="text-[10px] font-mono text-gray-500">Click [*] to pin</span>
            </div>
            {fileTree.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-500 font-mono">
                No files found in workspace.
              </div>
            ) : (
              <div className="space-y-0.5">
                {fileTree.map((node) => (
                  <FileTreeNodeItem
                    key={node.path}
                    node={node}
                    pinnedFiles={pinnedFiles}
                    onTogglePin={onTogglePinFile}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SHELL / TERMINAL */}
        {openTabs.includes('terminal') && activeTab === 'terminal' && (
          <div className="h-full flex flex-col justify-between space-y-2 animate-fade-in">
            {/* Terminal Logs Output */}
            <div className="flex-1 overflow-y-auto bg-black/60 border border-white/10 rounded-xl p-3 font-mono text-xs text-gray-300 space-y-1 select-text">
              {terminalLogs.length === 0 && (
                <div className="text-[11px] text-gray-500">
                  PowerShell Terminal Ready. Type command below and press Enter.
                </div>
              )}
              {terminalLogs.map((log, idx) => (
                <pre
                  key={idx}
                  className={`whitespace-pre-wrap break-all ${
                    log.isError ? 'text-rose-400' : 'text-gray-200'
                  }`}
                >
                  {log.text}
                </pre>
              ))}
            </div>

            {/* Command Input Box */}
            <div className="space-y-1.5 shrink-0">
              <div className="flex items-center space-x-1.5">
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRunCommand()}
                  placeholder={tr.terminalPlaceholder}
                  className="flex-1 px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs text-gray-200 font-mono focus:outline-none focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={() => handleRunCommand()}
                  disabled={isRunning || !command.trim()}
                  className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs disabled:opacity-50 transition-colors flex items-center space-x-1"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>{isRunning ? tr.running : tr.run}</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-[10px] text-gray-400 px-1">
                <span>PowerShell Core</span>
                <button
                  type="button"
                  onClick={() => setTerminalLogs([])}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  {tr.clearLogs}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: WEB PREVIEW */}
        {openTabs.includes('browser') && activeTab === 'browser' && (
          <div className="h-full flex flex-col space-y-2 animate-fade-in">
            {/* Browser Address Bar */}
            <div className="flex items-center space-x-1.5 shrink-0">
              <input
                type="text"
                value={browserUrl}
                onChange={(e) => setBrowserUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setIframeKey((prev) => prev + 1)}
                placeholder={tr.browserPlaceholder}
                className="flex-1 px-3 py-1 rounded-xl bg-black/40 border border-white/10 text-xs text-gray-200 font-mono focus:outline-none focus:border-sky-500"
              />
              <button
                type="button"
                onClick={() => setIframeKey((prev) => prev + 1)}
                title={tr.refresh}
                className="p-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 hover:text-white border border-white/10 transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <a
                href={browserUrl}
                target="_blank"
                rel="noreferrer"
                title="Mở trong trình duyệt ngoài"
                className="p-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 hover:text-white border border-white/10 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Webview / Iframe Sandbox */}
            <div className="flex-1 rounded-xl overflow-hidden border border-white/10 bg-white">
              <iframe
                key={iframeKey}
                src={browserUrl}
                title="Web Preview"
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            </div>
          </div>
        )}

        {/* TAB 4: OFFLINE RAG RETRIEVAL */}
        {openTabs.includes('rag') && activeTab === 'rag' && (
          <div className="space-y-3 animate-fade-in">
            <div className="p-3.5 rounded-xl glass-card border border-sky-500/30 space-y-2">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-sky-400" />
                <span className="font-bold text-xs text-white">Offline Vector RAG</span>
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                {tr.ragExplanation}
              </p>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                placeholder={tr.ragSearchPlaceholder}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-gray-200 font-mono focus:outline-none focus:border-sky-500"
              />
              <button
                type="button"
                className="w-full py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-semibold transition-colors"
              >
                {tr.ragSearchBtn}
              </button>
            </div>
          </div>
        )}

        {/* TAB 5: WORKSPACE SYSTEM PROMPT */}
        {openTabs.includes('prompt') && activeTab === 'prompt' && (
          <div className="space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-white">{tr.promptLabel}</span>
              {isPromptSaved && (
                <span className="text-[10px] font-mono text-emerald-400 flex items-center space-x-1 animate-fade-in">
                  <Check className="w-3 h-3" />
                  <span>{tr.promptSaved}</span>
                </span>
              )}
            </div>

            <p className="text-[11px] text-gray-400 leading-relaxed">
              {tr.systemPromptDesc}
            </p>

            <textarea
              rows={8}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="e.g. Always respond in concise TypeScript, write unit tests for each function..."
              className="w-full p-2.5 rounded-xl bg-black/40 border border-white/10 text-gray-200 text-xs focus:outline-none focus:border-sky-500 font-mono leading-relaxed resize-none"
            />

            <button
              type="button"
              onClick={() => {
                onUpdateSystemPrompt(systemPrompt);
                setIsPromptSaved(true);
                setTimeout(() => setIsPromptSaved(false), 2000);
              }}
              className="w-full py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-md shadow-sky-500/20 transition-colors"
            >
              {tr.savePrompt}
            </button>
          </div>
        )}
      </div>

      {/* 4. Bottom Context Pinned Files summary */}
      <div className="p-3 border-t border-white/10 bg-black/30">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1.5">
            <Pin className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-semibold text-gray-200">{tr.pinnedFiles}</span>
          </div>
          <span className="font-mono text-[10px] text-sky-400 font-bold">
            {pinnedFiles.length} file(s)
          </span>
        </div>
        <div className="mt-1.5 max-h-16 overflow-y-auto space-y-1">
          {pinnedFiles.length === 0 ? (
            <p className="text-[10px] text-gray-500 italic">{tr.noPinnedFiles}</p>
          ) : (
            pinnedFiles.map((file) => (
              <div
                key={file}
                className="flex items-center justify-between text-[11px] text-gray-300 font-mono bg-white/[0.03] px-2 py-0.5 rounded-lg border border-white/5"
              >
                <span className="truncate max-w-[240px]">{file}</span>
                <button
                  type="button"
                  onClick={() => onTogglePinFile(file)}
                  className="hover:text-red-400 text-gray-500 ml-1"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
});

// Tree node component - Memoized
const FileTreeNode: React.FC<{
  node: FileNode;
  pinnedFiles: string[];
  onTogglePin: (relPath: string) => void;
}> = React.memo(({ node, pinnedFiles, onTogglePin }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isPinned = pinnedFiles.includes(node.relativePath);

  if (node.isDirectory) {
    return (
      <div>
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-1.5 py-1 px-2 rounded-lg hover:bg-white/[0.06] cursor-pointer text-xs text-gray-300 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          )}
          <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="font-semibold truncate">{node.name}</span>
        </div>
        {isExpanded && node.children && (
          <div className="pl-4 border-l border-white/10 ml-2 mt-0.5 space-y-0.5">
            {node.children.map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                pinnedFiles={pinnedFiles}
                onTogglePin={onTogglePin}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="group flex items-center justify-between py-1 px-2 rounded-lg hover:bg-white/[0.06] text-xs text-gray-300 transition-colors">
      <div className="flex items-center space-x-1.5 truncate">
        <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <span className="truncate font-mono text-[11px]">{node.name}</span>
      </div>
      <button
        onClick={() => onTogglePin(node.relativePath)}
        title={isPinned ? 'Unpin from context' : 'Pin to context'}
        className={`p-1 rounded transition-colors ${
          isPinned
            ? 'text-sky-400 bg-sky-500/20'
            : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-sky-400 hover:bg-white/10'
        }`}
      >
        <Pin className="w-3 h-3" />
      </button>
    </div>
  );
});
