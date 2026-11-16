import React, { useState } from 'react';
import type { Workspace, ChatSession } from '../../types.js';
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
} from 'lucide-react';

interface LeftSidebarProps {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  sessions: ChatSession[];
  activeSession: ChatSession | null;
  onSelectWorkspace: (ws: Workspace) => void;
  onSelectSession: (session: ChatSession) => void;
  onNewChat: () => void;
  onNewWorkspace: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onOpenSettings: () => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  workspaces,
  activeWorkspace,
  sessions,
  activeSession,
  onSelectWorkspace,
  onSelectSession,
  onNewChat,
  onNewWorkspace,
  onDeleteSession,
  onOpenSettings,
}) => {
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="w-68 h-full bg-[#161b22] border-r border-[#30363d] flex flex-col justify-between shrink-0 select-none">
      {/* 1. Top Section: Workspace Selector & New Chat */}
      <div className="p-3 border-b border-[#30363d] space-y-2.5">
        <div className="relative">
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
                  {activeWorkspace ? activeWorkspace.name : 'Select Project'}
                </span>
                <span className="text-[10px] text-gray-400 font-mono block truncate">
                  {activeWorkspace ? activeWorkspace.folderPath.split(/[\\/]/).pop() : 'No folder'}
                </span>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-1 group-hover:text-white" />
          </button>

          {/* Workspace Dropdown */}
          {showWorkspaceMenu && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl z-50 overflow-hidden py-1 animate-slide-up backdrop-blur-xl">
              <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
                Active Projects
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
                  <span>+ Add Project Folder</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* New Chat Button */}
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-sky-400 hover:from-sky-400 hover:to-sky-300 text-slate-950 font-bold text-xs shadow-lg shadow-sky-500/15 transition-all duration-150 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>New Chat</span>
          <span className="ml-auto text-[10px] opacity-75 font-mono">Ctrl+N</span>
        </button>

        {/* Search Bar for Chats */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="w-full pl-7 pr-2.5 py-1.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-gray-200 placeholder-gray-500 text-xs focus:outline-none focus:border-sky-500/80"
          />
          <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* 2. Middle Section: Chats Sessions List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="px-2.5 py-1 text-[10px] font-semibold text-gray-400 tracking-wider uppercase flex items-center justify-between">
          <span>Chat History</span>
          <span className="text-[10px] font-mono text-gray-500">{sessions.length}</span>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="p-4 text-center text-xs text-gray-500">
            {searchQuery ? 'No matching chats found.' : 'No chats yet in this folder.'}
          </div>
        ) : (
          filteredSessions.map((sess) => {
            const isActive = activeSession?.id === sess.id;
            return (
              <div
                key={sess.id}
                onClick={() => onSelectSession(sess)}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs cursor-pointer transition-all duration-150 ${
                  isActive
                    ? 'bg-[#21262d] text-sky-400 border border-sky-500/25 shadow-sm font-semibold'
                    : 'text-gray-300 hover:bg-[#21262d]/60 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2.5 truncate">
                  <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-sky-400' : 'text-gray-500'}`} />
                  <span className="truncate">{sess.title}</span>
                </div>
                <button
                  onClick={(e) => onDeleteSession(sess.id, e)}
                  title="Delete chat"
                  className="opacity-0 group-hover:opacity-100 hover:text-red-400 text-gray-500 p-1 rounded transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
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
            <span className="font-semibold text-xs">Settings & Skills</span>
          </div>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
          </span>
        </button>
      </div>
    </aside>
  );
};
