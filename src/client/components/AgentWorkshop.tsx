import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  X,
  FileCode,
  Terminal,
  Activity,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export type AgentRole = 'coordinator' | 'coder' | 'critic' | 'harness';

export interface AgentWorkshopProps {
  activeAgent?: AgentRole | null;
  thoughts?: Record<string, string>;
  harnessLogs?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  lang?: 'en' | 'vi';
}

export const AgentWorkshop: React.FC<AgentWorkshopProps> = ({
  activeAgent = null,
  thoughts = {},
  harnessLogs = '',
  isExpanded: controlledExpanded,
  onToggleExpand,
  lang = 'vi',
}) => {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const toggleExpand = onToggleExpand || (() => setInternalExpanded((prev) => !prev));

  const [selectedAgent, setSelectedAgent] = useState<AgentRole | null>(null);
  const [copiedLog, setCopiedLog] = useState(false);

  const isVi = lang === 'vi';

  const agentConfig: Record<
    AgentRole,
    {
      name: string;
      enName: string;
      emoji: string;
      color: string;
      bgActive: string;
      borderActive: string;
      ringActive: string;
      title: string;
      description: string;
    }
  > = {
    coordinator: {
      name: 'Trưởng nhóm',
      enName: 'Leader',
      emoji: '🌐',
      color: 'text-sky-400',
      bgActive: 'bg-sky-500/15',
      borderActive: 'border-sky-500/60',
      ringActive: 'ring-sky-500/40',
      title: 'Kế hoạch & Phân bổ',
      description: isVi ? 'Lập kế hoạch và chia nhỏ nhiệm vụ' : 'Decomposes tasks & plans execution strategy',
    },
    coder: {
      name: 'Lập trình viên',
      enName: 'Coder',
      emoji: '💻',
      color: 'text-emerald-400',
      bgActive: 'bg-emerald-500/15',
      borderActive: 'border-emerald-500/60',
      ringActive: 'ring-emerald-500/40',
      title: 'Lập trình & Tối ưu',
      description: isVi ? 'Viết mã nguồn chuẩn cú pháp' : 'Implements code, refactors & satisfies rules',
    },
    critic: {
      name: 'Phản biện',
      enName: 'Reviewer',
      emoji: '🔍',
      color: 'text-purple-400',
      bgActive: 'bg-purple-500/15',
      borderActive: 'border-purple-500/60',
      ringActive: 'ring-purple-500/40',
      title: 'Soát lỗi & Tinh gọn',
      description: isVi ? 'Kiểm tra logic và lọc bỏ phần thừa' : 'Validates logic, memory leaks & constraints',
    },
    harness: {
      name: 'Kiểm thử',
      enName: 'Tester',
      emoji: '⚡',
      color: 'text-amber-400',
      bgActive: 'bg-amber-500/15',
      borderActive: 'border-amber-500/60',
      ringActive: 'ring-amber-500/40',
      title: 'Chạy thử hệ thống',
      description: isVi ? 'Tự động chạy lệnh kiểm thử trên terminal' : 'Executes automated local test commands',
    },
  };

  const handleCopyLogs = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLog(true);
    setTimeout(() => setCopiedLog(false), 2000);
  };

  /* -------------------------------------------------------------
     Inline Animated SVG Characters (<10KB total)
  ------------------------------------------------------------- */
  const renderCharacterSvg = (role: AgentRole, isActive: boolean) => {
    switch (role) {
      case 'coordinator':
        return (
          <svg
            viewBox="0 0 80 80"
            className={`w-10 h-10 transition-transform duration-300 ${
              isActive ? 'scale-110 animate-bounce' : 'group-hover:scale-105'
            }`}
          >
            <circle cx="40" cy="40" r="36" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" strokeDasharray={isActive ? "4 2" : "none"} />
            {/* Clipboard / Blueprint */}
            <rect x="25" y="24" width="30" height="40" rx="3" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
            <path d="M33 22h14a2 2 0 0 1 2 2v2H31v-2a2 2 0 0 1 2-2z" fill="#38bdf8" />
            <circle cx="40" cy="23" r="2" fill="#0f172a" />
            {/* Checklist lines */}
            <line x1="30" y1="32" x2="38" y2="32" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="41" y1="32" x2="49" y2="32" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="30" y1="40" x2="36" y2="40" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="39" y1="40" x2="49" y2="40" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="30" y1="48" x2="35" y2="48" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="38" y1="48" x2="47" y2="48" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
            {/* Network / Globe Node Pulse */}
            <circle cx="56" cy="22" r="5" fill={isActive ? "#38bdf8" : "#0284c7"} className={isActive ? "animate-ping" : ""} opacity={isActive ? 0.7 : 0.4} />
            <circle cx="56" cy="22" r="3.5" fill="#38bdf8" />
          </svg>
        );

      case 'coder':
        return (
          <svg
            viewBox="0 0 80 80"
            className={`w-10 h-10 transition-transform duration-300 ${
              isActive ? 'scale-110' : 'group-hover:scale-105'
            }`}
          >
            <circle cx="40" cy="40" r="36" fill="#064e3b" fillOpacity="0.25" stroke="#10b981" strokeWidth="2" />
            {/* Monitor */}
            <rect x="22" y="20" width="36" height="26" rx="3" fill="#0f172a" stroke="#10b981" strokeWidth="1.5" />
            <line x1="40" y1="46" x2="40" y2="52" stroke="#10b981" strokeWidth="2" />
            <line x1="34" y1="52" x2="46" y2="52" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
            {/* Code lines on screen */}
            <line x1="26" y1="26" x2="36" y2="26" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="26" y1="31" x2="48" y2="31" stroke="#6ee7b7" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="30" y1="36" x2="44" y2="36" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" />
            {/* Blinking cursor */}
            <rect x="46" y="34.5" width="2" height="4" fill="#10b981" className={isActive ? "animate-pulse" : ""} />
            {/* Coffee mug with rising steam */}
            <rect x="53" y="44" width="7" height="9" rx="1.5" fill="#f59e0b" />
            <path d="M60 46h2a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-2" fill="none" stroke="#f59e0b" strokeWidth="1" />
            <path
              d="M55 41c0-2 1-3 0-5"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="1"
              strokeLinecap="round"
              className={isActive ? "animate-pulse" : ""}
            />
          </svg>
        );

      case 'critic':
        return (
          <svg
            viewBox="0 0 80 80"
            className={`w-10 h-10 transition-transform duration-300 ${
              isActive ? 'scale-110' : 'group-hover:scale-105'
            }`}
          >
            <circle cx="40" cy="40" r="36" fill="#581c87" fillOpacity="0.25" stroke="#a855f7" strokeWidth="2" />
            {/* Document sheet */}
            <rect x="23" y="19" width="30" height="40" rx="3" fill="#1e1b4b" stroke="#a855f7" strokeWidth="1.5" />
            <line x1="28" y1="26" x2="44" y2="26" stroke="#c084fc" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="28" y1="32" x2="40" y2="32" stroke="#9333ea" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="28" y1="38" x2="45" y2="38" stroke="#9333ea" strokeWidth="1.5" strokeLinecap="round" />
            {/* Magnifying Glass scanning */}
            <g className={isActive ? "animate-bounce" : ""}>
              <circle cx="46" cy="42" r="11" fill="#3b0764" fillOpacity="0.8" stroke="#c084fc" strokeWidth="2" />
              <line x1="54" y1="50" x2="64" y2="60" stroke="#c084fc" strokeWidth="3" strokeLinecap="round" />
              {/* Checkmark inside glass */}
              <path d="M42 42l3 3 6-6" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </svg>
        );

      case 'harness':
        return (
          <svg
            viewBox="0 0 80 80"
            className={`w-10 h-10 transition-transform duration-300 ${
              isActive ? 'scale-110' : 'group-hover:scale-105'
            }`}
          >
            <circle cx="40" cy="40" r="36" fill="#78350f" fillOpacity="0.25" stroke="#f59e0b" strokeWidth="2" />
            {/* Spinning Gear */}
            <g
              transform="translate(36, 36)"
              className={isActive ? "origin-center animate-spin" : ""}
              style={{ animationDuration: '4s' }}
            >
              <circle cx="0" cy="0" r="13" fill="#1e293b" stroke="#f59e0b" strokeWidth="2" />
              <circle cx="0" cy="0" r="5" fill="#f59e0b" />
              {/* Gear teeth */}
              {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                <rect
                  key={deg}
                  x="-2"
                  y="-16"
                  width="4"
                  height="4"
                  rx="1"
                  fill="#f59e0b"
                  transform={`rotate(${deg})`}
                />
              ))}
            </g>
            {/* Speed Gauge / Needle */}
            <path d="M46 56a14 14 0 0 1 18-4" fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="2 2" />
            {/* Status Lights */}
            <circle cx="22" cy="24" r="3" fill="#10b981" className={isActive ? "animate-ping" : ""} />
            <circle cx="22" cy="24" r="2" fill="#34d399" />
            <circle cx="22" cy="32" r="2" fill="#eab308" />
            <circle cx="22" cy="40" r="2" fill="#ef4444" />
          </svg>
        );
    }
  };

  /* -------------------------------------------------------------
     Collapsed Mini-Pill Dock Mode (26px height)
  ------------------------------------------------------------- */
  if (!isExpanded) {
    return (
      <div className="w-full flex justify-center mb-1.5 animate-fade-in select-none">
        <button
          type="button"
          onClick={toggleExpand}
          title={isVi ? "Mở Biệt đội AI" : "Open AI Team"}
          className="h-6.5 px-3 py-0.5 flex items-center space-x-2 rounded-full bg-[#161b22]/90 hover:bg-[#21262d] backdrop-blur-md border border-[#30363d]/80 shadow-md text-gray-300 hover:text-white transition-all text-xs"
        >
          {/* 4 Status Dots [🌐 💻 🔍 ⚡] */}
          <div className="flex items-center space-x-1.5">
            {(['coordinator', 'coder', 'critic', 'harness'] as AgentRole[]).map((role) => {
              const isCurrent = activeAgent === role;
              const hasThought = !!thoughts[role] || (role === 'harness' && !!harnessLogs);
              return (
                <span
                  key={role}
                  className={`relative inline-flex items-center justify-center text-[12px] transition-transform ${
                    isCurrent ? 'scale-125' : 'opacity-80'
                  }`}
                  title={`${agentConfig[role].name}: ${isCurrent ? 'Đang hoạt động' : hasThought ? 'Có kết quả' : 'Sẵn sàng'}`}
                >
                  <span>{agentConfig[role].emoji}</span>
                  {isCurrent && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                    </span>
                  )}
                </span>
              );
            })}
          </div>

          <div className="h-3 w-px bg-[#30363d]" />

          <span className="text-[11px] font-medium text-gray-300 flex items-center space-x-1">
            {activeAgent ? (
              <span className={`font-semibold ${agentConfig[activeAgent].color} animate-pulse`}>
                {agentConfig[activeAgent].emoji} {isVi ? agentConfig[activeAgent].name : agentConfig[activeAgent].enName}...
              </span>
            ) : (
              <span className="text-gray-400">{isVi ? 'Biệt đội AI' : 'AI Team'}</span>
            )}
          </span>

          <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-0.5" />
        </button>
      </div>
    );
  }

  /* -------------------------------------------------------------
     Expanded Modern Glassmorphism Dock Mode
  ------------------------------------------------------------- */
  return (
    <div className="w-full mb-2.5 rounded-xl bg-[#161b22]/90 backdrop-blur-xl border border-[#30363d] shadow-xl p-2.5 animate-slide-up transition-all select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#30363d]/60">
        <div className="flex items-center space-x-2">
          <Activity className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-xs font-semibold text-gray-200">
            {isVi ? 'Biệt đội AI' : 'AI Team'}
          </span>
          {activeAgent && (
            <span className="px-2 py-0.5 text-[10px] rounded-full bg-sky-500/15 border border-sky-500/40 text-sky-300 font-mono animate-pulse">
              {agentConfig[activeAgent].emoji} {isVi ? `${agentConfig[activeAgent].name} đang chạy` : `${agentConfig[activeAgent].enName} Active`}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={toggleExpand}
          title={isVi ? "Thu gọn" : "Collapse"}
          className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-[#21262d] transition-colors"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 4 Agent Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {(['coordinator', 'coder', 'critic', 'harness'] as AgentRole[]).map((role) => {
          const cfg = agentConfig[role];
          const isActive = activeAgent === role;
          const isSelected = selectedAgent === role;
          const hasData = !!thoughts[role] || (role === 'harness' && !!harnessLogs);

          return (
            <button
              key={role}
              type="button"
              onClick={() => setSelectedAgent(selectedAgent === role ? null : role)}
              className={`group flex flex-col items-center p-2 rounded-lg border text-center transition-all duration-200 relative ${
                isActive
                  ? `${cfg.bgActive} ${cfg.borderActive} ring-2 ${cfg.ringActive} shadow-lg shadow-sky-500/10`
                  : isSelected
                  ? 'bg-[#21262d] border-sky-500/60 ring-1 ring-sky-500/30'
                  : 'bg-[#0d1117]/80 border-[#30363d] hover:border-[#484f58] hover:bg-[#161b22]'
              }`}
            >
              {/* Active Pulse Badge */}
              {isActive && (
                <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}

              {/* Avatar Illustration */}
              <div className="my-0.5">{renderCharacterSvg(role, isActive)}</div>

              {/* Name & Title */}
              <div className="mt-0.5 flex items-center space-x-1">
                <span className="text-[11px]">{cfg.emoji}</span>
                <span className={`text-[11px] font-semibold ${isActive ? cfg.color : 'text-gray-200'}`}>
                  {isVi ? cfg.name : cfg.enName}
                </span>
              </div>

              {/* Status Badge */}
              <span className="text-[10px] text-gray-400 mt-0.5 line-clamp-1 max-w-[130px]">
                {isActive
                  ? (isVi ? 'Đang xử lý...' : 'Processing...')
                  : hasData
                  ? (isVi ? 'Ghi chú 💭' : 'Notes 💭')
                  : (isVi ? 'Sẵn sàng' : 'Ready')}
              </span>
            </button>
          );
        })}
      </div>

      {/* Thought Bubble / Slide-Over Drawer Modal for Selected Agent */}
      {selectedAgent && (
        <div className="mt-2.5 p-2.5 rounded-lg bg-[#0d1117] border border-[#30363d] shadow-inner animate-slide-up text-left">
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#30363d]/60">
            <div className="flex items-center space-x-2">
              <span className="text-sm">{agentConfig[selectedAgent].emoji}</span>
              <div>
                <span className={`text-xs font-semibold ${agentConfig[selectedAgent].color}`}>
                  {isVi ? agentConfig[selectedAgent].name : agentConfig[selectedAgent].enName} — {agentConfig[selectedAgent].title}
                </span>
                <p className="text-[10px] text-gray-400">{agentConfig[selectedAgent].description}</p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              {((selectedAgent === 'harness' && harnessLogs) || thoughts[selectedAgent]) && (
                <button
                  type="button"
                  onClick={() => handleCopyLogs(selectedAgent === 'harness' ? harnessLogs : thoughts[selectedAgent] || '')}
                  title={isVi ? "Sao chép" : "Copy logs"}
                  className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#21262d] transition-colors"
                >
                  {copiedLog ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedAgent(null)}
                className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#21262d] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Drawer Body Content */}
          <div className="max-h-40 overflow-y-auto text-xs font-mono select-text leading-relaxed">
            {selectedAgent === 'harness' ? (
              harnessLogs ? (
                <pre className="p-2 rounded bg-[#161b22] border border-[#30363d] text-emerald-300 whitespace-pre-wrap font-mono text-[11px]">
                  {harnessLogs}
                </pre>
              ) : (
                <div className="p-2 text-center text-gray-500 font-sans text-xs">
                  {isVi
                    ? 'Chưa có nhật ký kiểm thử cho tác vụ hiện tại.'
                    : 'No harness execution logs recorded yet.'}
                </div>
              )
            ) : thoughts[selectedAgent] ? (
              <div className="p-2 rounded bg-[#161b22] border border-[#30363d] text-gray-200 whitespace-pre-wrap font-sans text-xs leading-relaxed">
                {thoughts[selectedAgent]}
              </div>
            ) : (
              <div className="p-2 text-center text-gray-500 font-sans text-xs">
                {isVi
                  ? `${agentConfig[selectedAgent].name} đang sẵn sàng nhận nhiệm vụ.`
                  : `${agentConfig[selectedAgent].enName} is ready for tasks.`}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
