import React, { useState, useMemo, useEffect } from 'react';
import {
  FolderOpen,
  Plus,
  X,
  Search,
  Check,
  CheckCircle2,
  Package,
  Sparkles,
  Download,
  RefreshCw,
  ChevronDown,
  ExternalLink,
  Heart,
  Settings as SettingsIcon,
  Trash2,
  Zap,
  HelpCircle,
  Cpu,
  Pause,
  Play,
  AlertCircle,
} from 'lucide-react';
import { ModelHubService, parseModelMetadata, type ModelHubItem } from '../../../model-hub.js';
import type { ProviderConfig, HardwareStats } from '../../../types.js';
import { getApiUrl } from '../../api.js';
import type { EnrichedModelItem } from './types.js';
import { ModelGlossaryModal } from './ModelGlossaryModal.js';

interface ModelHubTabProps {
  hubModels: EnrichedModelItem[];
  setHubModels: React.Dispatch<React.SetStateAction<EnrichedModelItem[]>>;
  selectedHubModel: EnrichedModelItem | null;
  setSelectedHubModel: (m: EnrichedModelItem | null) => void;
  providers: ProviderConfig[];
  hardwareStats: HardwareStats | null;
  gpuLayers: number;
  downloadProgress: Record<string, number>;
  downloadingId: string | null;
  onDownloadModel: (model: EnrichedModelItem) => void;
  onDeleteModel: (model: EnrichedModelItem, e?: React.MouseEvent) => void;
  onSetActiveModel: (model: EnrichedModelItem) => void;
  onOpenModelConfig: (model: EnrichedModelItem, e?: React.MouseEvent) => void;
  systemPaths: { models: string } | null;
  onOpenFolder: (path: string) => void;
  currentLang: string;
  onSyncProvider?: (id: string) => Promise<any>;
}

