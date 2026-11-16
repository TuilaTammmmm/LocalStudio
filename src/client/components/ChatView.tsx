import React, { useRef, useEffect, useState } from 'react';
import type { ChatSession, ChatMessage, LocalSkill, Workspace } from '../../types.js';
import type { FileNode } from '../../workspace-fs.js';
import { ChatMessageItem } from './ChatMessageItem.js';
import { ChatInput } from './ChatInput.js';
import {
  Sparkles,
  MessageSquare,
  Search,
  Code2,
  Database,
  Brain,
  Zap,
  Compass,
  Eye,
  Globe,
  ChevronDown,
  Check,
} from 'lucide-react';

interface ChatViewProps {
  activeSession: ChatSession | null;
  activeWorkspace: Workspace | null;
  messages: ChatMessage[];
  pinnedFiles: string[];
  availableSkills: LocalSkill[];
  fileTree: FileNode[];
  activeModelName?: string;
  isAutoRoute?: boolean;
  availableModels?: string[];
  onSelectModel: (name: string, isAuto?: boolean) => void;
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
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

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

  const quickModels = [
    {
      id: 'qwen3b',
      label: 'Qwen-3B',
      matchKey: '3b',
      modelId: 'Qwen2.5-3B-Instruct-Q4_K_M.gguf',
      icon: <Zap className="w-3 h-3 text-amber-400" />,
      desc: 'Fast local general chat, low VRAM footprint (~1.9GB)',
    },
    {
      id: 'coder7b',
      label: 'Coder-7B',
      matchKey: 'coder',
      modelId: 'Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf',
      icon: <Code2 className="w-3 h-3 text-sky-400" />,
      desc: 'Specialized for code review, debugging & refactoring',
    },
    {
      id: 'deepseek_r1',
      label: 'DeepSeek-R1',
      matchKey: 'r1',
      modelId: 'DeepSeek-R1-Distill-Qwen-8B-Q4_K_M.gguf',
      icon: <Brain className="w-3 h-3 text-purple-400" />,
      desc: 'Deep reasoning model with transparent chain-of-thought',
    },
    {
      id: 'vision',
      label: 'Vision (Qwen2-VL)',
      matchKey: 'vl',
      modelId: 'Qwen2-VL-7B-Instruct-Q4_K_M.gguf',
      icon: <Eye className="w-3 h-3 text-emerald-400" />,
      desc: 'Multimodal vision model for screenshots, diagrams & charts',
    },
    {
      id: 'freellm',
      label: 'FreeLLM Cloud',
      matchKey: 'llama-3.3-70b',
      modelId: 'llama-3.3-70b-instruct',
      icon: <Globe className="w-3 h-3 text-cyan-400" />,
      desc: 'Heavy context & complex queries offloaded to FreeLLM API',
    },
  ];

  // Default models combined with custom models from provider
  const allModelChoices = Array.from(
    new Set([
      'Qwen2.5-3B-Instruct-Q4_K_M.gguf',
      'Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf',
      'DeepSeek-R1-Distill-Qwen-8B-Q4_K_M.gguf',
      'Qwen2-VL-7B-Instruct-Q4_K_M.gguf',
      'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
      'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
      'llama-3.3-70b-instruct',
      ...availableModels,
    ])
  );

