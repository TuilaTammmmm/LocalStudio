import React, { useState } from 'react';
import type { ProviderConfig, HardwareStats } from '../../types.js';
import { type Language, type Translations, dictionaries, getLanguage } from '../i18n.js';
import {
  Cpu,
  Zap,
  Globe,
  ChevronDown,
  Sliders,
  PanelRightOpen,
  PanelRightClose,
  Sparkles,
  Gauge,
  Activity,
  Compass,
  Settings,
  Languages,
} from 'lucide-react';

interface HeaderProps {
  providers: ProviderConfig[];
  activeProvider: ProviderConfig | null;
  hardwareStats: HardwareStats | null;
  isRightSidebarOpen: boolean;
  autoRouteEnabled: boolean;
  lang?: Language;
  t?: Translations;
  onToggleLanguage?: (l: Language) => void;
  onToggleAutoRoute: () => void;
  onSwitchProvider: (providerId: string) => void;
  onSelectModel: (modelName: string) => void;
  onToggleRightSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = React.memo(({
  providers,
  activeProvider,
  hardwareStats,
  isRightSidebarOpen,
  autoRouteEnabled,
  lang,
  t: propT,
  onToggleLanguage,
  onToggleAutoRoute,
  onSwitchProvider,
  onSelectModel,
  onToggleRightSidebar,
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
    <header className="h-14 border-b border-[#30363d]/80 bg-[#161b22]/95 backdrop-blur-md px-5 flex items-center justify-between shrink-0 select-none z-30 shadow-sm">
      {/* 1. Left: Brand & Studio Name */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-slate-950 font-black text-sm shadow-md shadow-sky-500/20">
            ⚡
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-sm tracking-wide text-white">
              {tr.studioTitle}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono font-semibold">
              {tr.online}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Right: Language Switcher, Hardware HUD & Panel Controls */}
      <div className="flex items-center space-x-2.5">
        {/* Quick Language Toggle [ VI | EN ] */}
        {onToggleLanguage && (
          <button
            type="button"
            onClick={() => onToggleLanguage(currentLang === 'vi' ? 'en' : 'vi')}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] text-xs font-mono font-semibold transition-all text-gray-300 hover:text-white shadow-inner"
            title={currentLang === 'vi' ? 'Switch to English (100% full English)' : 'Chuyển sang tiếng Việt'}
          >
            <Languages className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[11px] font-bold">{currentLang === 'vi' ? 'VI' : 'EN'}</span>
          </button>
        )}

        {/* Hardware Status Capsule (GTX 1650 VRAM Gauge) */}
        <div
          className="flex items-center space-x-2.5 px-3 py-1 rounded-full bg-[#0d1117] border border-[#30363d] text-xs shadow-inner"
          title={tr.vramTooltip}
        >
          <div className="flex items-center space-x-1.5">
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-mono text-gray-300">
              <span className="text-white font-semibold">{vramUsedGb}</span>/{vramTotalGb}GB
            </span>
          </div>
          <div className="w-12 h-1.5 bg-[#21262d] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                vramPercent > 85 ? 'bg-red-500' : vramPercent > 65 ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.max(8, vramPercent)}%` }}
            />
          </div>
        </div>

        {/* Toggle Right Folder Tools Sidebar */}
        <button
          onClick={onToggleRightSidebar}
          title={isRightSidebarOpen ? tr.hideTools : tr.openTools}
          className={`p-1.5 rounded-lg border transition-all ${
            isRightSidebarOpen
              ? 'bg-[#21262d] text-sky-400 border-[#30363d]'
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
