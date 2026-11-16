import React from 'react';
import type { ProviderConfig, HardwareStats, Workspace } from '../../types.js';
import { type Language, type Translations, dictionaries, getLanguage } from '../i18n.js';
import {
  Cpu,
  Zap,
  Globe,
  PanelRightOpen,
  PanelRightClose,
  Sparkles,
  Compass,
  Folder,
  Settings,
} from 'lucide-react';

interface HeaderProps {
  providers: ProviderConfig[];
  activeProvider: ProviderConfig | null;
  activeWorkspace?: Workspace | null;
  hardwareStats: HardwareStats | null;
  isRightSidebarOpen: boolean;
  autoRouteEnabled: boolean;
  isOnline?: boolean;
  lang?: Language;
  t?: Translations;
  onToggleLanguage?: (l: Language) => void;
  onToggleAutoRoute: () => void;
  onSwitchProvider: (providerId: string) => void;
  onSelectModel: (modelName: string) => void;
  onToggleRightSidebar: () => void;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = React.memo(({
  providers,
  activeProvider,
  activeWorkspace,
  hardwareStats,
  isRightSidebarOpen,
  autoRouteEnabled,
  isOnline = true,
  lang,
  t: propT,
  onToggleLanguage,
  onToggleAutoRoute,
  onSwitchProvider,
  onSelectModel,
  onToggleRightSidebar,
  onOpenSettings,
}) => {
  const currentLang = lang || getLanguage();
  const tr = propT || dictionaries[currentLang];

  // VRAM calculation for GTX 1650
  const vramUsedGb = hardwareStats ? (hardwareStats.vramUsedMb / 1024).toFixed(1) : '0.3';
  const vramTotalGb = hardwareStats ? (hardwareStats.vramTotalMb / 1024).toFixed(1) : '4.0';
  const vramPercent = hardwareStats && hardwareStats.vramTotalMb > 0
    ? Math.round((hardwareStats.vramUsedMb / hardwareStats.vramTotalMb) * 100)
    : 8;

  return (
    <header className="h-13 border-b border-[#30363d]/80 bg-[#161b22]/90 backdrop-blur-xl px-4 sm:px-5 flex items-center justify-between shrink-0 select-none z-30 shadow-sm relative">
      {/* 1. Left: Brand & Studio Name with Realtime Status */}
      <div className="flex items-center space-x-3.5 shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500 via-indigo-500 to-cyan-400 flex items-center justify-center text-slate-950 font-black text-xs shadow-md shadow-sky-500/20 ring-1 ring-white/20">
            ⚡
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-sm tracking-tight text-white flex items-center">
              LocalAI<span className="text-sky-400 ml-0.5 font-semibold">Studio</span>
            </span>

            {/* Live Connection Status Badge (No monospace, smooth sans typography) */}
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                isOnline
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
              }`}
            >
              <span className="relative flex h-1.5 w-1.5">
                {isOnline && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                    isOnline ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                ></span>
              </span>
              <span className="tracking-tight font-medium font-sans">
                {isOnline ? tr.online : tr.offline}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Center: Active Workspace & Model / Routing Breadcrumb */}
      <div className="hidden md:flex items-center space-x-2.5 px-3.5 py-1 rounded-full bg-[#0d1117]/80 border border-[#30363d]/80 text-xs shadow-inner backdrop-blur-md">
        {/* Workspace Chip */}
        <div className="flex items-center space-x-1.5 text-gray-300 max-w-[170px] truncate">
          <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate font-medium text-[11px]">
            {activeWorkspace?.name || (currentLang === 'vi' ? 'Chưa chọn thư mục' : 'No workspace')}
          </span>
        </div>

        <span className="text-gray-600 font-bold">•</span>

        {/* AI Engine Status Chip */}
        <div className="flex items-center space-x-1.5 max-w-[200px] truncate">
          {autoRouteEnabled ? (
            <>
              <Compass className="w-3.5 h-3.5 text-amber-400 animate-spin-slow shrink-0" />
              <span className="truncate text-[11px] font-medium text-amber-300">
                {currentLang === 'vi' ? 'Định tuyến thông minh' : 'Smart Auto-Route'}
              </span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="truncate text-[11px] font-medium text-sky-300">
                {activeProvider?.selectedModel?.split('-')[0] || activeProvider?.name || 'Local llama.cpp'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* 3. Right: Hardware HUD, Language Toggle & Tool Controls */}
      <div className="flex items-center space-x-2.5">
        {/* Hardware Status Capsule (GTX 1650 VRAM Gauge) */}
        <div
          className="flex items-center space-x-2 px-3 py-1 rounded-full bg-[#0d1117]/90 border border-[#30363d]/80 text-xs shadow-inner hover:border-sky-500/30 transition-all cursor-default"
          title={tr.vramTooltip || 'NVIDIA GTX 1650 (CUDA) • VRAM Allocation'}
        >
          <Cpu className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-[11px] text-gray-300 font-mono">
            <span className="text-white font-semibold">{vramUsedGb}</span>/{vramTotalGb}GB
          </span>
          <div className="w-12 h-1.5 bg-[#21262d] rounded-full overflow-hidden shrink-0">
            <div
              className={`h-full transition-all duration-300 ${
                vramPercent > 85 ? 'bg-rose-500' : vramPercent > 65 ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.max(8, vramPercent)}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-400 font-mono hidden lg:inline">
            {vramPercent}%
          </span>
        </div>

        {/* Modern Segmented Language Switcher [ VI | EN ] */}
        {onToggleLanguage && (
          <div className="flex items-center p-0.5 rounded-full bg-[#0d1117] border border-[#30363d] shadow-inner">
            <button
              type="button"
              onClick={() => onToggleLanguage('vi')}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                currentLang === 'vi'
                  ? 'bg-sky-500 text-slate-950 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Tiếng Việt (Giao diện hoàn chỉnh)"
            >
              VI
            </button>
            <button
              type="button"
              onClick={() => onToggleLanguage('en')}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                currentLang === 'en'
                  ? 'bg-sky-500 text-slate-950 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="English (100% full English)"
            >
              EN
            </button>
          </div>
        )}

        {/* Settings Quick Access Button */}
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            title={tr.settingsAndSkills}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#21262d] border border-transparent hover:border-[#30363d] transition-all"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}

        {/* Toggle Right Folder Tools Sidebar */}
        <button
          type="button"
          onClick={onToggleRightSidebar}
          title={isRightSidebarOpen ? tr.hideTools : tr.openTools}
          className={`p-1.5 rounded-lg border transition-all ${
            isRightSidebarOpen
              ? 'bg-sky-500/15 text-sky-400 border-sky-500/30 shadow-sm shadow-sky-500/10'
              : 'text-gray-400 hover:text-white hover:bg-[#21262d] border-transparent'
          }`}
        >
          {isRightSidebarOpen ? (
            <PanelRightClose className="w-4 h-4" />
          ) : (
            <PanelRightOpen className="w-4 h-4" />
          )}
        </button>
      </div>
    </header>
  );
});
