import React, { useState, useEffect } from 'react';
import type { LocalSkill, ProviderConfig, ProviderType, HardwareStats } from '../../types.js';
import type { AutoRouteConfig } from '../../auto-router.js';
import { type ModelHubItem, type ModelCompatibility, ModelHubService } from '../../model-hub.js';
import { type Language, type Translations, dictionaries, getLanguage } from '../i18n.js';
import { getApiUrl } from '../api.js';
import {
  type ThemeId,
  type AccentId,
  type FontSizeId,
  type GlassStyleId,
  type ThemeSettings,
  getSavedThemeSettings,
  applyTheme,
} from '../theme.js';
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
  Languages,
  ChevronDown,
  Plus,
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
  onDeleteProvider?: (id: string) => Promise<void>;
  onSyncProvider: (id: string) => Promise<any>;
  lang?: Language;
  t?: Translations;
  onToggleLanguage?: (l: Language) => void;
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
  onDeleteProvider,
  onSyncProvider,
  lang,
  t: propT,
  onToggleLanguage,
}) => {
  const currentLang = lang || getLanguage();
  const tr = propT || dictionaries[currentLang];

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

  // Appearance & Themes (Dark, Midnight, Obsidian, Slate)
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(() => getSavedThemeSettings().theme);
  const [currentAccent, setCurrentAccent] = useState<AccentId>(() => getSavedThemeSettings().accent);
  const [glassStyle, setGlassStyle] = useState<GlassStyleId>(() => getSavedThemeSettings().glassStyle);
  const [uiFontSize, setUiFontSize] = useState<FontSizeId>(() => getSavedThemeSettings().fontSize);

  const handleUpdateTheme = (updates: Partial<ThemeSettings>) => {
    const next = applyTheme(updates);
    if (updates.theme) setCurrentTheme(next.theme);
    if (updates.accent) setCurrentAccent(next.accent);
    if (updates.glassStyle) setGlassStyle(next.glassStyle);
    if (updates.fontSize) setUiFontSize(next.fontSize);
  };

  // Add Custom Provider state
  const [isAddingProvider, setIsAddingProvider] = useState(false);
  const [newProviderName, setNewProviderName] = useState('');
  const [newProviderType, setNewProviderType] = useState<ProviderType>('ollama');
  const [newProviderBaseUrl, setNewProviderBaseUrl] = useState('http://127.0.0.1:11434/v1');
  const [newProviderApiKey, setNewProviderApiKey] = useState('');
  const [newProviderModel, setNewProviderModel] = useState('');

  // Add Custom Model state
  const [isAddingCustomModel, setIsAddingCustomModel] = useState(false);
  const [customModelName, setCustomModelName] = useState('');
  const [customModelUrl, setCustomModelUrl] = useState('');
  const [customModelAuthor, setCustomModelAuthor] = useState('HuggingFace');
  const [customModelParam, setCustomModelParam] = useState('7B');
  const [customModelQuant, setCustomModelQuant] = useState('Q4_K_M');
  const [customModelSizeGb, setCustomModelSizeGb] = useState('4.5');
  const [customModelCategory, setCustomModelCategory] = useState<'coding' | 'reasoning' | 'vision' | 'general'>('coding');

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
    fetch(getApiUrl('/api/models/hub'))
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

    fetch(getApiUrl('/api/dialog/system-folders'))
      .then((res) => res.json())
      .then((data) => setSystemPaths(data))
      .catch(() => {});
  }, [isOpen]);

  // Esc key listener to quickly close modal or sub-forms
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAddingCustomModel) {
          setIsAddingCustomModel(false);
        } else if (isAddingProvider) {
          setIsAddingProvider(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isAddingCustomModel, isAddingProvider, onClose]);

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
      await fetch(getApiUrl('/api/models/download'), {
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
        const res = await fetch(getApiUrl('/api/models/downloads'));
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
      const res = await fetch(getApiUrl('/api/app/check-update'));
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
      await fetch(getApiUrl('/api/dialog/open-folder'), {
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
      const res = await fetch(getApiUrl('/api/app/clear-cache'), { method: 'POST' });
      const data = await res.json();
      setCacheMessage(data.message || 'Cache & logs cleared successfully');
      setTimeout(() => setCacheMessage(null), 3000);
    } catch (e: any) {
      setCacheMessage('Error clearing cache');
      setTimeout(() => setCacheMessage(null), 3000);
    }
  };

  const handleAddCustomModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customModelName || !customModelUrl) return;
    try {
      const sizeBytes = Math.round(parseFloat(customModelSizeGb || '4') * 1024 * 1024 * 1024);
      const res = await fetch(getApiUrl('/api/models/hub/custom'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customModelName,
          downloadUrl: customModelUrl,
          author: customModelAuthor || 'HuggingFace',
          parameterSize: customModelParam || '7B',
          quantization: customModelQuant || 'Q4_K_M',
          fileSizeBytes: sizeBytes,
          category: customModelCategory,
        }),
      });
      if (res.ok) {
        setIsAddingCustomModel(false);
        setCustomModelName('');
        setCustomModelUrl('');
        const hubRes = await fetch(getApiUrl('/api/models/hub'));
        const data = await hubRes.json();
        setHubModels(data.models || []);
      }
    } catch (err) {
      console.error('Failed to add custom model', err);
    }
  };

  const handleDeleteCustomModel = async (modelId: string) => {
    try {
      await fetch(getApiUrl(`/api/models/hub/custom/${modelId}`), { method: 'DELETE' });
      setHubModels((prev) => prev.filter((m) => m.id !== modelId));
      if (selectedHubModel?.id === modelId) {
        setSelectedHubModel(hubModels.find((m) => m.id !== modelId) || null);
      }
    } catch (err) {
      console.error('Failed to delete custom model', err);
    }
  };

  const handleAddNewProvider = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProviderName || !newProviderBaseUrl) return;
    const id = `provider-${Date.now()}`;
    const newProv: ProviderConfig = {
      id,
      name: newProviderName,
      type: newProviderType,
      baseUrl: newProviderBaseUrl,
      apiKey: newProviderApiKey || undefined,
      models: [newProviderModel || 'default-model'],
      selectedModel: newProviderModel || 'default-model',
      isDefault: false,
      enabled: true,
    };
    onSaveProvider(newProv);
    setSelectedProviderId(id);
    setIsAddingProvider(false);
    setNewProviderName('');
    setNewProviderApiKey('');
    setNewProviderModel('');
  };

  const handleDeleteProvider = async (id: string) => {
    if (id === 'local-llama') return;
    if (onDeleteProvider) {
      await onDeleteProvider(id);
    } else {
      await fetch(getApiUrl(`/api/providers/${id}`), { method: 'DELETE' });
    }
    if (selectedProviderId === id) {
      const remaining = providers.filter((p) => p.id !== id);
      setSelectedProviderId(remaining[0]?.id || 'local-llama');
    }
  };

  const navItems = [
    { id: 'autoroute', label: tr.navAutoRoute || 'Auto Model Router', icon: <Compass className="w-4 h-4 text-sky-400" /> },
    { id: 'models', label: tr.navModels || 'Model Hub & Library', icon: <Package className="w-4 h-4 text-amber-400" /> },
    { id: 'inference', label: tr.navInference || 'Sampling & Inference', icon: <Sliders className="w-4 h-4 text-emerald-400" /> },
    { id: 'cuda', label: tr.navCuda || 'CUDA & VRAM Hardware', icon: <Cpu className="w-4 h-4 text-rose-400" /> },
    { id: 'skills', label: tr.navSkills || 'Local Skills & Tools', icon: <Sparkles className="w-4 h-4 text-purple-400" /> },
    { id: 'storage', label: tr.navStorage || 'Storage & System Paths', icon: <HardDrive className="w-4 h-4 text-teal-400" /> },
    { id: 'appearance', label: tr.navAppearance || 'Appearance & UI Theme', icon: <Palette className="w-4 h-4 text-pink-400" /> },
    { id: 'shortcuts', label: tr.navShortcuts || 'Keyboard Shortcuts', icon: <Keyboard className="w-4 h-4 text-yellow-400" /> },
    { id: 'providers', label: tr.navProviders || 'API Keys & Providers', icon: <Globe className="w-4 h-4 text-sky-400" /> },
    { id: 'rag', label: tr.navRag || 'Offline RAG & Vectors', icon: <BookOpen className="w-4 h-4 text-indigo-400" /> },
    { id: 'about', label: tr.navAbout || 'About & Updates', icon: <Zap className="w-4 h-4 text-amber-400" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#0d1117] flex flex-col select-none animate-fade-in text-gray-200">
      {/* Top Application Bar with Back to Chat Button */}
      <div className="h-14 px-6 border-b border-[#30363d] bg-[#161b22] flex items-center justify-between shrink-0 shadow-sm z-30">
        <div className="flex items-center space-x-4">
          <button
            onClick={onClose}
            className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-xs font-semibold transition-all group shadow-sm"
            title={`${tr.backToChat} (Esc)`}
          >
            <ArrowLeft className="w-4 h-4 text-sky-400 group-hover:-translate-x-0.5 transition-transform" />
            <span className="font-bold">{tr.backToChat}</span>
            <kbd className="text-[10px] bg-[#0d1117] px-1.5 py-0.5 rounded text-gray-400 border border-[#30363d] font-mono">
              Esc
            </kbd>
          </button>

          <div className="h-5 w-[1px] bg-[#30363d]" />

          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-slate-950 font-black text-xs shadow-md shadow-sky-500/20">
              ⚡
            </div>
            <div>
              <span className="font-bold text-sm text-white">
                {currentLang === 'vi' ? 'Cài đặt & Quản lý Mô hình' : 'Settings & Model Management'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs text-gray-400 font-mono">
        </div>
      </div>

      {/* Main Full-Size Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Categories Sidebar */}
        <div className="w-64 bg-[#161b22] border-r border-[#30363d] flex flex-col justify-between shrink-0 p-3">
          <div className="space-y-3">
            <div className="px-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              {tr.settingsAndHardware}
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveCategory(item.id as any)}
                  className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all ${
                    activeCategory === item.id
                      ? 'bg-sky-500/20 text-sky-300 shadow-sm border border-sky-500/30'
                      : 'text-gray-400 hover:bg-[#21262d] hover:text-gray-200 border border-transparent'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-2 border-t border-[#30363d] text-[11px] text-gray-400 font-mono flex items-center justify-between">
            <span>LocalAI Desktop</span>
            <span className="text-sky-400">v0.1.0</span>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1117]">
          {/* Category Top Banner */}
          <div className="px-6 py-3 border-b border-[#30363d] flex items-center justify-between shrink-0 bg-[#161b22]/60">
            <h2 className="text-sm font-bold text-white capitalize">
              {navItems.find((n) => n.id === activeCategory)?.label}
            </h2>
          </div>

          {/* Conditional Layout: Master-Detail for models, Full-width for others */}
          {activeCategory === 'models' ? (
            <div className="flex-1 flex overflow-hidden h-full animate-fade-in">
              {/* 1. Left Sub-Column: Model List */}
              <div className="w-[390px] border-r border-[#30363d] flex flex-col h-full bg-[#161b22]/40 shrink-0 p-4 space-y-3 overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-200">
                    {currentLang === 'vi' ? 'Kho Mô Hình GGUF' : 'GGUF Model Hub'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingCustomModel(!isAddingCustomModel)}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-[11px] font-semibold transition-all"
                  >
                    {isAddingCustomModel ? (
                      <>
                        <X className="w-3.5 h-3.5" />
                        <span>{currentLang === 'vi' ? 'Đóng' : 'Close'}</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>{currentLang === 'vi' ? 'Thêm từ Hugging Face' : 'Add from Hugging Face'}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Inline Add Custom Model Form */}
                {isAddingCustomModel && (
                  <form onSubmit={handleAddCustomModel} className="p-3 rounded-xl bg-[#0d1117] border border-sky-500/40 space-y-2 text-xs animate-fade-in shadow-lg">
                    <div className="font-bold text-sky-400 text-xs flex items-center space-x-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{currentLang === 'vi' ? 'Thêm mô hình từ Hugging Face hoặc URL' : 'Add Model from Hugging Face / URL'}</span>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 block font-medium">
                        {currentLang === 'vi' ? 'Tên mô hình:' : 'Model Name:'}
                      </label>
                      <input
                        type="text"
                        placeholder="Ví dụ: DeepSeek-R1-Distill-Qwen-7B"
                        value={customModelName}
                        onChange={(e) => setCustomModelName(e.target.value)}
                        required
                        className="w-full px-2.5 py-1 rounded-lg bg-[#161b22] border border-[#30363d] text-white text-xs focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 block font-medium">
                        {currentLang === 'vi' ? 'Đường dẫn Hugging Face / URL (.gguf):' : 'Hugging Face URL / GGUF Link:'}
                      </label>
                      <input
                        type="url"
                        placeholder="https://huggingface.co/.../*.gguf"
                        value={customModelUrl}
                        onChange={(e) => setCustomModelUrl(e.target.value)}
                        required
                        className="w-full px-2.5 py-1 rounded-lg bg-[#161b22] border border-[#30363d] text-white font-mono text-[11px] focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-400 block font-medium">
                          {currentLang === 'vi' ? 'Định dạng lượng tử:' : 'Quantization:'}
                        </label>
                        <select
                          value={customModelQuant}
                          onChange={(e) => setCustomModelQuant(e.target.value)}
                          className="w-full px-2 py-1 rounded-lg bg-[#161b22] border border-[#30363d] text-white text-xs focus:outline-none focus:border-sky-500"
                        >
                          <option value="Q4_K_M">Q4_K_M (Khuyên dùng)</option>
                          <option value="Q5_K_M">Q5_K_M</option>
                          <option value="Q8_0">Q8_0</option>
                          <option value="Q3_K_M">Q3_K_M</option>
                          <option value="IQ4_XS">IQ4_XS</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 block font-medium">
                          {currentLang === 'vi' ? 'Dung lượng ước tính (GB):' : 'Size (GB):'}
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="4.5"
                          value={customModelSizeGb}
                          onChange={(e) => setCustomModelSizeGb(e.target.value)}
                          className="w-full px-2 py-1 rounded-lg bg-[#161b22] border border-[#30363d] text-white text-xs focus:outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-400 block font-medium">
                          {currentLang === 'vi' ? 'Số lượng tham số:' : 'Parameters:'}
                        </label>
                        <select
                          value={customModelParam}
                          onChange={(e) => setCustomModelParam(e.target.value)}
                          className="w-full px-2 py-1 rounded-lg bg-[#161b22] border border-[#30363d] text-white text-xs focus:outline-none focus:border-sky-500"
                        >
                          <option value="1.5B">1.5B</option>
                          <option value="3B">3B</option>
                          <option value="7B">7B</option>
                          <option value="8B">8B</option>
                          <option value="14B">14B</option>
                          <option value="32B">32B</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 block font-medium">
                          {currentLang === 'vi' ? 'Mục đích sử dụng:' : 'Category:'}
                        </label>
                        <select
                          value={customModelCategory}
                          onChange={(e) => setCustomModelCategory(e.target.value as any)}
                          className="w-full px-2 py-1 rounded-lg bg-[#161b22] border border-[#30363d] text-white text-xs focus:outline-none focus:border-sky-500"
                        >
                          <option value="coding">💻 {currentLang === 'vi' ? 'Lập trình' : 'Coding'}</option>
                          <option value="reasoning">🧠 {currentLang === 'vi' ? 'Suy luận' : 'Reasoning'}</option>
                          <option value="general">⚡ {currentLang === 'vi' ? 'Đa nhiệm' : 'General'}</option>
                          <option value="vision">👁️ {currentLang === 'vi' ? 'Thị giác' : 'Vision'}</option>
                        </select>
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-all flex items-center justify-center space-x-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{currentLang === 'vi' ? 'Thêm vào danh sách' : 'Add to List'}</span>
                    </button>
                  </form>
                )}

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

                {/* Model Cards List - Split into Downloaded & Available */}
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

                    const downloaded = filtered.filter((m) => downloadProgress[m.id] === 100);
                    const available = filtered.filter((m) => downloadProgress[m.id] !== 100);

                    const renderCard = (m: EnrichedModelItem, isDownloaded: boolean) => {
                      const isCurSelected = selectedHubModel?.id === m.id;
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
                              : 'bg-[#161b22] border-[#30363d] hover:bg-[#21262d] hover:border-sky-500/40'
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

                          {/* Dynamic Tag & Status */}
                          <div className="mt-2 flex items-center justify-between">
                            {isDownloaded ? (
                              <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/30 flex items-center space-x-1">
                                <CheckCircle2 className="w-3 h-3 mr-0.5 inline" />
                                <span>{currentLang === 'vi' ? 'Đã tải trên máy' : 'Downloaded'}</span>
                              </span>
                            ) : (
                              <span
                                className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full border ${comp.badgeColor}`}
                              >
                                ● {comp.statusLabel}
                              </span>
                            )}
                            <div className="flex items-center space-x-1.5">
                              {(m.tags?.includes('Custom') || m.id.startsWith('custom-')) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCustomModel(m.id);
                                  }}
                                  className="p-1 rounded hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 transition-colors"
                                  title="Xóa mô hình tùy chỉnh"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                              {isCurSelected && (
                                <span className="text-[9px] font-mono text-sky-400 font-bold">
                                  {currentLang === 'vi' ? 'Đang chọn ➔' : 'Selected ➔'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    };

                    return (
                      <>
                        {/* Section 1: Downloaded Models on PC */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400 uppercase tracking-wider px-1">
                            <span className="flex items-center space-x-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{currentLang === 'vi' ? 'Mô hình đã tải về máy' : 'Downloaded Models'} ({downloaded.length})</span>
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

                        {/* Section 2: Available Models in Hub */}
                        <div className="space-y-1.5 pt-3 border-t border-[#30363d]/60">
                          <div className="flex items-center justify-between text-[11px] font-bold text-sky-400 uppercase tracking-wider px-1">
                            <span className="flex items-center space-x-1">
                              <Package className="w-3.5 h-3.5" />
                              <span>{currentLang === 'vi' ? 'Kho mô hình sẵn có & Tải về' : 'Available to Download'} ({available.length})</span>
                            </span>
                          </div>
                          {available.map((m) => renderCard(m, false))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* 2. Right Sub-Column: Selected Model Inspector & CUDA Tuner */}
              <div className="flex-1 h-full overflow-y-auto p-6 space-y-4">
                {selectedHubModel ? (
                  <div className="space-y-4 max-w-3xl">
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
                            {currentLang === 'vi' ? 'Tên tệp:' : 'Filename:'} {selectedHubModel.filename} • {currentLang === 'vi' ? 'Tác giả:' : 'Author:'} {selectedHubModel.author}
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
                            className="px-2 py-0.5 rounded-md bg-[#21262d] text-[10px] font-mono text-gray-400 border border-[#30363d]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Dynamic CUDA & Hardware Calculator */}
                    <div className="p-4 rounded-2xl bg-[#161b22] border border-[#30363d] space-y-4 shadow-sm">
                      <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
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
                        <div className="p-3.5 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-300 font-semibold">Ước tính tiêu thụ bộ nhớ đồ họa:</span>
                            <span className="font-mono text-white font-bold">
                              {currentModelComp.estimatedVramMb} MB / 4096 MB VRAM
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-[#161b22] rounded-full overflow-hidden border border-[#30363d]">
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
                          className="w-full accent-sky-400 h-2 bg-[#0d1117] rounded-lg cursor-pointer"
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
                                    : 'bg-[#0d1117] text-gray-400 border-[#30363d] hover:text-white hover:bg-[#21262d]'
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
                                    : 'bg-[#0d1117] text-gray-400 border-[#30363d] hover:text-white hover:bg-[#21262d]'
                                }`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Flash Attention Toggle */}
                      <div className="p-3.5 rounded-xl bg-[#0d1117] border border-[#30363d] flex items-center justify-between">
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
                          <div className="w-10 h-5 bg-[#21262d] border border-[#30363d] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>
                    </div>

                    {/* Action Buttons Bar */}
                    <div className="p-4 rounded-2xl bg-[#161b22] border border-[#30363d] flex items-center justify-between shadow-sm">
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
                            className="px-4 py-2 rounded-xl bg-[#21262d] hover:bg-[#30363d] text-white font-semibold text-xs transition-all flex items-center space-x-1.5 border border-[#30363d] shadow-sm"
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
                      <span className="font-bold text-sm text-white">
                        {currentLang === 'vi' ? 'Định tuyến mô hình thông minh' : 'Smart Auto-Model Routing'}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 max-w-md">
                      {currentLang === 'vi'
                        ? 'Tự động nhận diện ý định câu lệnh (Trò chuyện, Lập trình, Suy luận, Thị giác) để chuyển tiếp đến mô hình tối ưu nhất.'
                        : 'Auto-detect prompt intent (Fast chat, Code, Deep reasoning, Vision) and dispatch to the optimal model.'}
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
                <div className="space-y-3">
                  <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    {currentLang === 'vi' ? 'Chỉ định mô hình theo vai trò' : 'Role Model Assignments'}
                  </div>

                  {/* General */}
                  <SearchableModelPicker
                    label={currentLang === 'vi' ? 'Mô hình trò chuyện nhanh (3B)' : 'Fast Conversational Model (3B)'}
                    desc={currentLang === 'vi' ? 'Xử lý các câu hỏi thông thường, dịch thuật, tóm tắt và định dạng nhanh.' : 'Handles general queries, format conversion, translations.'}
                    value={autoRouteConfig.generalModel}
                    category="general"
                    dropdownPosition="down"
                    onChange={(val) => onUpdateAutoRouteConfig({ ...autoRouteConfig, generalModel: val })}
                  />

                  {/* Coder */}
                  <SearchableModelPicker
                    label={currentLang === 'vi' ? 'Mô hình lập trình chuyên sâu' : 'Specialized Coding Model'}
                    desc={currentLang === 'vi' ? 'Tự động kích hoạt khi phát hiện viết mã, sửa lỗi hoặc tái cấu trúc.' : 'Selected when code, functions, bugs or refactoring are detected.'}
                    value={autoRouteConfig.coderModel}
                    category="coding"
                    dropdownPosition="down"
                    onChange={(val) => onUpdateAutoRouteConfig({ ...autoRouteConfig, coderModel: val })}
                  />

                  {/* Reasoner */}
                  <SearchableModelPicker
                    label={currentLang === 'vi' ? 'Mô hình suy luận & tư duy sâu' : 'Deep Reasoning Model'}
                    desc={currentLang === 'vi' ? 'Kích hoạt khi giải toán, thuật toán, phân tích logic từng bước.' : 'Dispatched for math, algorithms, step-by-step logic.'}
                    value={autoRouteConfig.reasonerModel}
                    category="reasoning"
                    dropdownPosition="up"
                    onChange={(val) => onUpdateAutoRouteConfig({ ...autoRouteConfig, reasonerModel: val })}
                  />

                  {/* Vision Multimodal */}
                  <SearchableModelPicker
                    label={currentLang === 'vi' ? 'Mô hình thị giác máy tính' : 'Vision & Multimodal Model'}
                    desc={currentLang === 'vi' ? 'Tự động kích hoạt khi đính kèm hình ảnh hoặc sơ đồ kiến trúc.' : 'Automatically triggers when you attach or ask about images or charts.'}
                    value={autoRouteConfig.visionModel}
                    category="vision"
                    dropdownPosition="up"
                    onChange={(val) => onUpdateAutoRouteConfig({ ...autoRouteConfig, visionModel: val })}
                  />
                </div>
              </div>
            )}

            {/* 3. LOCAL SKILLS */}
            {activeCategory === 'skills' && (
              <div className="space-y-4 animate-fade-in">
                <div className="p-3.5 rounded-xl bg-[#161b22] border border-[#30363d] space-y-2">
                  <label className="font-semibold text-xs text-white block">
                    {currentLang === 'vi' ? 'Tự động quét kỹ năng trên máy tính:' : 'Global Skills Auto-Discovery:'}
                  </label>
                  <p className="text-[11px] text-gray-400">
                    {currentLang === 'vi'
                      ? 'Ứng dụng tự động nhận diện các thư mục kỹ năng và công cụ mở rộng (~/.gemini/skills, ~/.config/skills).'
                      : 'The app automatically scans your PC\'s global plugin & skill directories (~/.gemini/skills, ~/.config/skills).'}
                  </p>
                  <div className="flex space-x-2 pt-1">
                    <input
                      type="text"
                      value={newSkillFolder}
                      onChange={(e) => setNewSkillFolder(e.target.value)}
                      placeholder={currentLang === 'vi' ? 'Thêm đường dẫn thư mục kỹ năng trên máy...' : 'Add custom folder on PC...'}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-gray-200 font-mono text-xs focus:outline-none focus:border-sky-500"
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
                      <span>{currentLang === 'vi' ? 'Thêm' : 'Add'}</span>
                    </button>
                  </div>
                </div>

                {/* Discovered Skills List */}
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    {currentLang === 'vi' ? `Kỹ năng đã tìm thấy (${skills.length})` : `Discovered Skills (${skills.length})`}
                  </div>
                  {skills.map((skill) => (
                    <div
                      key={skill.id}
                      className="p-3.5 rounded-xl bg-[#161b22] border border-[#30363d] flex items-center justify-between space-x-4"
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
                      <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 whitespace-nowrap shrink-0">
                        {currentLang === 'vi' ? 'Hoạt động' : 'Active'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. PROVIDERS & KEYS */}
            {activeCategory === 'providers' && currentProvider && (
              <div className="space-y-4 animate-fade-in">
                {/* Providers Header & Add Button */}
                <div className="flex items-center justify-between pb-1">
                  <div>
                    <h3 className="text-xs font-bold text-white">
                      {currentLang === 'vi' ? 'Nhà cung cấp & Cổng kết nối API' : 'Inference Providers & Endpoints'}
                    </h3>
                    <p className="text-[11px] text-gray-400">
                      {currentLang === 'vi'
                        ? 'Mặc định là llama.cpp (CUDA) tích hợp sẵn. Bạn có thể thêm Ollama, LM Studio, FreeLLM hoặc API tùy chỉnh.'
                        : 'Default is embedded llama.cpp (CUDA). Add Ollama, LM Studio, FreeLLM or custom endpoints.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddingProvider(!isAddingProvider)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-semibold transition-all shadow-sm"
                  >
                    {isAddingProvider ? (
                      <>
                        <X className="w-3.5 h-3.5" />
                        <span>{currentLang === 'vi' ? 'Đóng' : 'Close'}</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>{currentLang === 'vi' ? 'Thêm nhà cung cấp' : 'Add Provider'}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Inline Add Provider Form with Quick Presets */}
                {isAddingProvider && (
                  <form onSubmit={handleAddNewProvider} className="p-4 rounded-xl bg-[#0d1117] border border-sky-500/40 space-y-3 animate-fade-in shadow-xl">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-sky-400">
                        {currentLang === 'vi' ? 'Thêm nhà cung cấp suy luận mới' : 'Add New Inference Provider'}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {currentLang === 'vi' ? 'Chọn mẫu cấu hình nhanh hoặc tự điền chi tiết' : 'Choose a preset or enter custom details'}
                      </span>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                      {[
                        { label: '🦙 Ollama', name: 'Ollama (Local)', type: 'ollama' as ProviderType, url: 'http://127.0.0.1:11434/v1', model: 'llama3:latest' },
                        { label: '🧪 LM Studio', name: 'LM Studio (Local)', type: 'custom' as ProviderType, url: 'http://127.0.0.1:1234/v1', model: 'local-model' },
                        { label: '⚡ FreeLLM API', name: 'FreeLLM API', type: 'freellm' as ProviderType, url: 'https://api.freellm.example/v1', model: 'llama-3.3-70b-instruct' },
                        { label: '🌐 OpenAI', name: 'OpenAI API', type: 'openai' as ProviderType, url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
                        { label: '⚙️ ' + (currentLang === 'vi' ? 'Tùy chỉnh' : 'Custom'), name: 'Custom Server', type: 'custom' as ProviderType, url: 'http://localhost:8080/v1', model: 'default' },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setNewProviderName(preset.name);
                            setNewProviderType(preset.type);
                            setNewProviderBaseUrl(preset.url);
                            setNewProviderModel(preset.model);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-gray-300 hover:text-white border border-[#30363d] text-[11px] font-medium transition-colors"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Provider Name:</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Ollama Local"
                          value={newProviderName}
                          onChange={(e) => setNewProviderName(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-[#161b22] border border-[#30363d] text-gray-200 text-xs focus:outline-none focus:border-sky-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Provider Type:</label>
                        <select
                          value={newProviderType}
                          onChange={(e) => setNewProviderType(e.target.value as any)}
                          className="w-full px-3 py-1.5 rounded-lg bg-[#161b22] border border-[#30363d] text-gray-200 text-xs focus:outline-none focus:border-sky-500"
                        >
                          <option value="ollama">Ollama</option>
                          <option value="custom">Custom (LM Studio, vLLM, etc.)</option>
                          <option value="freellm">FreeLLM API</option>
                          <option value="openai">OpenAI Compatible</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Base URL Endpoint:</label>
                        <input
                          type="text"
                          required
                          placeholder="http://127.0.0.1:11434/v1"
                          value={newProviderBaseUrl}
                          onChange={(e) => setNewProviderBaseUrl(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-[#161b22] border border-[#30363d] text-gray-200 font-mono text-xs focus:outline-none focus:border-sky-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Default Model Name:</label>
                        <input
                          type="text"
                          placeholder="e.g. llama3:latest or qwen2.5:latest"
                          value={newProviderModel}
                          onChange={(e) => setNewProviderModel(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-[#161b22] border border-[#30363d] text-gray-200 font-mono text-xs focus:outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                        {currentLang === 'vi' ? 'Khóa API (Không bắt buộc với server nội bộ):' : 'API Key (Optional for local):'}
                      </label>
                      <input
                        type="password"
                        placeholder="sk-••••••••••••••••••••"
                        value={newProviderApiKey}
                        onChange={(e) => setNewProviderApiKey(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-[#161b22] border border-[#30363d] text-gray-200 font-mono text-xs focus:outline-none focus:border-sky-500"
                      />
                    </div>

                    <div className="flex justify-end space-x-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddingProvider(false)}
                        className="px-3 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-gray-300 text-xs font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center space-x-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Save Provider</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* Providers Cards Grid */}
                <div className="grid grid-cols-3 gap-2.5">
                  {providers.map((p) => {
                    const isSelected = selectedProviderId === p.id;
                    const canDelete = p.id !== 'local-llama';
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedProviderId(p.id)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all relative group ${
                          isSelected
                            ? 'border-sky-500 bg-sky-500/10 text-sky-400 shadow-sm ring-1 ring-sky-500/30'
                            : 'border-[#30363d] bg-[#161b22] text-gray-300 hover:bg-[#21262d] hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-xs truncate max-w-[170px]">{p.name}</div>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProvider(p.id);
                              }}
                              className="p-1 rounded-lg hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 transition-colors shrink-0"
                              title={currentLang === 'vi' ? 'Xóa nhà cung cấp' : 'Delete provider'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-1 text-[10px] text-gray-400 font-mono">
                          <span className="uppercase text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/5">
                            {p.type}
                          </span>
                          <div className="flex items-center space-x-1.5">
                            <span className={p.enabled !== false ? 'text-emerald-400 font-semibold' : 'text-gray-500'}>
                              {p.enabled !== false ? '● ' + (currentLang === 'vi' ? 'Bật' : 'On') : '○ ' + (currentLang === 'vi' ? 'Tắt' : 'Off')}
                            </span>
                            {p.isDefault && (
                              <span className="text-sky-400 font-semibold">★ {currentLang === 'vi' ? 'Mặc định' : 'Default'}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Provider Editor */}
                <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] space-y-3 shadow-sm">
                  <div className="flex items-center justify-between border-b border-[#30363d] pb-2">
                    <span className="font-bold text-xs text-white">
                      {currentLang === 'vi' ? 'Cấu hình:' : 'Configuring:'} {currentProvider.name}
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => onSaveProvider({ ...currentProvider, enabled: !(currentProvider.enabled !== false) })}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center space-x-1.5 ${
                          currentProvider.enabled !== false
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-[#21262d] text-gray-400 border border-[#30363d] hover:text-white'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${currentProvider.enabled !== false ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                        <span>{currentProvider.enabled !== false ? (currentLang === 'vi' ? 'Đang bật' : 'Enabled') : (currentLang === 'vi' ? 'Đã tắt' : 'Disabled')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onSaveProvider({ ...currentProvider, isDefault: !currentProvider.isDefault })}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                          currentProvider.isDefault
                            ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                            : 'bg-[#21262d] text-gray-300 hover:text-white border border-[#30363d]'
                        }`}
                      >
                        {currentProvider.isDefault ? (currentLang === 'vi' ? '✓ Cổng mặc định' : '✓ Default Provider') : (currentLang === 'vi' ? 'Đặt làm mặc định' : 'Set as Default')}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Base URL Endpoint:</label>
                    <input
                      type="text"
                      value={currentProvider.baseUrl}
                      onChange={(e) => onSaveProvider({ ...currentProvider, baseUrl: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-gray-200 font-mono text-xs focus:outline-none focus:border-sky-500"
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
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={currentProvider.selectedModel}
                        onChange={(e) => onSaveProvider({ ...currentProvider, selectedModel: e.target.value })}
                        placeholder="Model name"
                        className="flex-1 px-3 py-1.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-gray-200 font-mono text-xs focus:outline-none focus:border-sky-500"
                      />
                      {currentProvider.models && currentProvider.models.length > 0 && (
                        <select
                          value={currentProvider.selectedModel}
                          onChange={(e) => onSaveProvider({ ...currentProvider, selectedModel: e.target.value })}
                          className="px-2.5 py-1.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-gray-200 font-mono text-xs focus:outline-none focus:border-sky-500 max-w-[180px]"
                        >
                          {currentProvider.models.map((m) => (
                            <option key={m} value={m} className="bg-[#161b22] text-gray-200 py-1">
                              {m}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-white/10">
                    <button
                      onClick={handleSync}
                      disabled={syncStatus.loading}
                      className="px-3.5 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-sky-400 border border-[#30363d] font-semibold text-xs transition-colors flex items-center space-x-1.5"
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
                <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] space-y-3 shadow-sm">
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
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] space-y-2 shadow-sm">
                  <span className="font-bold text-xs text-white">Smart Offload Policy:</span>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Auto-tuner allocates layers to GPU VRAM while reserving headroom for the operating system display. Remaining layers run on CPU system RAM with Flash Attention.
                  </p>
                </div>
              </div>
            )}

            {/* 3. SAMPLING & INFERENCE PARAMETERS (LM Studio style) */}
            {activeCategory === 'inference' && (
              <div className="space-y-4 animate-fade-in">
                <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
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
                    </div>
                    <textarea
                      rows={3}
                      value={defaultSystemPrompt}
                      onChange={(e) => setDefaultSystemPrompt(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[#0d1117] border border-[#30363d] text-gray-200 text-xs focus:outline-none focus:border-emerald-500 font-sans"
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
                <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] space-y-4 shadow-sm">
                  <div className="flex items-center space-x-2 border-b border-[#30363d] pb-3">
                    <HardDrive className="w-4 h-4 text-teal-400" />
                    <div>
                      <span className="font-bold text-sm text-white">
                        {currentLang === 'vi' ? 'Quản lý lưu trữ & Đường dẫn hệ thống' : 'Storage & System Directories'}
                      </span>
                      <p className="text-[11px] text-gray-400">
                        {currentLang === 'vi' ? 'Quản lý thư mục chứa mô hình GGUF, dự án và bộ nhớ tạm' : 'Manage GGUF models, workspace data and cache directories'}
                      </p>
                    </div>
                  </div>

                  {/* GGUF Models Path */}
                  <div className="p-3.5 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white">
                        {currentLang === 'vi' ? '📁 Thư mục mô hình GGUF:' : '📁 GGUF Models Folder:'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenFolder(systemPaths?.models || '')}
                        className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 text-[11px] font-semibold transition-all"
                      >
                        <FolderOpen className="w-3 h-3" />
                        <span>{currentLang === 'vi' ? 'Mở trong Explorer' : 'Open in Explorer'}</span>
                      </button>
                    </div>
                    <div className="p-2 rounded-lg bg-[#161b22] border border-[#30363d] font-mono text-[11px] text-gray-300 break-all select-all">
                      {systemPaths?.models || 'c:\\Tam\\Code\\LocalAI\\models'}
                    </div>
                    <p className="text-[10px] text-gray-500">
                      {currentLang === 'vi'
                        ? 'Tất cả file .gguf tải về hoặc copy thủ công vào thư mục này sẽ tự động xuất hiện trong Model Hub.'
                        : 'All downloaded or manually copied .gguf files in this folder appear automatically in Model Hub.'}
                    </p>
                  </div>

                  {/* Current Workspace Path */}
                  <div className="p-3.5 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white">
                        {currentLang === 'vi' ? '💻 Thư mục dự án đang mở:' : '💻 Active Workspace Root:'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenFolder(systemPaths?.current || '')}
                        className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-[11px] font-semibold transition-all"
                      >
                        <FolderOpen className="w-3 h-3" />
                        <span>{currentLang === 'vi' ? 'Mở trong Explorer' : 'Open in Explorer'}</span>
                      </button>
                    </div>
                    <div className="p-2 rounded-lg bg-[#161b22] border border-[#30363d] font-mono text-[11px] text-gray-300 break-all select-all">
                      {systemPaths?.current || 'c:\\Tam\\Code\\LocalAI'}
                    </div>
                  </div>

                  {/* Cache Cleanup */}
                  <div className="p-3.5 rounded-xl bg-[#0d1117] border border-[#30363d] flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-white">
                        {currentLang === 'vi' ? '🧹 Bộ nhớ đệm & Nhật ký tạm thời' : '🧹 App Temporary Cache & Logs'}
                      </span>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {currentLang === 'vi' ? 'Xóa phiên làm việc lưu đệm và nhật ký tạm thời để giải phóng dung lượng' : 'Clear session cache and temporary logs to free up storage space'}
                      </p>
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
                      <span>{currentLang === 'vi' ? 'Xóa bộ nhớ đệm' : 'Clear Cache'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* APPEARANCE & THEMES */}
            {activeCategory === 'appearance' && (
              <div className="space-y-4 animate-fade-in">
                <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] space-y-4 shadow-sm">
                  <div className="flex items-center space-x-2 border-b border-[#30363d] pb-3">
                    <Palette className="w-4 h-4 text-pink-400" />
                    <div>
                      <span className="font-bold text-sm text-white">{tr.appearanceTitle || 'Appearance & Workspace Themes'}</span>
                      <p className="text-[11px] text-gray-400">{tr.appearanceSubtitle || 'Customize visual theme, accent colors, and font scaling'}</p>
                    </div>
                  </div>

                  {/* Studio Themes */}
                  <div className="space-y-2">
                    <span className="font-semibold text-xs text-gray-200">Studio Theme:</span>
                    <div className="grid grid-cols-4 gap-2.5">
                      {[
                        { id: 'charcoal' as ThemeId, label: 'Charcoal Dark', desc: 'Default studio look', bg: '#0d1117' },
                        { id: 'midnight' as ThemeId, label: 'Midnight Blue', desc: 'Deep navy undertone', bg: '#080c14' },
                        { id: 'obsidian' as ThemeId, label: 'Obsidian OLED', desc: 'True pure black', bg: '#000000' },
                        { id: 'slate' as ThemeId, label: 'Slate Gray', desc: 'Modern cool gray', bg: '#0f172a' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleUpdateTheme({ theme: item.id })}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            currentTheme === item.id
                              ? 'bg-sky-500/15 border-sky-500/50 text-white shadow-md ring-1 ring-sky-500/30'
                              : 'bg-[#0d1117] border-[#30363d] text-gray-400 hover:bg-[#21262d] hover:text-white'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <span className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0" style={{ backgroundColor: item.bg }} />
                            <span className="font-bold text-xs text-gray-200">{item.label}</span>
                          </div>
                          <div className="text-[10px] text-gray-500 mt-1">{item.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Accent Colors */}
                  <div className="space-y-2 pt-2 border-t border-[#30363d]">
                    <span className="font-semibold text-xs text-gray-200">Accent Color:</span>
                    <div className="grid grid-cols-4 gap-2.5">
                      {[
                        { id: 'sky' as AccentId, label: 'Sky Blue', color: 'bg-sky-400' },
                        { id: 'emerald' as AccentId, label: 'Emerald Green', color: 'bg-emerald-400' },
                        { id: 'indigo' as AccentId, label: 'Indigo Violet', color: 'bg-indigo-400' },
                        { id: 'rose' as AccentId, label: 'Rose Red', color: 'bg-rose-400' },
                      ].map((acc) => (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => handleUpdateTheme({ accent: acc.id })}
                          className={`p-2.5 rounded-xl border text-left transition-all flex items-center space-x-2 ${
                            currentAccent === acc.id
                              ? 'bg-white/10 border-white/40 text-white shadow-sm'
                              : 'bg-[#0d1117] border-[#30363d] text-gray-400 hover:bg-[#21262d] hover:text-white'
                          }`}
                        >
                          <span className={`w-3 h-3 rounded-full ${acc.color}`} />
                          <span className="font-semibold text-xs text-gray-200">{acc.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* UI Font Scaling */}
                  <div className="space-y-2 pt-2 border-t border-[#30363d]">
                    <span className="font-semibold text-xs text-gray-200">{tr.fontSize || 'Font Scaling'}:</span>
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { id: 'compact' as FontSizeId, label: 'Compact', desc: '13px High-density UI' },
                        { id: 'default' as FontSizeId, label: 'Default', desc: '14px Balanced standard' },
                        { id: 'large' as FontSizeId, label: 'Large', desc: '15px High-readability' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleUpdateTheme({ fontSize: item.id })}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            uiFontSize === item.id
                              ? 'bg-sky-500/15 border-sky-500/50 text-white shadow-md'
                              : 'bg-[#0d1117] border-[#30363d] text-gray-400 hover:bg-[#21262d] hover:text-white'
                          }`}
                        >
                          <div className="font-bold text-xs text-gray-200">{item.label}</div>
                          <div className="text-[10px] text-gray-500 mt-0.5">{item.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Glassmorphism Presets */}
                  <div className="space-y-2 pt-2 border-t border-[#30363d]">
                    <span className="font-semibold text-xs text-gray-200">{tr.glassIntensity || 'Glass Intensity'}:</span>
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { id: 'ultra' as GlassStyleId, label: 'Ultra Glass', desc: 'Max blur & transparency' },
                        { id: 'frosted' as GlassStyleId, label: 'Balanced Frosted', desc: 'Optimized contrast' },
                        { id: 'solid' as GlassStyleId, label: 'Solid Dark', desc: 'Clean zero-blur' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleUpdateTheme({ glassStyle: item.id })}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            glassStyle === item.id
                              ? 'bg-sky-500/15 border-sky-500/50 text-white shadow-md'
                              : 'bg-[#0d1117] border-[#30363d] text-gray-400 hover:bg-[#21262d] hover:text-white'
                          }`}
                        >
                          <div className="font-bold text-xs text-gray-200">{item.label}</div>
                          <div className="text-[10px] text-gray-500 mt-0.5">{item.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Language Selection without redundant subtitles */}
                  <div className="space-y-2 pt-2 border-t border-[#30363d]">
                    <span className="font-semibold text-xs text-gray-200">{tr.language || 'Language'}:</span>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => onToggleLanguage && onToggleLanguage('en')}
                        className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                          currentLang === 'en'
                            ? 'bg-sky-500/15 border-sky-500/50 text-white shadow-md'
                            : 'bg-[#0d1117] border-[#30363d] text-gray-400 hover:bg-[#21262d] hover:text-white'
                        }`}
                      >
                        <div className="font-bold text-xs flex items-center space-x-2">
                          <Languages className="w-3.5 h-3.5 text-sky-400" />
                          <span>English</span>
                        </div>
                        {currentLang === 'en' && <Check className="w-3.5 h-3.5 text-sky-400" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleLanguage && onToggleLanguage('vi')}
                        className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                          currentLang === 'vi'
                            ? 'bg-sky-500/15 border-sky-500/50 text-white shadow-md'
                            : 'bg-[#0d1117] border-[#30363d] text-gray-400 hover:bg-[#21262d] hover:text-white'
                        }`}
                      >
                        <div className="font-bold text-xs flex items-center space-x-2">
                          <Languages className="w-3.5 h-3.5 text-sky-400" />
                          <span>Tiếng Việt</span>
                        </div>
                        {currentLang === 'vi' && <Check className="w-3.5 h-3.5 text-sky-400" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* KEYBOARD SHORTCUTS */}
            {activeCategory === 'shortcuts' && (
              <div className="space-y-4 animate-fade-in">
                <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] space-y-4 shadow-sm">
                  <div className="flex items-center space-x-2 border-b border-[#30363d] pb-3">
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
                        <div className="flex items-center justify-between p-2 rounded-lg bg-[#0d1117] border border-[#30363d]">
                          <span className="text-xs text-gray-300">Gửi tin nhắn</span>
                          <kbd className="px-2 py-0.5 rounded bg-[#21262d] text-white font-mono text-[10px] border border-[#30363d]">
                            Enter
                          </kbd>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-[#0d1117] border border-[#30363d]">
                          <span className="text-xs text-gray-300">Xuống dòng mới</span>
                          <kbd className="px-2 py-0.5 rounded bg-[#21262d] text-white font-mono text-[10px] border border-[#30363d]">
                            Shift + Enter
                          </kbd>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-[#0d1117] border border-[#30363d]">
                          <span className="text-xs text-gray-300">Tạo cuộc trò chuyện mới</span>
                          <kbd className="px-2 py-0.5 rounded bg-[#21262d] text-white font-mono text-[10px] border border-[#30363d]">
                            Ctrl + N
                          </kbd>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-[#0d1117] border border-[#30363d]">
                          <span className="text-xs text-gray-300">Đóng modal / Dừng stream</span>
                          <kbd className="px-2 py-0.5 rounded bg-[#21262d] text-white font-mono text-[10px] border border-[#30363d]">
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
                        <div className="flex items-center justify-between p-2 rounded-lg bg-[#0d1117] border border-[#30363d]">
                          <span className="text-xs text-gray-300">Bật/tắt Workspace Tools Panel</span>
                          <kbd className="px-2 py-0.5 rounded bg-[#21262d] text-white font-mono text-[10px] border border-[#30363d]">
                            Ctrl + B
                          </kbd>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-[#0d1117] border border-[#30363d]">
                          <span className="text-xs text-gray-300">Mở danh sách Local Skills</span>
                          <kbd className="px-2 py-0.5 rounded bg-[#21262d] text-white font-mono text-[10px] border border-[#30363d]">
                            / (Slash)
                          </kbd>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-[#0d1117] border border-[#30363d]">
                          <span className="text-xs text-gray-300">Tham chiếu file dự án (@mention)</span>
                          <kbd className="px-2 py-0.5 rounded bg-[#21262d] text-white font-mono text-[10px] border border-[#30363d]">
                            @ (At)
                          </kbd>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-[#0d1117] border border-[#30363d]">
                          <span className="text-xs text-gray-300">Mở cài đặt Studio</span>
                          <kbd className="px-2 py-0.5 rounded bg-[#21262d] text-white font-mono text-[10px] border border-[#30363d]">
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
                <div className="p-4 rounded-xl bg-[#161b22] border border-sky-500/30 space-y-3 shadow-sm">
                  <div className="flex items-center space-x-2">
                    <BookOpen className="w-5 h-5 text-sky-400" />
                    <span className="font-bold text-sm text-white">
                      {currentLang === 'vi' ? 'Cơ sở tri thức RAG Ngoại Tuyến là gì?' : 'What is Offline RAG?'}
                    </span>
                  </div>
                  <p className="text-[12px] text-gray-300 leading-relaxed">
                    {currentLang === 'vi' ? (
                      <>
                        <strong>RAG (Truy xuất tăng cường tạo nội dung)</strong> là phương thức tra cứu dữ liệu ngoại tuyến dành cho AI cục bộ. Thay vì phải tinh chỉnh mô hình, ứng dụng sẽ tự động phân tách tài liệu dự án thành các đoạn nhỏ, tạo chỉ mục vector cục bộ và trích xuất chính xác những đoạn liên quan nhất để đưa vào ngữ cảnh câu lệnh.
                      </>
                    ) : (
                      <>
                        <strong>RAG (Retrieval-Augmented Generation)</strong> is an "open-book exam" for local AI. Instead of training or fine-tuning, the app chunks your files, embeds them with a local model, and retrieves the most relevant snippets to inject into the prompt.
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* 7. About & App Updates */}
            {activeCategory === 'about' && (
              <div className="space-y-4 animate-fade-in">
                <div className="p-5 rounded-2xl bg-[#161b22] border border-[#30363d] space-y-4 shadow-sm">
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

                  <div className="pt-2 border-t border-[#30363d] flex items-center justify-between">
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
              </div>
            )}
          </div>
          )}

          {/* Bottom Actions Bar */}
          <div className="px-6 py-3 border-t border-[#30363d] bg-[#161b22] flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-md shadow-sky-500/20 transition-all"
            >
              {currentLang === 'vi' ? 'Hoàn tất & Lưu' : 'Done & Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Searchable & Typable Custom Model Picker Component
const SearchableModelPicker: React.FC<{
  label: string;
  desc: string;
  value: string;
  category: 'general' | 'coding' | 'reasoning' | 'vision';
  dropdownPosition?: 'up' | 'down';
  onChange: (val: string) => void;
}> = ({ label, desc, value, category, dropdownPosition = 'down', onChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  const categoryModels: Record<'general' | 'coding' | 'reasoning' | 'vision', Array<{ name: string; tag: string; icon: string }>> = {
    general: [
      { name: 'Qwen2.5-3B-Instruct-Q4_K_M.gguf', tag: 'Nhanh (3B)', icon: '⚡' },
      { name: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf', tag: 'Đa nhiệm (3B)', icon: '⚡' },
      { name: 'Phi-3.5-mini-instruct-Q4_K_M.gguf', tag: '3.8B', icon: '⚡' },
      { name: 'Mistral-7B-Instruct-v0.3-Q4_K_M.gguf', tag: '7B', icon: '⚡' },
    ],
    coding: [
      { name: 'Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf', tag: 'Lập trình (7B)', icon: '💻' },
      { name: 'Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf', tag: 'Lập trình (1.5B)', icon: '💻' },
      { name: 'Qwen2.5-Coder-14B-Instruct-Q4_K_M.gguf', tag: 'Lập trình (14B)', icon: '💻' },
    ],
    reasoning: [
      { name: 'DeepSeek-R1-Distill-Qwen-8B-Q4_K_M.gguf', tag: 'Suy luận (8B)', icon: '🧠' },
      { name: 'DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf', tag: 'Suy luận (1.5B)', icon: '🧠' },
      { name: 'Phi-3.5-mini-instruct-Q4_K_M.gguf', tag: 'Toán & Logic', icon: '🧠' },
    ],
    vision: [
      { name: 'Qwen2-VL-7B-Instruct-Q4_K_M.gguf', tag: 'Thị giác (7B)', icon: '👁️' },
      { name: 'llava-v1.6-7b-Q4_K_M.gguf', tag: 'Thị giác (7B)', icon: '👁️' },
    ],
  };

  const options = categoryModels[category] || categoryModels.general;
  const positionClass = dropdownPosition === 'up'
    ? 'bottom-full mb-1.5 right-0'
    : 'top-full mt-1.5 right-0';

  return (
    <div className="p-3.5 rounded-xl bg-[#161b22] border border-[#30363d] space-y-2 hover:border-[#388bfd]/30 transition-all shadow-sm">
      <div className="flex items-center justify-between">
        <span className="font-bold text-xs text-white">{label}</span>
      </div>
      <p className="text-[11px] text-gray-400 leading-relaxed">{desc}</p>

      <div className="relative">
        <div className="flex items-center rounded-lg bg-[#0d1117] border border-[#30363d] focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500/20 transition-all overflow-hidden">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Nhập tên file GGUF hoặc bấm Chọn..."
            className="flex-1 px-3 py-1.5 bg-transparent text-gray-200 font-mono text-xs focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#21262d] hover:bg-[#30363d] text-gray-300 hover:text-white border-l border-[#30363d] text-xs font-semibold transition-colors shrink-0"
            title="Chọn mô hình phù hợp"
          >
            <span className="text-[11px]">Chọn</span>
            <ChevronDown className={`w-3.5 h-3.5 text-sky-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setIsOpen(false)}
            />
            <div className={`absolute ${positionClass} w-full sm:w-96 max-h-60 overflow-y-auto bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl z-50 p-1.5 space-y-1 animate-slide-up backdrop-blur-xl`}>
              <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 border-b border-[#30363d] pb-1 flex items-center justify-between">
                <span>Mô hình tương thích ({options.length})</span>
                <span className="text-[9px] text-gray-500 font-mono">Bấm để gán</span>
              </div>
              {options.map((opt) => {
                const isSelected = value === opt.name;
                return (
                  <button
                    key={opt.name}
                    type="button"
                    onClick={() => {
                      onChange(opt.name);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors text-left group ${
                      isSelected
                        ? 'bg-sky-500/15 text-sky-300 font-semibold border border-sky-500/30'
                        : 'text-gray-300 hover:bg-[#21262d] hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate mr-2">
                      <span className="text-sm shrink-0">{opt.icon}</span>
                      <span className="font-mono text-[11px] truncate">{opt.name}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0d1117] text-gray-400 border border-[#30363d] font-mono">
                        {opt.tag}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
