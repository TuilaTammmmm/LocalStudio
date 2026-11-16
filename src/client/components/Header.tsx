import React, { useState } from 'react';
import type { ProviderConfig, HardwareStats } from '../../types.js';
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
} from 'lucide-react';

interface HeaderProps {
  providers: ProviderConfig[];
  activeProvider: ProviderConfig | null;
  hardwareStats: HardwareStats | null;
  isRightSidebarOpen: boolean;
  autoRouteEnabled: boolean;
  onToggleAutoRoute: () => void;
  onSwitchProvider: (providerId: string) => void;
  onSelectModel: (modelName: string) => void;
  onToggleRightSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  providers,
  activeProvider,
  hardwareStats,
  isRightSidebarOpen,
  autoRouteEnabled,
  onToggleAutoRoute,
  onSwitchProvider,
  onSelectModel,
  onToggleRightSidebar,
}) => {
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
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-xs tracking-wide text-white">
                LocalAI Studio
              </span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono font-semibold">
                ONLINE
              </span>
            </div>
            <p className="text-[10px] text-gray-400 font-mono hidden sm:block">
              Standalone Desktop Core
            </p>
          </div>
        </div>
      </div>

      {/* 2. Right: Hardware HUD & Panel Controls */}
      <div className="flex items-center space-x-2.5">
        {/* Hardware Status Capsule (GTX 1650 VRAM Gauge) */}
        <div
          className="flex items-center space-x-2.5 px-3 py-1 rounded-full bg-[#0d1117] border border-[#30363d] text-xs shadow-inner"
          title="NVIDIA GeForce GTX 1650 Real-time VRAM"
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

        {/* Toggle Right Folder Tools Sidebar (Files, Shell/Terminal, Web/Browser, RAG, Prompt) */}
        <button
          onClick={onToggleRightSidebar}
          title={isRightSidebarOpen ? 'Hide Tools Panel (Shell, Browser, Files, RAG)' : 'Open Tools Panel (Shell, Browser, Files, RAG)'}
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
};
