import React, { useState, useEffect, useMemo } from 'react';
import type { ProviderConfig } from '../../types.js';
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
  Sparkles,
  Globe,
  Cpu,
  RefreshCw,
  Check,
  Zap,
  Sliders,
  BookOpen,
  Database,
  Package,
  Download,
  CheckCircle2,
  HardDrive,
  Palette,
  Keyboard,
  AlertTriangle,
  Languages,
  RotateCcw,
  Save,
  ChevronDown,
} from 'lucide-react';

import type {
  SettingsModalProps,
  SettingsCategory,
  EnrichedModelItem,
  ModelConfigFileState,
} from './settings/types.js';
import { ModelHubTab } from './settings/ModelHubTab.js';
import { HardwareTab } from './settings/HardwareTab.js';
import { SamplingTab } from './settings/SamplingTab.js';
import { SkillsTab } from './settings/SkillsTab.js';
import { ProvidersTab } from './settings/ProvidersTab.js';
import { StorageTab } from './settings/StorageTab.js';
import { ShortcutsTab } from './settings/ShortcutsTab.js';
import { ModelConfigModal } from './settings/ModelConfigModal.js';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  skills,
  skillFolders,
  providers,
  hardwareStats,
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

  const [activeCategory, setActiveCategory] = useState<SettingsCategory>(() => {
    return (localStorage.getItem('localai_settings_active_tab') as SettingsCategory) || 'models';
  });

  const handleSelectCategory = (cat: SettingsCategory) => {
    setActiveCategory(cat);
    localStorage.setItem('localai_settings_active_tab', cat);
  };

  // Delete confirmations
  const [deleteConfirmModel, setDeleteConfirmModel] = useState<EnrichedModelItem | null>(null);
  const [deleteConfirmProvider, setDeleteConfirmProvider] = useState<ProviderConfig | null>(null);

  // App updates state
  const [updateState, setUpdateState] = useState<{
    loading: boolean;
    result?: { currentVersion: string; latestVersion: string; hasUpdate: boolean; releaseNotes?: string; releaseUrl?: string };
  }>({ loading: false });

  // Sampling & Generation Parameters
  const [temperature, setTemperature] = useState(() => {
    return Number(localStorage.getItem('localai_temperature') || '0.6');
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
  const [autoApply, setAutoApply] = useState(() => {
    return localStorage.getItem('localai_auto_apply') === 'true';
  });
  const [defaultSystemPrompt, setDefaultSystemPrompt] = useState(() => {
    return (
      localStorage.getItem('localai_defaultSystemPrompt') ||
      'Bạn là LocalAI, chuyên gia lập trình và trợ lý AI cục bộ thông minh.\n' +
      'QUY TẮC BẮT BUỘC:\n' +
      '1. TUYỆT ĐỐI KHÔNG chào hỏi, không mở bài hay kết bài xã giao.\n' +
      '2. TUYỆT ĐỐI KHÔNG lặp lại câu hỏi hoặc tóm tắt lại prompt của người dùng.\n' +
      '3. Đi thẳng trực tiếp vào câu trả lời hoặc xuất code giải pháp hoàn chỉnh ngay lập tức.\n' +
      '4. Giữ nguyên thuật ngữ kỹ thuật, code, tên thư viện và cú pháp bằng tiếng Anh.\n' +
      '5. Giải thích cực kỳ súc tích dưới dạng các gạch đầu dòng ngắn gọn, không lan man.'
    );
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

  // Appearance & Themes
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

  // Model Hub & Downloader state
  const [hubModels, setHubModels] = useState<EnrichedModelItem[]>([]);
  const [selectedHubModel, setSelectedHubModel] = useState<EnrichedModelItem | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Global Hardware tuning for local-llama
  const activeLlamaProvider = providers.find((p) => p.id === 'local-llama' || p.type === 'llama-server');
  const [gpuLayers, setGpuLayers] = useState<number>(() => activeLlamaProvider?.gpuLayers ?? 21);
  const [contextSize, setContextSize] = useState<number>(() => activeLlamaProvider?.contextSize ?? 4096);
  const [cpuThreads, setCpuThreads] = useState<number>(() => activeLlamaProvider?.cpuThreads ?? 4);
  const [flashAttention, setFlashAttention] = useState<boolean>(() => activeLlamaProvider?.flashAttention ?? true);
  const [tuneApplied, setTuneApplied] = useState(false);

  // Per-Model Presets Configuration Modal State
  const [configModel, setConfigModel] = useState<EnrichedModelItem | null>(null);
  const [modelConfigForm, setModelConfigForm] = useState<ModelConfigFileState>({
    temperature: 0.3,
    topP: 0.85,
    repeatPenalty: 1.05,
    gpuLayers: 20,
    contextSize: 4096,
    systemPromptMode: 'standard',
  });
  const [modelConfigLoading, setModelConfigLoading] = useState(false);
  const [modelConfigSaved, setModelConfigSaved] = useState(false);

  // Sync settings when providers prop updates
  useEffect(() => {
    const p = providers.find((item) => item.id === 'local-llama' || item.type === 'llama-server');
    if (p) {
      if (p.gpuLayers !== undefined) setGpuLayers(p.gpuLayers);
      if (p.contextSize !== undefined) setContextSize(p.contextSize);
      if (p.cpuThreads !== undefined) setCpuThreads(p.cpuThreads);
      if (p.flashAttention !== undefined) setFlashAttention(p.flashAttention);
    }
  }, [isOpen, providers]);

  // Initial data loading
  useEffect(() => {
    if (!isOpen) return;
    fetch(getApiUrl('/api/models/hub'))
      .then((res) => res.json())
      .then((data) => {
        const models: EnrichedModelItem[] = data.models || [];
        setHubModels(models);
        if (models.length > 0 && !selectedHubModel) {
          setSelectedHubModel(models[0]);
        }
      })
      .catch(() => {});

    fetch(getApiUrl('/api/dialog/system-folders'))
      .then((res) => res.json())
      .then((data) => setSystemPaths(data))
      .catch(() => {});
  }, [isOpen]);

  // Esc key listener to close modals in hierarchical order
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (configModel) {
          setConfigModel(null);
        } else if (deleteConfirmModel) {
          setDeleteConfirmModel(null);
        } else if (deleteConfirmProvider) {
          setDeleteConfirmProvider(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, configModel, deleteConfirmModel, deleteConfirmProvider, onClose]);

  // State snapshot for detecting dirty fields and one-click reverting
  interface SettingsSnapshot {
    gpuLayers: number;
    contextSize: number;
    cpuThreads: number;
    flashAttention: boolean;
    temperature: number;
    topP: number;
    maxTokens: number;
    repeatPenalty: number;
    autoApply: boolean;
    defaultSystemPrompt: string;
    theme: ThemeId;
    accent: AccentId;
    glassStyle: GlassStyleId;
    fontSize: FontSizeId;
  }

  const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(null);
  const [allSavedToast, setAllSavedToast] = useState(false);
  const [showPendingChangesModal, setShowPendingChangesModal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const p = providers.find((item) => item.id === 'local-llama' || item.type === 'llama-server');
      const themeSettings = getSavedThemeSettings();
      setSnapshot({
        gpuLayers: p?.gpuLayers ?? 21,
        contextSize: p?.contextSize ?? 4096,
        cpuThreads: p?.cpuThreads ?? 4,
        flashAttention: p?.flashAttention ?? true,
        temperature: Number(localStorage.getItem('localai_temperature') || '0.6'),
        topP: Number(localStorage.getItem('localai_topP') || '0.9'),
        maxTokens: Number(localStorage.getItem('localai_maxTokens') || '4096'),
        repeatPenalty: Number(localStorage.getItem('localai_repeatPenalty') || '1.1'),
        autoApply: localStorage.getItem('localai_auto_apply') === 'true',
        defaultSystemPrompt:
          localStorage.getItem('localai_defaultSystemPrompt') || defaultSystemPrompt,
        theme: themeSettings.theme,
        accent: themeSettings.accent,
        glassStyle: themeSettings.glassStyle,
        fontSize: themeSettings.fontSize,
      });
    } else {
      setSnapshot(null);
    }
  }, [isOpen, providers, defaultSystemPrompt]);

  interface PendingChange {
    id: string;
    label: string;
    detail: string;
    revert: () => void;
  }

  const pendingChanges = useMemo<PendingChange[]>(() => {
    if (!snapshot) return [];
    const list: PendingChange[] = [];

    if (gpuLayers !== snapshot.gpuLayers) {
      list.push({
        id: 'gpuLayers',
        label: 'Layer GPU',
        detail: `${snapshot.gpuLayers} → ${gpuLayers}`,
        revert: () => setGpuLayers(snapshot.gpuLayers),
      });
    }
    if (contextSize !== snapshot.contextSize) {
      list.push({
        id: 'contextSize',
        label: 'Ngữ cảnh',
        detail: `${snapshot.contextSize} → ${contextSize}`,
        revert: () => setContextSize(snapshot.contextSize),
      });
    }
    if (cpuThreads !== snapshot.cpuThreads) {
      list.push({
        id: 'cpuThreads',
        label: 'Luồng CPU',
        detail: `${snapshot.cpuThreads} → ${cpuThreads}`,
        revert: () => setCpuThreads(snapshot.cpuThreads),
      });
    }
    if (flashAttention !== snapshot.flashAttention) {
      list.push({
        id: 'flashAttention',
        label: 'Flash Attention',
        detail: flashAttention ? 'Bật' : 'Tắt',
        revert: () => setFlashAttention(snapshot.flashAttention),
      });
    }
    if (temperature !== snapshot.temperature) {
      list.push({
        id: 'temperature',
        label: 'Nhiệt độ',
        detail: `${snapshot.temperature.toFixed(2)} → ${temperature.toFixed(2)}`,
        revert: () => setTemperature(snapshot.temperature),
      });
    }
    if (topP !== snapshot.topP) {
      list.push({
        id: 'topP',
        label: 'Top-P',
        detail: `${snapshot.topP.toFixed(2)} → ${topP.toFixed(2)}`,
        revert: () => setTopP(snapshot.topP),
      });
    }
    if (maxTokens !== snapshot.maxTokens) {
      list.push({
        id: 'maxTokens',
        label: 'Độ dài tối đa',
        detail: `${snapshot.maxTokens} → ${maxTokens}`,
        revert: () => setMaxTokens(snapshot.maxTokens),
      });
    }
    if (repeatPenalty !== snapshot.repeatPenalty) {
      list.push({
        id: 'repeatPenalty',
        label: 'Phạt lặp từ',
        detail: `${snapshot.repeatPenalty.toFixed(2)} → ${repeatPenalty.toFixed(2)}`,
        revert: () => setRepeatPenalty(snapshot.repeatPenalty),
      });
    }
    if (autoApply !== snapshot.autoApply) {
      list.push({
        id: 'autoApply',
        label: 'Tự động áp dụng',
        detail: autoApply ? 'Bật' : 'Tắt',
        revert: () => setAutoApply(snapshot.autoApply),
      });
    }
    if (defaultSystemPrompt !== snapshot.defaultSystemPrompt) {
      list.push({
        id: 'defaultSystemPrompt',
        label: 'Chỉ dẫn hệ thống',
        detail: 'Đã chỉnh sửa',
        revert: () => setDefaultSystemPrompt(snapshot.defaultSystemPrompt),
      });
    }
    if (
      currentTheme !== snapshot.theme ||
      currentAccent !== snapshot.accent ||
      glassStyle !== snapshot.glassStyle ||
      uiFontSize !== snapshot.fontSize
    ) {
      list.push({
        id: 'appearance',
        label: 'Giao diện & Chủ đề',
        detail: 'Tùy biến hiển thị',
        revert: () => {
          handleUpdateTheme({
            theme: snapshot.theme,
            accent: snapshot.accent,
            glassStyle: snapshot.glassStyle,
            fontSize: snapshot.fontSize,
          });
        },
      });
    }

    return list;
  }, [
    snapshot,
    gpuLayers,
    contextSize,
    cpuThreads,
    flashAttention,
    temperature,
    topP,
    maxTokens,
    repeatPenalty,
    autoApply,
    defaultSystemPrompt,
    currentTheme,
    currentAccent,
    glassStyle,
    uiFontSize,
  ]);

  // Actions
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
          filename: model.filename,
        }),
      });

      const interval = setInterval(async () => {
        const res = await fetch(getApiUrl('/api/models/downloads'));
        const tasks: any[] = await res.json();
        const myTask = tasks.find((t) => t.modelId === model.id);
        if (myTask) {
          setDownloadProgress((prev) => ({ ...prev, [model.id]: myTask.progressPercent }));
          if (myTask.status === 'completed') {
            clearInterval(interval);
            setDownloadingId(null);
            if (onSyncProvider) {
              onSyncProvider('local-llama');
            }
          }
        }
      }, 700);
    } catch {
      setDownloadingId(null);
    }
  };

  const handleDeleteModel = (model: EnrichedModelItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeleteConfirmModel(model);
  };

  const executeDeleteModel = async () => {
    if (!deleteConfirmModel) return;
    const model = deleteConfirmModel;
    setDeleteConfirmModel(null);

    setDownloadProgress((prev) => {
      const next = { ...prev };
      delete next[model.id];
      return next;
    });

    const localModels = providers.find((p) => p.id === 'local-llama')?.models || [];
    const targetFile =
      localModels.find((f) => {
        const fl = f.toLowerCase();
        return (
          fl === model.filename.toLowerCase() ||
          fl === `${model.id.toLowerCase()}.gguf` ||
          fl.includes(model.id.toLowerCase())
        );
      }) || model.filename;

    try {
      const res = await fetch(getApiUrl(`/api/models/local/${encodeURIComponent(targetFile)}`), {
        method: 'DELETE',
      });
      if (res.ok && onSyncProvider) {
        await onSyncProvider('local-llama');
      }
    } catch (err) {
      console.error('Failed to delete model file:', err);
    }
  };

  const executeDeleteProvider = async () => {
    if (!deleteConfirmProvider) return;
    const target = deleteConfirmProvider;
    setDeleteConfirmProvider(null);
    if (onDeleteProvider) {
      await onDeleteProvider(target.id);
    }
  };

  const handleSaveHardwareConfig = () => {
    const llamaProvider = providers.find((p) => p.id === 'local-llama' || p.type === 'llama-server');
    if (llamaProvider) {
      const updated: ProviderConfig = {
        ...llamaProvider,
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

  const handleSetActiveModel = (model: EnrichedModelItem) => {
    const llamaProvider = providers.find((p) => p.id === 'local-llama' || p.type === 'llama-server');
    if (llamaProvider) {
      const updated: ProviderConfig = {
        ...llamaProvider,
        selectedModel: model.filename,
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

  const handleOpenModelConfig = async (model: EnrichedModelItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setConfigModel(model);
    setModelConfigLoading(true);
    setModelConfigSaved(false);

    try {
      const res = await fetch(getApiUrl(`/api/models/config/${encodeURIComponent(model.filename)}`));
      if (res.ok) {
        const data = await res.json();
        setModelConfigForm({
          temperature: data.config.temperature ?? 0.3,
          topP: data.config.topP ?? 0.85,
          repeatPenalty: data.config.repeatPenalty ?? 1.05,
          gpuLayers: data.config.gpuLayers ?? 20,
          contextSize: data.config.contextSize ?? 4096,
          systemPromptMode: data.config.systemPromptMode ?? 'standard',
          description: data.defaults?.description,
        });
      }
    } catch (err) {
      console.error('Failed to load model config:', err);
    } finally {
      setModelConfigLoading(false);
    }
  };

  const handleSaveModelConfig = async () => {
    if (!configModel) return;
    setModelConfigLoading(true);
    try {
      await fetch(getApiUrl(`/api/models/config/${encodeURIComponent(configModel.filename)}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modelConfigForm),
      });
      setModelConfigSaved(true);
      setTimeout(() => {
        setModelConfigSaved(false);
        setConfigModel(null);
      }, 1200);
    } catch (err) {
      console.error('Failed to save model config:', err);
    } finally {
      setModelConfigLoading(false);
    }
  };

  const handleResetModelConfig = async () => {
    if (!configModel) return;
    setModelConfigLoading(true);
    try {
      await fetch(getApiUrl(`/api/models/config/${encodeURIComponent(configModel.filename)}`), {
        method: 'DELETE',
      });
      const res = await fetch(getApiUrl(`/api/models/config/${encodeURIComponent(configModel.filename)}`));
      if (res.ok) {
        const data = await res.json();
        setModelConfigForm({
          temperature: data.defaults.temperature,
          topP: data.defaults.topP,
          repeatPenalty: data.defaults.repeatPenalty,
          gpuLayers: data.defaults.recommendedNgl,
          contextSize: data.defaults.recommendedCtxSize,
          systemPromptMode: data.defaults.systemPromptMode,
          description: data.defaults.description,
        });
      }
    } catch (err) {
      console.error('Failed to reset model config:', err);
    } finally {
      setModelConfigLoading(false);
    }
  };

  const handleSaveInferenceParams = () => {
    localStorage.setItem('localai_temperature', String(temperature));
    localStorage.setItem('localai_topP', String(topP));
    localStorage.setItem('localai_maxTokens', String(maxTokens));
    localStorage.setItem('localai_repeatPenalty', String(repeatPenalty));
    localStorage.setItem('localai_defaultSystemPrompt', defaultSystemPrompt);
    localStorage.setItem('localai_auto_apply', String(autoApply));
    setParamSaved(true);
    setTimeout(() => setParamSaved(false), 2200);
  };



  const handleSaveAllChanges = () => {
    handleSaveHardwareConfig();
    handleSaveInferenceParams();

    const themeSettings = getSavedThemeSettings();
    setSnapshot({
      gpuLayers,
      contextSize,
      cpuThreads,
      flashAttention,
      temperature,
      topP,
      maxTokens,
      repeatPenalty,
      autoApply,
      defaultSystemPrompt,
      theme: themeSettings.theme,
      accent: themeSettings.accent,
      glassStyle: themeSettings.glassStyle,
      fontSize: themeSettings.fontSize,
    });

    setAllSavedToast(true);
    setTimeout(() => setAllSavedToast(false), 2500);
  };

  const handleOpenFolder = async (folderPath: string) => {
    try {
      await fetch(getApiUrl('/api/dialog/open-folder'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folderPath }),
      });
    } catch (err) {
      console.error('Failed to open folder:', err);
    }
  };

  const handleCheckUpdate = async () => {
    setUpdateState({ loading: true });
    try {
      const res = await fetch(getApiUrl('/api/app/check-update'));
      const data = await res.json();
      setUpdateState({ loading: false, result: data });
    } catch {
      setUpdateState({
        loading: false,
        result: {
          currentVersion: '1.0.5',
          latestVersion: '1.0.5',
          hasUpdate: false,
          releaseNotes: 'Phiên bản hiện tại là mới nhất hoặc chưa cấu hình remote repository.',
        },
      });
    }
  };

  const navItems = [
    {
      id: 'models' as SettingsCategory,
      label: tr.navModels || (currentLang === 'vi' ? 'Thư viện mô hình & Tải về' : 'Model Hub & Downloads'),
      icon: <Package className="w-4 h-4 text-emerald-400" />,
    },
    {
      id: 'cuda' as SettingsCategory,
      label: tr.navCuda || (currentLang === 'vi' ? 'Hiệu năng GPU VRAM & Phần cứng' : 'GPU & Hardware Tuner'),
      icon: <Cpu className="w-4 h-4 text-amber-400" />,
    },
    {
      id: 'inference' as SettingsCategory,
      label: tr.navInference || (currentLang === 'vi' ? 'Thông số suy luận mặc định' : 'Default Sampling & Tokens'),
      icon: <Sliders className="w-4 h-4 text-sky-400" />,
    },
    {
      id: 'skills' as SettingsCategory,
      label: tr.navSkills || (currentLang === 'vi' ? 'Kỹ năng & Công cụ cục bộ' : 'Local Skills & Tools'),
      icon: <Sparkles className="w-4 h-4 text-purple-400" />,
    },
    {
      id: 'storage' as SettingsCategory,
      label: tr.navStorage || (currentLang === 'vi' ? 'Quản lý lưu trữ & Đường dẫn' : 'Storage & System Paths'),
      icon: <HardDrive className="w-4 h-4 text-teal-400" />,
    },
    {
      id: 'appearance' as SettingsCategory,
      label: tr.navAppearance || (currentLang === 'vi' ? 'Giao diện & Chủ đề' : 'Appearance & UI Theme'),
      icon: <Palette className="w-4 h-4 text-pink-400" />,
    },
    {
      id: 'shortcuts' as SettingsCategory,
      label: tr.navShortcuts || (currentLang === 'vi' ? 'Phím tắt thao tác' : 'Keyboard Shortcuts'),
      icon: <Keyboard className="w-4 h-4 text-yellow-400" />,
    },
    {
      id: 'providers' as SettingsCategory,
      label: tr.navProviders || (currentLang === 'vi' ? 'Nhà cung cấp & API Keys' : 'API Keys & Providers'),
      icon: <Globe className="w-4 h-4 text-sky-400" />,
    },
    {
      id: 'rag' as SettingsCategory,
      label: tr.navRag || (currentLang === 'vi' ? 'Cơ sở tri thức RAG Ngoại tuyến' : 'Offline RAG & Vectors'),
      icon: <BookOpen className="w-4 h-4 text-indigo-400" />,
    },
    {
      id: 'about' as SettingsCategory,
      label: tr.navAbout || (currentLang === 'vi' ? 'Thông tin ứng dụng & Cập nhật' : 'About & Updates'),
      icon: <Zap className="w-4 h-4 text-amber-400" />,
    },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0d1117] flex overflow-hidden">
      <div className="w-full h-full bg-[#0d1117] flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <div className="w-64 sm:w-72 bg-[#161b22] border-r border-[#30363d] flex flex-col justify-between shrink-0">
          <div>
            <div className="p-4 border-b border-[#30363d] flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-bold text-sm text-white tracking-tight leading-tight">
                    {tr.settingsAndHardware || (currentLang === 'vi' ? 'Cài đặt Studio' : 'Studio Settings')}
                  </h2>
                  <p className="text-[10px] text-gray-400">LocalAI Workstation</p>
                </div>
              </div>
            </div>

            <nav className="p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)] custom-scrollbar">
              {navItems.map((item) => {
                const isActive = activeCategory === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectCategory(item.id)}
                    className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left ${
                      isActive
                        ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-sm'
                        : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-3 border-t border-[#30363d] text-[11px] text-gray-500 flex items-center justify-between">
            <span>LocalAI v1.0.5</span>
          </div>
        </div>

        {/* Right Main Content Pane */}
        <div className="flex-1 flex flex-col bg-[#0d1117] overflow-hidden">
          {/* Header */}
          <div className="h-12 px-6 border-b border-[#30363d] bg-[#161b22] flex items-center justify-between shrink-0 gap-3">
            <span className="text-xs font-bold text-gray-200 shrink-0">
              {navItems.find((n) => n.id === activeCategory)?.label}
            </span>

            {/* Changes Indicator & Revert Dropdown / Table */}
            <div className="relative flex items-center space-x-2 shrink-0">
              {pendingChanges.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowPendingChangesModal(!showPendingChangesModal)}
                    className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-all shadow-sm"
                    title={currentLang === 'vi' ? 'Xem bảng các thay đổi chưa lưu' : 'View unsaved changes'}
                  >
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span>
                      {currentLang === 'vi' ? 'Đã sửa' : 'Modified'} ({pendingChanges.length})
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-amber-400 transition-transform ${
                        showPendingChangesModal ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Fixed Size Scrollable Table Popover */}
                  {showPendingChangesModal && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowPendingChangesModal(false)}
                      />
                      <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[#161b22] border border-[#30363d] rounded-2xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl">
                        {/* Table Header */}
                        <div className="px-3.5 py-2.5 bg-[#0d1117] border-b border-[#30363d] flex items-center justify-between">
                          <div className="flex items-center space-x-1.5">
                            <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
                            <span className="text-xs font-bold text-white">
                              {currentLang === 'vi' ? 'Tùy chọn đã thay đổi' : 'Unsaved Changes'}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              ({pendingChanges.length})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              pendingChanges.forEach((c) => c.revert());
                              setShowPendingChangesModal(false);
                            }}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold transition-colors flex items-center space-x-1"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span>{currentLang === 'vi' ? 'Hoàn tác tất cả' : 'Revert All'}</span>
                          </button>
                        </div>

                        {/* Table Body - Fixed max height with smooth scrolling */}
                        <div className="max-h-64 overflow-y-auto divide-y divide-[#30363d]/50 custom-scrollbar p-1">
                          {pendingChanges.map((change) => (
                            <div
                              key={change.id}
                              className="px-3 py-2 flex items-center justify-between text-xs hover:bg-[#21262d]/60 rounded-lg transition-colors group"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="font-semibold text-gray-200 text-xs">
                                  {change.label}
                                </div>
                                <div className="text-[11px] text-amber-300 font-mono truncate">
                                  {change.detail}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={change.revert}
                                className="px-2 py-1 rounded-md bg-[#21262d] group-hover:bg-rose-500/20 text-gray-400 group-hover:text-rose-300 border border-[#30363d] text-[10px] font-semibold shrink-0 transition-colors flex items-center space-x-1"
                                title={currentLang === 'vi' ? 'Hoàn tác mục này' : 'Revert this change'}
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>{currentLang === 'vi' ? 'Hoàn tác' : 'Revert'}</span>
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Table Footer */}
                        <div className="px-3 py-2 bg-[#0d1117] border-t border-[#30363d] text-[10px] text-gray-400 flex items-center justify-between font-mono">
                          <span>{currentLang === 'vi' ? 'Cuộn xem toàn bộ danh sách' : 'Scroll inside to view all'}</span>
                          <span className="text-gray-500">LocalAI Studio</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-2.5 py-1 rounded-lg hover:bg-[#30363d] text-gray-400 hover:text-white transition-colors flex items-center space-x-1.5 shrink-0"
                title="Đóng (Esc)"
              >
                <span className="text-[10px] font-mono text-gray-500">Esc</span>
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tab Content Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
            {activeCategory === 'models' && (
              <ModelHubTab
                hubModels={hubModels}
                setHubModels={setHubModels}
                selectedHubModel={selectedHubModel}
                setSelectedHubModel={setSelectedHubModel}
                providers={providers}
                hardwareStats={hardwareStats}
                gpuLayers={gpuLayers}
                downloadProgress={downloadProgress}
                downloadingId={downloadingId}
                onDownloadModel={handleStartDownload}
                onDeleteModel={handleDeleteModel}
                onSetActiveModel={handleSetActiveModel}
                onOpenModelConfig={handleOpenModelConfig}
                systemPaths={systemPaths}
                onOpenFolder={handleOpenFolder}
                currentLang={currentLang}
                onSyncProvider={onSyncProvider}
              />
            )}

            {activeCategory === 'cuda' && (
              <HardwareTab
                hardwareStats={hardwareStats}
                gpuLayers={gpuLayers}
                setGpuLayers={setGpuLayers}
                contextSize={contextSize}
                setContextSize={setContextSize}
                cpuThreads={cpuThreads}
                setCpuThreads={setCpuThreads}
                flashAttention={flashAttention}
                setFlashAttention={setFlashAttention}
                onSaveHardwareConfig={handleSaveHardwareConfig}
                tuneApplied={tuneApplied}
                currentLang={currentLang}
              />
            )}

            {activeCategory === 'inference' && (
              <SamplingTab
                temperature={temperature}
                setTemperature={setTemperature}
                topP={topP}
                setTopP={setTopP}
                maxTokens={maxTokens}
                setMaxTokens={setMaxTokens}
                repeatPenalty={repeatPenalty}
                setRepeatPenalty={setRepeatPenalty}
                autoApply={autoApply}
                setAutoApply={setAutoApply}
                defaultSystemPrompt={defaultSystemPrompt}
                setDefaultSystemPrompt={setDefaultSystemPrompt}
                onSave={handleSaveInferenceParams}
                paramSaved={paramSaved}
                currentLang={currentLang}
              />
            )}

            {activeCategory === 'skills' && (
              <SkillsTab
                skills={skills}
                onAddSkillFolder={onAddSkillFolder}
                currentLang={currentLang}
              />
            )}

            {activeCategory === 'storage' && (
              <StorageTab
                systemPaths={systemPaths}
                onOpenFolder={handleOpenFolder}
                currentLang={currentLang}
              />
            )}

            {activeCategory === 'appearance' && (
              <div className="space-y-4 animate-fade-in max-w-4xl">
                <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] space-y-4 shadow-sm">
                  <div className="flex items-center space-x-2 border-b border-[#30363d] pb-3">
                    <Palette className="w-4 h-4 text-pink-400" />
                    <div>
                      <span className="font-bold text-sm text-white">
                        {currentLang === 'vi' ? 'Giao diện & Chủ đề không gian làm việc' : 'Appearance & Workspace Themes'}
                      </span>
                      <p className="text-[11px] text-gray-400">
                        {currentLang === 'vi' ? 'Tùy biến chủ đề hiển thị, màu nhấn và cỡ chữ' : 'Customize visual theme, accent colors, and font scaling'}
                      </p>
                    </div>
                  </div>

                  {/* Themes */}
                  <div className="space-y-2">
                    <span className="font-semibold text-xs text-gray-200">
                      {currentLang === 'vi' ? 'Chủ đề giao diện:' : 'Studio Theme:'}
                    </span>
                    <div className="grid grid-cols-4 gap-2.5">
                      {[
                        {
                          id: 'charcoal' as ThemeId,
                          label: currentLang === 'vi' ? 'Tối Than Chì' : 'Charcoal Dark',
                          desc: currentLang === 'vi' ? 'Mặc định Studio' : 'Default studio look',
                          bg: '#0d1117',
                        },
                        {
                          id: 'midnight' as ThemeId,
                          label: currentLang === 'vi' ? 'Xanh Đêm Thẳm' : 'Midnight Blue',
                          desc: currentLang === 'vi' ? 'Sắc lam chìm êm dịu' : 'Deep navy undertone',
                          bg: '#080c14',
                        },
                        {
                          id: 'obsidian' as ThemeId,
                          label: currentLang === 'vi' ? 'Đen Thuần OLED' : 'Obsidian OLED',
                          desc: currentLang === 'vi' ? 'Đen sâu tiết kiệm pin' : 'True pure black',
                          bg: '#000000',
                        },
                        {
                          id: 'slate' as ThemeId,
                          label: currentLang === 'vi' ? 'Xám Đá Phiến' : 'Slate Gray',
                          desc: currentLang === 'vi' ? 'Hiện đại thanh lịch' : 'Modern cool gray',
                          bg: '#0f172a',
                        },
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
                    <span className="font-semibold text-xs text-gray-200">
                      {currentLang === 'vi' ? 'Màu sắc điểm nhấn:' : 'Accent Color:'}
                    </span>
                    <div className="grid grid-cols-4 gap-2.5">
                      {[
                        { id: 'sky' as AccentId, label: currentLang === 'vi' ? 'Xanh Dương' : 'Sky Blue', color: 'bg-sky-400' },
                        { id: 'emerald' as AccentId, label: currentLang === 'vi' ? 'Xanh Lục Bảo' : 'Emerald Green', color: 'bg-emerald-400' },
                        { id: 'indigo' as AccentId, label: currentLang === 'vi' ? 'Tím Chàm' : 'Indigo Violet', color: 'bg-indigo-400' },
                        { id: 'rose' as AccentId, label: currentLang === 'vi' ? 'Đỏ Hoa Hồng' : 'Rose Red', color: 'bg-rose-400' },
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
                    <span className="font-semibold text-xs text-gray-200">
                      {tr.fontSize?.replace(/:+$/, '') || (currentLang === 'vi' ? 'Tỷ lệ cỡ chữ giao diện' : 'Font Scaling')}:
                    </span>
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        {
                          id: 'compact' as FontSizeId,
                          label: currentLang === 'vi' ? 'Tinh gọn (13px)' : 'Compact (13px)',
                          desc: currentLang === 'vi' ? 'Mật độ cao, hiển thị nhiều nội dung' : '13px High-density UI',
                        },
                        {
                          id: 'default' as FontSizeId,
                          label: currentLang === 'vi' ? 'Tiêu chuẩn (14px)' : 'Default (14px)',
                          desc: currentLang === 'vi' ? 'Cân bằng chuẩn giao diện Studio' : '14px Balanced standard',
                        },
                        {
                          id: 'large' as FontSizeId,
                          label: currentLang === 'vi' ? 'Cỡ lớn (15px)' : 'Large (15px)',
                          desc: currentLang === 'vi' ? 'Dễ đọc, rõ ràng khoảng cách' : '15px High-readability',
                        },
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
                    <span className="font-semibold text-xs text-gray-200">
                      {tr.glassIntensity?.replace(/:+$/, '') || (currentLang === 'vi' ? 'Mức độ hiệu ứng kính mờ' : 'Glass Intensity')}:
                    </span>
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        {
                          id: 'ultra' as GlassStyleId,
                          label: currentLang === 'vi' ? 'Kính mờ cao' : 'Ultra Glass',
                          desc: currentLang === 'vi' ? 'Độ mờ & trong suốt tối đa' : 'Max blur & transparency',
                        },
                        {
                          id: 'frosted' as GlassStyleId,
                          label: currentLang === 'vi' ? 'Sương mờ cân đối' : 'Balanced Frosted',
                          desc: currentLang === 'vi' ? 'Độ tương phản tối ưu' : 'Optimized contrast',
                        },
                        {
                          id: 'solid' as GlassStyleId,
                          label: currentLang === 'vi' ? 'Tối phẳng' : 'Solid Dark',
                          desc: currentLang === 'vi' ? 'Đơn sắc thuần túy, không mờ' : 'Clean zero-blur',
                        },
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

                  {/* Language Selection */}
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

            {activeCategory === 'shortcuts' && (
              <ShortcutsTab currentLang={currentLang} />
            )}

            {activeCategory === 'providers' && (
              <ProvidersTab
                providers={providers}
                onSaveProvider={onSaveProvider}
                onDeleteProvider={onDeleteProvider}
                onSyncProvider={onSyncProvider}
                setDeleteConfirmProvider={setDeleteConfirmProvider}
                currentLang={currentLang}
              />
            )}

            {activeCategory === 'rag' && (
              <div className="space-y-4 animate-fade-in max-w-4xl">
                <div className="p-4 rounded-xl bg-[#161b22] border border-sky-500/30 space-y-3 shadow-sm">
                  <div className="flex items-center space-x-2">
                    <BookOpen className="w-5 h-5 text-sky-400" />
                    <span className="font-bold text-sm text-white">
                      {currentLang === 'vi' ? 'Cơ sở tri thức RAG Ngoại tuyến' : 'Offline Vector & Keyword RAG'}
                    </span>
                  </div>
                  <p className="text-[12px] text-gray-300 leading-relaxed">
                    {currentLang === 'vi' ? (
                      <>
                        <strong>RAG (Truy xuất tăng cường tạo nội dung)</strong> là phương thức tra cứu dữ liệu ngoại tuyến tối ưu cho AI cục bộ. Hệ thống tự động phân tách tài liệu dự án thành các đoạn trích 25 dòng có độ gối đầu, đánh chỉ số từ khóa và trích xuất chính xác những đoạn mã liên quan nhất để đưa vào ngữ cảnh câu lệnh mà <strong>không tiêu tốn thêm VRAM GPU</strong>.
                      </>
                    ) : (
                      <>
                        <strong>RAG (Retrieval-Augmented Generation)</strong> retrieves local project snippets to inject into LLM prompts without requiring extra GPU VRAM or cloud embeddings. Files are indexed using 25-line sliding windows and ranked via BM25 relevance.
                      </>
                    )}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] space-y-3 shadow-sm">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-gray-200">
                    <Database className="w-4 h-4 text-indigo-400" />
                    <span>{currentLang === 'vi' ? 'Thông số kỹ thuật bộ máy RAG' : 'RAG Engine Specifications'}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="p-3 rounded-lg bg-[#0d1117] border border-[#30363d]/60 space-y-1">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                        {currentLang === 'vi' ? 'Cơ chế tính điểm' : 'Scoring Algorithm'}
                      </span>
                      <p className="font-mono text-white text-xs font-semibold">
                        BM25 + Exact Phrase Boost
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {currentLang === 'vi' ? 'Ưu tiên cụm từ chính xác và mật độ từ khóa' : 'Weighted term frequency & exact string matches'}
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-[#0d1117] border border-[#30363d]/60 space-y-1">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                        {currentLang === 'vi' ? 'Kích thước phân đoạn' : 'Chunk Window'}
                      </span>
                      <p className="font-mono text-white text-xs font-semibold">
                        25 lines (5 lines overlap)
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {currentLang === 'vi' ? 'Bảo toàn ngữ cảnh hàm và khối lệnh' : 'Preserves function & block context'}
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-[#0d1117] border border-[#30363d]/60 space-y-1">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                        {currentLang === 'vi' ? 'Tài nguyên tiêu thụ' : 'Resource Impact'}
                      </span>
                      <p className="font-mono text-emerald-400 text-xs font-semibold">
                        0 MB VRAM / Zero GPU Load
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {currentLang === 'vi' ? 'Chạy CPU đa luồng cực nhanh' : 'Instant in-memory execution'}
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-[#0d1117] border border-[#30363d]/60 space-y-1">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                        {currentLang === 'vi' ? 'Bộ lọc an toàn' : 'Safety Filter'}
                      </span>
                      <p className="font-mono text-white text-xs font-semibold">
                        Auto-ignore .git, node_modules, binaries
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {currentLang === 'vi' ? 'Bỏ qua file nén, ảnh, file > 500KB' : 'Ignores build artifacts and huge files'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] space-y-2 text-xs">
                  <div className="flex items-center space-x-2 font-semibold text-gray-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{currentLang === 'vi' ? 'Cách sử dụng trong ứng dụng' : 'How to Use'}</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-gray-300 text-[11px] leading-relaxed pl-1">
                    <li>
                      {currentLang === 'vi'
                        ? 'Mở thanh công cụ bên phải (nhấp biểu tượng Tools ở góc phải trên).'
                        : 'Open the right sidebar panel (click the Tools button top-right).'}
                    </li>
                    <li>
                      {currentLang === 'vi'
                        ? 'Chuyển sang tab "Tri thức RAG" (Offline Vector RAG).'
                        : 'Switch to the "RAG" tab.'}
                    </li>
                    <li>
                      {currentLang === 'vi'
                        ? 'Nhập từ khóa, tên hàm hoặc vấn đề cần tìm rồi ấn "Tìm kiếm".'
                        : 'Enter query keywords, symbol names or phrases and click search.'}
                    </li>
                    <li>
                      {currentLang === 'vi'
                        ? 'Nhấp "Ghim vào Chat" trên đoạn mã tìm thấy để tự động đưa vào ngữ cảnh của câu lệnh tiếp theo.'
                        : 'Click "Pin to Chat" to inject relevant snippets into the LLM context.'}
                    </li>
                  </ol>
                </div>
              </div>
            )}

            {activeCategory === 'about' && (
              <div className="space-y-4 animate-fade-in max-w-4xl">
                <div className="p-5 rounded-2xl bg-[#161b22] border border-[#30363d] space-y-4 shadow-sm">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-slate-950 font-black text-lg shadow-md">
                      ⚡
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white">LocalAI Desktop Studio</h3>
                      <p className="text-xs text-gray-400 font-mono">v1.0.5 • Embedded llama.cpp & CUDA Engine</p>
                    </div>
                  </div>

                  <p className="text-xs text-gray-300 leading-relaxed">
                    {currentLang === 'vi'
                      ? 'LocalAI là nền tảng máy trạm AI cục bộ độc lập, tích hợp bộ tăng tốc phần cứng thông minh cho GPU 4GB VRAM (GTX 1650), thư viện mô hình mã nguồn mở và hệ thống Local Skills.'
                      : 'LocalAI is an independent local AI desktop workstation, integrating intelligent hardware acceleration for 4GB VRAM GPUs (GTX 1650), open source model hub, and Local Skills system.'}
                  </p>

                  <div className="pt-2 border-t border-[#30363d] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-gray-200">
                          {currentLang === 'vi' ? 'Kiểm tra bản cập nhật mới' : 'Check for Updates'}
                        </span>
                        <p className="text-[11px] text-gray-400">
                          {updateState.result
                            ? updateState.result.hasUpdate
                              ? `Đã có bản cập nhật mới: v${updateState.result.latestVersion} (Hiện tại: v${updateState.result.currentVersion})`
                              : `Bạn đang ở phiên bản mới nhất (v${updateState.result.currentVersion})`
                            : 'Kiểm tra phiên bản mới từ GitHub Releases'}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {updateState.result?.hasUpdate && updateState.result.releaseUrl && (
                          <a
                            href={updateState.result.releaseUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center space-x-1.5"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Tải bản mới ({updateState.result.latestVersion})</span>
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={handleCheckUpdate}
                          disabled={updateState.loading}
                          className="px-3.5 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-semibold transition-all disabled:opacity-50 flex items-center space-x-1.5"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${updateState.loading ? 'animate-spin' : ''}`} />
                          <span>{updateState.loading ? 'Đang kiểm tra...' : 'Kiểm tra cập nhật'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Actions Bar: Single unified save button */}
          <div className="px-6 py-3 border-t border-[#30363d] bg-[#161b22] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {allSavedToast && (
                <div className="flex items-center space-x-1.5 text-emerald-400 text-xs font-semibold animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>
                    {currentLang === 'vi'
                      ? 'Đã lưu tất cả thay đổi cấu hình thành công!'
                      : 'All changes saved successfully!'}
                  </span>
                </div>
              )}
              {!allSavedToast && pendingChanges.length > 0 && (
                <span className="text-[11px] text-amber-400 font-medium">
                  {currentLang === 'vi'
                    ? `Có ${pendingChanges.length} tùy chọn đã thay đổi chưa lưu.`
                    : `${pendingChanges.length} unsaved changes.`}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-[#30363d] transition-colors"
              >
                {currentLang === 'vi' ? 'Đóng' : 'Close'}
              </button>

              <button
                type="button"
                onClick={handleSaveAllChanges}
                className={`px-6 py-2 rounded-xl font-bold text-xs shadow-md transition-all flex items-center space-x-2 ${
                  pendingChanges.length > 0
                    ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sky-500/25 ring-2 ring-sky-400/50'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                <span>
                  {pendingChanges.length > 0
                    ? currentLang === 'vi'
                      ? `Lưu thay đổi (${pendingChanges.length})`
                      : `Save Changes (${pendingChanges.length})`
                    : currentLang === 'vi'
                    ? 'Lưu thay đổi'
                    : 'Save Changes'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal: Delete Model from Disk */}
      {deleteConfirmModel && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteConfirmModel(null);
          }}
        >
          <div className="w-full max-w-md bg-[#161b22] border border-rose-500/40 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">
                  {currentLang === 'vi' ? 'Xác nhận xóa mô hình' : 'Delete Model File'}
                </h3>
                <p className="text-[11px] text-gray-400 font-mono truncate max-w-[280px]">
                  {deleteConfirmModel.name}
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              {currentLang === 'vi'
                ? 'Hành động này sẽ xóa vĩnh viễn tệp mô hình GGUF khỏi ổ cứng máy tính và giải phóng dung lượng lưu trữ. Bạn có chắc chắn muốn tiếp tục?'
                : 'This will permanently remove the GGUF model file from your local disk and free up storage space. Are you sure you want to proceed?'}
            </p>

            <div className="p-3 rounded-lg bg-[#0d1117] border border-[#30363d] space-y-1 font-mono text-[11px]">
              <div className="text-gray-400 flex justify-between">
                <span>File:</span>
                <span className="text-white truncate max-w-[260px]">{deleteConfirmModel.filename}</span>
              </div>
              <div className="text-gray-400 flex justify-between">
                <span>Size:</span>
                <span className="text-white">{(deleteConfirmModel.fileSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB</span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmModel(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#30363d] transition-colors"
              >
                {currentLang === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={executeDeleteModel}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-400 text-white shadow-md shadow-rose-500/20 transition-all flex items-center space-x-1.5"
              >
                <span>{currentLang === 'vi' ? 'Xóa khỏi đĩa' : 'Delete from Disk'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Provider */}
      {deleteConfirmProvider && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteConfirmProvider(null);
          }}
        >
          <div className="w-full max-w-md bg-[#161b22] border border-rose-500/40 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">
                  {currentLang === 'vi' ? 'Xác nhận xóa nhà cung cấp' : 'Delete Provider'}
                </h3>
                <p className="text-[11px] text-gray-400 font-mono truncate max-w-[280px]">
                  {deleteConfirmProvider.name}
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              {currentLang === 'vi'
                ? 'Hành động này sẽ xóa cấu hình nhà cung cấp dịch vụ suy luận này khỏi ứng dụng. Bạn có chắc chắn muốn tiếp tục?'
                : 'This will remove this inference provider configuration from your workspace. Are you sure you want to proceed?'}
            </p>

            <div className="p-3 rounded-lg bg-[#0d1117] border border-[#30363d] space-y-1 font-mono text-[11px]">
              <div className="text-gray-400 flex justify-between">
                <span>Endpoint:</span>
                <span className="text-white truncate max-w-[260px]">{deleteConfirmProvider.baseUrl}</span>
              </div>
              <div className="text-gray-400 flex justify-between">
                <span>Type:</span>
                <span className="text-white uppercase">{deleteConfirmProvider.type}</span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmProvider(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#30363d] transition-colors"
              >
                {currentLang === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={executeDeleteProvider}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-400 text-white shadow-md shadow-rose-500/20 transition-all flex items-center space-x-1.5"
              >
                <span>{currentLang === 'vi' ? 'Xác nhận xóa' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Model Config */}
      <ModelConfigModal
        configModel={configModel}
        onClose={() => setConfigModel(null)}
        modelConfigForm={modelConfigForm}
        setModelConfigForm={setModelConfigForm}
        modelConfigLoading={modelConfigLoading}
        modelConfigSaved={modelConfigSaved}
        onSave={handleSaveModelConfig}
        onReset={handleResetModelConfig}
      />
    </div>
  );
};
