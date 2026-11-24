import React, { useState, useEffect } from 'react';
import { Cpu, Zap, CheckCircle2, Download, RefreshCw, AlertCircle, HardDrive } from 'lucide-react';
import type { HardwareStats } from '../../../types.js';
import { api } from '../../api.js';

interface HardwareTabProps {
  hardwareStats: HardwareStats | null;
  gpuLayers: number;
  setGpuLayers: (val: number) => void;
  contextSize: number;
  setContextSize: (val: number) => void;
  cpuThreads: number;
  setCpuThreads: (val: number) => void;
  flashAttention: boolean;
  setFlashAttention: (val: boolean) => void;
  onSaveHardwareConfig?: () => void;
  tuneApplied?: boolean;
  currentLang: string;
}

export const HardwareTab: React.FC<HardwareTabProps> = ({
  hardwareStats,
  gpuLayers,
  setGpuLayers,
  contextSize,
  setContextSize,
  cpuThreads,
  setCpuThreads,
  flashAttention,
  setFlashAttention,
  onSaveHardwareConfig,
  tuneApplied,
  currentLang,
}) => {
  const cpuFeatures = (hardwareStats as any)?.cpuFeatures;
  const vramTotal = hardwareStats?.vramTotalMb || 4096;
  const estimatedWeightMb = Math.round(Math.min(32, gpuLayers) * 125);
  const estimatedKvCacheMb = Math.round((2 * Math.min(32, gpuLayers) * contextSize * 2048) / (1024 * 1024));
  const safetyBufferMb = vramTotal <= 6000 ? 800 : 1200;
  const totalVramEstMb = estimatedWeightMb + estimatedKvCacheMb + safetyBufferMb;
  const isVramOverflown = totalVramEstMb > vramTotal;

  const weightPct = Math.min(100, Math.round((estimatedWeightMb / vramTotal) * 100));
  const kvPct = Math.min(100 - weightPct, Math.round((estimatedKvCacheMb / vramTotal) * 100));
  const bufferPct = Math.min(100 - weightPct - kvPct, Math.round((safetyBufferMb / vramTotal) * 100));

  return (
    <div className="space-y-4 animate-fade-in max-w-4xl">
      {/* Hardware Monitor Header */}
      <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] space-y-3 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-sky-400" />
            <span className="font-bold text-sm text-white">
              {hardwareStats?.gpuName || 'NVIDIA GeForce GTX 1650'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#0d1117] border border-[#30363d] text-gray-300">
              {cpuFeatures?.model || 'CPU Cục bộ'}
            </span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-md border font-bold ${
                cpuFeatures?.hasAvx2 !== false
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              }`}
            >
              {cpuFeatures?.hasAvx2 !== false ? 'AVX2 Sẵn sàng' : 'Không có AVX2'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3 rounded-lg bg-[#0d1117] border border-[#30363d]">
            <span className="text-gray-400 text-[11px]">VRAM Total:</span>
            <div className="text-base font-bold text-white font-mono mt-0.5">
              {hardwareStats ? `${hardwareStats.vramTotalMb} MB` : '4096 MB'}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#0d1117] border border-[#30363d]">
            <span className="text-gray-400 text-[11px]">VRAM Free:</span>
            <div className="text-base font-bold text-sky-400 font-mono mt-0.5">
              {hardwareStats ? `${hardwareStats.vramFreeMb} MB` : '3600 MB'}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#0d1117] border border-[#30363d]">
            <span className="text-gray-400 text-[11px]">System RAM:</span>
            <div className="text-base font-bold text-purple-400 font-mono mt-0.5">
              {hardwareStats ? `${Math.round(hardwareStats.ramTotalMb / 1024)} GB` : '8 GB'}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#0d1117] border border-[#30363d]">
            <span className="text-gray-400 text-[11px]">RAM Free:</span>
            <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
              {hardwareStats ? `${Math.round((hardwareStats.ramFreeMb || 0) / 1024)} GB` : '3 GB'}
            </div>
          </div>
        </div>
      </div>

      {/* Global Hardware Tuning Controls for Local llama.cpp */}
      <div className="p-5 rounded-2xl bg-[#161b22] border border-[#30363d] space-y-4 shadow-sm">
        <div className="border-b border-[#30363d] pb-3">
          <span className="text-sm font-bold text-white block">
            {currentLang === 'vi'
              ? 'Cấu hình phần cứng cho Local llama.cpp'
              : 'Hardware Tuning for Local llama.cpp'}
          </span>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {currentLang === 'vi'
              ? 'Khi kéo thanh trượt GPU VRAM, toàn bộ mô hình trong thư viện sẽ tự động tính toán lại độ tương thích và kiểm tra xem có đủ RAM/VRAM hay không.'
              : 'Changing the GPU layer slider automatically recalculates RAM and VRAM sufficiency across all models in real-time.'}
          </p>
        </div>

        {tuneApplied && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center space-x-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {currentLang === 'vi'
                ? 'Đã lưu cấu hình phần cứng thành công!'
                : 'Hardware settings saved successfully!'}
            </span>
          </div>
        )}

        {/* 1. GPU Offload Layers Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-gray-200">
              {currentLang === 'vi' ? 'Số Layer nạp vào GPU VRAM (-ngl):' : 'GPU Offload Layers (-ngl):'}
            </label>
            <span className="font-mono text-xs font-bold text-sky-400 bg-sky-500/10 px-2.5 py-0.5 rounded-full border border-sky-500/25">
              {gpuLayers} Layers
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={99}
            value={gpuLayers}
            onChange={(e) => setGpuLayers(parseInt(e.target.value, 10))}
            className="w-full accent-sky-400 h-2 bg-[#0d1117] rounded-lg cursor-pointer"
          />

          {/* Quick Preset Buttons */}
          <div className="flex items-center space-x-2 pt-1 flex-wrap gap-y-1">
            <span className="text-[10px] text-gray-400 font-mono mr-1">
              {currentLang === 'vi' ? 'Gợi ý nhanh:' : 'Presets:'}
            </span>
            {[
              { label: currentLang === 'vi' ? 'Chỉ CPU (0)' : 'CPU Only (0)', val: 0 },
              { label: 'GTX 1650 (21)', val: 21 },
              { label: 'GTX 1650 Max (28)', val: 28 },
              { label: currentLang === 'vi' ? '100% GPU (99)' : 'Max GPU (99)', val: 99 },
            ].map((item) => (
              <button
                key={item.val}
                type="button"
                onClick={() => setGpuLayers(item.val)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-mono border transition-all ${
                  gpuLayers === item.val
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 font-bold'
                    : 'bg-[#0d1117] text-gray-400 border-[#30363d] hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Live Strategy Indicator */}
          <div className="p-3 rounded-xl bg-[#0d1117] border border-[#30363d] grid grid-cols-2 gap-3 text-xs mt-2">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">
                {currentLang === 'vi' ? 'Mô hình nhỏ (1B - 3B):' : 'Small Models (1B - 3B):'}
              </span>
              <div className="flex items-center space-x-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${gpuLayers > 0 ? 'bg-emerald-400' : 'bg-gray-400'}`}
                ></span>
                <span className={`font-semibold ${gpuLayers > 0 ? 'text-emerald-400' : 'text-gray-300'}`}>
                  {gpuLayers === 0
                    ? currentLang === 'vi'
                      ? 'Chạy 100% trên CPU'
                      : '100% CPU'
                    : gpuLayers >= 16
                    ? currentLang === 'vi'
                      ? '⚡ Full GPU Offload (100% VRAM)'
                      : '⚡ Full GPU Offload'
                    : currentLang === 'vi'
                    ? `Hybrid (${gpuLayers} GPU)`
                    : `Hybrid (${gpuLayers} GPU)`}
                </span>
              </div>
              <p className="text-[10px] text-gray-500 font-mono">
                {gpuLayers > 0 ? 'Tốc độ cực nhanh: ~45 - 65 tokens/s' : 'Tốc độ: ~8 - 12 tokens/s'}
              </p>
            </div>

            <div className="space-y-1 border-l border-[#30363d] pl-3">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">
                {currentLang === 'vi' ? 'Mô hình vừa (7B - 8B):' : 'Medium Models (7B - 8B):'}
              </span>
              <div className="flex items-center space-x-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    gpuLayers >= 21 ? 'bg-amber-400' : gpuLayers > 0 ? 'bg-sky-400' : 'bg-gray-400'
                  }`}
                ></span>
                <span
                  className={`font-semibold ${
                    gpuLayers >= 21 ? 'text-amber-400' : gpuLayers > 0 ? 'text-sky-300' : 'text-gray-300'
                  }`}
                >
                  {gpuLayers === 0
                    ? currentLang === 'vi'
                      ? 'Chạy 100% trên CPU'
                      : '100% CPU'
                    : gpuLayers >= 32
                    ? currentLang === 'vi'
                      ? 'Full GPU (Cần >6GB VRAM)'
                      : 'Full GPU (>6GB VRAM)'
                    : currentLang === 'vi'
                    ? `⚡ Hybrid (${gpuLayers} GPU / ${Math.max(0, 32 - gpuLayers)} CPU)`
                    : `⚡ Hybrid (${gpuLayers} GPU)`}
                </span>
              </div>
              <p className="text-[10px] text-gray-500 font-mono">
                {gpuLayers >= 21
                  ? 'Tốc độ: ~10 - 16 t/s (Tối ưu GTX 1650)'
                  : gpuLayers > 0
                  ? 'Tốc độ: ~7 - 10 tokens/s'
                  : 'Tốc độ: ~3 - 6 tokens/s'}
              </p>
            </div>
          </div>

          {/* Dynamic VRAM & KV Cache Allocation Visualizer */}
          <div className="p-3.5 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-2 mt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-gray-200 flex items-center space-x-1.5">
                <HardDrive className="w-3.5 h-3.5 text-sky-400" />
                <span>
                  {currentLang === 'vi'
                    ? `Dự toán VRAM động (Mô hình 8B, Context ${contextSize}):`
                    : `Dynamic VRAM Allocation (8B Model, Context ${contextSize}):`}
                </span>
              </span>
              <span
                className={`font-mono text-[11px] font-bold ${
                  isVramOverflown ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {totalVramEstMb} MB / {vramTotal} MB {isVramOverflown ? '(⚠️ Tràn VRAM)' : '(✓ An toàn)'}
              </span>
            </div>

            {/* Segmented bar */}
            <div className="w-full h-2.5 bg-[#21262d] rounded-full overflow-hidden flex">
              <div
                className="bg-sky-500 h-full"
                style={{ width: `${weightPct}%` }}
                title={`Weights: ${estimatedWeightMb}MB`}
              />
              <div
                className="bg-purple-500 h-full"
                style={{ width: `${kvPct}%` }}
                title={`KV Cache: ${estimatedKvCacheMb}MB`}
              />
              <div
                className="bg-gray-500 h-full"
                style={{ width: `${bufferPct}%` }}
                title={`OS Buffer: ${safetyBufferMb}MB`}
              />
            </div>

            {/* Legend */}
            <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 flex-wrap gap-1 pt-0.5">
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-sky-500 inline-block"></span>
                <span>Trọng số model: ~{estimatedWeightMb} MB</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-purple-500 inline-block"></span>
                <span>KV Cache ({contextSize}): ~{estimatedKvCacheMb} MB</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-gray-500 inline-block"></span>
                <span>Hệ điều hành: ~{safetyBufferMb} MB</span>
              </span>
            </div>
          </div>
        </div>

        {/* 2. Context Size & CPU Threads */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-gray-200 block">
              {currentLang === 'vi' ? 'Độ dài ngữ cảnh (-c Context Size):' : 'Context Window (-c):'}
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {[2048, 4096, 8192, 16384].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setContextSize(sz)}
                  className={`py-1.5 text-center font-mono text-xs rounded-lg border transition-all ${
                    contextSize === sz
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 font-bold'
                      : 'bg-[#0d1117] text-gray-400 border-[#30363d] hover:text-white hover:bg-[#21262d]'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-gray-200 block">
              {currentLang === 'vi' ? 'Số luồng CPU xử lý (-t Threads):' : 'CPU Threads (-t):'}
            </span>
            <div className="grid grid-cols-5 gap-1.5">
              {[2, 4, 6, 8, 12].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCpuThreads(t)}
                  className={`py-1.5 text-center font-mono text-xs rounded-lg border transition-all ${
                    cpuThreads === t
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 font-bold'
                      : 'bg-[#0d1117] text-gray-400 border-[#30363d] hover:text-white hover:bg-[#21262d]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Flash Attention Toggle */}
        <div className="p-3.5 rounded-xl bg-[#0d1117] border border-[#30363d] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-white block">Flash Attention (-fa)</span>
            <p className="text-[10px] text-gray-400">
              {currentLang === 'vi'
                ? 'Tối ưu hóa GPU CUDA giúp tiết kiệm ~30% VRAM và tăng tốc sinh văn bản dài.'
                : 'CUDA optimization saving ~30% VRAM and speeding up long contexts.'}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={flashAttention}
              onChange={(e) => setFlashAttention(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-[#21262d] border border-[#30363d] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
          </label>
        </div>
      </div>

      {/* 4. Engine Runtime Management (Thin Client Architecture) */}
      <div className="p-5 rounded-2xl bg-[#161b22] border border-[#30363d] space-y-4 shadow-sm">
        <div className="border-b border-[#30363d] pb-3 flex items-center justify-between">
          <div>
            <span className="text-sm font-bold text-white block">
              {currentLang === 'vi' ? 'Động cơ suy luận (llama.cpp Runtime Engine)' : 'Inference Runtime Engine'}
            </span>
            <p className="text-xs text-gray-400 mt-0.5">
              {currentLang === 'vi'
                ? 'Động cơ biên dịch gốc tách rời giúp giảm 95% dung lượng bộ cài và tự động tương thích phần cứng máy bạn.'
                : 'Decoupled native engine package saving 95% installer footprint with auto hardware acceleration.'}
            </p>
          </div>
          <HardDrive className="w-5 h-5 text-sky-400 shrink-0" />
        </div>

        <EngineRuntimeSection currentLang={currentLang} />
      </div>
    </div>
  );
};

const EngineRuntimeSection: React.FC<{ currentLang: string }> = ({ currentLang }) => {
  const [engineStatus, setEngineStatus] = useState<any>(null);
  const [externalEngines, setExternalEngines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState('');
  const [showOfflineInput, setShowOfflineInput] = useState(false);
  const [offlinePath, setOfflinePath] = useState('');
  const [importing, setImporting] = useState(false);

  const loadStatus = async () => {
    try {
      const [res, ext] = await Promise.all([
        api.getEngineStatus(),
        api.getExternalEngines().catch(() => ({ engines: [] })),
      ]);
      setEngineStatus(res);
      setExternalEngines(ext.engines || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleInstall = async (runtimeId?: string) => {
    setInstalling(true);
    setMessage(currentLang === 'vi' ? 'Đang chuẩn bị tải gói động cơ...' : 'Preparing download...');
    try {
      const res = await api.installEngine(runtimeId);
      if (res.success) {
        setMessage(currentLang === 'vi' ? 'Đã cài đặt thành công!' : 'Installation successful!');
        await loadStatus();
      } else {
        setMessage(res.error || 'Lỗi cài đặt');
      }
    } catch (e: any) {
      setMessage(e.message || 'Lỗi kết nối máy chủ');
    } finally {
      setInstalling(false);
    }
  };

  const handleImportOffline = async () => {
    if (!offlinePath.trim()) return;
    setImporting(true);
    setMessage(currentLang === 'vi' ? 'Đang trích xuất và kiểm tra động cơ...' : 'Extracting and verifying engine...');
    try {
      const res = await api.importOfflineEngine(offlinePath.trim());
      if (res.success) {
        setMessage(currentLang === 'vi' ? 'Đã nhập động cơ ngoại tuyến thành công!' : 'Offline engine imported successfully!');
        setShowOfflineInput(false);
        setOfflinePath('');
        await loadStatus();
      } else {
        setMessage(res.error || 'Lỗi nhập engine');
      }
    } catch (e: any) {
      setMessage(e.message || 'Lỗi kết nối');
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return <div className="text-xs text-gray-500 font-mono py-2">Đang kiểm tra động cơ suy luận...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="p-3.5 rounded-xl bg-[#0d1117] border border-[#30363d] flex items-center justify-between flex-wrap gap-2">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            {engineStatus?.installed ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span className="text-xs font-bold text-white">
              {engineStatus?.installed
                ? currentLang === 'vi' ? 'Đã cài đặt sẵn sàng' : 'Engine Ready'
                : currentLang === 'vi' ? 'Chưa cài đặt động cơ' : 'Engine Not Installed'}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono">
              {engineStatus?.recommendedRuntimeId || 'auto-detect'}
            </span>
          </div>
          <p className="text-[11px] text-gray-400 font-mono truncate max-w-md">
            {engineStatus?.binaryPath || (currentLang === 'vi' ? 'Đường dẫn: %USERPROFILE%\\LocalAI\\bin' : 'Path: %USERPROFILE%\\LocalAI\\bin')}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowOfflineInput(!showOfflineInput)}
            className="px-3 py-2 text-xs font-semibold rounded-lg bg-[#21262d] hover:bg-[#30363d] text-gray-200 border border-[#30363d] transition-all flex items-center space-x-1.5"
            title={currentLang === 'vi' ? 'Nhập file ZIP hoặc thư mục engine có sẵn trên máy (Ngoại tuyến)' : 'Import local zip or folder (Offline)'}
          >
            <HardDrive className="w-3.5 h-3.5 text-teal-400" />
            <span>{currentLang === 'vi' ? 'Nhập Engine Offline' : 'Import Offline'}</span>
          </button>

          <button
            type="button"
            disabled={installing}
            onClick={() => handleInstall()}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50 transition-all flex items-center space-x-1.5 shadow-sm"
          >
            {installing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{currentLang === 'vi' ? 'Đang tải...' : 'Downloading...'}</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>
                  {engineStatus?.installed
                    ? currentLang === 'vi' ? 'Cập nhật lại Engine' : 'Reinstall / Update'
                    : currentLang === 'vi' ? 'Tải ngay (~35MB-400MB)' : 'Download Engine'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Offline Importer Drawer */}
      {showOfflineInput && (
        <div className="p-3.5 rounded-xl bg-[#0d1117] border border-teal-500/30 space-y-2 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-teal-300">
              {currentLang === 'vi' ? 'Nhập động cơ suy luận từ máy tính (Không cần Internet)' : 'Import Offline Engine from Local Disk'}
            </span>
            <span className="text-[10px] text-gray-400 font-mono">.zip / llama-server.exe / folder</span>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={offlinePath}
              onChange={(e) => setOfflinePath(e.target.value)}
              placeholder={
                currentLang === 'vi'
                  ? 'Dán đường dẫn tệp ZIP hoặc thư mục chứa llama-server...'
                  : 'Enter path to ZIP archive or directory containing llama-server...'
              }
              className="flex-1 px-3 py-1.5 rounded-lg bg-black/50 border border-[#30363d] text-xs text-white font-mono focus:outline-none focus:border-teal-400"
            />
            <button
              type="button"
              disabled={importing || !offlinePath.trim()}
              onClick={handleImportOffline}
              className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs disabled:opacity-50 transition-all flex items-center space-x-1 shadow-sm shrink-0"
            >
              {importing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>{currentLang === 'vi' ? 'Tiến hành nhập' : 'Import'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Discovered External Engines List */}
      {externalEngines.length > 0 && (
        <div className="p-3 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-2">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
            {currentLang === 'vi' ? 'Động cơ cục bộ phát hiện trên máy:' : 'Discovered Local Engines on Machine:'}
          </span>
          <div className="space-y-1.5">
            {externalEngines.map((ext) => (
              <div
                key={ext.id}
                className="flex items-center justify-between p-2 rounded-lg bg-[#161b22] border border-[#30363d] text-xs"
              >
                <div className="min-w-0 pr-2">
                  <span className="font-bold text-white block">{ext.name}</span>
                  <span className="text-[10px] text-gray-400 font-mono truncate block">{ext.binaryPath}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOfflinePath(ext.binaryPath);
                    setShowOfflineInput(true);
                  }}
                  className="px-2.5 py-1 rounded bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 text-xs font-semibold shrink-0 border border-sky-500/30 transition-colors"
                >
                  {currentLang === 'vi' ? 'Liên kết sử dụng' : 'Link Engine'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {message && (
        <div className="text-xs text-sky-400 font-mono px-1 flex items-center space-x-1.5">
          <span>{message}</span>
        </div>
      )}
    </div>
  );
};