export const ModelHubTab: React.FC<ModelHubTabProps> = ({
  hubModels,
  setHubModels,
  selectedHubModel,
  setSelectedHubModel,
  providers,
  hardwareStats,
  gpuLayers,
  downloadProgress,
  downloadingId,
  onDownloadModel,
  onDeleteModel,
  onSetActiveModel,
  onOpenModelConfig,
  systemPaths,
  onOpenFolder,
  currentLang,
  onSyncProvider,
}) => {
  const [modelHubView, setModelHubView] = useState<'curated' | 'hf'>('curated');
  const [modelSearch, setModelSearch] = useState('');
  const [modelCategoryFilter, setModelCategoryFilter] = useState<
    'all' | 'coding' | 'reasoning' | 'vision' | 'general'
  >('all');

  // Hugging Face Explorer State
  const [hfSearchQuery, setHfSearchQuery] = useState('Qwen2.5-Coder');
  const [hfSearchResults, setHfSearchResults] = useState<Array<{
    id: string;
    author: string;
    name: string;
    downloads: number;
    likes: number;
    tags: string[];
    lastModified?: string;
  }>>([]);
  const [hfSearching, setHfSearching] = useState(false);
  const [hfSearchError, setHfSearchError] = useState<string | null>(null);
  const [selectedHfRepo, setSelectedHfRepo] = useState<string | null>(null);
  const [hfRepoFiles, setHfRepoFiles] = useState<Array<{
    filename: string;
    sizeBytes: number;
    sizeGb: number;
    quantization: string;
    parameterSize: string;
    category: 'coding' | 'reasoning' | 'vision' | 'general';
    downloadUrl: string;
  }>>([]);
  const [hfFilesLoading, setHfFilesLoading] = useState(false);
  const [hfDownloadingFiles, setHfDownloadingFiles] = useState<Record<string, boolean>>({});

  // Multi-download queue state
  const [downloadTasks, setDownloadTasks] = useState<Array<{
    modelId: string;
    name: string;
    status: 'idle' | 'downloading' | 'paused' | 'completed' | 'error';
    progressPercent: number;
    downloadedBytes: number;
    totalBytes: number;
    speedMbps: number;
    filePath?: string;
    downloadUrl?: string;
    filename?: string;
    error?: string;
  }>>([]);
  const [showDownloadManager, setShowDownloadManager] = useState(false);

  // Polling active download tasks across all models
  useEffect(() => {
    let timer: any = null;
    let isMounted = true;

    const fetchTasks = async () => {
      try {
        const res = await fetch(getApiUrl('/api/models/downloads'));
        if (res.ok && isMounted) {
          const tasks: any[] = await res.json();
          setDownloadTasks(tasks);

          const hasActive = tasks.some((t) => t.status === 'downloading');
          const hasCompleted = tasks.some((t) => t.status === 'completed');
          if (hasCompleted && onSyncProvider) {
            onSyncProvider('local-llama');
          }

          if (hasActive) {
            timer = setTimeout(fetchTasks, 600);
          } else if (tasks.some((t) => t.status === 'paused')) {
            timer = setTimeout(fetchTasks, 1500);
          }
        }
      } catch {}
    };

    fetchTasks();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [onSyncProvider]);

  const activeDownloads = downloadTasks.filter((t) => t.status === 'downloading');
  const pausedDownloads = downloadTasks.filter((t) => t.status === 'paused');
  const allActiveTasks = downloadTasks.filter(
    (t) => t.status === 'downloading' || t.status === 'paused' || t.status === 'error'
  );
  const activeDownloadsCount = activeDownloads.length;

  // Multi-download control handlers
  const handlePauseDownload = async (modelId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await fetch(getApiUrl(`/api/models/downloads/${encodeURIComponent(modelId)}/pause`), {
        method: 'POST',
      });
      const res = await fetch(getApiUrl('/api/models/downloads'));
      if (res.ok) setDownloadTasks(await res.json());
    } catch {}
  };

  const handleResumeDownload = async (modelId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await fetch(getApiUrl(`/api/models/downloads/${encodeURIComponent(modelId)}/resume`), {
        method: 'POST',
      });
      const res = await fetch(getApiUrl('/api/models/downloads'));
      if (res.ok) setDownloadTasks(await res.json());
    } catch {}
  };

  const handleCancelDownload = async (modelId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await fetch(getApiUrl(`/api/models/downloads/${encodeURIComponent(modelId)}/cancel`), {
        method: 'POST',
      });
      const res = await fetch(getApiUrl('/api/models/downloads'));
      if (res.ok) setDownloadTasks(await res.json());
    } catch {}
  };

  const handlePauseAll = async () => {
    try {
      await fetch(getApiUrl('/api/models/downloads/pause-all'), { method: 'POST' });
      const res = await fetch(getApiUrl('/api/models/downloads'));
      if (res.ok) setDownloadTasks(await res.json());
    } catch {}
  };

  const handleResumeAll = async () => {
    try {
      await fetch(getApiUrl('/api/models/downloads/resume-all'), { method: 'POST' });
      const res = await fetch(getApiUrl('/api/models/downloads'));
      if (res.ok) setDownloadTasks(await res.json());
    } catch {}
  };

  const handleCancelAll = async () => {
    try {
      await fetch(getApiUrl('/api/models/downloads/cancel-all'), { method: 'POST' });
      const res = await fetch(getApiUrl('/api/models/downloads'));
      if (res.ok) setDownloadTasks(await res.json());
    } catch {}
  };

  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);

  // Real-time dynamic evaluation cached via useMemo to eliminate UI lag during typing & sliding
  const compatibilityMap = useMemo(() => {
    const map = new Map<string, any>();
    const vramTotal = hardwareStats?.vramTotalMb || 4096;
    const vramFree = hardwareStats?.vramFreeMb || 3600;
    const ramTotal = hardwareStats?.ramTotalMb;
    const ramFree = hardwareStats?.ramFreeMb;
    for (const m of hubModels) {
      map.set(
        m.id,
        ModelHubService.evaluateCompatibility(m, vramTotal, vramFree, gpuLayers, ramTotal, ramFree)
      );
    }
    return map;
  }, [
    hubModels,
    hardwareStats?.vramTotalMb,
    hardwareStats?.vramFreeMb,
    hardwareStats?.ramTotalMb,
    hardwareStats?.ramFreeMb,
    gpuLayers,
  ]);

  const computeModelCompatibility = (model: ModelHubItem) => {
    return (
      compatibilityMap.get(model.id) ||
      ModelHubService.evaluateCompatibility(
        model,
        hardwareStats?.vramTotalMb || 4096,
        hardwareStats?.vramFreeMb || 3600,
        gpuLayers,
        hardwareStats?.ramTotalMb,
        hardwareStats?.ramFreeMb
      )
    );
  };

  const handleHfSearch = async (queryToSearch?: string) => {
    const q = (queryToSearch !== undefined ? queryToSearch : hfSearchQuery).trim();
    if (!q) return;
    setHfSearching(true);
    setHfSearchError(null);
    setSelectedHfRepo(null);
    setHfRepoFiles([]);
    try {
      const res = await fetch(getApiUrl(`/api/hf/search?q=${encodeURIComponent(q)}&limit=15`));
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || (currentLang === 'vi' ? 'Không thể kết nối đến máy chủ Hugging Face. Vui lòng kiểm tra lại kết nối mạng.' : 'Failed to reach Hugging Face Hub.'));
      }
      const data = await res.json();
      setHfSearchResults(data.results || []);
      if (!data.results || data.results.length === 0) {
        setHfSearchError(
          currentLang === 'vi'
            ? 'Không tìm thấy mô hình GGUF nào phù hợp.'
            : 'No matching GGUF models found.'
        );
      }
    } catch (err: any) {
      setHfSearchError(err.message || (currentLang === 'vi' ? 'Lỗi kết nối tới máy chủ Hugging Face Hub' : 'Failed to connect to Hugging Face Hub'));
    } finally {
      setHfSearching(false);
    }
  };

  const handleSelectHfRepo = async (repoId: string) => {
    if (selectedHfRepo === repoId) {
      setSelectedHfRepo(null);
      setHfRepoFiles([]);
      return;
    }
    setSelectedHfRepo(repoId);
    setHfFilesLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/hf/model-files?repo=${encodeURIComponent(repoId)}`));
      if (!res.ok) throw new Error('Failed to fetch files');
      const data = await res.json();
      setHfRepoFiles(data.files || []);
    } catch (err) {
      console.error('Failed to load HF files:', err);
      setHfRepoFiles([]);
    } finally {
      setHfFilesLoading(false);
    }
  };

  const handleDownloadHfFile = async (repoId: string, file: any) => {
    try {
      const res = await fetch(getApiUrl('/api/hf/download'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: repoId,
          filename: file.filename,
          downloadUrl: file.downloadUrl,
          sizeBytes: file.sizeBytes,
          quantization: file.quantization,
          parameterSize: file.parameterSize,
          category: file.category,
        }),
      });
      if (res.ok) {
        const hubRes = await fetch(getApiUrl('/api/models/hub'));
        if (hubRes.ok) {
          const hubData = await hubRes.json();
          setHubModels(hubData.models || []);
        }
        // Instantly refresh tasks queue
        const pollRes = await fetch(getApiUrl('/api/models/downloads'));
        if (pollRes.ok) {
          setDownloadTasks(await pollRes.json());
        }
      }
    } catch (err) {
      console.error('Failed to start HF download:', err);
    }
  };

  const localModels = providers.find((p) => p.id === 'local-llama')?.models || [];

  return (
    <div className="flex-1 flex overflow-hidden h-full animate-fade-in">
      {/* 1. Left Sub-Column: Model List */}
      <div className="w-[410px] border-r border-[#30363d] flex flex-col h-full bg-[#161b22]/40 shrink-0 p-4 space-y-3 overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-200">
            {currentLang === 'vi' ? 'Kho Mô Hình GGUF' : 'GGUF Model Hub'}
          </span>
          <div className="flex items-center space-x-1.5">
            {/* Multi-Download Queue Manager Button & Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDownloadManager(!showDownloadManager)}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                  activeDownloadsCount > 0
                    ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                    : allActiveTasks.length > 0
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    : 'bg-[#21262d] hover:bg-[#30363d] border-[#30363d] text-gray-300 hover:text-white'
                }`}
                title={currentLang === 'vi' ? 'Quản lý tiến trình tải mô hình' : 'Model Download Manager'}
              >
                <Download className={`w-3.5 h-3.5 ${activeDownloadsCount > 0 ? 'text-sky-400' : 'text-gray-400'}`} />
                <span>{currentLang === 'vi' ? 'Đang tải' : 'Downloads'}</span>
                {allActiveTasks.length > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                      activeDownloadsCount > 0 ? 'bg-sky-500 text-slate-950' : 'bg-amber-500 text-slate-950'
                    }`}
                  >
                    {allActiveTasks.length}
                  </span>
                )}
              </button>

              {/* Download Manager Popover */}
              {showDownloadManager && (
                <>
                  <div
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setShowDownloadManager(false)}
                  />
                  <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-[#161b22] border border-[#30363d] rounded-2xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl">
                    {/* Popover Header */}
                    <div className="p-3 bg-[#0d1117] border-b border-[#30363d] flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Download className="w-4 h-4 text-sky-400" />
                        <span className="text-xs font-bold text-white">
                          {currentLang === 'vi' ? 'Quản lý Tải Mô hình' : 'Download Manager'}
                        </span>
                        <span className="text-[10px] font-mono text-gray-400">
                          ({allActiveTasks.length})
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        {activeDownloads.length > 0 && (
                          <button
                            type="button"
                            onClick={handlePauseAll}
                            className="text-[10px] px-2 py-0.5 rounded bg-white/[0.05] hover:bg-white/[0.1] text-amber-300 border border-amber-500/30"
                            title="Tạm dừng tất cả"
                          >
                            {currentLang === 'vi' ? 'Dừng hết' : 'Pause All'}
                          </button>
                        )}
                        {pausedDownloads.length > 0 && (
                          <button
                            type="button"
                            onClick={handleResumeAll}
                            className="text-[10px] px-2 py-0.5 rounded bg-white/[0.05] hover:bg-white/[0.1] text-sky-300 border border-sky-500/30"
                            title="Tiếp tục tất cả"
                          >
                            {currentLang === 'vi' ? 'Tiếp tục hết' : 'Resume All'}
                          </button>
                        )}
                        {allActiveTasks.length > 0 && (
                          <button
                            type="button"
                            onClick={handleCancelAll}
                            className="text-[10px] px-2 py-0.5 rounded bg-white/[0.05] hover:bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            title="Hủy tất cả"
                          >
                            {currentLang === 'vi' ? 'Hủy hết' : 'Cancel All'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Task List */}
                    <div className="max-h-72 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                      {allActiveTasks.length === 0 ? (
                        <div className="p-4 text-center text-gray-400 text-xs">
                          {currentLang === 'vi' ? 'Hiện không có mô hình nào đang tải.' : 'No active downloads.'}
                        </div>
                      ) : (
                        allActiveTasks.map((t) => {
                          const isDownloading = t.status === 'downloading';
                          const isPaused = t.status === 'paused';
                          const isError = t.status === 'error';

                          return (
                            <div
                              key={t.modelId}
                              className="p-2.5 rounded-xl bg-black/40 border border-white/10 space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-white truncate max-w-[200px]" title={t.name}>
                                  {t.name}
                                </span>
                                <div className="flex items-center space-x-1 shrink-0">
                                  {isDownloading && (
                                    <button
                                      type="button"
                                      onClick={(e) => handlePauseDownload(t.modelId, e)}
                                      className="p-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors"
                                      title={currentLang === 'vi' ? 'Tạm dừng tải' : 'Pause'}
                                    >
                                      <Pause className="w-3 h-3" />
                                    </button>
                                  )}
                                  {isPaused && (
                                    <button
                                      type="button"
                                      onClick={(e) => handleResumeDownload(t.modelId, e)}
                                      className="p-1 rounded-md bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 transition-colors"
                                      title={currentLang === 'vi' ? 'Tiếp tục tải' : 'Resume'}
                                    >
                                      <Play className="w-3 h-3" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => handleCancelDownload(t.modelId, e)}
                                    className="p-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors"
                                    title={currentLang === 'vi' ? 'Hủy tải và xóa tệp tạm' : 'Cancel download'}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[10px] font-mono text-gray-400">
                                <span className="truncate max-w-[170px]">{t.filename || t.modelId}</span>
                                <span>
                                  {isDownloading && `${t.progressPercent}% • ${t.speedMbps} MB/s`}
                                  {isPaused && `${currentLang === 'vi' ? 'Đã tạm dừng' : 'Paused'} (${t.progressPercent}%)`}
                                  {isError && (currentLang === 'vi' ? 'Lỗi kết nối' : 'Error')}
                                </span>
                              </div>

                              {/* Progress bar */}
                              <div className="w-full h-1.5 bg-[#21262d] rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-200 ${
                                    isPaused ? 'bg-amber-400' : isError ? 'bg-rose-500' : 'bg-sky-500'
                                  }`}
                                  style={{ width: `${t.progressPercent}%` }}
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsGlossaryOpen(true)}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 hover:text-white border border-sky-500/30 text-[11px] font-semibold transition-all"
              title="Hướng dẫn thuật ngữ mô hình (Instruct, Thinking, Abliterated...)"
            >
              <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
              <span>{currentLang === 'vi' ? 'Thuật ngữ (i)' : 'Glossary (i)'}</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenFolder(systemPaths?.models || '')}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-gray-300 hover:text-white border border-[#30363d] text-[11px] font-semibold transition-all"
              title={
                currentLang === 'vi'
                  ? 'Mở thư mục models trên máy để thả tệp .gguf'
                  : 'Open models folder in Explorer'
              }
            >
              <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
              <span>{currentLang === 'vi' ? 'Mở thư mục' : 'Open Folder'}</span>
            </button>
          </div>
        </div>

        {/* View Switcher: Curated Local Hub vs Hugging Face Hub */}
        <div className="flex items-center p-1 rounded-xl bg-[#0d1117] border border-[#30363d] text-[11px] font-semibold gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setModelHubView('curated')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition-all text-center flex items-center justify-center space-x-1.5 ${
              modelHubView === 'curated'
                ? 'bg-sky-500/25 text-sky-200 border border-sky-500/40 shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>{currentLang === 'vi' ? 'Cục bộ & Tuyển chọn' : 'Local & Curated'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setModelHubView('hf');
              if (hfSearchResults.length === 0 && !hfSearching) {
                handleHfSearch('Qwen2.5-Coder');
              }
            }}
            className={`flex-1 py-1.5 px-2 rounded-lg transition-all text-center flex items-center justify-center space-x-1.5 ${
              modelHubView === 'hf'
                ? 'bg-sky-500/25 text-sky-200 border border-sky-500/40 shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>{currentLang === 'vi' ? 'Tìm Hugging Face' : 'Hugging Face Hub'}</span>
          </button>
        </div>

        {modelHubView === 'curated' ? (
          <>
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                placeholder={currentLang === 'vi' ? 'Tìm kiếm mô hình GGUF...' : 'Search GGUF models...'}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#0d1117] border border-[#30363d] text-gray-200 text-xs focus:outline-none focus:border-sky-500"
              />
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-[11px]">
              {[
                { id: 'all', label: currentLang === 'vi' ? 'Tất cả' : 'All' },
                { id: 'coding', label: `💻 ${currentLang === 'vi' ? 'Lập trình' : 'Coding'}` },
                { id: 'reasoning', label: `🧠 ${currentLang === 'vi' ? 'Suy luận' : 'Reasoning'}` },
                { id: 'vision', label: `👁️ ${currentLang === 'vi' ? 'Thị giác' : 'Vision'}` },
                { id: 'general', label: `⚡ ${currentLang === 'vi' ? 'Đa nhiệm' : 'General'}` },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setModelCategoryFilter(cat.id as any)}
                  className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition-all ${
                    modelCategoryFilter === cat.id
                      ? 'bg-sky-500/25 text-sky-300 border border-sky-500/40 shadow-sm'
                      : 'bg-[#21262d] text-gray-400 hover:text-white border border-[#30363d]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Model Cards List with REAL-TIME compatibility calculation */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {(() => {
                const filtered = hubModels.filter((m) => {
                  if (modelCategoryFilter !== 'all' && (m as any).category !== modelCategoryFilter) {
                    return false;
                  }
                  if (modelSearch) {
                    return (
                      m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
                      m.author.toLowerCase().includes(modelSearch.toLowerCase()) ||
                      m.tags.some((t) => t.toLowerCase().includes(modelSearch.toLowerCase()))
                    );
                  }
                  return true;
                });

                const isModelOnDisk = (m: EnrichedModelItem) => {
                  const mFn = m.filename.toLowerCase();
                  const mIdGguf = `${m.id.toLowerCase()}.gguf`;
                  return localModels.some((f) => {
                    const fl = f.toLowerCase();
                    return fl === mFn || fl === mIdGguf || fl.includes(m.id.toLowerCase());
                  });
                };

                const downloaded = filtered.filter(isModelOnDisk);
                const available = filtered.filter((m) => !isModelOnDisk(m));

                const renderCard = (m: EnrichedModelItem, onDisk: boolean) => {
                  const isSelected = selectedHubModel?.id === m.id;
                  const task = downloadTasks.find((t) => t.modelId === m.id || t.filename === m.filename);
                  const isDownloading = task?.status === 'downloading' || downloadingId === m.id;
                  const isPaused = task?.status === 'paused';
                  const progress = task ? task.progressPercent : downloadProgress[m.id] || 0;
                  // Dynamic evaluation for this card right now!
                  const dynamicComp = computeModelCompatibility(m);

                  return (
                    <div
                      key={m.id}
                      onClick={() => setSelectedHubModel(m)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#1c2128] border-sky-500/60 shadow-md ring-1 ring-sky-500/30'
                          : 'bg-[#161b22]/70 border-[#30363d] hover:border-gray-500 hover:bg-[#161b22]'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 pr-2">
                          <h4 className="text-xs font-bold text-white truncate">{m.name}</h4>
                          <p className="text-[10px] text-gray-400 font-mono truncate">
                            {m.author} • {m.parameterSize} • {m.quantization}
                          </p>
                        </div>
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded-full border font-mono font-semibold shrink-0 ${dynamicComp.badgeColor}`}
                        >
                          {dynamicComp.statusLabel}
                        </span>
                      </div>

                      {/* Hardware / RAM sufficiency banner */}
                      <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-gray-400">
                        <span>
                          VRAM: ~{dynamicComp.estimatedVramMb}MB | RAM: ~{dynamicComp.estimatedRamMb}MB
                        </span>
                        <span
                          className={
                            dynamicComp.isSufficient === false ? 'text-rose-400 font-semibold' : 'text-emerald-400 font-semibold'
                          }
                        >
                          {dynamicComp.isSufficient === false ? '⚠️ Thiếu tài nguyên' : '✓ Đủ cấu hình'}
                        </span>
                      </div>

                      {isDownloading && (
                        <div className="mt-2 space-y-1.5 p-2 rounded-lg bg-sky-500/10 border border-sky-500/30">
                          <div className="flex items-center justify-between text-[10px] text-sky-400 font-mono">
                            <span className="flex items-center space-x-1 truncate mr-2">
                              <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
                              <span>{currentLang === 'vi' ? 'Đang tải' : 'Downloading'}</span>
                              {task?.speedMbps ? <span>({task.speedMbps} MB/s)</span> : null}
                            </span>
                            <div className="flex items-center space-x-1.5 shrink-0">
                              <span className="font-bold">{progress}%</span>
                              {task && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => handlePauseDownload(task.modelId, e)}
                                    className="p-1 hover:bg-sky-500/20 rounded text-sky-300 transition-colors"
                                    title={currentLang === 'vi' ? 'Tạm dừng tải' : 'Pause download'}
                                  >
                                    <Pause className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleCancelDownload(task.modelId, e)}
                                    className="p-1 hover:bg-rose-500/20 rounded text-rose-400 transition-colors"
                                    title={currentLang === 'vi' ? 'Hủy tải' : 'Cancel download'}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="w-full h-1.5 bg-[#21262d] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-sky-500 transition-all duration-200"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {isPaused && task && (
                        <div className="mt-2 space-y-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                          <div className="flex items-center justify-between text-[10px] text-amber-400 font-mono">
                            <span className="flex items-center space-x-1 truncate mr-2">
                              <Pause className="w-3 h-3 shrink-0" />
                              <span>{currentLang === 'vi' ? 'Đã tạm dừng' : 'Paused'}</span>
                            </span>
                            <div className="flex items-center space-x-1.5 shrink-0">
                              <span className="font-bold">{progress}%</span>
                              <button
                                type="button"
                                onClick={(e) => handleResumeDownload(task.modelId, e)}
                                className="p-1 hover:bg-amber-500/20 rounded text-amber-300 transition-colors"
                                title={currentLang === 'vi' ? 'Tiếp tục tải' : 'Resume download'}
                              >
                                <Play className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleCancelDownload(task.modelId, e)}
                                className="p-1 hover:bg-rose-500/20 rounded text-rose-400 transition-colors"
                                title={currentLang === 'vi' ? 'Hủy tải' : 'Cancel download'}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div className="w-full h-1.5 bg-[#21262d] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 transition-all duration-200"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                };

                return (
                  <>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400 uppercase tracking-wider px-1">
                        <span className="flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>
                            {currentLang === 'vi' ? 'Mô hình đã tải về máy' : 'Downloaded Models'} (
                            {downloaded.length})
                          </span>
                        </span>
                      </div>
                      {downloaded.length === 0 ? (
                        <div className="p-3 rounded-xl bg-[#0d1117] border border-[#30363d] text-center text-gray-500 text-[11px] font-mono">
                          {currentLang === 'vi' ? 'Chưa có mô hình nào được tải về' : 'No downloaded models'}
                        </div>
                      ) : (
                        downloaded.map((m) => renderCard(m, true))
                      )}
                    </div>

                    <div className="space-y-1.5 pt-3 border-t border-[#30363d]/60">
                      <div className="flex items-center justify-between text-[11px] font-bold text-sky-400 uppercase tracking-wider px-1">
                        <span className="flex items-center space-x-1">
                          <Package className="w-3.5 h-3.5" />
                          <span>
                            {currentLang === 'vi'
                              ? 'Kho mô hình sẵn có & Tải về'
                              : 'Available to Download'}{' '}
                            ({available.length})
                          </span>
                        </span>
                      </div>
                      {available.map((m) => renderCard(m, false))}
                    </div>
                  </>
                );
              })()}
            </div>
          </>
        ) : (
          /* Hugging Face Search & Results */
          <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
            <div className="space-y-2 shrink-0">
              <div className="flex items-center space-x-1.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={hfSearchQuery}
                    onChange={(e) => setHfSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleHfSearch()}
                    placeholder={
                      currentLang === 'vi'
                        ? 'Tìm mô hình GGUF (vd: Qwen, DeepSeek)...'
                        : 'Search HF GGUF (e.g. Qwen, DeepSeek)...'
                    }
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#0d1117] border border-[#30363d] text-gray-200 text-xs focus:outline-none focus:border-sky-500 font-mono"
                  />
                  <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>
                <button
                  type="button"
                  onClick={() => handleHfSearch()}
                  disabled={hfSearching}
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shrink-0 transition-all flex items-center space-x-1.5 shadow-md shadow-sky-500/20 disabled:opacity-50"
                >
                  {hfSearching ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span>{currentLang === 'vi' ? 'Tìm' : 'Search'}</span>
                </button>
              </div>

              <div className="flex items-center space-x-1 overflow-x-auto pb-1 text-[10px]">
                {['Qwen2.5-Coder', 'DeepSeek-R1', 'Llama-3.2', 'Gemma-2', 'Phi-4', 'Mistral-Nemo'].map(
                  (kw) => (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => {
                        setHfSearchQuery(kw);
                        handleHfSearch(kw);
                      }}
                      className="px-2 py-0.5 rounded-md bg-[#21262d] text-gray-300 hover:text-white hover:border-sky-500/40 border border-[#30363d] shrink-0 font-mono transition-colors"
                    >
                      {kw}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {hfSearching && (
                <div className="p-8 text-center text-gray-400 text-xs space-y-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-sky-400 mx-auto" />
                  <p>
                    {currentLang === 'vi'
                      ? 'Đang tìm kiếm trên Hugging Face...'
                      : 'Searching Hugging Face...'}
                  </p>
                </div>
              )}

              {hfSearchError && !hfSearching && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {hfSearchError}
                </div>
              )}

              {!hfSearching &&
                hfSearchResults.length > 0 &&
                hfSearchResults.map((repo) => {
                  const isSelected = selectedHfRepo === repo.id;
                  return (
                    <div
                      key={repo.id}
                      onClick={() => handleSelectHfRepo(repo.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#1c2128] border-sky-500/60 shadow-md ring-1 ring-sky-500/30'
                          : 'bg-[#161b22]/70 border-[#30363d] hover:border-gray-500 hover:bg-[#161b22]'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 pr-2">
                          <h4 className="text-xs font-bold text-white truncate">{repo.name}</h4>
                          <p className="text-[10px] text-gray-400 font-mono truncate">{repo.id}</p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 font-semibold shrink-0">
                          HF
                        </span>
                      </div>

                      <div className="flex items-center space-x-3 text-[10px] text-gray-400 font-mono mt-2 pt-2 border-t border-[#30363d]/50">
                        <span>
                          📥 {repo.downloads > 1000 ? `${(repo.downloads / 1000).toFixed(1)}k` : repo.downloads}
                        </span>
                        <span>❤️ {repo.likes}</span>
                        <span className="text-sky-400 ml-auto flex items-center space-x-0.5">
                          <span>{isSelected ? 'Đang chọn' : 'Xem Quants'}</span>
                          <ChevronDown
                            className={`w-3 h-3 transition-transform ${isSelected ? 'rotate-180' : ''}`}
                          />
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* 2. Right Sub-Column: Selected Model Inspector & CUDA Tuner */}
      <div className="flex-1 h-full overflow-y-auto p-6 space-y-4">
        {modelHubView === 'hf' ? (
          selectedHfRepo ? (
            <div className="space-y-4 w-full animate-fade-in">
              <div className="p-4 rounded-2xl bg-[#161b22] border border-amber-500/30 space-y-3 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-bold text-base text-white">
                        {selectedHfRepo.split('/')[1] || selectedHfRepo}
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30">
                        Hugging Face Hub
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                      Repo: <span className="text-gray-200">{selectedHfRepo}</span>
                    </p>
                  </div>

                  <a
                    href={`https://huggingface.co/${selectedHfRepo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-[11px] text-amber-400 hover:text-amber-300 font-mono bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20"
                  >
                    <span>Mở trên Hugging Face</span>
                    <ExternalLink className="w-3 h-3 ml-0.5" />
                  </a>
                </div>

                {(() => {
                  const repoMeta = hfSearchResults.find((r) => r.id === selectedHfRepo);
                  if (!repoMeta) return null;
                  return (
                    <div className="flex items-center space-x-3 text-xs text-gray-300 pt-1">
                      <span className="flex items-center space-x-1">
                        <Download className="w-3.5 h-3.5 text-gray-400" />
                        <span>{repoMeta.downloads.toLocaleString()} lượt tải</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center space-x-1">
                        <Heart className="w-3.5 h-3.5 text-rose-400" />
                        <span>{repoMeta.likes} yêu thích</span>
                      </span>
                      <span>•</span>
                      <span className="text-gray-400">Tác giả: {repoMeta.author}</span>
                    </div>
                  );
                })()}
              </div>

              {/* Hardware Compatibility & Sufficiency Verdict HUD (Synchronized with Local Hub) */}
              {(() => {
                const vramFree = (hardwareStats?.vramFreeMb || 3600) / 1024;
                const vramTotal = (hardwareStats?.vramTotalMb || 4096) / 1024;
                const ramTotal = (hardwareStats?.ramTotalMb || 8192) / 1024;
                const ramFree = (hardwareStats?.ramFreeMb || 4096) / 1024;
                const gpuName = hardwareStats?.gpuName || 'NVIDIA GeForce GPU';

                const smallestQuant = hfRepoFiles.reduce(
                  (min, f) => (f.sizeGb < min ? f.sizeGb : min),
                  hfRepoFiles.length > 0 ? hfRepoFiles[0].sizeGb : 999
                );
                const standardQuant = hfRepoFiles.find(
                  (f) => f.quantization.toLowerCase().includes('q4_k_m') || f.quantization.toLowerCase() === 'q4_0'
                ) || (hfRepoFiles.length > 0 ? hfRepoFiles[0] : null);

                const hasGpuFit = smallestQuant <= vramFree * 0.9;
                const hasHybridFit = standardQuant ? standardQuant.sizeGb <= (vramFree + ramFree) * 0.9 : true;

                return (
                  <div className="p-4 rounded-2xl bg-[#161b22] border border-[#30363d] space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Cpu className="w-4 h-4 text-sky-400" />
                        <span className="text-xs font-bold text-gray-200">
                          {currentLang === 'vi' ? 'Khả năng đáp ứng phần cứng hệ thống' : 'Hardware Sufficiency & Compatibility'}
                        </span>
                      </div>
                      <span
                        className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border font-semibold ${
                          hasGpuFit
                            ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                            : hasHybridFit
                            ? 'text-amber-300 bg-amber-500/10 border-amber-500/30'
                            : 'text-rose-300 bg-rose-500/10 border-rose-500/30'
                        }`}
                      >
                        {hasGpuFit
                          ? (currentLang === 'vi' ? '100% GPU Sẵn sàng' : '100% GPU Ready')
                          : hasHybridFit
                          ? (currentLang === 'vi' ? 'Hybrid CUDA+CPU' : 'Hybrid Offload')
                          : (currentLang === 'vi' ? 'Thiếu RAM / VRAM' : 'Low Memory')}
                      </span>
                    </div>

                    {/* Hardware Metrics Chips */}
                    <div className="grid grid-cols-3 gap-2 text-center font-mono text-[11px]">
                      <div className="p-2 rounded-xl bg-[#0d1117] border border-[#30363d]">
                        <span className="text-gray-400 block text-[10px]">GPU & VRAM trống</span>
                        <span className="text-white font-bold">{vramFree.toFixed(1)} GB / {vramTotal.toFixed(1)} GB</span>
                      </div>
                      <div className="p-2 rounded-xl bg-[#0d1117] border border-[#30363d]">
                        <span className="text-gray-400 block text-[10px]">RAM hệ thống</span>
                        <span className="text-white font-bold">{ramFree.toFixed(1)} GB trống / {ramTotal.toFixed(0)} GB</span>
                      </div>
                      <div className="p-2 rounded-xl bg-[#0d1117] border border-[#30363d]">
                        <span className="text-gray-400 block text-[10px]">Khuyên dùng (Q4_K_M)</span>
                        <span className="text-emerald-400 font-bold">{standardQuant ? `${standardQuant.sizeGb} GB` : '~4.5 GB'}</span>
                      </div>
                    </div>

                    {/* Sufficiency Verdict Banner */}
                    <div
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                        hasGpuFit
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : hasHybridFit
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      <span className="font-semibold flex items-center space-x-1.5">
                        <span>
                          {hasGpuFit
                            ? '✓ Đủ tài nguyên: GPU của bạn đáp ứng tốt mô hình này với tốc độ cao.'
                            : hasHybridFit
                            ? '⚡ Chế độ Hybrid: Nạp một phần layers vào VRAM, phần còn lại chạy trên CPU + RAM.'
                            : '⚠️ Cảnh báo: Mô hình này vượt quá dung lượng RAM + VRAM trống của máy.'}
                        </span>
                      </span>
                      <span className="text-[11px] font-mono shrink-0 ml-2">
                        {gpuName}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-200 flex items-center space-x-1.5">
                    <Package className="w-4 h-4 text-amber-400" />
                    <span>
                      {currentLang === 'vi'
                        ? 'Các bản Quantization (.gguf) khả dụng'
                        : 'Available Quantization (.gguf) Files'}
                    </span>
                    <span className="text-gray-400 font-mono text-[11px]">({hfRepoFiles.length})</span>
                  </h4>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setIsGlossaryOpen(true)}
                      className="flex items-center space-x-1 text-[11px] text-amber-400 hover:text-amber-300 font-medium"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>{currentLang === 'vi' ? 'Giải thích thuật ngữ (i)' : 'Terminology (i)'}</span>
                    </button>
                    <span className="text-[11px] text-gray-500">•</span>
                    <span className="text-[11px] text-gray-400">
                      {currentLang === 'vi'
                        ? 'Khuyên dùng: Q4_K_M (Cân bằng tốc độ & chất lượng)'
                        : 'Recommended: Q4_K_M (Speed & Quality balance)'}
                    </span>
                  </div>
                </div>

                {hfFilesLoading ? (
                  <div className="p-8 text-center text-gray-400 text-xs space-y-2 rounded-2xl bg-[#161b22] border border-[#30363d]">
                    <RefreshCw className="w-6 h-6 animate-spin text-amber-400 mx-auto" />
                    <p>
                      {currentLang === 'vi'
                        ? 'Đang đọc danh sách tệp .gguf từ Hugging Face Hub...'
                        : 'Scanning .gguf files from Hugging Face Hub...'}
                    </p>
                  </div>
                ) : hfRepoFiles.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-xs rounded-2xl bg-[#161b22] border border-[#30363d]">
                    {currentLang === 'vi'
                      ? 'Không tìm thấy tệp .gguf khả dụng trong repo này.'
                      : 'No .gguf files found in this repository.'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {hfRepoFiles.map((file) => {
                      const isDownloaded = localModels.some(
                        (m) => m.toLowerCase() === file.filename.toLowerCase()
                      );
                      const task = downloadTasks.find(
                        (t) =>
                          t.filename?.toLowerCase() === file.filename.toLowerCase() ||
                          t.downloadUrl === file.downloadUrl
                      );
                      const isDownloading = task?.status === 'downloading' || !!hfDownloadingFiles[file.filename];
                      const isPaused = task?.status === 'paused';

                      let hardwareBadge = {
                        label: '100% GPU (~60-120 t/s)',
                        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
                      };
                      if (file.sizeGb > 5.5) {
                        hardwareBadge = {
                          label: 'CPU / RAM Heavy (~5-15 t/s)',
                          color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
                        };
                      } else if (file.sizeGb > 2.8) {
                        hardwareBadge = {
                          label: 'Hybrid CUDA+CPU (~20-40 t/s)',
                          color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
                        };
                      }

                      return (
                        <div
                          key={file.filename}
                          className="p-3.5 rounded-xl bg-[#161b22] border border-[#30363d] hover:border-gray-500 transition-all flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-bold text-xs text-white truncate">
                                {file.filename}
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold shrink-0">
                                {file.quantization}
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-gray-800 text-gray-300 border border-gray-700 font-semibold shrink-0">
                                {file.sizeGb} GB
                              </span>
                            </div>

                            <div className="flex items-center space-x-2 text-[10px]">
                              <span
                                className={`px-2 py-0.5 rounded-md border font-mono ${hardwareBadge.color}`}
                              >
                                {hardwareBadge.label}
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center space-x-1.5">
                            {isDownloaded ? (
                              <button
                                disabled
                                className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center space-x-1 cursor-default"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{currentLang === 'vi' ? 'Đã có trên máy' : 'Downloaded'}</span>
                              </button>
                            ) : task?.status === 'downloading' ? (
                              <div className="flex items-center space-x-1 bg-sky-500/15 border border-sky-500/30 px-2.5 py-1 rounded-lg">
                                <RefreshCw className="w-3 h-3 text-sky-400 animate-spin" />
                                <span className="text-[11px] font-mono text-sky-300 font-bold mr-1">
                                  {task.progressPercent}%
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => handlePauseDownload(task.modelId, e)}
                                  className="p-1 hover:bg-sky-500/20 rounded text-sky-300 transition-colors"
                                  title={currentLang === 'vi' ? 'Tạm dừng tải' : 'Pause download'}
                                >
                                  <Pause className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleCancelDownload(task.modelId, e)}
                                  className="p-1 hover:bg-rose-500/20 rounded text-rose-400 transition-colors"
                                  title={currentLang === 'vi' ? 'Hủy tải' : 'Cancel download'}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : isPaused && task ? (
                              <div className="flex items-center space-x-1 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-lg">
                                <Pause className="w-3 h-3 text-amber-400" />
                                <span className="text-[11px] font-mono text-amber-300 font-bold mr-1">
                                  {task.progressPercent}%
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => handleResumeDownload(task.modelId, e)}
                                  className="p-1 hover:bg-amber-500/20 rounded text-amber-300 transition-colors"
                                  title={currentLang === 'vi' ? 'Tiếp tục tải' : 'Resume download'}
                                >
                                  <Play className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleCancelDownload(task.modelId, e)}
                                  className="p-1 hover:bg-rose-500/20 rounded text-rose-400 transition-colors"
                                  title={currentLang === 'vi' ? 'Hủy tải' : 'Cancel download'}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : isDownloading ? (
                              <button
                                disabled
                                className="px-3 py-1.5 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/40 text-xs font-semibold flex items-center space-x-1.5 cursor-wait"
                              >
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>{currentLang === 'vi' ? 'Đang tải...' : 'Downloading...'}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleDownloadHfFile(selectedHfRepo, file)}
                                className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-all flex items-center space-x-1.5 shadow-md shadow-sky-500/20"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>{currentLang === 'vi' ? 'Tải ngay' : 'Download'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-white text-sm">
                {currentLang === 'vi' ? 'Khám phá mô hình từ Hugging Face Hub' : 'Explore Hugging Face Models'}
              </h3>
              <p className="text-gray-400 text-xs max-w-md">
                {currentLang === 'vi'
                  ? 'Chọn một mô hình từ danh sách kết quả tìm kiếm bên trái để xem thông số và tải về bản Quantization (.gguf) phù hợp với GPU của bạn.'
                  : 'Select a model from the left search results to inspect parameters and download the optimal GGUF quantization.'}
              </p>
            </div>
          )
        ) : selectedHubModel ? (
          (() => {
            const dynamicComp = computeModelCompatibility(selectedHubModel);
            const selectedTask = downloadTasks.find(
              (t) => t.modelId === selectedHubModel.id || t.filename === selectedHubModel.filename
            );
            const isDownloaded = localModels.some((f) => {
              const fl = f.toLowerCase();
              return (
                fl === selectedHubModel.filename.toLowerCase() ||
                fl === `${selectedHubModel.id.toLowerCase()}.gguf` ||
                fl.includes(selectedHubModel.id.toLowerCase())
              );
            });

            return (
              <div className="space-y-4 w-full animate-fade-in">
                {/* Top Header Card */}
                <div className="p-4 rounded-2xl bg-[#161b22] border border-[#30363d] space-y-3 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-bold text-base text-white">{selectedHubModel.name}</h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#21262d] text-gray-300 border border-[#30363d]">
                          {selectedHubModel.parameterSize}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/30">
                          {selectedHubModel.quantization}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                        {currentLang === 'vi' ? 'Tên tệp:' : 'Filename:'} {selectedHubModel.filename} •{' '}
                        {currentLang === 'vi' ? 'Tác giả:' : 'Author:'} {selectedHubModel.author}
                      </p>
                    </div>

                    <a
                      href={selectedHubModel.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1 text-[11px] text-sky-400 hover:text-sky-300 font-mono bg-sky-500/10 px-2.5 py-1 rounded-lg border border-sky-500/20"
                    >
                      <span>Hugging Face</span>
                      <ExternalLink className="w-3 h-3 ml-0.5" />
                    </a>
                  </div>

                  <p className="text-xs text-gray-300 leading-relaxed">
                    {selectedHubModel.description}
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedHubModel.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-md bg-[#21262d] text-[10px] text-gray-300 border border-[#30363d]"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Compatibility HUD (Calculated Dynamically from gpuLayers Slider) */}
                <div className="p-4 rounded-2xl bg-[#161b22] border border-[#30363d] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-200">
                      {currentLang === 'vi' ? 'Khả năng chạy trên GPU hiện tại' : 'Hardware Compatibility'}
                    </span>
                    <span
                      className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border font-semibold ${dynamicComp.badgeColor}`}
                    >
                      {dynamicComp.statusLabel}
                    </span>
                  </div>

                  <p className="text-xs text-gray-300 leading-relaxed">{dynamicComp.description}</p>

                  {/* Resource Breakdown Metrics */}
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono text-[11px]">
                    <div className="p-2 rounded-xl bg-[#0d1117] border border-[#30363d]">
                      <span className="text-gray-400 block text-[10px]">Ước tính VRAM</span>
                      <span className="text-white font-bold">~{dynamicComp.estimatedVramMb} MB</span>
                    </div>
                    <div className="p-2 rounded-xl bg-[#0d1117] border border-[#30363d]">
                      <span className="text-gray-400 block text-[10px]">Ước tính RAM</span>
                      <span className="text-white font-bold">~{dynamicComp.estimatedRamMb} MB</span>
                    </div>
                    <div className="p-2 rounded-xl bg-[#0d1117] border border-[#30363d]">
                      <span className="text-gray-400 block text-[10px]">Tốc độ dự kiến</span>
                      <span className="text-emerald-400 font-bold">{dynamicComp.estimatedSpeed}</span>
                    </div>
                  </div>

                  {/* Sufficiency Verdict Banner */}
                  <div
                    className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                      dynamicComp.isSufficient === false
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    }`}
                  >
                    <span className="font-semibold">
                      {dynamicComp.isSufficient === false
                        ? '⚠️ Cảnh báo: Tài nguyên hệ thống không đủ chạy mượt mà'
                        : '✓ Đủ tài nguyên: Hệ thống đáp ứng tốt mô hình này'}
                    </span>
                    <span className="text-[11px] font-mono">
                      {dynamicComp.ramStatus || 'Sẵn sàng nạp'}
                    </span>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={(e) => onOpenModelConfig(selectedHubModel, e)}
                    className="px-3 py-1.5 rounded-xl bg-[#21262d] hover:bg-[#30363d] text-gray-200 border border-[#30363d] text-xs font-semibold flex items-center space-x-1.5 transition-all"
                  >
                    <SettingsIcon className="w-3.5 h-3.5 text-sky-400" />
                    <span>{currentLang === 'vi' ? 'Tùy chỉnh Preset & Lấy mẫu' : 'Model Presets'}</span>
                  </button>

                  <div className="flex items-center space-x-2">
                    {isDownloaded ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onSetActiveModel(selectedHubModel)}
                          className="px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all"
                        >
                          <Zap className="w-3.5 h-3.5 fill-current" />
                          <span>{currentLang === 'vi' ? 'Đặt làm Model Hoạt động' : 'Set as Active'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => onDeleteModel(selectedHubModel, e)}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center space-x-1 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{currentLang === 'vi' ? 'Xóa khỏi máy' : 'Delete'}</span>
                        </button>
                      </>
                    ) : selectedTask?.status === 'downloading' ? (
                      <div className="flex items-center space-x-2 bg-sky-500/15 border border-sky-500/30 px-3 py-1.5 rounded-xl">
                        <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
                        <span className="text-xs font-mono font-bold text-sky-300">
                          {selectedTask.progressPercent}%
                        </span>
                        {selectedTask.speedMbps ? (
                          <span className="text-[11px] font-mono text-gray-400">
                            ({selectedTask.speedMbps} MB/s)
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={(e) => handlePauseDownload(selectedTask.modelId, e)}
                          className="px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 text-xs font-medium flex items-center space-x-1 transition-colors"
                          title={currentLang === 'vi' ? 'Tạm dừng tải' : 'Pause'}
                        >
                          <Pause className="w-3 h-3" />
                          <span>{currentLang === 'vi' ? 'Tạm dừng' : 'Pause'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleCancelDownload(selectedTask.modelId, e)}
                          className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-medium flex items-center space-x-1 transition-colors"
                          title={currentLang === 'vi' ? 'Hủy tải' : 'Cancel'}
                        >
                          <X className="w-3 h-3" />
                          <span>{currentLang === 'vi' ? 'Hủy' : 'Cancel'}</span>
                        </button>
                      </div>
                    ) : selectedTask?.status === 'paused' ? (
                      <div className="flex items-center space-x-2 bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 rounded-xl">
                        <Pause className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs font-mono font-bold text-amber-300">
                          {selectedTask.progressPercent}%
                        </span>
                        <span className="text-[11px] text-amber-300/80 font-mono">
                          {currentLang === 'vi' ? '(Đã dừng)' : '(Paused)'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleResumeDownload(selectedTask.modelId, e)}
                          className="px-2.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-medium flex items-center space-x-1 transition-colors"
                          title={currentLang === 'vi' ? 'Tiếp tục tải' : 'Resume'}
                        >
                          <Play className="w-3 h-3" />
                          <span>{currentLang === 'vi' ? 'Tiếp tục' : 'Resume'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleCancelDownload(selectedTask.modelId, e)}
                          className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-medium flex items-center space-x-1 transition-colors"
                          title={currentLang === 'vi' ? 'Hủy tải' : 'Cancel'}
                        >
                          <X className="w-3 h-3" />
                          <span>{currentLang === 'vi' ? 'Hủy' : 'Cancel'}</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onDownloadModel(selectedHubModel)}
                        className="px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-sky-500/20 transition-all"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{currentLang === 'vi' ? 'Tải về máy' : 'Download Model'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 font-mono text-xs">
            {currentLang === 'vi'
              ? 'Chọn một model từ danh sách bên trái để xem chi tiết và kiểm tra cấu hình'
              : 'Select a model from the left list to view details and inspect hardware fit'}
          </div>
        )}
      </div>

      {/* Model Glossary Modal */}
      <ModelGlossaryModal
        isOpen={isGlossaryOpen}
        onClose={() => setIsGlossaryOpen(false)}
        currentLang={currentLang}
      />
    </div>
  );
};
