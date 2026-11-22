import React from 'react';
import { HardDrive, FolderOpen } from 'lucide-react';

interface StorageTabProps {
  systemPaths: {
    current: string;
    home: string;
    desktop: string;
    documents: string;
    models: string;
  } | null;
  onOpenFolder: (path: string) => void;
  currentLang: string;
}

export const StorageTab: React.FC<StorageTabProps> = ({
  systemPaths,
  onOpenFolder,
  currentLang,
}) => {
  return (
    <div className="space-y-4 animate-fade-in max-w-4xl">
      <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] space-y-4 shadow-sm">
        <div className="flex items-center space-x-2 border-b border-[#30363d] pb-3">
          <HardDrive className="w-4 h-4 text-teal-400" />
          <div>
            <span className="font-bold text-sm text-white">
              {currentLang === 'vi'
                ? 'Quản lý lưu trữ & Đường dẫn hệ thống'
                : 'Storage & System Directories'}
            </span>
            <p className="text-[11px] text-gray-400">
              {currentLang === 'vi'
                ? 'Quản lý thư mục chứa mô hình GGUF, dự án và bộ nhớ tạm'
                : 'Manage GGUF models, workspace data and cache directories'}
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
              onClick={() => onOpenFolder(systemPaths?.models || '')}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 text-[11px] font-semibold transition-all"
            >
              <FolderOpen className="w-3 h-3" />
              <span>{currentLang === 'vi' ? 'Mở trong Explorer' : 'Open in Explorer'}</span>
            </button>
          </div>
          <div className="p-2 rounded-lg bg-[#161b22] border border-[#30363d] font-mono text-[11px] text-gray-300 break-all select-all">
            {systemPaths?.models || 'C:\\Users\\...\\LocalAI\\models'}
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
              onClick={() => onOpenFolder(systemPaths?.current || '')}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-[11px] font-semibold transition-all"
            >
              <FolderOpen className="w-3 h-3" />
              <span>{currentLang === 'vi' ? 'Mở trong Explorer' : 'Open in Explorer'}</span>
            </button>
          </div>
          <div className="p-2 rounded-lg bg-[#161b22] border border-[#30363d] font-mono text-[11px] text-gray-300 break-all select-all">
            {systemPaths?.current || process.cwd()}
          </div>
        </div>
      </div>
    </div>
  );
};
