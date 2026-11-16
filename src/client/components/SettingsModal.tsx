import React, { useState, useEffect } from 'react';
import type { LocalSkill, ProviderConfig, HardwareStats } from '../../types.js';
import type { AutoRouteConfig } from '../../auto-router.js';
import { type ModelHubItem, type ModelCompatibility, ModelHubService } from '../../model-hub.js';
import {
  X,
  ArrowLeft,
  Sparkles,
  Globe,
  Cpu,
  FolderPlus,
  RefreshCw,
  Check,
  Eye,
  EyeOff,
  Zap,
  Terminal,
  Compass,
  Sliders,
  ShieldCheck,
  BookOpen,
  Package,
  Download,
  Search,
  CheckCircle2,
  Image as ImageIcon,
  HardDrive,
  Palette,
  Keyboard,
  Trash2,
  ExternalLink,
  FolderOpen,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  skills: LocalSkill[];
  skillFolders: string[];
  providers: ProviderConfig[];
  hardwareStats: HardwareStats | null;
  autoRouteConfig: AutoRouteConfig;
  onUpdateAutoRouteConfig: (config: AutoRouteConfig) => void;
  onAddSkillFolder: (folderPath: string) => void;
  onSaveProvider: (provider: ProviderConfig) => void;
  onSyncProvider: (id: string) => Promise<any>;
}

