import React, { useRef, useEffect } from 'react';
import type { ChatSession, ChatMessage, LocalSkill, Workspace, ProviderConfig } from '../../types.js';
import type { FileNode } from '../../workspace-fs.js';
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
}

export const ChatView: React.FC<ChatViewProps> = ({
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
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const quickStarters = [
    {
      icon: <Code2 className="w-4 h-4 text-sky-400" />,
      title: 'Review Project Code',
      desc: 'Check for memory leaks, unhandled exceptions & clean code',
      prompt: '/review Hãy kiểm tra mã nguồn trong dự án và đề xuất các điểm tối ưu hiệu năng!',
    },
    {
      icon: <Database className="w-4 h-4 text-emerald-400" />,
      title: 'Analyze Architecture',
      desc: 'Explain dependencies, data flow & module boundaries',
      prompt: 'Phân tích kiến trúc tổng thể của workspace này và luồng xử lý dữ liệu chính.',
    },
    {
      icon: <Brain className="w-4 h-4 text-amber-400" />,
      title: 'Deep Thinking Mode',
      desc: 'Formulate step-by-step reasoning for complex algorithms',
      prompt: 'Hãy dùng tư duy logic từng bước (Deep Reasoning) để giải bài toán tối ưu hóa thuật toán sau:',
    },
    {
      icon: <Zap className="w-4 h-4 text-purple-400" />,
      title: 'Generate Unit Tests',
      desc: 'Create thorough test suites for critical components',
      prompt: 'Viết bộ kiểm thử tự động (Unit Tests) đầy đủ bao phủ các trường hợp biên.',
    },
  ];

  if (!activeSession) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0d1117] text-gray-500 text-sm space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-[#161b22] border border-[#30363d] flex items-center justify-center text-sky-400 shadow-2xl shadow-sky-500/10">
          <MessageSquare className="w-7 h-7" />
        </div>
        <div className="text-center space-y-1">
          <p className="font-semibold text-gray-300">Select or Create a Conversation</p>
          <p className="text-xs text-gray-500">Pick a chat session on the left or press New Chat to begin.</p>
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
                What would you like to build today?
              </h1>
              <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
                Running locally on your <span className="text-amber-400 font-semibold">GTX 1650 (CUDA)</span> or synced with <span className="text-sky-400 font-semibold">FreeLLM Cloud</span>.
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
                      Send ↵
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
          />
        </div>
      </div>
    </div>
  );
};