  const filteredModels = allModelChoices.filter((m) =>
    m.toLowerCase().includes(searchFilter.toLowerCase())
  );

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
      {/* 1. Glassy In-Chat Model Switcher & Auto-Route Bar */}
      <div className="border-b border-[#30363d]/70 bg-[#161b22]/90 backdrop-blur-md px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 z-20 shrink-0">
        <div className="flex items-center space-x-2 overflow-x-auto py-0.5 max-w-full">
          {/* Auto Route Pill */}
          <button
            onClick={() => onSelectModel('auto', true)}
            title="Auto Model Route: Tự động phân loại Code -> Coder, Suy luận -> DeepSeek-R1, Ảnh -> Vision (Qwen2-VL), Chat -> Qwen-3B"
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm ${
              isAutoRoute
                ? 'bg-gradient-to-r from-amber-500/20 to-sky-500/20 text-amber-300 border border-amber-500/50 ring-1 ring-amber-500/30'
                : 'bg-[#0d1117] text-gray-400 hover:text-white border border-[#30363d]'
            }`}
          >
            <Compass className={`w-3.5 h-3.5 ${isAutoRoute ? 'text-amber-400 animate-spin-slow' : 'text-gray-400'}`} />
            <span>🔮 Auto-Route</span>
            {isAutoRoute && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping ml-0.5" />
            )}
          </button>

          {/* Quick Models */}
          {quickModels.map((m) => {
            const isSelected = !isAutoRoute && activeModelName.toLowerCase().includes(m.matchKey.toLowerCase());
            return (
              <button
                key={m.id}
                onClick={() => onSelectModel(m.modelId, false)}
                title={m.desc}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs transition-all ${
                  isSelected
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50 font-semibold shadow-sm'
                    : 'bg-[#0d1117]/80 text-gray-400 hover:text-gray-200 border border-[#30363d]/60 hover:border-gray-500'
                }`}
              >
                {m.icon}
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Model Search & Current Active Indicator */}
        <div className="flex items-center space-x-2 relative">
          <button
            onClick={() => setShowSearchDropdown(!showSearchDropdown)}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] text-xs text-gray-300 transition-colors"
          >
            <Search className="w-3 h-3 text-gray-400" />
            <span className="text-[11px] font-mono truncate max-w-[130px]">
              {isAutoRoute ? 'Auto: Smart Dispatch' : activeModelName}
            </span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>

          {/* Searchable Dropdown Popup */}
          {showSearchDropdown && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl z-50 p-2 space-y-1.5 animate-slide-up backdrop-blur-xl">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Tìm hoặc gõ tên model..."
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-sky-500/80"
                  autoFocus
                />
              </div>

              <div className="max-h-52 overflow-y-auto space-y-1 pt-1">
                <button
                  onClick={() => {
                    onSelectModel('auto', true);
                    setShowSearchDropdown(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors ${
                    isAutoRoute ? 'bg-amber-500/15 text-amber-300 font-semibold' : 'text-gray-300 hover:bg-[#21262d]'
                  }`}
                >
                  <div className="flex items-center space-x-1.5">
                    <Compass className="w-3.5 h-3.5 text-amber-400" />
                    <span>Auto-Route (Smart Dispatch)</span>
                  </div>
                  {isAutoRoute && <Check className="w-3 h-3 text-amber-400" />}
                </button>

                {filteredModels.map((m) => {
                  const isCur = !isAutoRoute && activeModelName === m;
                  return (
                    <button
                      key={m}
                      onClick={() => {
                        onSelectModel(m, false);
                        setShowSearchDropdown(false);
                      }}
                      className={`w-full flex items-center justify-between p-1.5 rounded-lg text-left text-xs transition-colors font-mono truncate ${
                        isCur ? 'bg-sky-500/15 text-sky-400 font-semibold' : 'text-gray-300 hover:bg-[#21262d]'
                      }`}
                    >
                      <span className="truncate">{m}</span>
                      {isCur && <Check className="w-3 h-3 text-sky-400 shrink-0 ml-1" />}
                    </button>
                  );
                })}

                {filteredModels.length === 0 && searchFilter.trim() && (
                  <button
                    onClick={() => {
                      onSelectModel(searchFilter.trim(), false);
                      setShowSearchDropdown(false);
                    }}
                    className="w-full p-2 text-left text-xs text-sky-400 hover:bg-[#21262d] rounded-lg border border-dashed border-sky-500/30"
                  >
                    Dùng model tùy chỉnh: "{searchFilter.trim()}"
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

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
          />
        </div>
      </div>
    </div>
  );
};
