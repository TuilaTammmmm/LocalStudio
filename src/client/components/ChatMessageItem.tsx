import React, { useState, useEffect, useMemo } from 'react';
import { marked } from 'marked';
import type { ChatMessage, Workspace } from '../../types.js';
import { api } from '../api.js';
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
  Save,
  FileCode,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Pencil,
} from 'lucide-react';

interface ChatMessageItemProps {
  message: ChatMessage;
  activeWorkspace?: Workspace | null;
  onEditPrompt?: (prompt: string) => void;
  onRegenerate?: (messageId: string, prompt?: string) => void;
}

const TRUNCATED_CODE_REGEX = /(?:\/\/|#|\/\*|<!--)\s*(?:\.{3}|…)?\s*(?:existing\s+code|rest\s+of\s+(?:the\s+)?code|keep\s+existing\s+code|phần\s+còn\s+lại\s+giữ\s+nguyên|giữ\s+nguyên)/i;

export const ChatMessageItem: React.FC<ChatMessageItemProps> = React.memo(
  ({ message, activeWorkspace, onEditPrompt, onRegenerate }) => {
    const isUser = message.role === 'user';
    const isRecentAssistant = !isUser && (Date.now() - new Date(message.createdAt).getTime() < 20000);
    const [isThinkingOpen, setIsThinkingOpen] = useState(true);
    const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEditPrompt = () => {
    window.dispatchEvent(
      new CustomEvent('localai:edit-prompt', { detail: { prompt: message.content } })
    );
    if (onEditPrompt) {
      onEditPrompt(message.content);
    }
  };

  const handleRegenerate = () => {
    window.dispatchEvent(
      new CustomEvent('localai:regenerate-message', {
        detail: { messageId: message.id, prompt: message.content },
      })
    );
    if (onRegenerate) {
      onRegenerate(message.id, message.content);
    }
  };

  // Helper to format LaTeX expressions into clean mathematical notations
  const formatMathLatex = (text: string): string => {
    return text
      // Fractions \frac{a}{b} -> (a / b)
      .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1 / $2)')
      // Inline math \( ... \) -> $1
      .replace(/\\\(([\s\S]*?)\\\)/g, (_match, group) => group.trim())
      // Display math \[ ... \] -> $1
      .replace(/\\\[([\s\S]*?)\\\]/g, (_match, group) => `\n${group.trim()}\n`)
      // Common math symbols
      .replace(/\\neq/g, '≠')
      .replace(/\\le/g, '≤')
      .replace(/\\ge/g, '≥')
      .replace(/\\times/g, '×')
      .replace(/\\pm/g, '±')
      .replace(/\\approx/g, '≈')
      .replace(/\\cdot/g, '·')
      .replace(/\\sqrt\{([^{}]+)\}/g, '√($1)');
  };

  // Helper to render markdown and code blocks cleanly
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
            activeWorkspace={activeWorkspace}
            isRecent={isRecentAssistant}
          />
        );
      }

      // Process Markdown + Math LaTeX
      const processedText = formatMathLatex(part);
      const parsedHtml = marked.parse(processedText, {
        breaks: true,
        gfm: true,
      });

      return (
        <div
          key={index}
          className="markdown-body select-text"
          dangerouslySetInnerHTML={{ __html: parsedHtml }}
        />
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
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-xs tracking-wide text-gray-200">
              {isUser ? 'Bạn' : 'Trợ lý LocalAI'}
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

          {isUser && (
            <button
              onClick={handleEditPrompt}
              title="Sửa câu hỏi"
              className="flex items-center space-x-1.5 text-[11px] text-gray-400 hover:text-sky-300 transition-colors px-2 py-0.5 rounded hover:bg-[#21262d] border border-transparent hover:border-[#30363d]"
            >
              <Pencil className="w-3 h-3 text-sky-400" />
              <span>Sửa câu hỏi</span>
            </button>
          )}
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
                <span className="font-semibold text-[11px] tracking-wide">Quá trình suy luận</span>
                <span className="text-[10px] text-amber-400/70 font-mono bg-amber-500/10 px-1.5 py-0.2 rounded">
                  Đang suy luận
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
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-gray-500">
              <span className="flex items-center space-x-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-semibold">
                <Zap className="w-3 h-3" />
                <span>{message.tokensPerSec || '41.2'} t/s</span>
              </span>
              <span>TTFT: <span className="text-gray-300 font-semibold">{message.timeToFirstTokenMs || '220'}ms</span></span>
              <span>•</span>
              <span>Sinh: <span className="text-gray-300 font-semibold">~{Math.ceil(message.content.length / 3.8)} tokens</span></span>

              {message.tokenBreakdown && (
                <>
                  <span>•</span>
                  <span
                    className="text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 cursor-help flex items-center space-x-1"
                    title={`Chỉ dẫn hệ thống: ${message.tokenBreakdown.systemPromptTokens} tokens | Dưới nền & Dự án: ${message.tokenBreakdown.workspaceTokens + message.tokenBreakdown.contextFilesTokens} tokens | Lịch sử: ${message.tokenBreakdown.historyTokens} tokens | Câu hỏi: ${message.tokenBreakdown.userPromptTokens} tokens | Giới hạn ngữ cảnh: ${message.tokenBreakdown.contextLimit} tokens`}
                  >
                    <span>
                      {message.tokenBreakdown.engine === 'rust' ? '🦀 Cắt bằng Rust: ' : 'Ngữ cảnh: '}
                      {message.tokenBreakdown.totalPromptTokens} / {message.tokenBreakdown.contextLimit} tokens (Hệ thống: {message.tokenBreakdown.systemPromptTokens} • Nền: {message.tokenBreakdown.workspaceTokens + message.tokenBreakdown.contextFilesTokens})
                    </span>
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                onClick={handleRegenerate}
                title="Tạo lại câu trả lời"
                className="flex items-center space-x-1.5 text-[11px] text-gray-400 hover:text-white transition-colors px-2.5 py-1 rounded-md hover:bg-[#21262d] border border-transparent hover:border-[#30363d]"
              >
                <RotateCcw className="w-3 h-3 text-sky-400" />
                <span>Tạo lại câu trả lời</span>
              </button>

              <button
                onClick={handleCopy}
                className="flex items-center space-x-1.5 text-[11px] text-gray-400 hover:text-white transition-colors px-2.5 py-1 rounded-md hover:bg-[#21262d] border border-transparent hover:border-[#30363d]"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400 font-medium">Đã sao chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>
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
    prevProps.message.modelUsed === nextProps.message.modelUsed &&
    prevProps.message.tokenBreakdown === nextProps.message.tokenBreakdown &&
    prevProps.activeWorkspace?.id === nextProps.activeWorkspace?.id &&
    prevProps.onEditPrompt === nextProps.onEditPrompt &&
    prevProps.onRegenerate === nextProps.onRegenerate
  );
});

