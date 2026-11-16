import React, { useState, useEffect, useRef } from 'react';
import { type Language, type Translations, dictionaries, getLanguage } from '../i18n.js';
import { getApiUrl } from '../api.js';
import { X, FolderPlus, FolderOpen, HardDrive, Sparkles, Loader2 } from 'lucide-react';

interface NewWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, folderPath: string) => void;
  lang?: Language;
  t?: Translations;
}

interface SystemFolders {
  current: string;
  home: string;
  desktop: string;
  documents: string;
}

export const NewWorkspaceModal: React.FC<NewWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  lang,
  t: propT,
}) => {
  const currentLang = lang || getLanguage();
  const tr = propT || dictionaries[currentLang];

  const [name, setName] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [isPicking, setIsPicking] = useState(false);
  const [systemFolders, setSystemFolders] = useState<SystemFolders | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Fetch system folders for quick chips
      fetch(getApiUrl('/api/dialog/system-folders'))
        .then((res) => res.json())
        .then((data) => setSystemFolders(data))
        .catch(() => null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePickNativeFolder = async () => {
    setIsPicking(true);
    setErrorMessage(null);
    try {
      const res = await fetch(getApiUrl('/api/dialog/pick-folder'), {
        method: 'POST',
      });
      const data = await res.json();
      if (data.path) {
        setFolderPath(data.path);
        if (!name.trim() && data.name) {
          setName(data.name);
        }
      }
    } catch (err: any) {
      setErrorMessage(
        currentLang === 'vi'
          ? 'Không thể kết nối đến core backend. Vui lòng kiểm tra backend hoặc nhập đường dẫn thủ công.'
          : 'Could not connect to backend core. Please check backend or type path manually.'
      );
    } finally {
      setIsPicking(false);
    }
  };

  const handleSelectQuickFolder = (path: string, defaultName: string) => {
    setFolderPath(path);
    if (!name.trim()) {
      setName(defaultName);
    }
  };

  const handleBrowserFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // In Chromium webkitdirectory, the first file's webkitRelativePath starts with folder name
      const firstPath = files[0].webkitRelativePath || '';
      const rootFolderName = firstPath.split('/')[0] || 'MyProject';
      if (!name.trim()) setName(rootFolderName);
      // If path is empty, inform user
      if (!folderPath.trim()) {
        setFolderPath(`C:\\Projects\\${rootFolderName}`);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !folderPath.trim()) return;
    onCreate(name.trim(), folderPath.trim());
    setName('');
    setFolderPath('');
    setErrorMessage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in select-none">
      <div className="w-full max-w-lg bg-[#161b22] border border-[#30363d] rounded-2xl shadow-2xl overflow-hidden glass-panel">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#30363d] flex items-center justify-between bg-black/20">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm text-white">{tr.addProjectFolderTitle}</span>
              <p className="text-[11px] text-gray-400">{tr.addProjectFolderSubtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#21262d] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* 1. Pick Folder Button & Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-gray-300">
                {tr.folderPathLabel}
              </label>
              <span className="text-[10px] text-gray-500">Windows Absolute Path</span>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  required
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  placeholder={tr.folderPathPlaceholder}
                  className="w-full px-3 py-2 rounded-xl bg-[#0d1117] border border-[#30363d] text-gray-200 font-mono text-xs focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>

              {/* Native Windows Folder Picker */}
              <button
                type="button"
                onClick={handlePickNativeFolder}
                disabled={isPicking}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-semibold shrink-0 transition-all shadow-sm disabled:opacity-50"
              >
                {isPicking ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{tr.browsingBtn}</span>
                  </>
                ) : (
                  <>
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>{tr.browseBtn}</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Suggestions */}
            {systemFolders && (
              <div className="pt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className="text-gray-500">{tr.quickSuggestions}</span>
                <button
                  type="button"
                  onClick={() => handleSelectQuickFolder(systemFolders.current, 'Current Project')}
                  className="px-2 py-0.5 rounded-md bg-[#21262d] hover:bg-[#30363d] text-gray-300 border border-[#30363d] transition-colors truncate max-w-[140px]"
                  title={systemFolders.current}
                >
                  ⚡ {tr.currentRepo}
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectQuickFolder(systemFolders.desktop, 'Desktop')}
                  className="px-2 py-0.5 rounded-md bg-[#21262d] hover:bg-[#30363d] text-gray-300 border border-[#30363d] transition-colors"
                >
                  🖥️ {tr.desktop}
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectQuickFolder(systemFolders.documents, 'Documents')}
                  className="px-2 py-0.5 rounded-md bg-[#21262d] hover:bg-[#30363d] text-gray-300 border border-[#30363d] transition-colors"
                >
                  📁 {tr.documents}
                </button>
              </div>
            )}
          </div>

          {/* 2. Workspace Display Name */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-gray-300">{tr.projectNameLabel}</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tr.projectNamePlaceholder}
              className="w-full px-3 py-2 rounded-xl bg-[#0d1117] border border-[#30363d] text-gray-200 text-xs focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          {errorMessage && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px]">
              {errorMessage}
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#30363d]/60 flex items-center justify-between">
            <div className="text-[11px] text-gray-500 flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Full local file index & git tools</span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-[#21262d] transition-colors font-medium"
              >
                {tr.cancel}
              </button>
              <button
                type="submit"
                disabled={!name.trim() || !folderPath.trim() || isPicking}
                className="px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-semibold transition-all shadow-md shadow-sky-500/20"
              >
                {tr.createWorkspaceBtn}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
