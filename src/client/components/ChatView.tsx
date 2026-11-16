import React, { useRef, useEffect } from 'react';
import type { ChatSession, ChatMessage, LocalSkill, Workspace, ProviderConfig } from '../../types.js';
import type { FileNode } from '../../workspace-fs.js';
import { type Language, type Translations, dictionaries, getLanguage } from '../i18n.js';
import { ChatMessageItem } from './ChatMessageItem.js';
import { ChatInput } from './ChatInput.js';
import {
  Sparkles,
  MessageSquare,
  Code2,
  Database,
  Brain,
  Zap,
} from 'lucide-react';

interface ChatViewProps {
  activeSession: ChatSession | null;
  activeWorkspace: Workspace | null;
  messages: ChatMessage[];
  pinnedFiles: string[];
  availableSkills: LocalSkill[];
  fileTree: FileNode[];
  providers?: ProviderConfig[];
  activeProvider?: ProviderConfig | null;
  onSwitchProvider?: (providerId: string) => void;
  activeModelName?: string;
  isAutoRoute?: boolean;
  availableModels?: string[];
  onSelectModel?: (name: string, isAuto?: boolean) => void;
  onSendMessage: (text: string, hasImage?: boolean) => void;
  isStreaming: boolean;
  onStopStreaming: () => void;
  onRemovePinnedFile: (file: string) => void;
  lang?: Language;
  t?: Translations;
}

export const ChatView: React.FC<ChatViewProps> = React.memo(({
  activeSession,
  activeWorkspace,
  messages,
  pinnedFiles,
  availableSkills,
  fileTree,
  providers = [],
  activeProvider = null,
  onSwitchProvider,
  activeModelName = 'Qwen2.5-3B-Instruct',
  isAutoRoute = true,
  availableModels = [],
  onSelectModel,
  onSendMessage,
  isStreaming,
  onStopStreaming,
  onRemovePinnedFile,
  lang,
  t: propT,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentLang = lang || getLanguage();
  const tr = propT || dictionaries[currentLang];

  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const id = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [messages]);

  const quickStarters = [
    {
      icon: <Code2 className="w-4 h-4 text-sky-400" />,
      title: tr.quickStarterCodeTitle,
      desc: tr.quickStarterCodeDesc,
      prompt: tr.quickStarterCodePrompt,
    },
    {
      icon: <Database className="w-4 h-4 text-emerald-400" />,
      title: tr.quickStarterArchTitle,
      desc: tr.quickStarterArchDesc,
      prompt: tr.quickStarterArchPrompt,
    },
    {
      icon: <Brain className="w-4 h-4 text-amber-400" />,
      title: tr.quickStarterThinkTitle,
      desc: tr.quickStarterThinkDesc,
      prompt: tr.quickStarterThinkPrompt,
    },
    {
      icon: <Zap className="w-4 h-4 text-purple-400" />,
      title: tr.quickStarterTestTitle,
      desc: tr.quickStarterTestDesc,
      prompt: tr.quickStarterTestPrompt,
    },
  ];

  if (!activeSession) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0d1117] text-gray-500 text-sm space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-[#161b22] border border-[#30363d] flex items-center justify-center text-sky-400 shadow-2xl shadow-sky-500/10">
          <MessageSquare className="w-7 h-7" />
        </div>
        <div className="text-center space-y-1">
          <p className="font-semibold text-gray-300">{tr.selectOrCreateChat}</p>
          <p className="text-xs text-gray-500">{tr.pickChatDesc}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d1117] overflow-hidden relative">
      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="min-h-full flex flex-col items-center justify-center p-8 max-w-3xl mx-auto space-y-10 animate-fade-in">
            {/* Hero Section */}
            <div className="text-center space-y-3">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-gradient-to-r from-sky-500/10 to-indigo-500/10 border border-sky-500/20 text-sky-400 text-xs font-medium">
                <Sparkles className="w-3.5 h-3.5 animate-pulse-subtle" />
                <span>Local AI Studio Core Active</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {tr.whatToBuild}
              </h1>
              <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
                {tr.runningOnHw}
              </p>
            </div>

            {/* Quick-Starter Cards Grid (Cursor/Claude Style) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full">
              {quickStarters.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendMessage(item.prompt)}
                  className="group p-4 rounded-xl bg-[#161b22]/70 hover:bg-[#21262d] border border-[#30363d] hover:border-sky-500/40 text-left transition-all duration-200 hover:shadow-lg hover:shadow-sky-500/5 active:scale-[0.99] flex flex-col justify-between space-y-2"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="p-2 rounded-lg bg-[#0d1117] border border-[#30363d] group-hover:border-sky-500/30 transition-colors">
                      {item.icon}
                    </div>
                    <span className="text-[10px] font-mono text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      {tr.send} ↵
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-xs text-gray-200 group-hover:text-sky-400 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-[11px] text-gray-400 leading-snug mt-0.5">
                      {item.desc}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto w-full pt-6 pb-6 px-4 space-y-4">
            {messages.map((msg) => (
              <ChatMessageItem key={msg.id} message={msg} />
            ))}
          </div>
        )}
      </div>

      {/* Floating Modern Composer Bar */}
      <div className="p-4 pb-6 pt-2 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/95 to-transparent">
        <div className="max-w-4xl mx-auto w-full">
          <ChatInput
            onSendMessage={onSendMessage}
            isStreaming={isStreaming}
            onStopStreaming={onStopStreaming}
            pinnedFiles={pinnedFiles}
            onRemovePinnedFile={onRemovePinnedFile}
            availableSkills={availableSkills}
            fileTree={fileTree}
            providers={providers}
            activeProvider={activeProvider}
            onSwitchProvider={onSwitchProvider}
            activeModelName={activeModelName}
            isAutoRoute={isAutoRoute}
            availableModels={availableModels}
            onSelectModel={onSelectModel}
            lang={currentLang}
            t={tr}
          />
        </div>
      </div>
    </div>
  );
});
