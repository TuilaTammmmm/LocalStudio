import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { LocalSkill, ProviderConfig } from '../../types.js';
import type { FileNode } from '../../workspace-fs.js';
import { type Language, type Translations, dictionaries, getLanguage } from '../i18n.js';
import {
  Send,
  Square,
  Sparkles,
  Paperclip,
  FileText,
  CornerDownLeft,
  AtSign,
  Terminal,
  Zap,
  Image as ImageIcon,
  X,
  Eye,
  Globe,
  ChevronDown,
  Compass,
  Brain,
  Code2,
  Check,
  Search,
} from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (text: string, hasImage?: boolean) => void;
  isStreaming: boolean;
  onStopStreaming: () => void;
  pinnedFiles: string[];
  onRemovePinnedFile: (file: string) => void;
  onAttachFile?: (file: string) => void;
  availableSkills: LocalSkill[];
  fileTree: FileNode[];
  providers?: ProviderConfig[];
  activeProvider?: ProviderConfig | null;
  onSwitchProvider?: (providerId: string) => void;
  activeModelName?: string;
  isAutoRoute?: boolean;
  availableModels?: string[];
  onSelectModel?: (name: string, isAuto?: boolean) => void;
  lang?: Language;
  t?: Translations;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isStreaming,
  onStopStreaming,
  pinnedFiles,
  onRemovePinnedFile,
  onAttachFile,
  availableSkills,
  fileTree,
  providers = [],
  activeProvider = null,
  onSwitchProvider,
  activeModelName = 'Qwen2.5-3B-Instruct',
  isAutoRoute = true,
  availableModels = [],
  onSelectModel,
  lang,
  t: propT,
}) => {
  const currentLang = lang || getLanguage();
  const tr = propT || dictionaries[currentLang];

  const [text, setText] = useState('');
  const [attachedImage, setAttachedImage] = useState<{ name: string; dataUrl: string } | null>(null);
  const [autocompleteMode, setAutocompleteMode] = useState<'skill' | 'file' | null>(null);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [selectedAutocompleteIndex, setSelectedAutocompleteIndex] = useState(0);
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // User-draggable composer height (saved in localStorage)
  const [composerHeight, setComposerHeight] = useState<number>(() => {
    const saved = localStorage.getItem('localai_composer_height');
    return saved ? parseInt(saved, 10) : 60;
  });
  const [isResizingInput, setIsResizingInput] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(60);
  const [autoApply, setAutoApply] = useState(() => localStorage.getItem('localai_auto_apply') === 'true');
  const [conciseMode, setConciseMode] = useState(() => localStorage.getItem('localai_concise_mode') === 'true');

  useEffect(() => {
    const handleEditPromptEvent = (e: any) => {
      const prompt = typeof e.detail === 'string' ? e.detail : e.detail?.prompt;
      if (typeof prompt === 'string') {
        setText(prompt);
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(prompt.length, prompt.length);
        }
      }
    };
    window.addEventListener('localai:edit-prompt', handleEditPromptEvent);
    return () => window.removeEventListener('localai:edit-prompt', handleEditPromptEvent);
  }, []);

  useEffect(() => {
    if (!isResizingInput) return;
    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = dragStartY.current - e.clientY;
      const newHeight = Math.min(420, Math.max(50, dragStartHeight.current + deltaY));
      setComposerHeight(newHeight);
    };
    const handleMouseUp = () => {
      setIsResizingInput(false);
      localStorage.setItem('localai_composer_height', composerHeight.toString());
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingInput, composerHeight]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    // 1. Dropped from internal FileTree or plaintext path
    const localAiData = e.dataTransfer.getData('application/x-localai-file');
    const plainText = e.dataTransfer.getData('text/plain');
    if (localAiData) {
      try {
        const parsed = JSON.parse(localAiData);
        if (parsed.path && !pinnedFiles.includes(parsed.path)) {
          if (onAttachFile) onAttachFile(parsed.path);
          return;
        }
      } catch {}
    } else if (plainText) {
      const cleanPath = plainText.trim();
      if (onAttachFile && !pinnedFiles.includes(cleanPath)) {
        onAttachFile(cleanPath);
        return;
      }
    }

    // 2. Dropped from OS Desktop / Explorer
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setAttachedImage({
            name: file.name,
            dataUrl: event.target?.result as string,
          });
        };
        reader.readAsDataURL(file);
      } else {
        const textContent = await file.text();
        const snippet = `\`\`\`${file.name}\n${textContent.slice(0, 4000)}\n\`\`\`\n`;
        setText((prev) => (prev ? `${prev}\n${snippet}` : snippet));
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            setAttachedImage({
              name: file.name || `Pasted_Image_${Date.now().toString().slice(-4)}.png`,
              dataUrl,
            });
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    }
  };

  // Flatten file list for @ autocomplete (memoized to avoid recursive traversal lag)
  const flatFiles = useMemo(() => {
    const list: string[] = [];
    const collectFiles = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (!node.isDirectory) list.push(node.relativePath);
        if (node.children) collectFiles(node.children);
      }
    };
    collectFiles(fileTree);
    return list;
  }, [fileTree]);

  const filteredFiles = useMemo(() => {
    return flatFiles
      .filter((f) => !autocompleteQuery || f.toLowerCase().includes(autocompleteQuery))
      .slice(0, 15);
  }, [flatFiles, autocompleteQuery]);

  const filteredSkills = useMemo(() => {
    return availableSkills
      .filter((s) => s.enabled)
      .filter((s) => {
        if (!autocompleteQuery) return true;
        return (
          s.triggers.some((t) => t.toLowerCase().includes(autocompleteQuery)) ||
          s.name.toLowerCase().includes(autocompleteQuery)
        );
      });
  }, [availableSkills, autocompleteQuery]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (autocompleteMode === 'file') {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedAutocompleteIndex((prev) => (filteredFiles.length ? (prev + 1) % filteredFiles.length : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedAutocompleteIndex((prev) => (filteredFiles.length ? (prev - 1 + filteredFiles.length) % filteredFiles.length : 0));
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && filteredFiles.length > 0) {
        e.preventDefault();
        const chosen = filteredFiles[selectedAutocompleteIndex] || filteredFiles[0];
        if (chosen) {
          selectFile(chosen);
          return;
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setAutocompleteMode(null);
        return;
      }
    } else if (autocompleteMode === 'skill') {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedAutocompleteIndex((prev) => (filteredSkills.length ? (prev + 1) % filteredSkills.length : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedAutocompleteIndex((prev) => (filteredSkills.length ? (prev - 1 + filteredSkills.length) % filteredSkills.length : 0));
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && filteredSkills.length > 0) {
        e.preventDefault();
        const chosen = filteredSkills[selectedAutocompleteIndex] || filteredSkills[0];
        if (chosen) {
          selectSkill(chosen.triggers[0]);
          return;
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setAutocompleteMode(null);
        return;
      }
    }

    if (e.key === 'Escape') {
      setAutocompleteMode(null);
      setShowProviderMenu(false);
      setShowModelMenu(false);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if ((!text.trim() && !attachedImage) || isStreaming) return;
    const finalPrompt = attachedImage
      ? `[Ảnh đính kèm: ${attachedImage.name}]\n${text.trim() || 'Hãy phân tích hình ảnh này.'}`
      : text;
    onSendMessage(finalPrompt, !!attachedImage);
    setText('');
    setAttachedImage(null);
    setAutocompleteMode(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachedImage({
        name: file.name,
        dataUrl: event.target?.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    // Exact word-based autocomplete: only active when word begins with / or @ until a space is entered
    const cursor = e.target.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursor);
    const lastWordMatch = textBeforeCursor.match(/(?:^|\s)([/@])([^\s]*)$/);

    if (lastWordMatch) {
      const trigger = lastWordMatch[1];
      const query = lastWordMatch[2] || '';
      setSelectedAutocompleteIndex(0);
      if (trigger === '/') {
        setAutocompleteMode('skill');
        setAutocompleteQuery(query.toLowerCase());
      } else if (trigger === '@') {
        setAutocompleteMode('file');
        setAutocompleteQuery(query.toLowerCase());
      }
    } else {
      setAutocompleteMode(null);
      setAutocompleteQuery('');
      setSelectedAutocompleteIndex(0);
    }
  };

  const selectSkill = (trigger: string) => {
    // Replace the current /query token with the chosen skill trigger
    const cursor = textareaRef.current?.selectionStart || text.length;
    const textBeforeCursor = text.slice(0, cursor);
    const textAfterCursor = text.slice(cursor);
    const replaced = textBeforeCursor.replace(/(?:^|\s)\/[^\s]*$/, (m) => (m.startsWith(' ') ? ` ${trigger} ` : `${trigger} `));
    setText(replaced + textAfterCursor);
    setAutocompleteMode(null);
    textareaRef.current?.focus();
  };

  const selectFile = (filePath: string) => {
    // Replace the current @query token with the chosen @file
    const cursor = textareaRef.current?.selectionStart || text.length;
    const textBeforeCursor = text.slice(0, cursor);
    const textAfterCursor = text.slice(cursor);
    const replaced = textBeforeCursor.replace(/(?:^|\s)@[^\s]*$/, (m) => (m.startsWith(' ') ? ` @${filePath} ` : `@${filePath} `));
    setText(replaced + textAfterCursor);
    setAutocompleteMode(null);
    textareaRef.current?.focus();
  };

  const estimatedTokens = Math.ceil(text.length / 3.8);

  return (
    <div className="relative w-full">
      {/* Click-outside backdrop for autocomplete */}
      {autocompleteMode && (
        <div
          className="fixed inset-0 z-40 cursor-default"
          onClick={() => setAutocompleteMode(null)}
        />
      )}

      {/* 1. Skill Suggestions Popup */}
      {autocompleteMode === 'skill' && (
        <div className="absolute bottom-full left-0 mb-3 w-84 bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl z-50 p-2 space-y-1 animate-slide-up backdrop-blur-xl">
          <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 flex items-center justify-between border-b border-[#30363d] pb-1.5">
            <div className="flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>Select Skill (/{autocompleteQuery})</span>
            </div>
            <span className="text-[9px] text-gray-500 font-mono">↑↓ / Enter / Esc</span>
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1">
            {filteredSkills.map((skill, idx) => (
              <button
                key={skill.id}
                onClick={() => selectSkill(skill.triggers[0])}
                onMouseEnter={() => setSelectedAutocompleteIndex(idx)}
                className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors group ${
                  idx === selectedAutocompleteIndex
                    ? 'bg-sky-500/20 text-sky-200 border border-sky-500/40'
                    : 'hover:bg-[#21262d] text-gray-200'
                }`}
              >
                <div>
                  <span className="font-semibold text-sky-400 font-mono group-hover:underline">
                    {skill.triggers[0]}
                  </span>
                  <p className="text-[11px] text-gray-400 truncate max-w-[240px] mt-0.5">
                    {skill.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. File Suggestions Popup (@) */}
      {autocompleteMode === 'file' && (
        <div className="absolute bottom-full left-0 mb-3 w-84 max-h-56 overflow-y-auto bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl z-50 p-2 space-y-1 animate-slide-up backdrop-blur-xl">
          <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 flex items-center justify-between border-b border-[#30363d] pb-1.5">
            <div className="flex items-center space-x-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Reference File (@{autocompleteQuery})</span>
            </div>
            <span className="text-[9px] text-gray-500 font-mono">↑↓ / Enter / Esc</span>
          </div>
          {filteredFiles.map((file, idx) => (
            <button
              key={file}
              onClick={() => selectFile(file)}
              onMouseEnter={() => setSelectedAutocompleteIndex(idx)}
              className={`w-full flex items-center space-x-2 p-1.5 rounded-md text-left text-xs transition-colors font-mono truncate ${
                idx === selectedAutocompleteIndex
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-gray-200 hover:bg-[#21262d]'
              }`}
            >
              <Paperclip className={`w-3 h-3 shrink-0 ${idx === selectedAutocompleteIndex ? 'text-sky-400' : 'text-gray-400'}`} />
              <span className="truncate">{file}</span>
            </button>
          ))}
        </div>
      )}

      {/* 3. Floating Modern Composer Container */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-2xl bg-[#161b22] border transition-all duration-200 p-3 space-y-2.5 relative ${
          isDragOver
            ? 'border-sky-500 bg-sky-500/10 ring-2 ring-sky-500/30'
            : 'border-[#30363d] shadow-2xl focus-within:border-sky-500/80 focus-within:ring-2 focus-within:ring-sky-500/20'
        }`}
      >
        {/* Drag handle to resize composer height */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizingInput(true);
            dragStartY.current = e.clientY;
            dragStartHeight.current = composerHeight;
          }}
          className="w-full h-3 -top-2 left-0 absolute cursor-ns-resize flex items-center justify-center group z-20"
          title={currentLang === 'vi' ? 'Kéo lên/xuống để chỉnh độ cao khung chat' : 'Drag to resize composer height'}
        >
          <div className="w-12 h-1 rounded-full bg-white/10 group-hover:bg-sky-400 group-hover:w-20 transition-all duration-200" />
        </div>

        {isDragOver && (
          <div className="absolute inset-0 bg-sky-950/80 backdrop-blur-sm rounded-2xl flex items-center justify-center z-30 pointer-events-none border-2 border-dashed border-sky-400">
            <div className="flex items-center space-x-2 text-sky-300 font-semibold text-xs animate-bounce">
              <Paperclip className="w-4 h-4" />
              <span>{currentLang === 'vi' ? 'Thả tệp vào đây để thêm vào ngữ cảnh hội thoại' : 'Drop files here to attach to conversation context'}</span>
            </div>
          </div>
        )}

        {/* Pinned Context Chips & Attached Image */}
        {(pinnedFiles.length > 0 || attachedImage) && (
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider shrink-0 mr-1">
              {currentLang === 'vi' ? 'Tệp đính kèm:' : 'Attached Context:'}
            </span>
            {attachedImage && (
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px] font-mono shrink-0 shadow-sm animate-pulse-subtle">
                <img
                  src={attachedImage.dataUrl}
                  alt={attachedImage.name}
                  className="w-4 h-4 rounded object-cover border border-amber-400/40"
                />
                <span className="truncate max-w-[120px]">{attachedImage.name}</span>
                <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-200 border border-amber-500/40 font-semibold">
                  Auto-Vision
                </span>
                <button
                  onClick={() => setAttachedImage(null)}
                  className="hover:text-red-400 ml-0.5 font-bold"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {pinnedFiles.map((file) => (
              <span
                key={file}
                className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/25 text-[11px] font-mono shrink-0 shadow-sm"
              >
                <FileText className="w-3 h-3" />
                <span className="truncate max-w-[140px]">{file.split('/').pop()}</span>
                <button
                  onClick={() => onRemovePinnedFile(file)}
                  className="hover:text-red-400 ml-0.5 font-bold"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Text Input with dynamic height */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={attachedImage ? tr.visionPlaceholder : tr.askPlaceholder}
          style={{ height: `${composerHeight}px` }}
          className="w-full bg-transparent text-gray-100 placeholder-gray-500 text-sm focus:outline-none resize-none overflow-y-auto leading-relaxed px-1"
        />

        {/* Hidden File Input for Image Upload */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleImageChange}
        />

        {/* Bottom Toolbar inside Composer */}
        <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-[#30363d]/60 flex-wrap">
          <div className="flex items-center space-x-1 shrink-0 flex-wrap gap-y-1">
            {/* Quick @ File button */}
            <button
              type="button"
              onClick={() => {
                setText((prev) => (prev ? `${prev} @` : '@'));
                setAutocompleteMode('file');
                setAutocompleteQuery('');
                textareaRef.current?.focus();
              }}
              title={tr.fileMention}
              className="inline-flex items-center space-x-1 px-2 h-7 rounded-md text-[11px] font-medium text-gray-400 hover:text-white hover:bg-[#21262d] transition-colors whitespace-nowrap shrink-0 leading-none"
            >
              <AtSign className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap hidden sm:inline">{tr.fileMention}</span>
            </button>

            {/* Quick / Skill button */}
            <button
              type="button"
              onClick={() => {
                setText((prev) => (prev ? `${prev} /` : '/'));
                setAutocompleteMode('skill');
                setAutocompleteQuery('');
                textareaRef.current?.focus();
              }}
              title={tr.skillSlash}
              className="inline-flex items-center space-x-1 px-2 h-7 rounded-md text-[11px] font-medium text-gray-400 hover:text-white hover:bg-[#21262d] transition-colors whitespace-nowrap shrink-0 leading-none"
            >
              <Terminal className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap hidden sm:inline">{tr.skillSlash}</span>
            </button>

            {/* Concise Mode Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !conciseMode;
                setConciseMode(next);
                localStorage.setItem('localai_concise_mode', String(next));
                window.dispatchEvent(new CustomEvent('localai:concise-mode-changed', { detail: { conciseMode: next } }));
              }}
              title={tr.conciseModeDesc}
              className={`inline-flex items-center space-x-1 px-2 h-7 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 leading-none ${
                conciseMode
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-[#21262d]'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 shrink-0 ${conciseMode ? 'text-amber-400 fill-current' : 'text-gray-400'}`} />
              <span className="whitespace-nowrap">{currentLang === 'vi' ? 'Ngắn gọn' : 'Concise'}</span>
            </button>

            {/* Token Counter */}
            {text.length > 0 && (
              <span className="text-[10px] text-gray-500 font-mono ml-1 whitespace-nowrap shrink-0">
                ~{estimatedTokens} {tr.tokens}
              </span>
            )}
          </div>

          {/* Right Toolbar: Provider | Model | Send */}
          <div className="flex items-center space-x-1.5 relative shrink-0 ml-auto">
            {/* Backdrop for Popups */}
            {(showProviderMenu || showModelMenu) && (
              <div
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => {
                  setShowProviderMenu(false);
                  setShowModelMenu(false);
                }}
              />
            )}

            {/* 1. Provider Selector Pill (Only enabled providers) */}
            {providers.filter((p) => p.enabled !== false).length > 0 && onSwitchProvider && (
              <div className="relative z-50">
                <button
                  type="button"
                  onClick={() => {
                    setShowProviderMenu(!showProviderMenu);
                    setShowModelMenu(false);
                  }}
                  className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] text-xs text-gray-300 hover:text-white transition-all shadow-inner"
                  title={currentLang === 'vi' ? 'Chuyển đổi nhà cung cấp' : 'Switch Provider'}
                >
                  {activeProvider?.type === 'llama-server' ? (
                    <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                  ) : (
                    <Globe className="w-3 h-3 text-sky-400 shrink-0" />
                  )}
                  <span className="font-medium text-[11px] truncate max-w-[85px]">
                    {activeProvider ? activeProvider.name.split('(')[0].trim() : 'Provider'}
                  </span>
                  <ChevronDown className="w-3 h-3 text-gray-500 shrink-0" />
                </button>

                {showProviderMenu && (
                  <div className="absolute bottom-full right-0 mb-2 w-64 bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl z-50 p-1.5 space-y-1 animate-slide-up backdrop-blur-xl">
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 border-b border-[#30363d] pb-1">
                      {currentLang === 'vi' ? 'Nhà cung cấp suy luận' : 'Inference Provider'}
                    </div>
                    {providers.filter((p) => p.enabled !== false).map((p) => {
                      const isCur = activeProvider?.id === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            onSwitchProvider(p.id);
                            setShowProviderMenu(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                            isCur ? 'bg-sky-500/15 text-sky-400 font-semibold border border-sky-500/30' : 'text-gray-300 hover:bg-[#21262d]'
                          }`}
                        >
                          <div className="flex items-center space-x-1.5 truncate">
                            {p.type === 'llama-server' ? (
                              <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                            ) : (
                              <Globe className="w-3 h-3 text-sky-400 shrink-0" />
                            )}
                            <span className="truncate">{p.name}</span>
                          </div>
                          {isCur && <Check className="w-3 h-3 text-sky-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 2. Model / Auto-Route Selector Pill */}
            {onSelectModel && (
              <div className="relative z-50">
                <button
                  type="button"
                  onClick={() => {
                    setShowModelMenu(!showModelMenu);
                    setShowProviderMenu(false);
                  }}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
                    isAutoRoute
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 ring-1 ring-amber-500/20 shadow-sm'
                      : 'bg-[#0d1117] hover:bg-[#21262d] border-[#30363d] text-gray-200'
                  }`}
                  title={isAutoRoute ? 'Auto-Routing Active' : `Active Model: ${activeModelName}`}
                >
                  {isAutoRoute ? (
                    <Compass className="w-3.5 h-3.5 text-amber-400 animate-spin-slow shrink-0" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  )}
                  <span className="font-semibold text-[11px] truncate max-w-[130px]">
                    {isAutoRoute ? '🔮 Auto-Route' : (activeModelName?.replace(/\.gguf$/i, '').split('-')[0] || activeModelName || 'Model')}
                  </span>
                  <ChevronDown className="w-3 h-3 text-gray-500 shrink-0" />
                </button>

                {showModelMenu && (
                  <div className="absolute bottom-full right-0 mb-2 w-80 sm:w-96 bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl z-50 p-2 space-y-1.5 animate-slide-up backdrop-blur-xl">
                    <div className="relative">
                      <Search className="w-3 h-3 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={modelSearch}
                        onChange={(e) => setModelSearch(e.target.value)}
                        placeholder={currentLang === 'vi' ? 'Tìm kiếm mô hình...' : `Search models...`}
                        className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-7 pr-2.5 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-sky-500/80"
                        autoFocus
                      />
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-1 pt-1">
                      {/* Auto Route Option (only shown if Auto-Route is active) */}
                      {isAutoRoute && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectModel('auto', true);
                            setShowModelMenu(false);
                          }}
                          className="w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40"
                        >
                          <div className="flex items-center space-x-2">
                            <Compass className="w-3.5 h-3.5 text-amber-400" />
                            <div>
                              <div className="font-semibold">{tr.autoRoute}</div>
                              <div className="text-[10px] text-gray-400 leading-tight">{tr.autoRouteDesc}</div>
                            </div>
                          </div>
                          <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        </button>
                      )}

                      {/* Header for models of selected provider */}
                      <div className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center justify-between border-t border-[#30363d]/50 pt-1.5 mt-1">
                        <span className="truncate max-w-[200px]">{activeProvider?.name.split('(')[0].trim() || 'Provider'}</span>
                        <span className="font-mono text-gray-500 text-[10px] shrink-0">
                          {currentLang === 'vi'
                            ? `${(activeProvider?.models || []).length} mô hình`
                            : `${(activeProvider?.models || []).length} models`}
                        </span>
                      </div>

                      {/* Only list models belonging to active provider */}
                      {(activeProvider?.models || [])
                        .filter((m) => !modelSearch || m.toLowerCase().includes(modelSearch.toLowerCase()))
                        .map((m) => {
                          const isCur = !isAutoRoute && activeModelName === m;
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={() => {
                                onSelectModel(m, false);
                                setShowModelMenu(false);
                              }}
                              className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors ${
                                isCur ? 'bg-sky-500/15 text-sky-400 font-semibold border border-sky-500/30' : 'text-gray-300 hover:bg-[#21262d]'
                              }`}
                            >
                              <div className="flex items-center space-x-1.5 truncate">
                                {activeProvider?.type === 'llama-server' ? (
                                  <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                                ) : (
                                  <Globe className="w-3 h-3 text-sky-400 shrink-0" />
                                )}
                                <span className="truncate font-mono text-[11px]">{m}</span>
                              </div>
                              {isCur && <Check className="w-3 h-3 text-sky-400 shrink-0" />}
                            </button>
                          );
                        })}

                      {/* If no matching model in provider list */}
                      {(activeProvider?.models || []).filter((m) => !modelSearch || m.toLowerCase().includes(modelSearch.toLowerCase())).length === 0 && (
                        <div className="p-2 text-center text-[10px] text-gray-500 font-mono">
                          {tr.noMatchingModels}
                        </div>
                      )}

                      {/* Custom typed model if user types something not in list */}
                      {modelSearch.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectModel(modelSearch.trim(), false);
                            setShowModelMenu(false);
                          }}
                          className="w-full p-2 text-left text-xs text-sky-400 hover:bg-[#21262d] rounded-lg border border-dashed border-sky-500/30 mt-1"
                        >
                          {tr.useCustomModel} "{modelSearch.trim()}"
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. Send / Stop Button */}
            {isStreaming ? (
              <button
                type="button"
                onClick={onStopStreaming}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-semibold transition-colors"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>{tr.stop}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!text.trim()}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  text.trim()
                    ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-md shadow-sky-500/20 active:scale-95'
                    : 'bg-[#21262d] text-gray-500 cursor-not-allowed'
                }`}
              >
                <span>{tr.send}</span>
                <CornerDownLeft className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
