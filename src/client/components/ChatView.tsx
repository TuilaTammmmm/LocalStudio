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
  onAttachFile?: (file: string) => void;
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
  onAttachFile,
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

  const [isDragOverChat, setIsDragOverChat] = React.useState(false);

  const handleChatDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverChat(true);
  };

  const handleChatDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverChat(false);
  };

  const handleChatDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverChat(false);

    const localAiData = e.dataTransfer.getData('application/x-localai-file');
    const plainText = e.dataTransfer.getData('text/plain');

    if (localAiData) {
      try {
        const parsed = JSON.parse(localAiData);
        if (parsed.path && onAttachFile) {
          onAttachFile(parsed.path);
          return;
        }
      } catch {}
    }

    if (plainText && onAttachFile) {
      onAttachFile(plainText);
      return;
    }
  };

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
    <div
      onDragOver={handleChatDragOver}
      onDragLeave={handleChatDragLeave}
      onDrop={handleChatDrop}
      className="flex-1 flex flex-col h-full bg-[#0d1117] overflow-hidden relative"
    >
      {/* Global Chat Drop Cue Overlay */}
      {isDragOverChat && (
        <div className="absolute inset-0 z-50 bg-sky-950/70 backdrop-blur-sm border-2 border-dashed border-sky-400 flex items-center justify-center pointer-events-none animate-fade-in">
          <div className="px-5 py-3 rounded-2xl bg-[#161b22] border border-sky-400 text-sky-300 font-bold text-sm shadow-2xl flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-sky-400 animate-spin" />
            <span>{currentLang === 'vi' ? 'Thả tệp vào đây để đính kèm vào ngữ cảnh chat' : 'Drop file here to attach to chat context'}</span>
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="min-h-full flex flex-col items-center justify-center p-8 max-w-2xl mx-auto space-y-4 animate-fade-in text-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-xl shadow-sky-500/10">
              <Sparkles className="w-6 h-6 animate-pulse-subtle" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {tr.whatToBuild}
              </h1>
              <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                {tr.runningOnHw}
              </p>
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
            onAttachFile={onAttachFile}
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
