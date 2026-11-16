import React, { useState, useEffect } from 'react';
import type { LocalSkill, ProviderConfig, HardwareStats } from '../../types.js';
import type { AutoRouteConfig } from '../../auto-router.js';
import type { ModelHubItem, ModelCompatibility } from '../../model-hub.js';
import {
  X,
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
    'autoroute' | 'models' | 'skills' | 'providers' | 'cuda' | 'rag' | 'about'
  >('autoroute');

  const [newSkillFolder, setNewSkillFolder] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState(providers[0]?.id || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ loading: boolean; text?: string }>({ loading: false });
  const [updateState, setUpdateState] = useState<{
    loading: boolean;
    result?: { currentVersion: string; latestVersion: string; hasUpdate: boolean; releaseNotes?: string };
  }>({ loading: false });

  // Model Hub & Downloader state inside Settings
  const [hubModels, setHubModels] = useState<EnrichedModelItem[]>([]);
  const [modelSearch, setModelSearch] = useState('');
  const [modelHubSubTab, setModelHubSubTab] = useState<'catalog' | 'tuner'>('catalog');
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
        setHubModels(data.models || []);
        if (data.models?.length > 0) {
          setSelectedHubModel(data.models[0]);
          setGpuLayers(data.models[0].compatibility.recommendedNgl || 21);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

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

  const navItems = [
    { id: 'autoroute', label: 'Auto Model Router', icon: <Compass className="w-4 h-4 text-sky-400" /> },
    { id: 'models', label: 'Model Hub & Library', icon: <Package className="w-4 h-4 text-amber-400" /> },
    { id: 'skills', label: 'Local Skills & Tools', icon: <Sparkles className="w-4 h-4 text-purple-400" /> },
    { id: 'providers', label: 'API Keys & Providers', icon: <Globe className="w-4 h-4 text-emerald-400" /> },
    { id: 'cuda', label: 'CUDA & VRAM Hardware', icon: <Cpu className="w-4 h-4 text-rose-400" /> },
    { id: 'rag', label: 'Offline RAG & Vectors', icon: <BookOpen className="w-4 h-4 text-indigo-400" /> },
    { id: 'about', label: 'About & Updates', icon: <Zap className="w-4 h-4 text-amber-400" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in select-none">
      <div className="w-full max-w-4xl h-[670px] glass-panel border border-white/10 rounded-2xl shadow-2xl flex overflow-hidden">
        {/* Left Column: Categories Navigation */}
        <div className="w-60 bg-black/30 border-r border-white/10 flex flex-col justify-between shrink-0 p-3">
          <div className="space-y-4">
            <div className="px-2 pt-1 flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center text-slate-950 font-bold text-xs shadow-md">
                ⚙️
              </div>
              <span className="font-bold text-sm text-white">Studio Settings</span>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveCategory(item.id as any)}
                  className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all ${
                    activeCategory === item.id
                      ? 'bg-white/10 text-white shadow-sm border border-white/10'
                      : 'text-gray-400 hover:bg-white/[0.05] hover:text-gray-200'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-2 border-t border-white/10 text-[11px] text-gray-400 font-mono">
            LocalAI Core • GTX 1650
          </div>
        </div>

        {/* Right Column: Settings Content Panels */}
        <div className="flex-1 flex flex-col justify-between bg-black/20 overflow-hidden">
          {/* Top Bar with Close */}
          <div className="px-6 py-3.5 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white capitalize">
              {navItems.find((n) => n.id === activeCategory)?.label}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Panel Content Area */}
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

            {/* 2. MODEL HUB & GGUF TUNER (LM Studio style inside settings) */}
            {activeCategory === 'models' && (
              <div className="space-y-4 animate-fade-in">
                {/* Sub-tab Switcher: Catalog vs CUDA Tuner */}
                <div className="flex items-center space-x-2 border-b border-white/10 pb-2">
                  <button
                    type="button"
                    onClick={() => setModelHubSubTab('catalog')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      modelHubSubTab === 'catalog'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                        : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>Model Catalog & Downloads</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModelHubSubTab('tuner')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      modelHubSubTab === 'tuner'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                        : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>GGUF & CUDA Parameter Tuner</span>
                  </button>
                </div>

                {/* VIEW 1: CATALOG & DOWNLOADS */}
                {modelHubSubTab === 'catalog' && (
                  <div className="space-y-3">
                    {/* Search */}
                    <div className="relative">
                      <input
                        type="text"
                        value={modelSearch}
                        onChange={(e) => setModelSearch(e.target.value)}
                        placeholder="Search Hugging Face GGUF models..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-gray-200 text-xs focus:outline-none focus:border-sky-500"
                      />
                      <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    </div>

                    <div className="grid grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                      {hubModels
                        .filter((m) => m.name.toLowerCase().includes(modelSearch.toLowerCase()))
                        .map((m) => {
                          const isDownloading = downloadingId === m.id;
                          const progress = downloadProgress[m.id] || 0;
                          const isComplete = progress === 100;

                          return (
                            <div
                              key={m.id}
                              className="p-3.5 rounded-xl glass-card flex flex-col justify-between space-y-2.5 border border-white/10 hover:border-white/20 transition-all"
                            >
                              <div>
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs text-white">{m.name}</span>
                                  <span className="text-[10px] font-mono font-semibold text-gray-400">
                                    {(m.fileSizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB
                                  </span>
                                </div>
                                <p className="text-[11px] text-gray-400 line-clamp-2 mt-1">{m.description}</p>
                              </div>

                              <div className="space-y-2">
                                <span
                                  className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full border ${m.compatibility.badgeColor}`}
                                >
                                  ● {m.compatibility.statusLabel}
                                </span>

                                <div className="flex items-center space-x-1.5">
                                  {/* Download Action */}
                                  {isComplete ? (
                                    <div className="flex-1 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-center font-bold text-[10px] flex items-center justify-center space-x-1 border border-emerald-500/30">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>Downloaded</span>
                                    </div>
                                  ) : isDownloading ? (
                                    <div className="flex-1 space-y-1">
                                      <div className="flex justify-between text-[10px] font-mono text-sky-400">
                                        <span>Downloading...</span>
                                        <span>{progress}%</span>
                                      </div>
                                      <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-sky-400 transition-all duration-300"
                                          style={{ width: `${progress}%` }}
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleStartDownload(m)}
                                      className="flex-1 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-white font-semibold text-[11px] transition-colors flex items-center justify-center space-x-1 border border-white/10"
                                    >
                                      <Download className="w-3 h-3 text-sky-400" />
                                      <span>Tải GGUF</span>
                                    </button>
                                  )}

                                  {/* Tune Parameters Button */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedHubModel(m);
                                      setGpuLayers(m.compatibility.recommendedNgl || 21);
                                      setModelHubSubTab('tuner');
                                    }}
                                    title="Tùy chỉnh thông số CUDA, Context và Threads cho model này"
                                    className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors"
                                  >
                                    <Sliders className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* VIEW 2: GGUF & CUDA PARAMETER TUNER (LM Studio Inspector) */}
                {modelHubSubTab === 'tuner' && (
                  <div className="space-y-4 animate-fade-in max-h-[420px] overflow-y-auto pr-1">
                    {/* Model Picker */}
                    <div className="p-3.5 rounded-xl glass-card border border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-white flex items-center space-x-2">
                          <Package className="w-4 h-4 text-sky-400" />
                          <span>Chọn Model cần tùy chỉnh thông số CUDA:</span>
                        </label>
                        {selectedHubModel && (
                          <span className="text-[10px] font-mono text-amber-400 font-semibold">
                            {selectedHubModel.parameterSize} • {selectedHubModel.quantMethod}
                          </span>
                        )}
                      </div>

                      <select
                        value={selectedHubModel?.id || hubModels[0]?.id || ''}
                        onChange={(e) => {
                          const found = hubModels.find((m) => m.id === e.target.value);
                          if (found) {
                            setSelectedHubModel(found);
                            setGpuLayers(found.compatibility.recommendedNgl || 21);
                          }
                        }}
                        className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-gray-200 font-mono text-xs focus:outline-none focus:border-sky-500"
                      >
                        {hubModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.filename})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* CUDA GPU Offload Layers (-ngl) Slider */}
                    <div className="p-3.5 rounded-xl glass-card border border-white/10 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Cpu className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-bold text-white">Mức dùng CUDA GPU (-ngl):</span>
                        </div>
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
                        className="w-full accent-sky-400 h-1.5 bg-black/40 rounded-lg cursor-pointer"
                      />

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-400">
                          {gpuLayers === 0
                            ? 'CPU Only (Không dùng VRAM)'
                            : gpuLayers <= 21
                            ? 'CUDA Tối ưu GTX 1650 (~2.6GB VRAM, an toàn chừa 1000MB OS)'
                            : 'CUDA Mức cao (Cần trên 3.5GB VRAM, có thể tràn GPU)'}
                        </span>
                        <span className="text-[10px] font-mono text-gray-500">Max: 99 layers</span>
                      </div>
                    </div>

                    {/* Context Size (-c) & CPU Threads (-t) */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Context Size */}
                      <div className="p-3.5 rounded-xl glass-card border border-white/10 space-y-2">
                        <span className="text-xs font-bold text-white block">Kích thước Context (-c):</span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[2048, 4096, 8192].map((sz) => (
                            <button
                              key={sz}
                              type="button"
                              onClick={() => setContextSize(sz)}
                              className={`py-1 text-center font-mono text-xs rounded-lg border transition-all ${
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

                      {/* CPU Threads */}
                      <div className="p-3.5 rounded-xl glass-card border border-white/10 space-y-2">
                        <span className="text-xs font-bold text-white block">Số luồng CPU Threads (-t):</span>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[2, 4, 6, 8].map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setCpuThreads(t)}
                              className={`py-1 text-center font-mono text-xs rounded-lg border transition-all ${
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
                    <div className="p-3.5 rounded-xl glass-card border border-white/10 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-white block">Bật Flash Attention (-fa)</span>
                        <p className="text-[11px] text-gray-400">Tiết kiệm 30% bộ nhớ VRAM khi sinh văn bản dài.</p>
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

                    {/* Apply Button */}
                    <div className="pt-1 flex items-center justify-between">
                      {tuneApplied ? (
                        <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-semibold font-mono animate-fade-in">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Đã lưu & áp dụng thông số CUDA thành công!</span>
                        </div>
                      ) : (
                        <div className="text-[11px] text-gray-500">
                          Thông số sẽ áp dụng ngay cho engine llama.cpp.
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleApplyTuning}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-sky-500 hover:from-amber-400 hover:to-sky-400 text-slate-950 font-bold text-xs shadow-lg shadow-sky-500/20 transition-all flex items-center space-x-1.5"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>Áp dụng thông số CUDA & Đặt làm Model Hoạt động</span>
                      </button>
                    </div>
                  </div>
                )}
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
