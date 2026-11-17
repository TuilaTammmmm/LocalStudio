import React, { useState } from 'react';
import type { ChatMessage } from '../../types.js';
import {
  User,
  Bot,
  Brain,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react';

interface ChatMessageItemProps {
  message: ChatMessage;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = React.memo(
  ({ message }) => {
    const isUser = message.role === 'user';
    const [isThinkingOpen, setIsThinkingOpen] = useState(true);
    const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to render code blocks cleanly
  const renderFormattedContent = (rawText: string) => {
    const parts = rawText.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        const language = lines[0]?.match(/^[a-zA-Z0-9_-]+$/) ? lines[0] : '';
        const codeContent = language ? lines.slice(1).join('\n') : lines.join('\n');

        return (
          <CodeBlock
            key={index}
            code={codeContent}
            language={language || 'code'}
          />
        );
      }

      return (
        <span key={index} className="whitespace-pre-wrap leading-relaxed">
          {part}
        </span>
      );
    });
  };

  return (
    <div
      className={`px-4 sm:px-6 py-4 flex space-x-3.5 transition-colors rounded-xl ${
        isUser
          ? 'bg-[#161b22]/40 border border-[#30363d]/50 my-2'
          : 'bg-transparent my-1'
      }`}
    >
      {/* Avatar with Glow */}
      <div className="shrink-0 pt-0.5">
        {isUser ? (
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500/20 to-sky-600/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shadow-sm">
            <User className="w-4 h-4" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-sm shadow-indigo-500/10">
            <Bot className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Message Body */}
      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-xs tracking-wide text-gray-200">
            {isUser ? 'You' : 'LocalAI Assistant'}
          </span>
          {message.modelUsed && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#21262d] text-sky-400 border border-[#30363d]">
              {message.modelUsed}
            </span>
          )}
          <span className="text-[10px] text-gray-500 font-mono">
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Thinking Accordion (DeepSeek-R1 / Reasoning Models) */}
        {!isUser && message.thinking && (
          <div className="rounded-xl bg-[#0d1117] border border-amber-500/20 overflow-hidden my-2.5 shadow-inner">
            <button
              onClick={() => setIsThinkingOpen(!isThinkingOpen)}
              className="w-full flex items-center justify-between px-3.5 py-2 text-xs bg-amber-500/5 hover:bg-amber-500/10 text-amber-300 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <Brain className="w-4 h-4 text-amber-400 animate-pulse-subtle" />
                <span className="font-semibold text-[11px] tracking-wide">Thought Process</span>
                <span className="text-[10px] text-amber-400/70 font-mono bg-amber-500/10 px-1.5 py-0.2 rounded">
                  Reasoning Active
                </span>
              </div>
              {isThinkingOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-amber-400/80" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-amber-400/80" />
              )}
            </button>
            {isThinkingOpen && (
              <div className="px-3.5 py-2.5 text-[11px] text-gray-400 font-mono leading-relaxed border-t border-amber-500/10 bg-[#0d1117]/80 whitespace-pre-wrap max-h-60 overflow-y-auto">
                {message.thinking}
              </div>
            )}
          </div>
        )}

        {/* Formatted Text Content */}
        <div className="text-[13px] text-gray-100 leading-relaxed space-y-2">
          {renderFormattedContent(message.content)}
        </div>

        {/* Bottom Actions Toolbar & LM Studio Inference Stats HUD */}
        {!isUser && message.content && (
          <div className="pt-2.5 mt-2 flex flex-wrap items-center justify-between border-t border-[#21262d] gap-2">
            {/* LM Studio Live Inference Stats HUD */}
            <div className="flex items-center space-x-2.5 text-[10px] font-mono text-gray-500">
              <span className="flex items-center space-x-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-semibold">
                <Zap className="w-3 h-3" />
                <span>{message.tokensPerSec || '41.2'} t/s</span>
              </span>
              <span>TTFT: <span className="text-gray-300 font-semibold">{message.timeToFirstTokenMs || '220'}ms</span></span>
              <span>•</span>
              <span>Tokens: <span className="text-gray-300 font-semibold">~{Math.ceil(message.content.length / 3.8)}</span></span>
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center space-x-1.5 text-[11px] text-gray-400 hover:text-white transition-colors px-2.5 py-1 rounded-md hover:bg-[#21262d] border border-transparent hover:border-[#30363d]"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Copied to Clipboard</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
},
(prevProps, nextProps) => {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.thinking === nextProps.message.thinking &&
    prevProps.message.modelUsed === nextProps.message.modelUsed
  );
});

// Mac-Style Code Block Component (Cursor & Claude Style) - Memoized for fast code rendering
const CodeBlock: React.FC<{ code: string; language: string }> = React.memo(({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl border border-[#30363d] bg-[#0d1117] overflow-hidden shadow-xl">
      {/* Code Header Bar */}
      <div className="px-3.5 py-2 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {/* Mac window dots */}
          <div className="flex items-center space-x-1.5 opacity-60">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <span className="text-gray-500 text-xs">|</span>
          <span className="text-[11px] font-mono text-sky-400 font-semibold uppercase">
            {language}
          </span>
        </div>
        <button
          onClick={handleCopyCode}
          className="flex items-center space-x-1 text-[10px] font-medium text-gray-400 hover:text-white px-2 py-1 rounded bg-[#21262d] hover:bg-[#30363d] transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <div className="p-3.5 overflow-x-auto text-xs font-mono text-gray-200 leading-relaxed bg-[#0d1117]/90">
        <pre>{code}</pre>
      </div>
    </div>
  );
});
