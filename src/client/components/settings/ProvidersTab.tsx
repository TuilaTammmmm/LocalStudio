import React, { useState, useEffect } from 'react';
import { Globe, Plus, X, Check, RefreshCw, Trash2, Eye, EyeOff, Save, CheckCircle2 } from 'lucide-react';
import type { ProviderConfig, ProviderType } from '../../../types.js';

interface ProvidersTabProps {
  providers: ProviderConfig[];
  onSaveProvider: (provider: ProviderConfig) => void;
  onDeleteProvider?: (id: string) => Promise<void>;
  onSyncProvider: (id: string) => Promise<any>;
  setDeleteConfirmProvider: (p: ProviderConfig | null) => void;
  currentLang: string;
}

export const ProvidersTab: React.FC<ProvidersTabProps> = ({
  providers,
  onSaveProvider,
  onSyncProvider,
  setDeleteConfirmProvider,
  currentLang,
}) => {
  const externalProviders = providers.filter((p) => p.id !== 'local-llama');
  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    externalProviders[0]?.id || ''
  );

  const currentProvider =
    externalProviders.find((p) => p.id === selectedProviderId) || externalProviders[0] || null;

  // Add new provider form state
  const [isAddingProvider, setIsAddingProvider] = useState(false);
  const [newProviderName, setNewProviderName] = useState('');
  const [newProviderType, setNewProviderType] = useState<ProviderType>('ollama');
  const [newProviderBaseUrl, setNewProviderBaseUrl] = useState('http://127.0.0.1:11434/v1');
  const [newProviderApiKey, setNewProviderApiKey] = useState('');
  const [newProviderModel, setNewProviderModel] = useState('');
  const [showNewApiKey, setShowNewApiKey] = useState(false);

  // Edit current provider state
  const [editName, setEditName] = useState('');
  const [editBaseUrl, setEditBaseUrl] = useState('');
  const [editApiKey, setEditApiKey] = useState('');
  const [editSelectedModel, setEditSelectedModel] = useState('');
  const [showEditApiKey, setShowEditApiKey] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync / fetch state
  const [syncStatus, setSyncStatus] = useState<
    Record<string, { loading: boolean; error?: string; success?: boolean; count?: number }>
  >({});

  // Sync edit state whenever currentProvider changes
  useEffect(() => {
    if (currentProvider) {
      setEditName(currentProvider.name);
      setEditBaseUrl(currentProvider.baseUrl);
      setEditApiKey(currentProvider.apiKey || '');
      setEditSelectedModel(currentProvider.selectedModel || '');
      setSaveSuccess(false);
    }
  }, [currentProvider?.id]);

  const handleAddNewProvider = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProviderName || !newProviderBaseUrl) return;

    const newProvider: ProviderConfig = {
      id: `provider-${Date.now()}`,
      name: newProviderName,
      type: newProviderType,
      baseUrl: newProviderBaseUrl.trim(),
      apiKey: newProviderApiKey.trim() || undefined,
      selectedModel: newProviderModel.trim() || 'default',
      models: newProviderModel ? [newProviderModel.trim()] : [],
      enabled: true,
      isDefault: false,
    };

    onSaveProvider(newProvider);
    setIsAddingProvider(false);
    setSelectedProviderId(newProvider.id);
    setNewProviderName('');
    setNewProviderApiKey('');
    setNewProviderModel('');
  };

  const handleSaveCurrentProvider = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentProvider) return;

    const updated: ProviderConfig = {
      ...currentProvider,
      name: editName.trim() || currentProvider.name,
      baseUrl: editBaseUrl.trim() || currentProvider.baseUrl,
      apiKey: editApiKey.trim() || undefined,
      selectedModel: editSelectedModel.trim() || currentProvider.selectedModel,
    };

    onSaveProvider(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2200);
  };

  const handleSync = async (id: string) => {
    if (!currentProvider) return;

    // First ensure latest typed base URL and API key are saved before testing
    const updated: ProviderConfig = {
      ...currentProvider,
      name: editName.trim() || currentProvider.name,
      baseUrl: editBaseUrl.trim() || currentProvider.baseUrl,
      apiKey: editApiKey.trim() || undefined,
      selectedModel: editSelectedModel.trim() || currentProvider.selectedModel,
    };
    onSaveProvider(updated);

    setSyncStatus((prev) => ({ ...prev, [id]: { loading: true } }));
    try {
      const res = await onSyncProvider(id);
      if (res && res.success) {
        const modelList: string[] = res.models || [];
        setSyncStatus((prev) => ({
          ...prev,
          [id]: { loading: false, success: true, count: modelList.length },
        }));
        if (modelList.length > 0 && (!editSelectedModel || !modelList.includes(editSelectedModel))) {
          setEditSelectedModel(modelList[0]);
        }
      } else {
        setSyncStatus((prev) => ({
          ...prev,
          [id]: { loading: false, error: res?.error || 'Không thể kết nối đến nhà cung cấp' },
        }));
      }
    } catch (err: any) {
      setSyncStatus((prev) => ({
        ...prev,
        [id]: { loading: false, error: err.message || 'Lỗi kết nối' },
      }));
    }
  };

  return (
    <div className="space-y-4 animate-fade-in max-w-4xl">
      {/* Header & Add Button */}
      <div className="flex items-center justify-between pb-1">
        <div>
          <h3 className="text-xs font-bold text-white">
            {currentLang === 'vi' ? 'Nhà cung cấp & Cổng kết nối API' : 'Inference Providers & Endpoints'}
          </h3>
          <p className="text-[11px] text-gray-400">
            {currentLang === 'vi'
              ? 'Kết nối Ollama, LM Studio, vLLM hoặc Cloud API (OpenAI, DeepSeek, Claude, FreeLLM).'
              : 'Connect Ollama, LM Studio, vLLM or Cloud APIs.'}
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

      {/* Inline Add Provider Form */}
      {isAddingProvider && (
        <form
          onSubmit={handleAddNewProvider}
          className="p-4 rounded-xl bg-[#0d1117] border border-sky-500/40 space-y-3 animate-fade-in shadow-xl"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-sky-400">
              {currentLang === 'vi' ? 'Thêm nhà cung cấp suy luận mới' : 'Add New Inference Provider'}
            </span>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
            {[
              {
                label: '🦙 Ollama',
                name: 'Ollama (Local)',
                type: 'ollama' as ProviderType,
                url: 'http://127.0.0.1:11434/v1',
                model: 'llama3:latest',
              },
              {
                label: '🧪 LM Studio',
                name: 'LM Studio (Local)',
                type: 'custom' as ProviderType,
                url: 'http://127.0.0.1:1234/v1',
                model: 'local-model',
              },
              {
                label: '⚡ DeepSeek',
                name: 'DeepSeek API',
                type: 'custom' as ProviderType,
                url: 'https://api.deepseek.com/v1',
                model: 'deepseek-chat',
              },
              {
                label: '🌐 OpenAI',
                name: 'OpenAI API',
                type: 'openai' as ProviderType,
                url: 'https://api.openai.com/v1',
                model: 'gpt-4o-mini',
              },
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
                className="px-2.5 py-1 rounded-md bg-[#21262d] hover:bg-[#30363d] text-gray-300 hover:text-white border border-[#30363d] text-[10px] font-semibold transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                {currentLang === 'vi' ? 'Tên nhà cung cấp:' : 'Provider Name:'}
              </label>
              <input
                type="text"
                value={newProviderName}
                onChange={(e) => setNewProviderName(e.target.value)}
                placeholder="e.g. DeepSeek API"
                required
                className="w-full px-3 py-1.5 rounded-lg bg-[#161b22] border border-[#30363d] text-gray-200 text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                {currentLang === 'vi' ? 'Giao thức:' : 'Protocol:'}
              </label>
              <select
                value={newProviderType}
                onChange={(e) => setNewProviderType(e.target.value as ProviderType)}
                className="w-full px-3 py-1.5 rounded-lg bg-[#161b22] border border-[#30363d] text-gray-200 text-xs focus:outline-none focus:border-sky-500"
              >
                <option value="ollama">Ollama</option>
                <option value="openai">OpenAI Compatible</option>
                <option value="custom">Custom Endpoint</option>
                <option value="freellm">FreeLLM API</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                Base URL Endpoint:
              </label>
              <input
                type="text"
                value={newProviderBaseUrl}
                onChange={(e) => setNewProviderBaseUrl(e.target.value)}
                placeholder="http://127.0.0.1:11434/v1"
                required
                className="w-full px-3 py-1.5 rounded-lg bg-[#161b22] border border-[#30363d] text-gray-200 font-mono text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                {currentLang === 'vi' ? 'Tên model ban đầu:' : 'Default Model:'}
              </label>
              <input
                type="text"
                value={newProviderModel}
                onChange={(e) => setNewProviderModel(e.target.value)}
                placeholder="e.g. deepseek-chat"
                className="w-full px-3 py-1.5 rounded-lg bg-[#161b22] border border-[#30363d] text-gray-200 font-mono text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] uppercase font-bold text-gray-400">
                {currentLang === 'vi' ? 'Khóa API (Tùy chọn):' : 'API Key (Optional):'}
              </label>
              <button
                type="button"
                onClick={() => setShowNewApiKey(!showNewApiKey)}
                className="text-[10px] text-gray-400 hover:text-white flex items-center space-x-1"
              >
                {showNewApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                <span>{showNewApiKey ? 'Ẩn' : 'Hiện'}</span>
              </button>
            </div>
            <input
              type={showNewApiKey ? 'text' : 'password'}
              value={newProviderApiKey}
              onChange={(e) => setNewProviderApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full px-3 py-1.5 rounded-lg bg-[#161b22] border border-[#30363d] text-gray-200 font-mono text-xs focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddingProvider(false)}
              className="px-3 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-gray-300 text-xs font-semibold"
            >
              {currentLang === 'vi' ? 'Hủy' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center space-x-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{currentLang === 'vi' ? 'Lưu Provider' : 'Save Provider'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Providers Cards Grid */}
      {externalProviders.length === 0 ? (
        <div className="p-8 text-center bg-[#161b22] border border-[#30363d] rounded-2xl space-y-2">
          <Globe className="w-8 h-8 text-sky-400 mx-auto opacity-80" />
          <div className="font-bold text-xs text-white">
            {currentLang === 'vi'
              ? 'Chưa có nhà cung cấp ngoài nào được kết nối'
              : 'No external providers added yet'}
          </div>
          <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
            {currentLang === 'vi'
              ? 'Động cơ nội bộ llama.cpp đã sẵn sàng và tự động chạy khi tải model từ Model Hub.'
              : 'Embedded llama.cpp auto-runs downloaded models.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {externalProviders.map((p) => {
            const isSelected = (currentProvider?.id || '') === p.id;
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
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmProvider(p);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 rounded transition-all"
                    title={currentLang === 'vi' ? 'Xóa nhà cung cấp' : 'Delete provider'}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-[10px] text-gray-500 font-mono truncate mt-0.5">{p.baseUrl}</div>
                <div className="mt-2 flex items-center justify-between text-[10px]">
                  <span className="font-mono text-gray-400 truncate max-w-[130px]">
                    {p.selectedModel || 'chưa chọn model'}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/5 text-gray-400 border border-white/10">
                    {p.models?.length || 0} models
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Provider Detail Inspector & Full Editor */}
      {currentProvider && (
        <div className="p-5 rounded-2xl bg-[#161b22] border border-[#30363d] space-y-4 shadow-sm animate-fade-in">
          {/* Top Bar: Name & Status */}
          <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
            <div className="flex items-center space-x-2">
              <Globe className="w-4 h-4 text-sky-400" />
              <span className="font-bold text-sm text-white">
                {currentProvider.name}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/30 uppercase">
                {currentProvider.type}
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-xs text-gray-400">
                {currentProvider.enabled !== false
                  ? currentLang === 'vi' ? 'Đang kích hoạt' : 'Enabled'
                  : currentLang === 'vi' ? 'Đã tắt' : 'Disabled'}
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentProvider.enabled !== false}
                  onChange={(e) => onSaveProvider({ ...currentProvider, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-[#21262d] border border-[#30363d] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
              </label>
            </div>
          </div>

          {/* Form Fields: Name, Endpoint, API Key */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                  {currentLang === 'vi' ? 'Tên hiển thị:' : 'Display Name:'}
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => handleSaveCurrentProvider()}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-gray-200 text-xs focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                  Base URL Endpoint:
                </label>
                <input
                  type="text"
                  value={editBaseUrl}
                  onChange={(e) => setEditBaseUrl(e.target.value)}
                  onBlur={() => handleSaveCurrentProvider()}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-gray-200 font-mono text-xs focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {/* API Key Input with Eye Toggle */}
            <div className="text-xs">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] uppercase font-bold text-gray-400">
                  {currentLang === 'vi' ? 'Khóa API (API Key):' : 'API Key:'}
                </label>
                <button
                  type="button"
                  onClick={() => setShowEditApiKey(!showEditApiKey)}
                  className="text-[10px] text-gray-400 hover:text-white flex items-center space-x-1"
                >
                  {showEditApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showEditApiKey ? 'Ẩn khóa' : 'Xem khóa'}</span>
                </button>
              </div>
              <input
                type={showEditApiKey ? 'text' : 'password'}
                value={editApiKey}
                onChange={(e) => setEditApiKey(e.target.value)}
                onBlur={() => handleSaveCurrentProvider()}
                placeholder="sk-..."
                className="w-full px-3 py-1.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-gray-200 font-mono text-xs focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Model Selection with Auto-Fetch Button */}
            <div className="p-3.5 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-white block">
                    {currentLang === 'vi' ? 'Mô hình hoạt động (Active Model):' : 'Active Model:'}
                  </label>
                  <span className="text-[10px] text-gray-400">
                    {currentProvider.models && currentProvider.models.length > 0
                      ? currentLang === 'vi'
                        ? `Tìm thấy ${currentProvider.models.length} mô hình từ nhà cung cấp`
                        : `Found ${currentProvider.models.length} models`
                      : currentLang === 'vi'
                        ? 'Chưa có danh sách model. Nhấn "Đọc danh sách Model" để lấy tự động.'
                        : 'No models found. Click fetch to query API.'}
                  </span>
                </div>

                {/* Auto-Fetch Button */}
                <button
                  type="button"
                  onClick={() => handleSync(currentProvider.id)}
                  disabled={syncStatus[currentProvider.id]?.loading}
                  className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-semibold flex items-center space-x-1.5 transition-all disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      syncStatus[currentProvider.id]?.loading ? 'animate-spin' : ''
                    }`}
                  />
                  <span>
                    {syncStatus[currentProvider.id]?.loading
                      ? currentLang === 'vi' ? 'Đang đọc...' : 'Reading...'
                      : currentLang === 'vi' ? 'Đọc danh sách Model' : 'Fetch Models'}
                  </span>
                </button>
              </div>

              {/* Status Banner */}
              {syncStatus[currentProvider.id]?.error && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {syncStatus[currentProvider.id]?.error}
                </div>
              )}
              {syncStatus[currentProvider.id]?.success && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {currentLang === 'vi'
                      ? `Kết nối thành công! Đã nạp ${syncStatus[currentProvider.id]?.count || 0} mô hình vào danh sách.`
                      : `Sync success! Loaded ${syncStatus[currentProvider.id]?.count || 0} models.`}
                  </span>
                </div>
              )}

              {/* Model Dropdown or Custom Input */}
              {currentProvider.models && currentProvider.models.length > 0 ? (
                <div className="space-y-1.5">
                  <select
                    value={editSelectedModel}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditSelectedModel(val);
                      if (currentProvider) {
                        onSaveProvider({ ...currentProvider, selectedModel: val });
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-[#161b22] border border-sky-500/40 text-white font-mono text-xs focus:outline-none focus:border-sky-500"
                  >
                    {currentProvider.models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <div className="text-[10px] text-gray-500">
                    {currentLang === 'vi'
                      ? 'Hoặc nhập tên model tùy chỉnh nếu không có trong danh sách trên:'
                      : 'Or enter a custom model identifier:'}
                  </div>
                  <input
                    type="text"
                    value={editSelectedModel}
                    onChange={(e) => setEditSelectedModel(e.target.value)}
                    onBlur={() => handleSaveCurrentProvider()}
                    placeholder="custom-model-id"
                    className="w-full px-3 py-1.5 rounded-lg bg-[#161b22] border border-[#30363d] text-gray-200 font-mono text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
              ) : (
                <input
                  type="text"
                  value={editSelectedModel}
                  onChange={(e) => setEditSelectedModel(e.target.value)}
                  onBlur={() => handleSaveCurrentProvider()}
                  placeholder="e.g. gpt-4o, llama3, deepseek-chat"
                  className="w-full px-3 py-2 rounded-lg bg-[#161b22] border border-[#30363d] text-gray-200 font-mono text-xs focus:outline-none focus:border-sky-500"
                />
              )}
            </div>
          </div>

          {/* Action Footer: Delete */}
          <div className="flex items-center justify-between pt-2 border-t border-[#30363d]">
            <button
              type="button"
              onClick={() => setDeleteConfirmProvider(currentProvider)}
              className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center space-x-1 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{currentLang === 'vi' ? 'Xóa nhà cung cấp' : 'Delete Provider'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
