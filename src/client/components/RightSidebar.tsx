import React, { useState, useEffect } from 'react';
import type { Workspace } from '../../types.js';
import type { FileNode } from '../../workspace-fs.js';
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
} from 'lucide-react';

interface RightSidebarProps {
  activeWorkspace: Workspace | null;
  fileTree: FileNode[];
  pinnedFiles: string[];
  isOpen: boolean;
  onToggle?: () => void;
  onTogglePinFile: (relativePath: string) => void;
  onUpdateSystemPrompt: (prompt: string) => void;
}

type ToolTabId = 'files' | 'terminal' | 'browser' | 'rag' | 'prompt';

const ALL_TOOLS: Array<{ id: ToolTabId; label: string; icon: React.ReactNode }> = [
  { id: 'files', label: 'Files', icon: <FileCode className="w-3.5 h-3.5 text-sky-400" /> },
  { id: 'terminal', label: 'Shell', icon: <TerminalIcon className="w-3.5 h-3.5 text-rose-400" /> },
  { id: 'browser', label: 'Web', icon: <Globe className="w-3.5 h-3.5 text-emerald-400" /> },
  { id: 'rag', label: 'RAG', icon: <Database className="w-3.5 h-3.5 text-indigo-400" /> },
  { id: 'prompt', label: 'Prompt', icon: <FileText className="w-3.5 h-3.5 text-amber-400" /> },
];

