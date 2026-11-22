import React, { useState } from 'react';
import { FolderPlus, Sparkles } from 'lucide-react';
import type { LocalSkill } from '../../../types.js';

interface SkillsTabProps {
  skills: LocalSkill[];
  onAddSkillFolder: (folder: string) => void;
  currentLang: string;
}

export const SkillsTab: React.FC<SkillsTabProps> = ({
  skills,
  onAddSkillFolder,
  currentLang,
}) => {
  const [newSkillFolder, setNewSkillFolder] = useState('');

  return (
    <div className="space-y-4 animate-fade-in max-w-4xl">
      <div className="p-3.5 rounded-xl bg-[#161b22] border border-[#30363d] space-y-2">
        <label className="font-semibold text-xs text-white block">
          {currentLang === 'vi' ? 'Tự động quét kỹ năng trên máy tính:' : 'Global Skills Auto-Discovery:'}
        </label>
        <p className="text-[11px] text-gray-400">
          {currentLang === 'vi'
            ? 'Ứng dụng tự động nhận diện các thư mục kỹ năng và công cụ mở rộng (~/.gemini/skills, ~/.config/skills).'
            : "The app automatically scans your PC's global plugin & skill directories (~/.gemini/skills, ~/.config/skills)."}
        </p>
        <div className="flex space-x-2 pt-1">
          <input
            type="text"
            value={newSkillFolder}
            onChange={(e) => setNewSkillFolder(e.target.value)}
            placeholder={
              currentLang === 'vi' ? 'Thêm đường dẫn thư mục kỹ năng trên máy...' : 'Add custom folder on PC...'
            }
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
          {currentLang === 'vi'
            ? `Kỹ năng đã tìm thấy (${skills.length})`
            : `Discovered Skills (${skills.length})`}
        </div>
        {skills.map((skill) => (
          <div
            key={skill.id}
            className="p-3.5 rounded-xl bg-[#161b22] border border-[#30363d] flex items-center justify-between space-x-4"
          >
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
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
  );
};