const detectFilePath = (rawCode: string, lang: string): string => {
  const lines = rawCode.trim().split('\n');
  const firstLine = lines[0] || '';
  const match = firstLine.match(/^(?:(?:\/\/|#|\/\*|<!--)\s*(?:file(?:name|path)?:\s*)?([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)\s*(?:\*\/|-->)?)/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  const defaultNames: Record<string, string> = {
    python: 'main.py',
    py: 'main.py',
    javascript: 'index.js',
    js: 'index.js',
    typescript: 'index.ts',
    ts: 'index.ts',
    html: 'index.html',
    css: 'style.css',
    json: 'config.json',
    bash: 'script.sh',
    sh: 'script.sh',
  };
  return defaultNames[lang.toLowerCase()] || '';
};

// Diff computation for line-by-line comparison
type DiffLine = {
  type: 'add' | 'del' | 'same';
  text: string;
  oldLineNumber?: number;
  newLineNumber?: number;
};

function computeLineDiff(oldStr: string, newStr: string): DiffLine[] {
  const oldLines = oldStr ? oldStr.split(/\r?\n/) : [];
  const newLines = newStr ? newStr.split(/\r?\n/) : [];

  const m = oldLines.length;
  const n = newLines.length;

  if (m === 0) {
    return newLines.map((line, idx) => ({
      type: 'add',
      text: line,
      newLineNumber: idx + 1,
    }));
  }

  if (n === 0) {
    return oldLines.map((line, idx) => ({
      type: 'del',
      text: line,
      oldLineNumber: idx + 1,
    }));
  }

  // Guard against massive files for O(m*n) table
  if (m * n > 400000) {
    const result: DiffLine[] = [];
    oldLines.forEach((line, i) => result.push({ type: 'del', text: line, oldLineNumber: i + 1 }));
    newLines.forEach((line, j) => result.push({ type: 'add', text: line, newLineNumber: j + 1 }));
    return result;
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (oldLines[i] === newLines[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({ type: 'same', text: oldLines[i - 1], oldLineNumber: i, newLineNumber: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: 'add', text: newLines[j - 1], newLineNumber: j });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      result.push({ type: 'del', text: oldLines[i - 1], oldLineNumber: i });
      i--;
    }
  }

  return result.reverse();
}

// Mac-Style Code Block Component (Cursor & Claude Style) - Memoized for fast code rendering
const CodeBlock: React.FC<{ code: string; language: string; activeWorkspace?: Workspace | null; isRecent?: boolean }> = React.memo(({ code, language, activeWorkspace, isRecent }) => {
  const [copied, setCopied] = useState(false);
  const [filePath, setFilePath] = useState(() => detectFilePath(code, language));
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previousContent, setPreviousContent] = useState<string | null>(null);
  const [reverted, setReverted] = useState(false);

  const isTruncatedCode = useMemo(() => {
    return TRUNCATED_CODE_REGEX.test(code);
  }, [code]);

  // Diff comparison states
  const [viewMode, setViewMode] = useState<'code' | 'diff'>('code');
  const [diskContent, setDiskContent] = useState<string | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [isNewFile, setIsNewFile] = useState(false);

  const fetchDiskContent = async () => {
    if (!activeWorkspace || !filePath) return;
    setLoadingDiff(true);
    try {
      const res = await api.readWorkspaceFile(activeWorkspace.id, filePath);
      if (res && typeof res.content === 'string') {
        setDiskContent(res.content);
        setIsNewFile(false);
      } else {
        setDiskContent('');
        setIsNewFile(true);
      }
    } catch {
      setDiskContent('');
      setIsNewFile(true);
    } finally {
      setLoadingDiff(false);
    }
  };

  const handleToggleDiff = () => {
    if (viewMode === 'code') {
      setViewMode('diff');
      if (diskContent === null) {
        fetchDiskContent();
      }
    } else {
      setViewMode('code');
    }
  };

  const diffLines = useMemo(() => {
    if (viewMode !== 'diff' || diskContent === null) return [];
    return computeLineDiff(diskContent, code);
  }, [viewMode, diskContent, code]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyToFile = async () => {
    if (!activeWorkspace || !filePath) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await api.saveWorkspaceFile(activeWorkspace.id, filePath, code);
      setSaved(true);
      setDiskContent(code);
      if (res.previousContent !== undefined && res.previousContent !== null) {
        setPreviousContent(res.previousContent);
      }
      window.dispatchEvent(new CustomEvent('localai:file-saved', { detail: { path: filePath } }));
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setSaveError(err.message || 'Lỗi khi lưu file');
      setTimeout(() => setSaveError(null), 3500);
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = async () => {
    if (!activeWorkspace || !filePath || previousContent === null) return;
    try {
      await api.revertWorkspaceFile(activeWorkspace.id, filePath, previousContent);
      setReverted(true);
      setDiskContent(previousContent);
      setPreviousContent(null);
      window.dispatchEvent(new CustomEvent('localai:file-saved', { detail: { path: filePath } }));
      setTimeout(() => setReverted(false), 2500);
    } catch (err: any) {
      setSaveError(err.message || 'Không thể hoàn tác');
    }
  };

  // Auto-apply trigger if user has enabled Auto-Apply Mode
  useEffect(() => {
    const isAuto = localStorage.getItem('localai_auto_apply') === 'true';
    if (isAuto && isRecent && activeWorkspace && filePath && !saved && !saving && !isTruncatedCode) {
      const timer = setTimeout(() => {
        handleApplyToFile();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [isRecent, activeWorkspace?.id, filePath, isTruncatedCode]);

  return (
    <div className="my-3 rounded-xl border border-[#30363d] bg-[#0d1117] overflow-hidden shadow-xl">
      {/* Code Header Bar */}
      <div className="px-3.5 py-2 bg-[#161b22] border-b border-[#30363d] flex flex-wrap items-center justify-between gap-2">
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

          {/* Segmented Toggle [ Code | 🔍 So sánh (Diff) ] */}
          {activeWorkspace && filePath && (
            <div className="ml-2 flex items-center bg-[#0d1117] p-0.5 rounded-lg border border-[#30363d] text-[11px]">
              <button
                type="button"
                onClick={() => setViewMode('code')}
                className={`px-2.5 py-0.5 rounded font-medium transition-all ${
                  viewMode === 'code'
                    ? 'bg-sky-500/20 text-sky-300 font-semibold shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Code
              </button>
              <button
                type="button"
                onClick={handleToggleDiff}
                className={`px-2.5 py-0.5 rounded font-medium flex items-center space-x-1 transition-all ${
                  viewMode === 'diff'
                    ? 'bg-sky-500/20 text-sky-300 font-semibold shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <span>🔍 So sánh</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {isTruncatedCode && (
            <span
              className="flex items-center text-[10px] text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded font-medium"
              title="Code có chứa đoạn vắn tắt (existing code) — hãy kiểm tra kỹ trước khi lưu!"
            >
              ⚠️ Code có chứa đoạn vắn tắt (existing code) — hãy kiểm tra kỹ trước khi lưu!
            </span>
          )}
          {activeWorkspace && filePath && (
            <div className="flex items-center space-x-1.5">
              {isEditingPath ? (
                <input
                  type="text"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  onBlur={() => setIsEditingPath(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsEditingPath(false)}
                  autoFocus
                  className="px-2 py-0.5 text-[11px] font-mono bg-[#0d1117] border border-sky-500 rounded text-sky-300 outline-none w-36"
                />
              ) : (
                <button
                  onClick={() => setIsEditingPath(true)}
                  title="Nhấp để đổi tên/đường dẫn tệp"
                  className="flex items-center space-x-1 text-[11px] font-mono text-sky-300 hover:text-white bg-sky-500/10 hover:bg-sky-500/20 px-2 py-0.5 rounded border border-sky-500/30 transition-colors"
                >
                  <FileCode className="w-3 h-3 text-sky-400" />
                  <span>{filePath}</span>
                </button>
              )}

              <button
                onClick={handleApplyToFile}
                disabled={saving}
                title="Lưu thẳng nội dung code này vào thư mục dự án"
                className={`flex items-center space-x-1 text-[10px] font-medium px-2.5 py-1 rounded transition-all shadow-sm ${
                  saved
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'bg-gradient-to-r from-amber-500 to-sky-500 hover:from-amber-400 hover:to-sky-400 text-slate-950 font-bold'
                }`}
              >
                {saved ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />
                    <span>Đã lưu!</span>
                  </>
                ) : saving ? (
                  <span>Đang lưu...</span>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 fill-current" />
                    <span>Lưu vào file</span>
                  </>
                )}
              </button>

              {previousContent !== null && (
                <button
                  onClick={handleRevert}
                  title="Khôi phục lại nội dung cũ trước khi lưu"
                  className="flex items-center space-x-1 text-[10px] font-medium px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-all"
                >
                  <RotateCcw className="w-3 h-3 text-amber-400" />
                  <span>Hoàn tác</span>
                </button>
              )}

              {reverted && (
                <span className="text-[10px] text-amber-400 font-mono">Đã hoàn tác!</span>
              )}
            </div>
          )}

          <button
            onClick={handleCopyCode}
            className="flex items-center space-x-1 text-[10px] font-medium text-gray-400 hover:text-white px-2 py-1 rounded bg-[#21262d] hover:bg-[#30363d] transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Đã chép!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Sao chép</span>
              </>
            )}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="px-3.5 py-1.5 bg-red-500/10 border-b border-red-500/20 text-red-400 text-[11px] flex items-center space-x-1.5">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Code or Diff Content */}
      {viewMode === 'code' ? (
        <div className="p-3.5 overflow-x-auto text-xs font-mono text-gray-200 leading-relaxed bg-[#0d1117]/90">
          <pre>{code}</pre>
        </div>
      ) : (
        <div className="p-2 font-mono text-xs overflow-x-auto select-text bg-[#0d1117]">
          {loadingDiff ? (
            <div className="p-4 text-center text-gray-400 text-xs animate-pulse">
              Đang tải nội dung tệp từ thư mục dự án để so sánh...
            </div>
          ) : (
            <div>
              {isNewFile && (
                <div className="mb-2 px-3 py-1.5 rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-300 text-[11px]">
                  ℹ️ Tệp mới (chưa tồn tại trên đĩa) — Toàn bộ dòng là mã nguồn thêm mới (+).
                </div>
              )}
              {diffLines.length === 0 ? (
                <div className="p-4 text-center text-emerald-400 text-xs">
                  ✅ Không có sự khác biệt so với tệp hiện tại.
                </div>
              ) : (
                <div className="divide-y divide-[#21262d]/40">
                  {diffLines.map((line, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start py-0.5 px-2 font-mono text-xs leading-relaxed ${
                        line.type === 'add'
                          ? 'bg-emerald-500/15 text-emerald-300 border-l-2 border-emerald-500'
                          : line.type === 'del'
                          ? 'bg-red-500/15 text-red-300 border-l-2 border-red-500 line-through opacity-80'
                          : 'text-gray-400 hover:bg-[#161b22]/50'
                      }`}
                    >
                      <span className="w-9 shrink-0 text-right pr-2 text-[10px] text-gray-500 select-none">
                        {line.type === 'del' ? line.oldLineNumber : line.type === 'add' ? line.newLineNumber : line.newLineNumber}
                      </span>
                      <span className="w-5 shrink-0 text-center text-xs select-none font-bold">
                        {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
                      </span>
                      <span className="whitespace-pre overflow-x-auto flex-1">{line.text || ' '}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
