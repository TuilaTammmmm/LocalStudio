import React, { useState, useRef, useEffect } from 'react';
import type { ProviderConfig, HardwareStats, Workspace } from '../../types.js';
import { type Language, type Translations, dictionaries, getLanguage } from '../i18n.js';
import {
  Cpu,
  Zap,
  Globe,
  PanelRightOpen,
  PanelRightClose,
  Sparkles,
  Folder,
  Settings,
  ChevronDown,
  Check,
} from 'lucide-react';

interface HeaderProps {
  providers: ProviderConfig[];
  activeProvider: ProviderConfig | null;
  activeWorkspace?: Workspace | null;
  hardwareStats: HardwareStats | null;
  isRightSidebarOpen: boolean;
  isOnline?: boolean;
  isStreaming?: boolean;
  lang?: Language;
  t?: Translations;
  onToggleLanguage?: (l: Language) => void;
  onSwitchProvider: (providerId: string) => void;
  onSelectModel: (modelName: string) => void;
  onToggleRightSidebar: () => void;
  onOpenSettings?: () => void;
  onOpenNewWorkspace?: () => void;
}

export const Header: React.FC<HeaderProps> = React.memo(({
  providers,
  activeProvider,
  activeWorkspace,
  hardwareStats,
  isRightSidebarOpen,
  isOnline = true,
  isStreaming = false,
  lang,
  t: propT,
  onSwitchProvider,
  onSelectModel,
  onToggleRightSidebar,
  onOpenSettings,
  onOpenNewWorkspace,
}) => {
  const currentLang = lang || getLanguage();
  const tr = propT || dictionaries[currentLang];

  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    if (isModelDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModelDropdownOpen]);

  // VRAM calculation for GTX 1650
  const vramUsedGb = hardwareStats ? (hardwareStats.vramUsedMb / 1024).toFixed(1) : '0.3';
  const vramTotalGb = hardwareStats ? (hardwareStats.vramTotalMb / 1024).toFixed(1) : '4.0';
  const vramPercent = hardwareStats && hardwareStats.vramTotalMb > 0
    ? Math.round((hardwareStats.vramUsedMb / hardwareStats.vramTotalMb) * 100)
    : 8;

  const currentModelDisplayName =
    activeProvider?.selectedModel || activeProvider?.name || 'Local llama.cpp';

  return (
    <header className="h-11 border-b border-[#30363d]/70 bg-[#161b22]/95 backdrop-blur-md px-3.5 flex items-center justify-between shrink-0 select-none z-30 shadow-sm relative">
      {/* 1. Left: Sleek Brand & Workspace Breadcrumb */}
      <div className="flex items-center space-x-2.5 shrink-0">
        <div className="w-5 h-5 rounded bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-[11px] shadow-sm">
          ⚡
        </div>
        <span className="font-semibold text-xs tracking-tight text-white hidden sm:inline">
          LocalAI
        </span>
        <span className="text-gray-600 text-xs hidden sm:inline">/</span>

        {/* Interactive Workspace Indicator */}
        <button
          type="button"
          onClick={onOpenNewWorkspace}
          className="flex items-center space-x-1.5 px-2 py-0.5 rounded-lg hover:bg-white/[0.06] text-gray-300 hover:text-white transition-all text-xs max-w-[200px] truncate group/wsbtn cursor-pointer"
          title={activeWorkspace ? `${activeWorkspace.name} (${activeWorkspace.folderPath})` : (currentLang === 'vi' ? 'Bấm để mở thư mục dự án' : 'Click to open project folder')}
        >
          {activeWorkspace ? (
            <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          )}
          <span className="truncate text-[11px] font-medium group-hover/wsbtn:text-sky-300">
            {activeWorkspace?.name || (currentLang === 'vi' ? 'Trò chuyện tự do' : 'General Chat')}
          </span>
        </button>

        {/* Live Status Dot */}
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`}
          title={isOnline ? 'Core Online' : 'Core Offline'}
        />
      </div>

      {/* 2. Center: Sleek Interactive Model & Provider Selector */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          disabled={isStreaming}
          onClick={() => !isStreaming && setIsModelDropdownOpen(!isModelDropdownOpen)}
          title={isStreaming ? (currentLang === 'vi' ? 'Đang trả lời... Vui lòng đợi' : 'Generating response... Please wait') : undefined}
          className={`flex items-center space-x-2 px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
            isStreaming
              ? 'opacity-60 cursor-not-allowed bg-[#0d1117]/50 border-[#30363d] text-gray-400'
              : isModelDropdownOpen
              ? 'bg-[#21262d] border-sky-500/50 text-white shadow-sm'
              : 'bg-[#0d1117]/80 hover:bg-[#21262d] border-[#30363d] text-gray-200'
          }`}
        >
          {activeProvider?.type === 'llama-server' ? (
            <Zap className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          ) : (
            <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          )}

          <span className="max-w-[220px] truncate text-[11px] font-medium">
            {currentModelDisplayName}
          </span>

          <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu for Quick Model & Provider Switch */}
        {isModelDropdownOpen && (
          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 w-72 p-1.5 rounded-xl bg-[#161b22] border border-[#30363d] shadow-2xl z-50 text-xs backdrop-blur-xl">
            {/* Providers List & Models (Only show enabled providers) */}
            <div className="max-h-60 overflow-y-auto space-y-1 py-0.5 custom-scrollbar">
              {providers.filter((p) => p.enabled !== false).map((p) => {
                const isSelected = activeProvider?.id === p.id;
                return (
                  <div key={p.id} className="rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => {
                        onSwitchProvider(p.id);
                        setIsModelDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2 py-1 rounded text-left transition-colors ${
                        isSelected
                          ? 'bg-sky-500/15 text-sky-300 font-semibold'
                          : 'text-gray-300 hover:bg-[#21262d] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5 truncate">
                        {p.type === 'llama-server' ? (
                          <Zap className="w-3 h-3 text-sky-400 shrink-0" />
                        ) : (
                          <Globe className="w-3 h-3 text-emerald-400 shrink-0" />
                        )}
                        <span className="truncate text-[11px]">{p.name}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                    </button>

                    {/* Sub-models list if active provider */}
                    {isSelected && p.models && p.models.length > 0 && (
                      <div className="pl-4 pr-1 py-1 space-y-0.5 border-l border-sky-500/20 ml-2 mt-1">
                        {p.models.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              onSelectModel(m);
                              setIsModelDropdownOpen(false);
                            }}
                            className={`w-full text-left px-2 py-0.5 rounded text-[10px] truncate block transition-colors ${
                              p.selectedModel === m
                                ? 'bg-sky-500/20 text-sky-200 font-medium'
                                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {onOpenSettings && (
              <div className="pt-1.5 border-t border-[#30363d]/60 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsModelDropdownOpen(false);
                    onOpenSettings();
                  }}
                  className="w-full text-center py-1 text-[10px] text-gray-400 hover:text-sky-400 transition-colors"
                >
                  {currentLang === 'vi' ? 'Quản lý Providers & Models trong Cài đặt →' : 'Manage Providers & Models in Settings →'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Right: Clean Hardware HUD & Action Buttons */}
      <div className="flex items-center space-x-2">
        {/* Compact VRAM Indicator */}
        <div
          className="flex items-center space-x-2 px-2.5 py-1 rounded-lg bg-[#0d1117]/80 border border-[#30363d] text-xs cursor-default"
          title={`NVIDIA GTX 1650: ${vramUsedGb} / ${vramTotalGb} GB VRAM (${vramPercent}%)`}
        >
          <Cpu className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-[11px] text-gray-300 font-mono">
            <span className="text-white font-medium">{vramUsedGb}</span>/{vramTotalGb}GB
          </span>
          <div className="w-10 h-1.5 bg-[#21262d] rounded-full overflow-hidden shrink-0">
            <div
              className={`h-full transition-all duration-300 ${
                vramPercent > 85 ? 'bg-rose-500' : vramPercent > 65 ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.max(8, vramPercent)}%` }}
            />
          </div>
        </div>

        {/* Toggle Right Tools Sidebar */}
        <button
          type="button"
          onClick={onToggleRightSidebar}
          title={isRightSidebarOpen ? tr.hideTools : tr.openTools}
          className={`p-1.5 rounded-lg border transition-colors ${
            isRightSidebarOpen
              ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
              : 'text-gray-400 hover:text-white hover:bg-[#21262d] border-transparent'
          }`}
        >
          {isRightSidebarOpen ? (
            <PanelRightClose className="w-3.5 h-3.5" />
          ) : (
            <PanelRightOpen className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </header>
  );
});
