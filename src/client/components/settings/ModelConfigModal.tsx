import React from 'react';
import { Sliders, X, Sparkles, Check } from 'lucide-react';
import type { EnrichedModelItem, ModelConfigFileState } from './types.js';

interface ModelConfigModalProps {
  configModel: EnrichedModelItem | null;
  onClose: () => void;
  modelConfigForm: ModelConfigFileState;
  setModelConfigForm: React.Dispatch<React.SetStateAction<ModelConfigFileState>>;
  modelConfigLoading: boolean;
  modelConfigSaved: boolean;
  onSave: () => void;
  onReset: () => void;
}

export const ModelConfigModal: React.FC<ModelConfigModalProps> = ({
  configModel,
  onClose,
  modelConfigForm,
  setModelConfigForm,
  modelConfigLoading,
  modelConfigSaved,
  onSave,
  onReset,
}) => {
  if (!configModel) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !modelConfigLoading) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-[#161b22] border border-sky-500/40 rounded-2xl shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
              <Sliders className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white truncate max-w-xs">{configModel.name}</h3>
              <p className="text-[10px] font-mono text-gray-400 truncate">{configModel.filename}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[#30363d] text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {modelConfigForm.description && (
          <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-[11px] leading-relaxed flex items-start space-x-2">
            <Sparkles className="w-4 h-4 shrink-0 text-sky-400 mt-0.5" />
            <span>{modelConfigForm.description}</span>
          </div>
        )}

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Temperature */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-gray-300 font-semibold">Nhiệt độ (Temperature):</span>
              <span className="font-mono text-sky-400 font-bold">{modelConfigForm.temperature.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={modelConfigForm.temperature}
              onChange={(e) =>
                setModelConfigForm((prev) => ({ ...prev, temperature: parseFloat(e.target.value) }))
              }
              className="w-full h-1.5 bg-[#30363d] rounded-lg appearance-none cursor-pointer accent-sky-500"
            />
            <span className="text-[10px] text-gray-500">Thấp: Chính xác, code logic. Cao: Sáng tạo, đàm thoại.</span>
          </div>

          {/* Top P */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-gray-300 font-semibold">Độ chọn lọc (Top P):</span>
              <span className="font-mono text-sky-400 font-bold">{modelConfigForm.topP.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={modelConfigForm.topP}
              onChange={(e) =>
                setModelConfigForm((prev) => ({ ...prev, topP: parseFloat(e.target.value) }))
              }
              className="w-full h-1.5 bg-[#30363d] rounded-lg appearance-none cursor-pointer accent-sky-500"
            />
          </div>

          {/* Repeat Penalty */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-gray-300 font-semibold">Phạt lặp từ (Repeat Penalty):</span>
              <span className="font-mono text-sky-400 font-bold">{modelConfigForm.repeatPenalty.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="1.3"
              step="0.02"
              value={modelConfigForm.repeatPenalty}
              onChange={(e) =>
                setModelConfigForm((prev) => ({ ...prev, repeatPenalty: parseFloat(e.target.value) }))
              }
              className="w-full h-1.5 bg-[#30363d] rounded-lg appearance-none cursor-pointer accent-sky-500"
            />
            <span className="text-[10px] text-gray-500">Khuyên dùng 1.0 (tắt) cho Gemma 2 và DeepSeek-R1 để tránh loạn ngữ.</span>
          </div>

          {/* GPU Layers */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-gray-300 font-semibold">Số lớp nạp vào GPU (GPU Layers):</span>
              <span className="font-mono text-emerald-400 font-bold">{modelConfigForm.gpuLayers} layers</span>
            </div>
            <input
              type="range"
              min="0"
              max="99"
              step="1"
              value={modelConfigForm.gpuLayers}
              onChange={(e) =>
                setModelConfigForm((prev) => ({ ...prev, gpuLayers: parseInt(e.target.value, 10) }))
              }
              className="w-full h-1.5 bg-[#30363d] rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <span className="text-[10px] text-gray-500">GTX 1650 4GB: 18-20 layers (model 8B-9B), 99 layers (model 1.5B-3B).</span>
          </div>

          {/* Context Size */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-gray-300 font-semibold">Độ dài ngữ cảnh (Context Size):</span>
              <span className="font-mono text-amber-400 font-bold">{modelConfigForm.contextSize} tokens</span>
            </div>
            <select
              value={modelConfigForm.contextSize}
              onChange={(e) =>
                setModelConfigForm((prev) => ({ ...prev, contextSize: parseInt(e.target.value, 10) }))
              }
              className="w-full px-3 py-1.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-gray-200 text-xs font-mono focus:outline-none focus:border-amber-500"
            >
              <option value={2048}>2048 (Tiết kiệm RAM nhất cho 8B-9B)</option>
              <option value={4096}>4096 (Chuẩn cho 1.5B-7B)</option>
              <option value={8192}>8192 (Ngữ cảnh dài)</option>
            </select>
          </div>

          {/* System Prompt Mode */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-gray-300 font-semibold">Xử lý vai trò System Prompt:</span>
            </div>
            <select
              value={modelConfigForm.systemPromptMode}
              onChange={(e) =>
                setModelConfigForm((prev) => ({ ...prev, systemPromptMode: e.target.value as any }))
              }
              className="w-full px-3 py-1.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-gray-200 text-xs focus:outline-none focus:border-sky-500"
            >
              <option value="standard">Tiêu chuẩn (Gửi role: system)</option>
              <option value="merge_to_user">Tự động gộp vào tin nhắn User (Khuyên dùng cho Gemma 2)</option>
              <option value="none">Bỏ qua System Prompt</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#30363d] pt-3">
          <button
            type="button"
            onClick={onReset}
            disabled={modelConfigLoading}
            className="px-3 py-1.5 rounded-xl bg-[#21262d] hover:bg-[#30363d] text-gray-300 text-xs font-medium transition-colors"
            title="Khôi phục lại thông số chuẩn theo dòng họ mô hình"
          >
            Khôi phục chuẩn (Auto-Preset)
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-[#21262d] hover:bg-[#30363d] text-gray-400 hover:text-white text-xs transition-colors"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={modelConfigLoading}
              className="px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-md shadow-sky-500/20 transition-all flex items-center space-x-1.5"
            >
              {modelConfigSaved ? (
                <>
                  <Check className="w-3.5 h-3.5 text-slate-950" />
                  <span>Đã lưu!</span>
                </>
              ) : (
                <span>Lưu cấu hình</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
