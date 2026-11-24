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
  availableModels?: string[];
  onSelectModel?: (name: string) => void;
  onSendMessage: (text: string, hasImage?: boolean) => void;
  isStreaming: boolean;
  onStopStreaming: () => void;
  onRemovePinnedFile: (file: string) => void;
  onAttachFile?: (file: string) => void;
  lang?: Language;
  t?: Translations;
  onEditPrompt?: (prompt: string) => void;
  onRegenerateMessage?: (messageId: string, prompt?: string) => void;
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
  availableModels = [],
  onSelectModel,
  onSendMessage,
  isStreaming,
  onStopStreaming,
  onRemovePinnedFile,
  onAttachFile,
  lang,
  t: propT,
  onEditPrompt,
  onRegenerateMessage,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef(false);
  const currentLang = lang || getLanguage();
  const tr = propT || dictionaries[currentLang];
  const [isDragOverChat, setIsDragOverChat] = React.useState(false);

  const PAGE_SIZE = 35;
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);

  // Reset pagination window when active session changes
  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeSession?.id]);

  const hasOlderMessages = messages.length > visibleCount;
  const visibleMessages = React.useMemo(() => {
    if (messages.length <= visibleCount) return messages;
    return messages.slice(messages.length - visibleCount);
  }, [messages, visibleCount]);

  const handleLoadOlder = () => {
    if (!scrollRef.current) return;
    const prevScrollHeight = scrollRef.current.scrollHeight;
    const prevScrollTop = scrollRef.current.scrollTop;

    setVisibleCount((prev) => Math.min(messages.length, prev + PAGE_SIZE));

    requestAnimationFrame(() => {
      if (scrollRef.current) {
        const heightDiff = scrollRef.current.scrollHeight - prevScrollHeight;
        scrollRef.current.scrollTop = prevScrollTop + heightDiff;
      }
    });
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // Only lock to bottom if user is within 120px of bottom; if user scrolled up, keep their position
    isUserScrolledUp.current = distanceFromBottom > 120;

    // Infinite scroll up trigger
    if (el.scrollTop < 60 && hasOlderMessages) {
      handleLoadOlder();
    }
  };

  // Instant scroll on session switch - runs before paint (zero visual bounce)
  React.useLayoutEffect(() => {
    if (!scrollRef.current) return;
    isUserScrolledUp.current = false;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeSession?.id]);

  // Keep pinned to bottom during message streaming / updates unless user scrolled up
  React.useLayoutEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const lastMessage = messages[messages.length - 1];

    // If user just sent a message, snap to bottom immediately
    if (lastMessage?.role === 'user') {
      isUserScrolledUp.current = false;
    }

    // Only auto-scroll down if user is NOT scrolling up to read previous content
    if (!isUserScrolledUp.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const handleChatDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const f = e.dataTransfer.files[i];
        if (f.type.startsWith('image/')) {
          // Dispatch image to ChatInput for multimodal vision models
          window.dispatchEvent(new CustomEvent('localai:attach-image', { detail: { file: f } }));
        } else {
          const p = (f as any).path || f.name;
          if (p && onAttachFile) {
            onAttachFile(p);
          }
        }
      }
      return;
    }

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
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="min-h-full flex flex-col items-center justify-center p-8 max-w-2xl mx-auto space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-xl shadow-sky-500/10">
              <Sparkles className="w-6 h-6" />
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
          <div key={activeSession.id} className="max-w-4xl mx-auto w-full pt-6 pb-6 px-4 space-y-4">
            {hasOlderMessages && (
              <div className="flex justify-center pb-2">
                <button
                  type="button"
                  onClick={handleLoadOlder}
                  className="px-3.5 py-1 rounded-full bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] text-gray-400 hover:text-white text-xs font-mono transition-colors shadow-sm"
                >
                  ↑ {currentLang === 'vi' ? 'Tải thêm tin nhắn cũ hơn' : 'Load older messages'} ({messages.length - visibleCount})
                </button>
              </div>
            )}
            {visibleMessages.map((msg) => (
              <ChatMessageItem
                key={msg.id}
                message={msg}
                activeWorkspace={activeWorkspace}
                onEditPrompt={onEditPrompt}
                onRegenerate={onRegenerateMessage}
              />
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
