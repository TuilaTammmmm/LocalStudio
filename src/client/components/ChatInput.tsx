import React, { useState, useRef } from 'react';
import type { LocalSkill, ProviderConfig } from '../../types.js';
import type { FileNode } from '../../workspace-fs.js';
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
  availableSkills: LocalSkill[];
  fileTree: FileNode[];
  providers?: ProviderConfig[];
  activeProvider?: ProviderConfig | null;
  onSwitchProvider?: (providerId: string) => void;
  activeModelName?: string;
  isAutoRoute?: boolean;
  availableModels?: string[];
  onSelectModel?: (name: string, isAuto?: boolean) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isStreaming,
  onStopStreaming,
  pinnedFiles,
  onRemovePinnedFile,
  availableSkills,
  fileTree,
  providers = [],
  activeProvider = null,
  onSwitchProvider,
  activeModelName = 'Qwen2.5-3B-Instruct',
  isAutoRoute = true,
  availableModels = [],
  onSelectModel,
}) => {
  const [text, setText] = useState('');
  const [attachedImage, setAttachedImage] = useState<{ name: string; dataUrl: string } | null>(null);
  const [showSkillPopup, setShowSkillPopup] = useState(false);
  const [showFilePopup, setShowFilePopup] = useState(false);
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Flatten file list for @ autocomplete
  const flatFiles: string[] = [];
  const collectFiles = (nodes: FileNode[]) => {
    for (const node of nodes) {
      if (!node.isDirectory) flatFiles.push(node.relativePath);
      if (node.children) collectFiles(node.children);
    }
  };
  collectFiles(fileTree);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
    setShowSkillPopup(false);
    setShowFilePopup(false);
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

    if (val.startsWith('/') && !val.includes(' ')) {
      setShowSkillPopup(true);
    } else {
      setShowSkillPopup(false);
    }

    const words = val.split(/\s+/);
    const lastWord = words[words.length - 1];
    if (lastWord.startsWith('@')) {
      setShowFilePopup(true);
    } else {
      setShowFilePopup(false);
    }
  };

  const selectSkill = (trigger: string) => {
    setText(`${trigger} `);
    setShowSkillPopup(false);
    textareaRef.current?.focus();
  };

  const selectFile = (filePath: string) => {
    const words = text.split(/\s+/);
    words.pop();
    words.push(`@${filePath} `);
    setText(words.join(' '));
    setShowFilePopup(false);
    textareaRef.current?.focus();
  };

  const estimatedTokens = Math.ceil(text.length / 3.8);

  return (
    <div className="relative w-full">
      {/* 1. Skill Suggestions Popup */}
      {showSkillPopup && (
        <div className="absolute bottom-full left-0 mb-3 w-84 bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl z-50 p-2 space-y-1 animate-slide-up backdrop-blur-xl">
          <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 flex items-center space-x-1.5 border-b border-[#30363d] pb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>Select Local Skill (Slash Command)</span>
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1">
            {availableSkills.filter((s) => s.enabled).map((skill) => (
              <button
                key={skill.id}
                onClick={() => selectSkill(skill.triggers[0])}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[#21262d] text-left text-xs transition-colors group"
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
      {showFilePopup && (
        <div className="absolute bottom-full left-0 mb-3 w-80 max-h-56 overflow-y-auto bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl z-50 p-2 space-y-1 animate-slide-up backdrop-blur-xl">
          <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 flex items-center space-x-1.5 border-b border-[#30363d] pb-1.5">
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>Reference Project File (@)</span>
          </div>
          {flatFiles.slice(0, 12).map((file) => (
            <button
              key={file}
              onClick={() => selectFile(file)}
              className="w-full flex items-center space-x-2 p-1.5 rounded-md hover:bg-[#21262d] text-left text-xs text-gray-200 transition-colors font-mono truncate"
            >
              <Paperclip className="w-3 h-3 text-gray-400 shrink-0" />
              <span className="truncate">{file}</span>
            </button>
          ))}
        </div>
      )}

      {/* 3. Floating Modern Composer Container */}
      <div className="rounded-2xl bg-[#161b22] border border-[#30363d] shadow-2xl focus-within:border-sky-500/80 focus-within:ring-2 focus-within:ring-sky-500/20 transition-all duration-200 p-3 space-y-2.5">
        {/* Pinned Context Chips & Attached Image */}
        {(pinnedFiles.length > 0 || attachedImage) && (
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider shrink-0 mr-1">
              Context:
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

        {/* Text Input */}
        <textarea
          ref={textareaRef}
          rows={2}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={attachedImage ? "Nhập câu hỏi về hình ảnh này (Auto-Route sẽ kích hoạt Qwen2-VL)..." : "Ask a question, type @ to reference file, or / for skills..."}
          className="w-full bg-transparent text-gray-100 placeholder-gray-500 text-sm focus:outline-none resize-none leading-relaxed px-1"
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
        <div className="flex items-center justify-between pt-1 border-t border-[#30363d]/60">
          <div className="flex items-center space-x-1.5">
            {/* Quick @ File button */}
            <button
              type="button"
              onClick={() => {
                setText((prev) => `${prev}@`);
                setShowFilePopup(true);
                textareaRef.current?.focus();
              }}
              className="flex items-center space-x-1 px-2 py-1 rounded-md text-[11px] text-gray-400 hover:text-white hover:bg-[#21262d] transition-colors"
            >
              <AtSign className="w-3.5 h-3.5" />
              <span>File</span>
            </button>

            {/* Quick / Skill button */}
            <button
              type="button"
              onClick={() => {
                setText('/');
                setShowSkillPopup(true);
                textareaRef.current?.focus();
              }}
              className="flex items-center space-x-1 px-2 py-1 rounded-md text-[11px] text-gray-400 hover:text-white hover:bg-[#21262d] transition-colors"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Skill</span>
            </button>

            {/* Image / Vision trigger button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Đính kèm ảnh - Tự động kích hoạt Vision Multimodal Model (Qwen2-VL)"
              className="flex items-center space-x-1 px-2 py-1 rounded-md text-[11px] text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors border border-amber-500/20"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Ảnh (Vision)</span>
            </button>

            {/* Token Counter */}
            {text.length > 0 && (
              <span className="text-[10px] text-gray-500 font-mono ml-2">
                ~{estimatedTokens} tokens
              </span>
            )}
          </div>

          {/* Right Toolbar: Provider | Model | Send */}
          <div className="flex items-center space-x-1.5 relative">
            {/* 1. Provider Selector Pill */}
            {providers.length > 0 && onSwitchProvider && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowProviderMenu(!showProviderMenu);
                    setShowModelMenu(false);
                  }}
                  className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] text-xs text-gray-300 hover:text-white transition-all shadow-inner"
                  title="Switch Provider"
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
                      Inference Provider
                    </div>
                    {providers.map((p) => {
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
              <div className="relative">
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
                  <span className="font-semibold text-[11px] truncate max-w-[110px]">
                    {isAutoRoute ? '🔮 Auto-Route' : activeModelName?.split('-')[0] || 'Model'}
                  </span>
                  <ChevronDown className="w-3 h-3 text-gray-500 shrink-0" />
                </button>

                {showModelMenu && (
                  <div className="absolute bottom-full right-0 mb-2 w-72 bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl z-50 p-2 space-y-1.5 animate-slide-up backdrop-blur-xl">
                    <div className="relative">
                      <Search className="w-3 h-3 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={modelSearch}
                        onChange={(e) => setModelSearch(e.target.value)}
                        placeholder="Tìm hoặc gõ model..."
                        className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-7 pr-2.5 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-sky-500/80"
                        autoFocus
                      />
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-1 pt-1">
                      {/* Auto Route Option */}
                      <button
                        type="button"
                        onClick={() => {
                          onSelectModel('auto', true);
                          setShowModelMenu(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors ${
                          isAutoRoute ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40' : 'text-gray-300 hover:bg-[#21262d]'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <Compass className="w-3.5 h-3.5 text-amber-400" />
                          <div>
                            <div className="font-semibold">🔮 Auto-Route (Smart)</div>
                            <div className="text-[10px] text-gray-400 leading-tight">Coder / Reason / Vision / Fast</div>
                          </div>
                        </div>
                        {isAutoRoute && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                      </button>

                      <div className="px-2 py-0.5 text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                        Quick Models
                      </div>

                      {[
                        { name: 'Qwen2.5-3B-Instruct-Q4_K_M.gguf', label: '⚡ Qwen-3B (Fast)', icon: <Zap className="w-3 h-3 text-amber-400" /> },
                        { name: 'Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf', label: '💻 Coder-7B (Code Specialist)', icon: <Code2 className="w-3 h-3 text-sky-400" /> },
                        { name: 'DeepSeek-R1-Distill-Qwen-8B-Q4_K_M.gguf', label: '🧠 DeepSeek-R1 (Reasoning)', icon: <Brain className="w-3 h-3 text-purple-400" /> },
                        { name: 'Qwen2-VL-7B-Instruct-Q4_K_M.gguf', label: '👁️ Qwen2-VL (Vision Multimodal)', icon: <Eye className="w-3 h-3 text-emerald-400" /> },
                        { name: 'llama-3.3-70b-instruct', label: '🌐 FreeLLM Cloud (70B)', icon: <Globe className="w-3 h-3 text-cyan-400" /> },
                      ]
                        .filter((m) => m.label.toLowerCase().includes(modelSearch.toLowerCase()) || m.name.toLowerCase().includes(modelSearch.toLowerCase()))
                        .map((m) => {
                          const isCur = !isAutoRoute && activeModelName === m.name;
                          return (
                            <button
                              key={m.name}
                              type="button"
                              onClick={() => {
                                onSelectModel(m.name, false);
                                setShowModelMenu(false);
                              }}
                              className={`w-full flex items-center justify-between p-1.5 rounded-lg text-left text-xs transition-colors ${
                                isCur ? 'bg-sky-500/15 text-sky-400 font-semibold border border-sky-500/30' : 'text-gray-300 hover:bg-[#21262d]'
                              }`}
                            >
                              <div className="flex items-center space-x-1.5 truncate">
                                {m.icon}
                                <span className="truncate">{m.label}</span>
                              </div>
                              {isCur && <Check className="w-3 h-3 text-sky-400 shrink-0" />}
                            </button>
                          );
                        })}

                      {/* Custom typed model if filtered */}
                      {modelSearch.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectModel(modelSearch.trim(), false);
                            setShowModelMenu(false);
                          }}
                          className="w-full p-2 text-left text-xs text-sky-400 hover:bg-[#21262d] rounded-lg border border-dashed border-sky-500/30"
                        >
                          Dùng model tùy chỉnh: "{modelSearch.trim()}"
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
                <span>Stop</span>
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
                <span>Send</span>
                <CornerDownLeft className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
