import React from 'react';
import { AppMode, MapSettings } from '../types';
import { Eye, Edit3, Settings, HelpCircle, Building2, FileArchive } from 'lucide-react';
import { BUILD_VERSION_INFO } from '../version';
import { UploadQueueMenu } from './UploadQueueMenu';

interface HeaderProps {
  settings: MapSettings;
  mode: AppMode;
  onToggleMode: (newMode: AppMode) => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onOpenImportExport: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  mode,
  onToggleMode,
  onOpenSettings,
  onOpenHelp,
  onOpenImportExport,
}) => {
  return (
    <header className="h-16 bg-slate-900 border-b-2 border-slate-800 px-6 flex items-center justify-between select-none z-[1100] relative shadow-xl">
      {/* Left: Project Branding & Commit Hash */}
      <div className="flex items-center space-x-3.5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md">
          <Building2 className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-sm font-bold text-white tracking-wide">
              {settings.title}
            </h1>
            <button
              onClick={onOpenHelp}
              className="hidden sm:flex items-center text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-blue-300 px-2 py-0.5 rounded-md border border-slate-700 font-mono font-medium transition cursor-pointer"
              title={`Badatel v${BUILD_VERSION_INFO.version}\nCommit: ${BUILD_VERSION_INFO.shortHash} ("${BUILD_VERSION_INFO.commitMessage}")\nClick for system details`}
            >
              <span className="text-blue-400">{BUILD_VERSION_INFO.shortHash}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right: Mode Toggle, Backup, Upload Queue & Utility Buttons */}
      <div className="flex items-center space-x-3">
        {/* View / Edit Mode Switcher */}
        <div className="flex items-center bg-slate-950 p-1.5 rounded-2xl border-2 border-slate-800 space-x-1.5 shadow-inner">
          <button
            onClick={() => onToggleMode('view')}
            className={`flex items-center space-x-2 px-4 py-1.5 rounded-xl text-xs font-bold transition ${
              mode === 'view'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>View Docs</span>
          </button>
          <button
            onClick={() => onToggleMode('edit')}
            className={`flex items-center space-x-2 px-4 py-1.5 rounded-xl text-xs font-bold transition ${
              mode === 'edit'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>Edit Footprints</span>
          </button>
        </div>

        {/* Import & Export Button */}
        <button
          onClick={onOpenImportExport}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-2 border-slate-700 shadow transition flex items-center space-x-1.5"
          title="Export / Import Project Data (.zip)"
        >
          <FileArchive className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold hidden xl:inline">Import & Export</span>
        </button>

        {/* Global Upload Queue & Status Menu */}
        <UploadQueueMenu />

        {/* Plan Settings Button (Cog) */}
        <button
          onClick={onOpenSettings}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-2 border-slate-700 shadow transition"
          title="Manage Site Map pages & settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Help / Guide Button (Question mark) */}
        <button
          onClick={onOpenHelp}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-2 border-slate-700 shadow transition relative"
          title={`Help & System Info\nVersion: v${BUILD_VERSION_INFO.version} (${BUILD_VERSION_INFO.shortHash})\nCommit: ${BUILD_VERSION_INFO.commitMessage}\nClick for full guide and version details`}
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

