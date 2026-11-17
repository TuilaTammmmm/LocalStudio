import React, { useState, useEffect } from 'react';
import type { Workspace, ChatSession } from '../../types.js';
import { type Language, type Translations, dictionaries, getLanguage } from '../i18n.js';
import {
  FolderKanban,
  Plus,
  MessageSquare,
  Trash2,
  Settings,
  ChevronDown,
  FolderPlus,
  Search,
  Sparkles,
  Pencil,
  Check,
} from 'lucide-react';

interface LeftSidebarProps {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  sessions: ChatSession[];
  activeSession: ChatSession | null;
  lang?: Language;
  t?: Translations;
  onSelectWorkspace: (ws: Workspace) => void;
  onSelectSession: (session: ChatSession) => void;
  onNewChat: () => void;
  onNewWorkspace: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onRenameSession?: (id: string, newTitle: string) => void;
  onRenameWorkspace?: (id: string, newName: string) => void;
  onOpenSettings: () => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = React.memo(({
  workspaces,
  activeWorkspace,
  sessions,
  activeSession,
  lang,
  t: propT,
  onSelectWorkspace,
  onSelectSession,
  onNewChat,
  onNewWorkspace,
  onDeleteSession,
  onRenameSession,
  onRenameWorkspace,
  onOpenSettings,
}) => {
  const currentLang = lang || getLanguage();
  const tr = propT || dictionaries[currentLang];
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isEditingWorkspace, setIsEditingWorkspace] = useState(false);
  const [workspaceNameInput, setWorkspaceNameInput] = useState('');

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close dropdown on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showWorkspaceMenu) {
        setShowWorkspaceMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showWorkspaceMenu]);

  return (
    <aside className="w-68 h-full bg-[#161b22] border-r border-[#30363d] flex flex-col justify-between shrink-0 select-none">
      {/* 1. Top Section: Workspace Selector & New Chat */}
      <div className="p-3 border-b border-[#30363d] space-y-2.5">
        <div className="relative">
          {/* Workspace Button with Inline Rename Option */}
          {isEditingWorkspace && activeWorkspace ? (
            <div className="flex items-center space-x-1.5 p-1 rounded-xl bg-[#0d1117] border border-sky-500">
              <input
                type="text"
                autoFocus
                value={workspaceNameInput}
                onChange={(e) => setWorkspaceNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (workspaceNameInput.trim() && onRenameWorkspace && workspaceNameInput !== activeWorkspace.name) {
                      onRenameWorkspace(activeWorkspace.id, workspaceNameInput.trim());
                    }
                    setIsEditingWorkspace(false);
                  } else if (e.key === 'Escape') {
                    setIsEditingWorkspace(false);
                  }
                }}
                className="flex-1 px-2 py-1 bg-transparent text-white text-xs font-bold focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (workspaceNameInput.trim() && onRenameWorkspace && workspaceNameInput !== activeWorkspace.name) {
                    onRenameWorkspace(activeWorkspace.id, workspaceNameInput.trim());
                  }
                  setIsEditingWorkspace(false);
                }}
                className="p-1 text-emerald-400 hover:text-emerald-300"
                title="Lưu tên dự án"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
              className="w-full flex items-center justify-between p-2 rounded-xl bg-[#0d1117] hover:bg-[#21262d] text-left transition-colors duration-150 border border-[#30363d] shadow-sm group"
            >
              <div className="flex items-center space-x-2.5 truncate">
                <div className="w-6 h-6 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                  <FolderKanban className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <span className="font-bold text-xs text-[#e6edf3] block truncate">
                    {activeWorkspace ? activeWorkspace.name : tr.workspaces}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono block truncate">
                    {activeWorkspace ? activeWorkspace.folderPath.split(/[\\/]/).pop() : 'No folder'}
                  </span>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-1 group-hover:text-white" />
            </button>
          )}

          {/* Workspace Dropdown */}
          {showWorkspaceMenu && (
            <>
              <div
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setShowWorkspaceMenu(false)}
              />
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl z-50 overflow-hidden py-1 animate-slide-up backdrop-blur-xl">
                <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-gray-400 uppercase flex items-center justify-between">
                  <span>{tr.workspaces}</span>
                  {activeWorkspace && onRenameWorkspace && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowWorkspaceMenu(false);
                        setWorkspaceNameInput(activeWorkspace.name);
                        setIsEditingWorkspace(true);
                      }}
                      className="text-[10px] text-sky-400 hover:underline flex items-center space-x-1 lowercase font-normal"
                      title="Đổi tên dự án này"
                    >
                      <Pencil className="w-2.5 h-2.5" />
                      <span>{currentLang === 'vi' ? 'Đổi tên' : 'Rename'}</span>
                    </button>
                  )}
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => {
                        onSelectWorkspace(ws);
                        setShowWorkspaceMenu(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#21262d] transition-colors ${
                        activeWorkspace?.id === ws.id ? 'bg-[#21262d] text-sky-400 font-semibold' : 'text-gray-300'
                      }`}
                    >
                      <span className="truncate">{ws.name}</span>
                      <span className="text-[10px] text-gray-500 font-mono truncate max-w-[80px]">
                        {ws.folderPath.split(/[\\/]/).pop()}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="border-t border-[#30363d] mt-1 pt-1">
                  <button
                    onClick={() => {
                      setShowWorkspaceMenu(false);
                      onNewWorkspace();
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-sky-400 hover:bg-[#21262d] font-semibold transition-colors"
                  >
                    <FolderPlus className="w-4 h-4" />
                    <span>+ {tr.addProject}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* New Chat Button - cleanly supports [data-accent] */}
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-lg shadow-sky-500/15 transition-all duration-150 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>{tr.newChat}</span>
          <span className="ml-auto text-[10px] opacity-75 font-mono">Ctrl+N</span>
        </button>

        {/* Search Bar for Chats */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={tr.search}
            className="w-full pl-7 pr-2.5 py-1.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-gray-200 placeholder-gray-500 text-xs focus:outline-none focus:border-sky-500/80"
          />
          <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* 2. Middle Section: Chats Sessions List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="px-2.5 py-1 text-[10px] font-semibold text-gray-400 tracking-wider uppercase flex items-center justify-between">
          <span>{tr.chatHistory}</span>
          <span className="text-[10px] font-mono text-gray-500">{sessions.length}</span>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="p-4 text-center text-xs text-gray-500">
            {tr.noChats}
          </div>
        ) : (
          filteredSessions.map((sess) => {
            const isActive = activeSession?.id === sess.id;
            const isEditing = editingSessionId === sess.id;

            return (
              <div
                key={sess.id}
                onClick={() => {
                  if (!isEditing) onSelectSession(sess);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingSessionId(sess.id);
                  setEditingTitle(sess.title);
                }}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs cursor-pointer transition-all duration-150 ${
                  isActive
                    ? 'bg-[#21262d] text-sky-400 border border-sky-500/25 shadow-sm font-semibold'
                    : 'text-gray-300 hover:bg-[#21262d]/60 hover:text-white'
                }`}
              >
                {isEditing ? (
                  <div className="flex-1 flex items-center space-x-1.5 mr-1" onClick={(e) => e.stopPropagation()}>
                    <MessageSquare className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <input
                      type="text"
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (editingTitle.trim() && onRenameSession && editingTitle !== sess.title) {
                            onRenameSession(sess.id, editingTitle.trim());
                          }
                          setEditingSessionId(null);
                        } else if (e.key === 'Escape') {
                          setEditingSessionId(null);
                        }
                      }}
                      onBlur={() => {
                        if (editingTitle.trim() && onRenameSession && editingTitle !== sess.title) {
                          onRenameSession(sess.id, editingTitle.trim());
                        }
                        setEditingSessionId(null);
                      }}
                      className="w-full px-2 py-0.5 rounded bg-[#0d1117] border border-sky-500 text-xs text-white focus:outline-none"
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center space-x-2.5 truncate" title="Bấm đúp để đổi tên cuộc trò chuyện">
                      <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-sky-400' : 'text-gray-500'}`} />
                      <span className="truncate">{sess.title}</span>
                    </div>
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onRenameSession && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingSessionId(sess.id);
                            setEditingTitle(sess.title);
                          }}
                          title="Đổi tên"
                          className="hover:text-sky-400 text-gray-500 p-1 rounded transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => onDeleteSession(sess.id, e)}
                        title={tr.delete}
                        className="hover:text-red-400 text-gray-500 p-1 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 3. Bottom Footer: Settings Button */}
      <div className="p-3 border-t border-[#30363d] bg-[#161b22]">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#21262d] text-gray-300 hover:text-white text-xs transition-colors border border-transparent hover:border-[#30363d]"
        >
          <div className="flex items-center space-x-2.5">
            <Settings className="w-4 h-4 text-gray-400" />
            <span className="font-semibold text-xs">{tr.settingsAndSkills}</span>
          </div>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
          </span>
        </button>
      </div>
    </aside>
  );
});
