import React from 'react';
import { Keyboard } from 'lucide-react';

interface ShortcutsTabProps {
  currentLang: string;
}

export const ShortcutsTab: React.FC<ShortcutsTabProps> = ({ currentLang }) => {
  return (
    <div className="space-y-4 animate-fade-in max-w-4xl">
      <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] space-y-4 shadow-sm">
        <div className="flex items-center space-x-2 border-b border-[#30363d] pb-3">
          <Keyboard className="w-4 h-4 text-yellow-400" />
          <div>
            <span className="font-bold text-sm text-white">Keyboard Shortcuts Cheat Sheet</span>
            <p className="text-[11px] text-gray-400">
              {currentLang === 'vi'
                ? 'Các phím tắt nhanh giúp thao tác năng suất như Cursor và VS Code'
                : 'Speed up your workflow with keyboard shortcuts'}
            </p>
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
              Workspace & Multi-Agent
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#0d1117] border border-[#30363d]">
                <span className="text-xs text-gray-300">Kích hoạt Swarm 4-Agent</span>
                <kbd className="px-2 py-0.5 rounded bg-[#21262d] text-sky-400 font-mono text-[10px] border border-sky-500/30">
                  /swarm &lt;prompt&gt;
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#0d1117] border border-[#30363d]">
                <span className="text-xs text-gray-300">Chèn tệp đính kèm (@file)</span>
                <kbd className="px-2 py-0.5 rounded bg-[#21262d] text-white font-mono text-[10px] border border-[#30363d]">
                  @ &lt;tên tệp&gt;
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#0d1117] border border-[#30363d]">
                <span className="text-xs text-gray-300">Mở khay hệ thống (System Tray)</span>
                <kbd className="px-2 py-0.5 rounded bg-[#21262d] text-white font-mono text-[10px] border border-[#30363d]">
                  Click Tray Icon
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#0d1117] border border-[#30363d]">
                <span className="text-xs text-gray-300">Ẩn / Hiện thanh công cụ phải</span>
                <kbd className="px-2 py-0.5 rounded bg-[#21262d] text-white font-mono text-[10px] border border-[#30363d]">
                  Ctrl + B
                </kbd>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