interface EnrichedModelItem extends ModelHubItem {
  compatibility: ModelCompatibility;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  skills,
  skillFolders,
  providers,
  hardwareStats,
  autoRouteConfig,
  onUpdateAutoRouteConfig,
  onAddSkillFolder,
  onSaveProvider,
  onSyncProvider,
}) => {
  const [activeCategory, setActiveCategory] = useState<
    'autoroute' | 'models' | 'inference' | 'skills' | 'providers' | 'cuda' | 'storage' | 'appearance' | 'shortcuts' | 'rag' | 'about'
  >('autoroute');

  const [newSkillFolder, setNewSkillFolder] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState(providers[0]?.id || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ loading: boolean; text?: string }>({ loading: false });
  const [updateState, setUpdateState] = useState<{
    loading: boolean;
    result?: { currentVersion: string; latestVersion: string; hasUpdate: boolean; releaseNotes?: string };
  }>({ loading: false });

  // Sampling & Generation Parameters (LM Studio style)
  const [temperature, setTemperature] = useState(() => {
    return Number(localStorage.getItem('localai_temperature') || '0.7');
  });
  const [topP, setTopP] = useState(() => {
    return Number(localStorage.getItem('localai_topP') || '0.9');
  });
  const [maxTokens, setMaxTokens] = useState(() => {
    return Number(localStorage.getItem('localai_maxTokens') || '4096');
  });
  const [repeatPenalty, setRepeatPenalty] = useState(() => {
    return Number(localStorage.getItem('localai_repeatPenalty') || '1.1');
  });
  const [defaultSystemPrompt, setDefaultSystemPrompt] = useState(() => {
    return localStorage.getItem('localai_defaultSystemPrompt') || 'You are LocalAI, an expert software developer and local intelligence agent.';
  });
  const [paramSaved, setParamSaved] = useState(false);

  // Storage and Path management
  const [systemPaths, setSystemPaths] = useState<{
    current: string;
    home: string;
    desktop: string;
    documents: string;
    models: string;
  } | null>(null);
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);

  // Appearance & Glassy UI
  const [glassStyle, setGlassStyle] = useState<'ultra' | 'frosted' | 'solid'>(() => {
    return (localStorage.getItem('localai_glass_style') as any) || 'ultra';
  });
  const [uiFontSize, setUiFontSize] = useState<'compact' | 'default' | 'large'>(() => {
    return (localStorage.getItem('localai_font_size') as any) || 'default';
  });

  // Model Hub & Downloader state inside Settings
  const [hubModels, setHubModels] = useState<EnrichedModelItem[]>([]);
  const [modelSearch, setModelSearch] = useState('');
  const [modelCategoryFilter, setModelCategoryFilter] = useState<'all' | 'coding' | 'reasoning' | 'vision' | 'general'>('all');
  const [selectedHubModel, setSelectedHubModel] = useState<EnrichedModelItem | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Sliders for selected model (CUDA, Context, Threads, Flash Attention)
  const [gpuLayers, setGpuLayers] = useState(21);
  const [contextSize, setContextSize] = useState(4096);
  const [cpuThreads, setCpuThreads] = useState(4);
  const [flashAttention, setFlashAttention] = useState(true);
  const [tuneApplied, setTuneApplied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/models/hub')
      .then((res) => res.json())
      .then((data) => {
        const models: EnrichedModelItem[] = data.models || [];
        setHubModels(models);
        if (models.length > 0) {
          const initial = models[0];
          setSelectedHubModel(initial);
          setGpuLayers(initial.fileSizeBytes <= 2600000000 ? (initial.totalLayers || 28) : 21);
        }
      })
      .catch(() => {});

    fetch('/api/dialog/system-folders')
      .then((res) => res.json())
      .then((data) => setSystemPaths(data))
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectHubModel = (model: EnrichedModelItem) => {
    setSelectedHubModel(model);
    const recNgl = model.fileSizeBytes <= 2600000000
      ? (model.totalLayers || 28)
      : (model.compatibility?.recommendedNgl || 21);
    setGpuLayers(recNgl);
  };

  // Dynamic compatibility evaluation based on current slider gpuLayers
  const currentModelComp = selectedHubModel
    ? ModelHubService.evaluateCompatibility(
        selectedHubModel,
        hardwareStats?.vramTotalMb || 4096,
        hardwareStats?.vramFreeMb || 3600,
        gpuLayers
      )
    : null;

  const currentProvider = providers.find((p) => p.id === selectedProviderId) || providers[0];

  const handleSync = async () => {
    if (!currentProvider) return;
    setSyncStatus({ loading: true });
    try {
      const res = await onSyncProvider(currentProvider.id);
      if (res.success) {
        setSyncStatus({ loading: false, text: `Connected! ${res.models.length} models synced (${res.latencyMs}ms)` });
      } else {
        setSyncStatus({ loading: false, text: `Failed: ${res.error || 'Connection error'}` });
      }
    } catch (err: any) {
      setSyncStatus({ loading: false, text: `Error: ${err.message}` });
    }
  };

  const handleStartDownload = async (model: EnrichedModelItem) => {
    setDownloadingId(model.id);
    setDownloadProgress((prev) => ({ ...prev, [model.id]: 0 }));

    try {
      await fetch('/api/models/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: model.id,
          modelName: model.name,
          fileSizeBytes: model.fileSizeBytes,
        }),
      });

      // Poll progress
      const interval = setInterval(async () => {
        const res = await fetch('/api/models/downloads');
        const tasks: any[] = await res.json();
        const myTask = tasks.find((t) => t.modelId === model.id);
        if (myTask) {
          setDownloadProgress((prev) => ({ ...prev, [model.id]: myTask.progressPercent }));
          if (myTask.status === 'completed') {
            clearInterval(interval);
            setDownloadingId(null);
          }
        }
      }, 700);
    } catch {
      setDownloadingId(null);
    }
  };

  const handleApplyTuning = () => {
    const llamaProvider = providers.find((p) => p.type === 'llama-server') || currentProvider;
    if (llamaProvider && selectedHubModel) {
      const updated: ProviderConfig = {
        ...llamaProvider,
        selectedModel: selectedHubModel.filename,
        gpuLayers,
        contextSize,
        cpuThreads,
        flashAttention,
      };
      onSaveProvider(updated);
      setTuneApplied(true);
      setTimeout(() => setTuneApplied(false), 2500);
    }
  };

  const handleCheckUpdate = async () => {
    setUpdateState({ loading: true });
    try {
      const res = await fetch('/api/app/check-update');
      const data = await res.json();
      setUpdateState({ loading: false, result: data });
    } catch (err: any) {
      setUpdateState({
        loading: false,
        result: {
          currentVersion: '0.1.0',
          latestVersion: '0.1.0',
          hasUpdate: false,
          releaseNotes: 'Phiên bản hiện tại là mới nhất hoặc chưa cấu hình remote repository.',
        },
      });
    }
  };

  const handleSaveInferenceParams = () => {
    localStorage.setItem('localai_temperature', String(temperature));
    localStorage.setItem('localai_topP', String(topP));
    localStorage.setItem('localai_maxTokens', String(maxTokens));
    localStorage.setItem('localai_repeatPenalty', String(repeatPenalty));
    localStorage.setItem('localai_defaultSystemPrompt', defaultSystemPrompt);
    setParamSaved(true);
    setTimeout(() => setParamSaved(false), 2200);
  };

  const handleOpenFolder = async (folderPath: string) => {
    try {
      await fetch('/api/dialog/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folderPath }),
      });
    } catch (e) {
      console.error('Failed to open folder:', e);
    }
  };

  const handleClearCache = async () => {
    try {
      const res = await fetch('/api/app/clear-cache', { method: 'POST' });
      const data = await res.json();
      setCacheMessage(data.message || 'Cache & logs cleared successfully');
      setTimeout(() => setCacheMessage(null), 3000);
    } catch (e: any) {
      setCacheMessage('Error clearing cache');
      setTimeout(() => setCacheMessage(null), 3000);
    }
  };

  const navItems = [
    { id: 'autoroute', label: 'Auto Model Router', icon: <Compass className="w-4 h-4 text-sky-400" /> },
    { id: 'models', label: 'Model Hub & Library', icon: <Package className="w-4 h-4 text-amber-400" /> },
    { id: 'inference', label: 'Sampling & Inference', icon: <Sliders className="w-4 h-4 text-emerald-400" /> },
    { id: 'cuda', label: 'CUDA & VRAM Hardware', icon: <Cpu className="w-4 h-4 text-rose-400" /> },
    { id: 'skills', label: 'Local Skills & Tools', icon: <Sparkles className="w-4 h-4 text-purple-400" /> },
    { id: 'storage', label: 'Storage & System Paths', icon: <HardDrive className="w-4 h-4 text-teal-400" /> },
    { id: 'appearance', label: 'Appearance & Glassy UI', icon: <Palette className="w-4 h-4 text-pink-400" /> },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: <Keyboard className="w-4 h-4 text-yellow-400" /> },
    { id: 'providers', label: 'API Keys & Providers', icon: <Globe className="w-4 h-4 text-sky-400" /> },
    { id: 'rag', label: 'Offline RAG & Vectors', icon: <BookOpen className="w-4 h-4 text-indigo-400" /> },
    { id: 'about', label: 'About & Updates', icon: <Zap className="w-4 h-4 text-amber-400" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#0d1117] flex flex-col select-none animate-fade-in text-gray-200">
      {/* Top Application Bar with Back to Chat Button */}
      <div className="h-14 px-6 border-b border-white/10 bg-[#161b22]/95 backdrop-blur-md flex items-center justify-between shrink-0 shadow-sm z-30">
        <div className="flex items-center space-x-4">
          <button
            onClick={onClose}
            className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-xs font-semibold transition-all group shadow-sm"
            title="Quay lại cuộc trò chuyện (Esc)"
          >
            <ArrowLeft className="w-4 h-4 text-sky-400 group-hover:-translate-x-0.5 transition-transform" />
            <span className="font-bold">Back to Chat</span>
            <kbd className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-gray-400 border border-white/10 font-mono">
              Esc
            </kbd>
          </button>

          <div className="h-5 w-[1px] bg-white/10" />

          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-slate-950 font-black text-xs shadow-md shadow-sky-500/20">
              ⚡
            </div>
            <div>
              <span className="font-bold text-sm text-white">LocalAI Studio Settings & Model Management</span>
              <span className="text-[10px] text-gray-400 font-mono ml-2 hidden md:inline">GTX 1650 (CUDA) • llama.cpp Core</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs text-gray-400 font-mono">
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
            ● Embedded Local Inference Active
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Full-Size Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Categories Sidebar */}
        <div className="w-64 bg-black/35 border-r border-white/10 flex flex-col justify-between shrink-0 p-3">
          <div className="space-y-3">
            <div className="px-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Settings & Hardware
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveCategory(item.id as any)}
                  className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all ${
                    activeCategory === item.id
                      ? 'bg-sky-500/20 text-sky-300 shadow-sm border border-sky-500/30'
                      : 'text-gray-400 hover:bg-white/[0.05] hover:text-gray-200 border border-transparent'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-2 border-t border-white/10 text-[11px] text-gray-400 font-mono flex items-center justify-between">
            <span>LocalAI Desktop</span>
            <span className="text-sky-400">v0.1.0</span>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-black/15">
          {/* Category Top Banner */}
          <div className="px-6 py-3 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/20">
            <h2 className="text-sm font-bold text-white capitalize">
              {navItems.find((n) => n.id === activeCategory)?.label}
            </h2>
            <div className="text-[11px] text-gray-400 font-mono">
              Category: <span className="text-sky-400">{activeCategory}</span>
            </div>
          </div>

          {/* Conditional Layout: Master-Detail for models, Full-width for others */}
          {activeCategory === 'models' ? (
            <div className="flex-1 flex overflow-hidden h-full animate-fade-in">
              {/* 1. Left Sub-Column: Model List */}
              <div className="w-[390px] border-r border-white/10 flex flex-col h-full bg-black/25 shrink-0 p-4 space-y-3 overflow-hidden">
                {/* Search Input */}
                <div className="relative">
                  <input
                    type="text"
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    placeholder="Tìm kiếm GGUF model..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-black/50 border border-white/10 text-gray-200 text-xs focus:outline-none focus:border-sky-500"
                  />
                  <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>

                {/* Category Filter Chips */}
                <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-[11px]">
                  {[
                    { id: 'all', label: 'Tất cả' },
                    { id: 'coding', label: '💻 Coding' },
                    { id: 'reasoning', label: '🧠 Suy luận' },
                    { id: 'vision', label: '👁️ Vision' },
                    { id: 'general', label: '⚡ Đa nhiệm' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setModelCategoryFilter(cat.id as any)}
                      className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition-all ${
                        modelCategoryFilter === cat.id
                          ? 'bg-sky-500/25 text-sky-300 border border-sky-500/40 shadow-sm'
                          : 'bg-white/[0.04] text-gray-400 hover:text-white border border-white/5'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Model Cards List */}
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {hubModels
                    .filter((m) => {
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
                    })
                    .map((m) => {
                      const isCurSelected = selectedHubModel?.id === m.id;
                      // Dynamic compatibility tag
                      const comp = isCurSelected && currentModelComp
                        ? currentModelComp
                        : ModelHubService.evaluateCompatibility(m, 4096, 3600);

                      return (
                        <div
                          key={m.id}
                          onClick={() => handleSelectHubModel(m)}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                            isCurSelected
                              ? 'bg-sky-500/15 border-sky-500/50 shadow-md ring-1 ring-sky-500/30'
                              : 'bg-black/30 border-white/10 hover:bg-white/[0.04] hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-white truncate max-w-[210px]">
                              {m.name}
                            </span>
                            <span className="text-[10px] font-mono text-gray-400 shrink-0">
                              {(m.fileSizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB
                            </span>
                          </div>

                          <div className="flex items-center space-x-2 text-[10px] text-gray-400 font-mono mt-1">
                            <span className="text-sky-400 font-semibold">{m.author}</span>
                            <span>•</span>
                            <span>{m.parameterSize}</span>
                            <span>•</span>
                            <span>{m.quantization}</span>
                          </div>

                          {/* Dynamic Tag */}
                          <div className="mt-2 flex items-center justify-between">
                            <span
                              className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full border ${comp.badgeColor}`}
                            >
                              ● {comp.statusLabel}
                            </span>
                            {isCurSelected && (
                              <span className="text-[9px] font-mono text-sky-400 font-bold">
                                Selected ➔
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* 2. Right Sub-Column: Selected Model Inspector & CUDA Tuner */}
              <div className="flex-1 h-full overflow-y-auto p-6 space-y-4">
                {selectedHubModel ? (
                  <div className="space-y-4 max-w-3xl">
                    {/* Top Header Card */}
                    <div className="p-4 rounded-2xl glass-card border border-white/10 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-bold text-base text-white">{selectedHubModel.name}</h3>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/10 text-gray-300 border border-white/10">
                              {selectedHubModel.parameterSize}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/10 text-sky-300 border border-white/10">
                              {selectedHubModel.quantization}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                            Filename: {selectedHubModel.filename} • Author: {selectedHubModel.author}
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
                            className="px-2 py-0.5 rounded-md bg-white/[0.04] text-[10px] font-mono text-gray-400 border border-white/5"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Dynamic CUDA & Hardware Calculator */}
                    <div className="p-4 rounded-2xl glass-card border border-white/10 space-y-4">
                      <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <div className="flex items-center space-x-2">
                          <Cpu className="w-5 h-5 text-amber-400" />
                          <div>
                            <span className="font-bold text-sm text-white">NVIDIA CUDA & VRAM Live Calculator</span>
                            <p className="text-[11px] text-gray-400">Tự động tính toán phân bổ bộ nhớ GPU và CPU theo thời gian thực</p>
                          </div>
                        </div>

                        {/* Dynamic Badge (Auto-updates with slider) */}
                        {currentModelComp && (
                          <span
                            className={`text-xs font-mono font-bold px-3 py-1 rounded-full border shadow-sm ${currentModelComp.badgeColor}`}
                          >
                            ● {currentModelComp.statusLabel}
                          </span>
                        )}
                      </div>

                      {/* Real-time VRAM Usage Meter */}
                      {currentModelComp && (
                        <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-300 font-semibold">Ước tính tiêu thụ bộ nhớ đồ họa:</span>
                            <span className="font-mono text-white font-bold">
                              {currentModelComp.estimatedVramMb} MB / 4096 MB VRAM
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
                            <div
                              className={`h-full transition-all duration-300 ${
                                currentModelComp.estimatedVramMb > 4096
                                  ? 'bg-rose-500'
                                  : currentModelComp.estimatedVramMb > 3000
                                  ? 'bg-amber-400'
                                  : 'bg-emerald-400'
                              }`}
                              style={{
                                width: `${Math.min(100, Math.round((currentModelComp.estimatedVramMb / 4096) * 100))}%`,
                              }}
                            />
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono">
                            <span>Tốc độ dự kiến: <strong className="text-emerald-400">{currentModelComp.estimatedSpeed}</strong></span>
                            <span>RAM hệ thống cần: ~{currentModelComp.estimatedRamMb} MB</span>
                          </div>
                        </div>
                      )}

                      {/* Slider for GPU Offload Layers (-ngl) */}
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-gray-200">
                            Số Layer nạp vào GPU VRAM (-ngl):
                          </label>
                          <span className="font-mono text-xs font-bold text-sky-400 bg-sky-500/10 px-2.5 py-0.5 rounded-full border border-sky-500/25">
                            {gpuLayers} / {selectedHubModel.totalLayers || 32} Layers
                          </span>
                        </div>

                        <input
                          type="range"
                          min={0}
                          max={selectedHubModel.totalLayers || 32}
                          value={gpuLayers}
                          onChange={(e) => setGpuLayers(parseInt(e.target.value, 10))}
                          className="w-full accent-sky-400 h-2 bg-black/40 rounded-lg cursor-pointer"
                        />

                        <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                          <span>0 (Chạy 100% trên CPU)</span>
                          <span className="text-sky-400 font-semibold">Kéo thanh trượt tag sẽ tự cập nhật</span>
                          <span>{selectedHubModel.totalLayers || 32} (100% GPU)</span>
                        </div>
                      </div>

                      {/* Context Size & CPU Threads */}
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="space-y-1.5">
                          <span className="text-xs font-semibold text-gray-200">Ngữ cảnh Context Window (-c):</span>
                          <div className="grid grid-cols-3 gap-1.5">
                            {[2048, 4096, 8192].map((sz) => (
                              <button
                                key={sz}
                                type="button"
                                onClick={() => setContextSize(sz)}
                                className={`py-1.5 text-center font-mono text-xs rounded-lg border transition-all ${
                                  contextSize === sz
                                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 font-bold'
                                    : 'bg-black/30 text-gray-400 border-white/10 hover:text-white'
                                }`}
                              >
                                {sz}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-xs font-semibold text-gray-200">Số luồng CPU Threads (-t):</span>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[2, 4, 6, 8].map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setCpuThreads(t)}
                                className={`py-1.5 text-center font-mono text-xs rounded-lg border transition-all ${
                                  cpuThreads === t
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                                    : 'bg-black/30 text-gray-400 border-white/10 hover:text-white'
                                }`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Flash Attention Toggle */}
                      <div className="p-3 rounded-xl bg-black/30 border border-white/10 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-white block">Flash Attention (-fa)</span>
                          <p className="text-[10px] text-gray-400">Tiết kiệm ~30% VRAM khi tạo văn bản dài.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={flashAttention}
                            onChange={(e) => setFlashAttention(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-10 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>
                    </div>

                    {/* Action Buttons Bar */}
                    <div className="p-4 rounded-2xl glass-card border border-white/10 flex items-center justify-between">
                      {/* Download button */}
                      <div className="flex items-center space-x-2">
                        {downloadProgress[selectedHubModel.id] === 100 ? (
                          <div className="px-3.5 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center space-x-1.5 border border-emerald-500/30">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Đã tải về máy</span>
                          </div>
                        ) : downloadingId === selectedHubModel.id ? (
                          <div className="px-3.5 py-2 rounded-xl bg-sky-500/20 text-sky-300 font-mono text-xs flex items-center space-x-2 border border-sky-500/30">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Đang tải: {downloadProgress[selectedHubModel.id] || 0}%</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartDownload(selectedHubModel)}
                            className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-white font-semibold text-xs transition-all flex items-center space-x-1.5 border border-white/10 shadow-sm"
                          >
                            <Download className="w-3.5 h-3.5 text-sky-400" />
                            <span>Tải Model GGUF ({((selectedHubModel.fileSizeBytes) / (1024 * 1024 * 1024)).toFixed(1)} GB)</span>
                          </button>
                        )}
                      </div>

                      {/* Apply & Set as Active Model */}
                      <div className="flex items-center space-x-3">
                        {tuneApplied && (
                          <span className="text-xs text-emerald-400 font-semibold font-mono flex items-center space-x-1 animate-fade-in">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>Đã áp dụng!</span>
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={handleApplyTuning}
                          className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-sky-500 hover:from-amber-400 hover:to-sky-400 text-slate-950 font-bold text-xs shadow-lg shadow-sky-500/20 transition-all flex items-center space-x-1.5"
                        >
                          <Zap className="w-3.5 h-3.5 fill-current" />
                          <span>Áp dụng thông số & Đặt làm Model Hoạt động</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500 font-mono text-xs">
                    Chọn một model từ danh sách bên trái để xem chi tiết và cấu hình phần cứng
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-gray-300">
            {/* 1. AUTO MODEL ROUTER */}
            {activeCategory === 'autoroute' && (
              <div className="space-y-4 animate-fade-in">
                {/* Master Toggle */}
                <div className="p-4 rounded-xl glass-card flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span className="font-bold text-sm text-white">Smart Auto-Model Routing & Vision</span>
                    </div>
                    <p className="text-[11px] text-gray-400 max-w-md">
                      Auto-detect prompt intent (Fast chat, Code, Deep reasoning, Vision/Image analysis) and automatically dispatch to the best model.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoRouteConfig.enabled}
                      onChange={(e) =>
                        onUpdateAutoRouteConfig({ ...autoRouteConfig, enabled: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                  </label>
                </div>

                {/* Model Role Assignments (Searchable & Selectable from list or custom) */}
                <div className="space-y-2.5">
                  <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Role Assignments (Select or Type Custom Model Name)
                  </div>

                  {/* General */}
                  <SearchableModelPicker
                    label="⚡ Fast Conversational Model (3B)"
                    badge="~50 t/s"
                    badgeColor="text-emerald-400"
                    desc="Handles general queries, format conversion, translations."
                    value={autoRouteConfig.generalModel}
                    onChange={(val) => onUpdateAutoRouteConfig({ ...autoRouteConfig, generalModel: val })}
                  />

                  {/* Coder */}
                  <SearchableModelPicker
                    label="💻 Specialized Coding Model"
                    badge="AST Optimized"
                    badgeColor="text-purple-400"
                    desc="Selected when code, functions, bugs or refactoring are detected."
                    value={autoRouteConfig.coderModel}
                    onChange={(val) => onUpdateAutoRouteConfig({ ...autoRouteConfig, coderModel: val })}
                  />

                  {/* Reasoner */}
                  <SearchableModelPicker
                    label="🧠 Deep Reasoning Model (Thinking Active)"
                    badge="<think> Active"
                    badgeColor="text-amber-400"
                    desc="Dispatched for math, algorithms, step-by-step logic."
                    value={autoRouteConfig.reasonerModel}
                    onChange={(val) => onUpdateAutoRouteConfig({ ...autoRouteConfig, reasonerModel: val })}
                  />

                  {/* Vision Multimodal */}
                  <SearchableModelPicker
                    label="👁️ Vision & Multimodal Model"
                    badge="Image Analysis"
                    badgeColor="text-sky-400"
                    desc="Automatically triggers when you attach or ask about images, screenshots or charts."
                    value={autoRouteConfig.visionModel}
                    onChange={(val) => onUpdateAutoRouteConfig({ ...autoRouteConfig, visionModel: val })}
                  />
                </div>
              </div>
            )}

            {/* 3. LOCAL SKILLS */}
            {activeCategory === 'skills' && (
              <div className="space-y-4 animate-fade-in">
                <div className="p-3.5 rounded-xl glass-card space-y-2">
                  <label className="font-semibold text-xs text-white block">
                    Global Skills Auto-Discovery:
                  </label>
                  <p className="text-[11px] text-gray-400">
                    The app automatically scans your PC's global plugin & skill directories (<span className="text-sky-400 font-mono">~/.gemini/skills</span>, <span className="text-sky-400 font-mono">~/.config/skills</span>).
                  </p>
                  <div className="flex space-x-2 pt-1">
                    <input
                      type="text"
                      value={newSkillFolder}
                      onChange={(e) => setNewSkillFolder(e.target.value)}
                      placeholder="Add custom folder on PC..."
                      className="flex-1 px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-gray-200 font-mono text-xs focus:outline-none focus:border-sky-500"
                    />
                    <button
                      onClick={() => {
                        if (newSkillFolder.trim()) {
                          onAddSkillFolder(newSkillFolder.trim());
                          setNewSkillFolder('');
                        }
                      }}
                      className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-colors flex items-center space-x-1 shadow-md shadow-sky-500/20"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

                {/* Discovered Skills List */}
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Discovered Skills ({skills.length})
                  </div>
                  {skills.map((skill) => (
                    <div
                      key={skill.id}
                      className="p-3.5 rounded-xl glass-card flex items-center justify-between space-x-4 border border-white/10"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white text-xs">{skill.name}</span>
                          <span className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-mono">
                            {skill.triggers.join(', ')}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400">{skill.description}</p>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                        Active
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. PROVIDERS & KEYS */}
            {activeCategory === 'providers' && currentProvider && (
              <div className="space-y-4 animate-fade-in">
                <div className="grid grid-cols-3 gap-2">
                  {providers.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProviderId(p.id)}
                      className={`p-3 rounded-xl border text-left transition-colors ${
                        selectedProviderId === p.id
                          ? 'border-sky-500 bg-sky-500/10 text-sky-400 shadow-sm'
                          : 'border-white/10 bg-black/30 text-gray-300 hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="font-bold text-xs">{p.name}</div>
                      <div className="text-[10px] text-gray-500 font-mono mt-0.5">{p.type}</div>
                    </button>
                  ))}
                </div>

                <div className="p-4 rounded-xl glass-card border border-white/10 space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Base URL Endpoint:</label>
                    <input
                      type="text"
                      value={currentProvider.baseUrl}
                      onChange={(e) => onSaveProvider({ ...currentProvider, baseUrl: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-gray-200 font-mono text-xs focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  {currentProvider.type !== 'llama-server' && (
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-gray-400">API Key:</label>
                      <div className="relative">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={currentProvider.apiKey || ''}
                          onChange={(e) => onSaveProvider({ ...currentProvider, apiKey: e.target.value })}
                          placeholder="sk-••••••••••••••••••••"
                          className="w-full px-3 py-1.5 pr-8 rounded-lg bg-black/40 border border-white/10 text-gray-200 font-mono text-xs focus:outline-none focus:border-sky-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Default Model:</label>
                    <select
                      value={currentProvider.selectedModel}
                      onChange={(e) => onSaveProvider({ ...currentProvider, selectedModel: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-gray-200 font-mono text-xs focus:outline-none focus:border-sky-500"
                    >
                      {currentProvider.models.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-white/10">
                    <button
                      onClick={handleSync}
                      disabled={syncStatus.loading}
                      className="px-3.5 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-sky-400 border border-white/10 font-semibold text-xs transition-colors flex items-center space-x-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.loading ? 'animate-spin' : ''}`} />
                      <span>Test & Sync Models</span>
                    </button>
                    {syncStatus.text && (
                      <span className="text-[11px] text-gray-300 font-mono">{syncStatus.text}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 5. CUDA HARDWARE */}
            {activeCategory === 'cuda' && (
              <div className="space-y-4 animate-fade-in">
                <div className="p-4 rounded-xl glass-card border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Cpu className="w-5 h-5 text-amber-400" />
                      <span className="font-bold text-sm text-white">
                        {hardwareStats?.gpuName || 'NVIDIA GeForce GTX 1650'}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      CUDA 12.x Ready
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="p-3 rounded-lg bg-black/40 border border-white/10">
                      <span className="text-gray-400 text-[11px]">VRAM Total:</span>
                      <div className="text-base font-bold text-white font-mono mt-0.5">
                        {hardwareStats ? `${hardwareStats.vramTotalMb} MB` : '4096 MB'}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-black/40 border border-white/10">
                      <span className="text-gray-400 text-[11px]">VRAM Free:</span>
                      <div className="text-base font-bold text-sky-400 font-mono mt-0.5">
                        {hardwareStats ? `${hardwareStats.vramFreeMb} MB` : '3600 MB'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl glass-card border border-white/10 space-y-2">
                  <span className="font-bold text-xs text-white">GTX 1650 Hybrid Offload Policy:</span>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Auto-Tuner detects 4096 MB VRAM with 1000 MB reserved for Windows OS Display. For an 8B model (32 layers), exactly <span className="text-sky-400 font-semibold">21 layers</span> go to CUDA GPU, and the remaining 11 layers run on CPU+RAM with Flash Attention.
                  </p>
                </div>
              </div>
            )}

            {/* 3. SAMPLING & INFERENCE PARAMETERS (LM Studio style) */}
            {activeCategory === 'inference' && (
              <div className="space-y-4 animate-fade-in">
                <div className="p-4 rounded-xl glass-card border border-white/10 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center space-x-2">
                      <Sliders className="w-4 h-4 text-emerald-400" />
                      <div>
                        <span className="font-bold text-sm text-white">Default Sampling Parameters</span>
                        <p className="text-[11px] text-gray-400">Tùy biến độ sáng tạo, độ dài câu trả lời và tần suất lặp từ</p>
                      </div>
                    </div>
                    {paramSaved && (
                      <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30 flex items-center space-x-1">
                        <Check className="w-3 h-3" />
                        <span>Saved!</span>
                      </span>
                    )}
                  </div>

                  {/* Temperature */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-gray-200">Temperature (Độ ngẫu nhiên):</span>
                      <span className="font-mono text-emerald-400 font-bold bg-black/40 px-2 py-0.5 rounded border border-white/10">
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
                      <span>0.0 (Code & Toán chính xác)</span>
                      <span>0.7 (Cân bằng mặc định)</span>
                      <span>1.5 (Sáng tạo văn thơ)</span>
                    </div>
                  </div>

                  {/* Top-P */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-gray-200">Top-P (Nucleus Sampling):</span>
                      <span className="font-mono text-emerald-400 font-bold bg-black/40 px-2 py-0.5 rounded border border-white/10">
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
                      <span>0.1 (Tập trung token xác suất cao)</span>
                      <span>0.9 (Tiêu chuẩn khuyến nghị)</span>
                      <span>1.0 (Không lọc)</span>
                    </div>
                  </div>

                  {/* Max Output Tokens */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-gray-200">Max Generation Tokens (Độ dài output tối đa):</span>
                      <span className="font-mono text-emerald-400 font-bold bg-black/40 px-2 py-0.5 rounded border border-white/10">
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
                              : 'bg-black/30 text-gray-400 border-white/10 hover:bg-white/[0.05]'
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
                      <span className="font-mono text-emerald-400 font-bold bg-black/40 px-2 py-0.5 rounded border border-white/10">
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

                  {/* System Prompt Preset */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-xs text-gray-200">Default Global System Prompt:</span>
                      <div className="flex space-x-1.5 text-[10px]">
                        <button
                          type="button"
                          onClick={() =>
                            setDefaultSystemPrompt(
                              'You are LocalAI, an expert senior software engineer and architect.'
                            )
                          }
                          className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-sky-400 border border-white/10"
                        >
                          💻 Senior Coder
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDefaultSystemPrompt(
                              'You are LocalAI, a concise, highly factual AI assistant.'
                            )
                          }
                          className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-emerald-400 border border-white/10"
                        >
                          ⚡ Concise
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={3}
                      value={defaultSystemPrompt}
                      onChange={(e) => setDefaultSystemPrompt(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-black/40 border border-white/10 text-gray-200 text-xs focus:outline-none focus:border-emerald-500 font-sans"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveInferenceParams}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center space-x-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Inference Defaults</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STORAGE & SYSTEM PATHS */}
            {activeCategory === 'storage' && (
              <div className="space-y-4 animate-fade-in">
                <div className="p-4 rounded-xl glass-card border border-white/10 space-y-4">
                  <div className="flex items-center space-x-2 border-b border-white/10 pb-3">
                    <HardDrive className="w-4 h-4 text-teal-400" />
                    <div>
                      <span className="font-bold text-sm text-white">Storage & System Directories</span>
                      <p className="text-[11px] text-gray-400">Quản lý thư mục chứa GGUF models, workspace data và bộ nhớ tạm</p>
                    </div>
                  </div>

                  {/* GGUF Models Path */}
                  <div className="p-3 rounded-xl bg-black/30 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white">📁 GGUF Models Folder:</span>
                      <button
                        type="button"
                        onClick={() => handleOpenFolder(systemPaths?.models || '')}
                        className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 text-[11px] font-semibold transition-all"
                      >
                        <FolderOpen className="w-3 h-3" />
                        <span>Open in Explorer</span>
                      </button>
                    </div>
                    <div className="p-2 rounded-lg bg-black/50 border border-white/5 font-mono text-[11px] text-gray-300 break-all select-all">
                      {systemPaths?.models || 'c:\\Tam\\Code\\LocalAI\\models'}
                    </div>
                    <p className="text-[10px] text-gray-500">
                      Tất cả file .gguf tải về hoặc copy thủ công vào thư mục này sẽ tự động xuất hiện trong Model Hub.
                    </p>
                  </div>

                  {/* Current Workspace Path */}
                  <div className="p-3 rounded-xl bg-black/30 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white">💻 Active Workspace Root:</span>
                      <button
                        type="button"
                        onClick={() => handleOpenFolder(systemPaths?.current || '')}
                        className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-[11px] font-semibold transition-all"
                      >
                        <FolderOpen className="w-3 h-3" />
                        <span>Open in Explorer</span>
                      </button>
                    </div>
                    <div className="p-2 rounded-lg bg-black/50 border border-white/5 font-mono text-[11px] text-gray-300 break-all select-all">
                      {systemPaths?.current || 'c:\\Tam\\Code\\LocalAI'}
                    </div>
                  </div>

                  {/* Cache Cleanup */}
                  <div className="p-3 rounded-xl bg-black/30 border border-white/10 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-white">🧹 App Temporary Cache & Logs</span>
                      <p className="text-[10px] text-gray-500 mt-0.5">Xóa session cache và log tạm thời để giải phóng dung lượng</p>
                      {cacheMessage && (
                        <p className="text-[11px] text-emerald-400 font-mono mt-1">{cacheMessage}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleClearCache}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear Cache</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* APPEARANCE & GLASSY UI */}
            {activeCategory === 'appearance' && (
              <div className="space-y-4 animate-fade-in">
                <div className="p-4 rounded-xl glass-card border border-white/10 space-y-4">
                  <div className="flex items-center space-x-2 border-b border-white/10 pb-3">
                    <Palette className="w-4 h-4 text-pink-400" />
                    <div>
                      <span className="font-bold text-sm text-white">Appearance & Glassy UI Theme</span>
                      <p className="text-[11px] text-gray-400">Tùy biến hiệu ứng mờ kính Frosted Glass, kích thước font và giao diện</p>
                    </div>
                  </div>

                  {/* Glassmorphism Presets */}
                  <div className="space-y-2">
                    <span className="font-semibold text-xs text-gray-200">Glassmorphism Intensity:</span>
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { id: 'ultra', label: '🔮 Ultra Glassy', desc: 'Blur 24px, hiệu ứng kính mờ tối đa sang trọng' },
                        { id: 'frosted', label: '💎 Balanced Glass', desc: 'Blur 12px, cân bằng hiệu năng và thẩm mỹ' },
                        { id: 'solid', label: '⬛ Solid Dark', desc: 'Không mờ, nền tối đặc tương phản cao' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setGlassStyle(item.id as any);
                            localStorage.setItem('localai_glass_style', item.id);
                          }}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            glassStyle === item.id
                              ? 'bg-pink-500/15 border-pink-500/50 text-white shadow-md'
                              : 'bg-black/30 border-white/10 text-gray-400 hover:bg-white/[0.04]'
                          }`}
                        >
                          <div className="font-bold text-xs">{item.label}</div>
                          <div className="text-[10px] text-gray-400 mt-1">{item.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* UI Font Scaling */}
                  <div className="space-y-2 pt-2">
                    <span className="font-semibold text-xs text-gray-200">Interface Font Scaling:</span>
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { id: 'compact', label: 'Compact (12px)', desc: 'Tối ưu không gian hiển thị nhiều code' },
                        { id: 'default', label: 'Default (13px)', desc: 'Cỡ chữ chuẩn hài hòa dễ đọc' },
                        { id: 'large', label: 'Large (14px)', desc: 'Cỡ chữ lớn thoáng mắt' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setUiFontSize(item.id as any);
                            localStorage.setItem('localai_font_size', item.id);
                          }}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            uiFontSize === item.id
                              ? 'bg-pink-500/15 border-pink-500/50 text-white shadow-md'
                              : 'bg-black/30 border-white/10 text-gray-400 hover:bg-white/[0.04]'
                          }`}
                        >
                          <div className="font-bold text-xs">{item.label}</div>
                          <div className="text-[10px] text-gray-400 mt-1">{item.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* KEYBOARD SHORTCUTS */}
            {activeCategory === 'shortcuts' && (
              <div className="space-y-4 animate-fade-in">
                <div className="p-4 rounded-xl glass-card border border-white/10 space-y-4">
                  <div className="flex items-center space-x-2 border-b border-white/10 pb-3">
                    <Keyboard className="w-4 h-4 text-yellow-400" />
                    <div>
                      <span className="font-bold text-sm text-white">Keyboard Shortcuts Cheat Sheet</span>
                      <p className="text-[11px] text-gray-400">Các phím tắt nhanh giúp thao tác năng suất như Cursor và VS Code</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        Chat & Commands
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-white/5">
                          <span className="text-xs text-gray-300">Gửi tin nhắn</span>
                          <kbd className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-[10px] border border-white/20">
                            Enter
                          </kbd>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-white/5">
                          <span className="text-xs text-gray-300">Xuống dòng mới</span>
                          <kbd className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-[10px] border border-white/20">
                            Shift + Enter
                          </kbd>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-white/5">
                          <span className="text-xs text-gray-300">Tạo cuộc trò chuyện mới</span>
                          <kbd className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-[10px] border border-white/20">
                            Ctrl + N
                          </kbd>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-white/5">
                          <span className="text-xs text-gray-300">Đóng modal / Dừng stream</span>
                          <kbd className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-[10px] border border-white/20">
                            Esc
                          </kbd>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        Tools & Workspace
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-white/5">
                          <span className="text-xs text-gray-300">Bật/tắt Workspace Tools Panel</span>
                          <kbd className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-[10px] border border-white/20">
                            Ctrl + B
                          </kbd>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-white/5">
                          <span className="text-xs text-gray-300">Mở danh sách Local Skills</span>
                          <kbd className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-[10px] border border-white/20">
                            / (Slash)
                          </kbd>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-white/5">
                          <span className="text-xs text-gray-300">Tham chiếu file dự án (@mention)</span>
                          <kbd className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-[10px] border border-white/20">
                            @ (At)
                          </kbd>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-white/5">
                          <span className="text-xs text-gray-300">Mở cài đặt Studio</span>
                          <kbd className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-[10px] border border-white/20">
                            Ctrl + ,
                          </kbd>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 6. RAG */}
            {activeCategory === 'rag' && (
              <div className="space-y-4 animate-fade-in">
                <div className="p-4 rounded-xl glass-card border border-sky-500/30 space-y-3">
                  <div className="flex items-center space-x-2">
                    <BookOpen className="w-5 h-5 text-sky-400" />
                    <span className="font-bold text-sm text-white">What is Offline RAG?</span>
                  </div>
                  <p className="text-[12px] text-gray-300 leading-relaxed">
                    <strong>RAG (Retrieval-Augmented Generation)</strong> is an "open-book exam" for local AI. Instead of training or fine-tuning, the app chunks your files, embeds them with a local model, and retrieves the most relevant snippets to inject into the prompt.
                  </p>
                </div>
              </div>
            )}

            {/* 7. About & App Updates */}
            {activeCategory === 'about' && (
              <div className="space-y-4 animate-fade-in">
                <div className="p-5 rounded-2xl glass-card border border-white/10 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-slate-950 font-black text-lg shadow-md">
                        ⚡
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-white">LocalAI Desktop Studio</h3>
                        <p className="text-xs text-gray-400 font-mono">v0.1.0 • Embedded llama.cpp & CUDA Engine</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono font-semibold">
                      Production Ready
                    </span>
                  </div>

                  <p className="text-xs text-gray-300 leading-relaxed">
                    LocalAI là nền tảng máy trạm AI cục bộ độc lập, tích hợp bộ tăng tốc phần cứng thông minh cho GPU 4GB VRAM (GTX 1650), tự động định tuyến mô hình đa nhiệm (Coder, Reasoner, Vision, Cloud) và hệ thống Local Skills.
                  </p>

                  <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-gray-200">Kiểm tra bản cập nhật mới</span>
                      <p className="text-[11px] text-gray-400">
                        {updateState.result?.releaseNotes || 'Kiểm tra phiên bản mới từ GitHub Releases'}
                      </p>
                    </div>
                    <button
                      onClick={handleCheckUpdate}
                      disabled={updateState.loading}
                      className="px-3.5 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-semibold transition-all disabled:opacity-50 flex items-center space-x-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${updateState.loading ? 'animate-spin' : ''}`} />
                      <span>{updateState.loading ? 'Đang kiểm tra...' : 'Check for Updates'}</span>
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-2 text-xs text-gray-400">
                  <div className="flex justify-between font-mono text-[11px]">
                    <span>Runtime Core:</span>
                    <span className="text-gray-300">Node.js + Hono (Desktop API)</span>
                  </div>
                  <div className="flex justify-between font-mono text-[11px]">
                    <span>Inference Backend:</span>
                    <span className="text-amber-400">llama.cpp CUDA 12/13 (-ngl 21)</span>
                  </div>
                  <div className="flex justify-between font-mono text-[11px]">
                    <span>Desktop App Path:</span>
                    <span className="text-sky-400">Tauri 2.0 (Rust) Native Wrapper</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}

          {/* Bottom Actions Bar */}
          <div className="px-6 py-3 border-t border-white/10 bg-black/40 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-lg shadow-sky-500/20 transition-colors"
            >
              Done & Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Searchable & Typable Model Picker Component
const SearchableModelPicker: React.FC<{
  label: string;
  badge: string;
  badgeColor: string;
  desc: string;
  value: string;
  onChange: (val: string) => void;
}> = ({ label, badge, badgeColor, desc, value, onChange }) => {
  const commonOptions = [
    'Qwen2.5-3B-Instruct-Q4_K_M.gguf',
    'Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf',
    'DeepSeek-R1-Distill-Qwen-8B-Q4_K_M.gguf',
    'Qwen2-VL-7B-Instruct-Q4_K_M.gguf',
    'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    'llama-3.3-70b-instruct',
    'deepseek-v3',
  ];

  return (
    <div className="p-3 rounded-xl glass-card space-y-2 border border-white/10">
      <div className="flex items-center justify-between">
        <span className="font-bold text-xs text-white">{label}</span>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.05] ${badgeColor}`}>
          {badge}
        </span>
      </div>
      <p className="text-[11px] text-gray-400">{desc}</p>
      <div className="flex space-x-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type or pick model..."
          className="flex-1 px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-gray-200 font-mono text-xs focus:outline-none focus:border-sky-500"
        />
        <select
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value);
          }}
          className="px-2 py-1.5 rounded-lg bg-black/40 border border-white/10 text-gray-300 font-mono text-xs focus:outline-none"
        >
          <option value="">Pick from list ▼</option>
          {commonOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