export const RightSidebar: React.FC<RightSidebarProps> = ({
  activeWorkspace,
  fileTree,
  pinnedFiles,
  isOpen,
  onToggle,
  onTogglePinFile,
  onUpdateSystemPrompt,
}) => {
  const [width, setWidth] = useState(380);
  const [isResizing, setIsResizing] = useState(false);
  const [openTabs, setOpenTabs] = useState<ToolTabId[]>(['files']);
  const [activeTab, setActiveTab] = useState<ToolTabId>('files');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(activeWorkspace?.systemPrompt || '');
  const [isPromptSaved, setIsPromptSaved] = useState(false);

  // Terminal state
  const [command, setCommand] = useState('');
  const [terminalLogs, setTerminalLogs] = useState<Array<{ text: string; isError?: boolean }>>([
    { text: 'LocalAI Terminal [PowerShell]\nWorkspace: ' + (activeWorkspace?.folderPath || 'None') + '\n' },
  ]);
  const [isRunning, setIsRunning] = useState(false);

  // Browser state
  const [browserUrl, setBrowserUrl] = useState('http://localhost:3000');
  const [iframeKey, setIframeKey] = useState(0);

  // Resizing mouse handlers
  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 280 && newWidth <= 900) {
        setWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  if (!isOpen) return null;

  const openToolTab = (id: ToolTabId) => {
    if (!openTabs.includes(id)) {
      setOpenTabs((prev) => [...prev, id]);
    }
    setActiveTab(id);
    setShowAddMenu(false);
  };

  const closeToolTab = (id: ToolTabId, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = openTabs.filter((t) => t !== id);
    setOpenTabs(remaining);
    if (activeTab === id && remaining.length > 0) {
      setActiveTab(remaining[remaining.length - 1]);
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

      {/* 1. Header */}
      <div className="p-2.5 px-3 border-b border-white/10 flex items-center justify-between relative z-30 bg-black/20">
        <div className="flex items-center space-x-2 truncate">
          <Layers className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="font-bold text-xs tracking-wide text-white truncate">
            Workspace Tools
          </span>
          <span className="text-[10px] text-gray-500 font-mono">({width}px)</span>
        </div>

        <div className="text-[10px] text-gray-400 font-mono">
          {openTabs.length} open {openTabs.length === 1 ? 'tool' : 'tools'}
        </div>
      </div>

      {/* 2. Dynamic Open Tabs Bar with [+] Add Tool Button */}
      <div className="flex items-center border-b border-white/10 bg-black/40 text-xs px-2 py-1.5 space-x-1.5 overflow-x-auto relative z-40">
        {openTabs.map((tabId) => {
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
                title="Đóng tab này"
                className="hover:text-red-400 hover:bg-white/10 rounded-full p-0.5 ml-0.5 opacity-60 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        {/* [+] Add Tool Trigger with Anchor Dropdown */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowAddMenu(!showAddMenu)}
            title="Thêm công cụ mới vào panel (+)"
            className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-xs font-semibold transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="text-[11px] font-bold">Tool</span>
            <ChevronDown className="w-3 h-3 text-sky-400" />
          </button>

          {showAddMenu && (
            <>
              {/* Invisible Click-outside Backdrop */}
              <div
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setShowAddMenu(false)}
              />

              {/* Menu Popup */}
              <div className="absolute top-full left-0 mt-1 w-56 bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl z-50 p-1.5 space-y-1 animate-slide-up backdrop-blur-xl">
                <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 border-b border-[#30363d] pb-1 flex items-center justify-between">
                  <span>Available Tools</span>
                  <span className="text-[9px] text-gray-500">Click to open</span>
                </div>
                {ALL_TOOLS.map((t) => {
                  const isOpen = openTabs.includes(t.id);
                  const isCur = activeTab === t.id && isOpen;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => openToolTab(t.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors ${
                        isCur
                          ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30'
                          : 'text-gray-300 hover:bg-[#21262d]'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        {t.icon}
                        <span className="truncate">{t.label}</span>
                      </div>
                      {isOpen ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono">
                          Open
                        </span>
                      ) : (
                        <span className="text-[10px] text-sky-400 font-bold flex items-center">
                          <Plus className="w-3 h-3 mr-0.5" /> Add
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 3. Tab Contents */}
      <div className="flex-1 overflow-y-auto p-3">
        {openTabs.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-sky-400 shadow-lg shadow-sky-500/5">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-200">No Workspace Tool Active</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Choose a tool to display in this panel</p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full pt-2">
              {ALL_TOOLS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => openToolTab(t.id)}
                  className="flex items-center space-x-2 p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-left transition-all"
                >
                  {t.icon}
                  <span className="font-medium text-gray-200">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TAB 1: FILES EXPLORER */}
        {openTabs.includes('files') && activeTab === 'files' && (
          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Project Explorer</span>
              <span className="text-[10px] text-gray-400 font-mono">
                Click [📌] to pin
              </span>
            </div>
            {fileTree.length === 0 ? (
              <div className="text-center text-xs text-gray-500 py-6">
                Folder is empty or unindexed.
              </div>
            ) : (
              fileTree.map((node) => (
                <FileTreeNode
                  key={node.path}
                  node={node}
                  pinnedFiles={pinnedFiles}
                  onTogglePin={onTogglePinFile}
                />
              ))
            )}
          </div>
        )}

        {/* TAB 2: IN-APP TERMINAL */}
        {openTabs.includes('terminal') && activeTab === 'terminal' && (
          <div className="h-full flex flex-col font-mono text-xs overflow-hidden">
            {/* Quick Actions */}
            <div className="flex items-center space-x-1 pb-2 overflow-x-auto text-[10px]">
              {['git status', 'pnpm test', 'nvidia-smi', 'dir'].map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => handleRunCommand(cmd)}
                  className="px-2 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.12] text-gray-300 hover:text-sky-400 border border-white/10 transition-colors shrink-0"
                >
                  {cmd}
                </button>
              ))}
            </div>

            {/* Logs Area */}
            <div className="flex-1 overflow-y-auto p-2 rounded-xl bg-black/40 border border-white/10 space-y-1 text-[11px] select-text">
              {terminalLogs.map((log, idx) => (
                <div
                  key={idx}
                  className={`whitespace-pre-wrap leading-relaxed ${
                    log.isError ? 'text-red-400' : 'text-gray-300'
                  }`}
                >
                  {log.text}
                </div>
              ))}
            </div>

            {/* Input Bar */}
            <div className="mt-2 flex items-center space-x-1.5 p-1 rounded-xl bg-black/30 border border-white/10">
              <span className="text-rose-400 font-bold pl-1">&gt;</span>
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRunCommand();
                }}
                placeholder="powershell command..."
                className="flex-1 bg-transparent text-gray-100 text-xs focus:outline-none"
              />
              <button
                onClick={() => handleRunCommand()}
                disabled={isRunning || !command.trim()}
                className="p-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 disabled:opacity-40"
              >
                <Play className="w-3 h-3 fill-current" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: IN-APP BROWSER */}
        {openTabs.includes('browser') && activeTab === 'browser' && (
          <div className="h-full flex flex-col overflow-hidden">
            <div className="flex items-center space-x-1.5 pb-2">
              <button
                onClick={() => setIframeKey((k) => k + 1)}
                className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <input
                type="text"
                value={browserUrl}
                onChange={(e) => setBrowserUrl(e.target.value)}
                className="flex-1 px-2 py-1 rounded-lg bg-black/30 border border-white/10 text-gray-200 font-mono text-[11px] focus:outline-none focus:border-emerald-500"
              />
              <a
                href={browserUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="flex-1 rounded-xl overflow-hidden border border-white/10 bg-white">
              <iframe
                key={iframeKey}
                src={browserUrl}
                className="w-full h-full border-none"
                title="Workspace Browser"
              />
            </div>
          </div>
        )}

        {/* TAB 4: RAG */}
        {openTabs.includes('rag') && activeTab === 'rag' && (
          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-xl glass-card space-y-2">
              <div className="font-bold text-sky-400 flex items-center space-x-2">
                <Database className="w-4 h-4" />
                <span>Offline Vector Index</span>
              </div>
              <p className="text-gray-300 text-[11px] leading-relaxed">
                Parse and embed code/docs in this project folder using a local GGUF embedding model. 100% offline.
              </p>
              <button className="w-full mt-2 py-1.5 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-md shadow-sky-500/20">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Index Folder Now</span>
              </button>
            </div>
            <div className="text-[11px] text-gray-400 p-2.5 border border-dashed border-white/10 rounded-xl text-center">
              Storage: <span className="text-gray-300 font-mono">sqlite-vec</span> (0 chunks indexed)
            </div>
          </div>
        )}

        {/* TAB 5: FOLDER PROMPT */}
        {openTabs.includes('prompt') && activeTab === 'prompt' && (
          <div className="space-y-2.5 text-xs">
            <div className="text-[11px] font-semibold text-gray-300">
              Folder System Prompt:
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Every chat session in this folder inherits these system instructions.
            </p>
            <textarea
              rows={8}
              value={systemPrompt}
              onChange={(e) => {
                setSystemPrompt(e.target.value);
                setIsPromptSaved(false);
              }}
              placeholder="e.g. You are a Senior TypeScript Engineer. Write clean, modular, and type-safe code."
              className="w-full p-2.5 rounded-xl bg-black/40 border border-white/10 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-sky-500 text-xs font-mono leading-relaxed"
            />
            <button
              onClick={() => {
                onUpdateSystemPrompt(systemPrompt);
                setIsPromptSaved(true);
                setTimeout(() => setIsPromptSaved(false), 2000);
              }}
              className="w-full py-1.5 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-sky-400 font-semibold text-xs transition-colors flex items-center justify-center space-x-1.5"
            >
              {isPromptSaved ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Saved!</span>
                </>
              ) : (
                <span>Save Prompt</span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* 4. Bottom Context Summary */}
      <div className="p-3 border-t border-white/10 bg-black/20 text-xs">
        <div className="flex items-center justify-between text-gray-400 mb-1.5">
          <span className="text-[11px] font-semibold">Pinned Context</span>
          <span className="text-[10px] font-mono text-sky-400">
            {pinnedFiles.length} file(s)
          </span>
        </div>
        {pinnedFiles.length === 0 ? (
          <div className="text-[10px] text-gray-500 italic">No files pinned to context.</div>
        ) : (
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
            {pinnedFiles.map((f) => (
              <span
                key={f}
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-mono"
              >
                <span className="truncate max-w-[120px]">{f.split('/').pop()}</span>
                <button
                  onClick={() => onTogglePinFile(f)}
                  className="hover:text-red-400 ml-0.5"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};

// Tree node component
const FileTreeNode: React.FC<{
  node: FileNode;
  pinnedFiles: string[];
  onTogglePin: (relPath: string) => void;
}> = ({ node, pinnedFiles, onTogglePin }) => {
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
};
