import React from 'react';
import { Sliders, Check } from 'lucide-react';

interface SamplingTabProps {
  temperature: number;
  setTemperature: (v: number) => void;
  topP: number;
  setTopP: (v: number) => void;
  maxTokens: number;
  setMaxTokens: (v: number) => void;
  repeatPenalty: number;
  setRepeatPenalty: (v: number) => void;
  autoApply: boolean;
  setAutoApply: (v: boolean) => void;
  defaultSystemPrompt: string;
  setDefaultSystemPrompt: (v: string) => void;
  onSave?: () => void;
  paramSaved?: boolean;
  currentLang: string;
}

export const SamplingTab: React.FC<SamplingTabProps> = ({
  temperature,
  setTemperature,
  topP,
  setTopP,
  maxTokens,
  setMaxTokens,
  repeatPenalty,
  setRepeatPenalty,
  autoApply,
  setAutoApply,
  defaultSystemPrompt,
  setDefaultSystemPrompt,
  onSave,
  paramSaved,
  currentLang,
}) => {
  return (
    <div className="space-y-4 animate-fade-in max-w-4xl">
      <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <div>
              <span className="font-bold text-sm text-white">Default Sampling Parameters</span>
              <p className="text-[11px] text-gray-400">
                {currentLang === 'vi'
                  ? 'Tùy biến độ sáng tạo, độ dài câu trả lời và tần suất lặp từ'
                  : 'Customize creativity, output length, and anti-repetition'}
              </p>
            </div>
          </div>
          {paramSaved && (
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30 flex items-center space-x-1">
              <Check className="w-3 h-3" />
              <span>{currentLang === 'vi' ? 'Đã lưu!' : 'Saved!'}</span>
            </span>
          )}
        </div>

        {/* Temperature */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-gray-200">Temperature (Độ ngẫu nhiên):</span>
            <span className="font-mono text-emerald-400 font-bold bg-[#0d1117] px-2 py-0.5 rounded border border-[#30363d]">
              {temperature.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.5"
            step="0.05"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-gray-500 font-mono">
            <span>{currentLang === 'vi' ? '0.0 (Chính xác)' : '0.0 (Precise)'}</span>
            <span>{currentLang === 'vi' ? '1.5 (Sáng tạo)' : '1.5 (Creative)'}</span>
          </div>
        </div>

        {/* Top-P */}
        <div className="space-y-1.5 pt-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-gray-200">
              {currentLang === 'vi' ? 'Lấy mẫu hạt nhân (Top-P):' : 'Top-P (Nucleus Sampling):'}
            </span>
            <span className="font-mono text-emerald-400 font-bold bg-[#0d1117] px-2 py-0.5 rounded border border-[#30363d]">
              {topP.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={topP}
            onChange={(e) => setTopP(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-gray-500 font-mono">
            <span>{currentLang === 'vi' ? '0.1 (Tập trung)' : '0.1 (Focused)'}</span>
            <span>{currentLang === 'vi' ? '1.0 (Rộng mở)' : '1.0 (Broad)'}</span>
          </div>
        </div>

        {/* Max Output Tokens */}
        <div className="space-y-1.5 pt-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-gray-200">
              {currentLang === 'vi' ? 'Độ dài phản hồi tối đa (Tokens):' : 'Max Generation Tokens:'}
            </span>
            <span className="font-mono text-emerald-400 font-bold bg-[#0d1117] px-2 py-0.5 rounded border border-[#30363d]">
              {maxTokens} tokens
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 pt-1">
            {[1024, 2048, 4096, 8192].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setMaxTokens(num)}
                className={`py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all ${
                  maxTokens === num
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                    : 'bg-[#0d1117] text-gray-400 border-[#30363d] hover:bg-[#21262d]'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* Repeat Penalty */}
        <div className="space-y-1.5 pt-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-gray-200">Repeat Penalty (Tránh lặp câu từ):</span>
            <span className="font-mono text-emerald-400 font-bold bg-[#0d1117] px-2 py-0.5 rounded border border-[#30363d]">
              {repeatPenalty.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="1.0"
            max="1.5"
            step="0.05"
            value={repeatPenalty}
            onChange={(e) => setRepeatPenalty(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer"
          />
        </div>

        {/* Auto-Apply Setting */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-[#0d1117] border border-[#30363d]">
          <div>
            <span className="font-semibold text-xs text-gray-200">
              {currentLang === 'vi' ? 'Tự động lưu code vào tệp dự án:' : 'Auto-apply code to files:'}
            </span>
            <p className="text-[11px] text-gray-400">
              {currentLang === 'vi'
                ? 'Tự động ghi code mới vào tệp dự án khi AI trả lời xong'
                : 'Automatically apply code changes into project files'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAutoApply(!autoApply)}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
              autoApply ? 'bg-emerald-500' : 'bg-[#30363d]'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                autoApply ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* System Prompt Preset */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-xs text-gray-200">
              {currentLang === 'vi' ? 'Chỉ dẫn hệ thống chung:' : 'Default Global System Prompt:'}
            </span>
            <span className="text-[10px] text-gray-500 font-mono">
              {currentLang === 'vi' ? 'Kéo góc dưới phải để mở rộng' : 'Resize corner'}
            </span>
          </div>
          <textarea
            rows={6}
            value={defaultSystemPrompt}
            onChange={(e) => setDefaultSystemPrompt(e.target.value)}
            placeholder="Nhập chỉ dẫn hệ thống mặc định..."
            className="w-full min-h-[140px] max-h-[420px] p-3 rounded-xl bg-[#0d1117] border border-[#30363d] text-gray-200 text-xs focus:outline-none focus:border-emerald-500 font-sans leading-relaxed resize-y"
          />
        </div>
      </div>
    </div>
  );
};
