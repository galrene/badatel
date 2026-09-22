import React, { useState, useRef, useEffect } from 'react';
import { AppMode, MapSettings } from '../types';
import { Eye, Edit3, Settings, HelpCircle, Building2, FileArchive, MoreVertical, X, UploadCloud, Loader2 } from 'lucide-react';
import { BUILD_VERSION_INFO } from '../version';
import { UploadQueueMenu } from './UploadQueueMenu';
import { useUploadQueue } from '../context/UploadContext';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const { isUploading, activeCount, queuedCount, errorCount, setIsMenuOpen } = useUploadQueue();
  const totalInFlight = activeCount + queuedCount;

  // Close mobile menu on outside click or escape
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

  return (
    <header className="min-h-16 pt-[env(safe-area-inset-top)] bg-slate-900 border-b-2 border-slate-800 px-4 sm:px-6 flex items-center justify-between select-none z-[1100] relative shadow-xl">
      {/* Left: Project Branding & Commit Hash */}
      <div className="flex items-center space-x-3 min-w-0 pr-2">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shrink-0">
          <Building2 className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <h1 className="text-sm font-bold text-white tracking-wide truncate max-w-[200px] sm:max-w-xs md:max-w-md">
              {settings.title}
            </h1>
            <button
              onClick={onOpenHelp}
              className="hidden sm:flex items-center text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-blue-300 px-2 py-0.5 rounded-md border border-slate-700 font-mono font-medium transition cursor-pointer shrink-0"
              title={`Badatel v${BUILD_VERSION_INFO.version}\nCommit: ${BUILD_VERSION_INFO.shortHash} ("${BUILD_VERSION_INFO.commitMessage}")\nClick for system details`}
            >
              <span className="text-blue-400">{BUILD_VERSION_INFO.shortHash}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Desktop (md and up): Full Toolbar */}
      <div className="hidden md:flex items-center space-x-3 shrink-0">
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

      {/* Mobile (< md): Clean Header with "..." Overflow Menu */}
      <div className="flex md:hidden items-center relative" ref={mobileMenuRef}>
        <button
          onClick={() => setMobileMenuOpen(prev => !prev)}
          className={`p-2.5 rounded-xl border-2 transition relative flex items-center justify-center ${
            mobileMenuOpen
              ? 'bg-slate-700 text-white border-slate-500 shadow-lg'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
          }`}
          title="Menu & Options"
          aria-label="Open menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <MoreVertical className="w-5 h-5" />}

          {/* Badge if upload in progress or errors */}
          {totalInFlight > 0 && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
            </span>
          )}
          {totalInFlight === 0 && errorCount > 0 && (
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-rose-500 rounded-full border-2 border-slate-900" />
          )}
        </button>

        {/* Mobile Dropdown Menu Panel */}
        {mobileMenuOpen && (
          <div className="absolute right-0 top-12 w-64 bg-slate-900 border-2 border-slate-700 rounded-2xl shadow-2xl p-2.5 z-[1300] flex flex-col space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Mode Switcher */}
            <div className="p-1 bg-slate-950 rounded-xl border border-slate-800 grid grid-cols-2 gap-1">
              <button
                onClick={() => {
                  onToggleMode('view');
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center justify-center space-x-1.5 py-2 px-2 rounded-lg text-xs font-bold transition ${
                  mode === 'view'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View</span>
              </button>
              <button
                onClick={() => {
                  onToggleMode('edit');
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center justify-center space-x-1.5 py-2 px-2 rounded-lg text-xs font-bold transition ${
                  mode === 'edit'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            </div>

            <div className="h-px bg-slate-800 my-1" />

            {/* Upload Queue Item */}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setIsMenuOpen(true);
              }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
            >
              <div className="flex items-center space-x-2.5">
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                ) : (
                  <UploadCloud className="w-4 h-4 text-blue-400" />
                )}
                <span>Upload Queue</span>
              </div>
              {totalInFlight > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white font-mono">
                  {totalInFlight}
                </span>
              ) : errorCount > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white font-mono">
                  {errorCount}
                </span>
              ) : null}
            </button>

            {/* Import & Export */}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenImportExport();
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
            >
              <FileArchive className="w-4 h-4 text-indigo-400" />
              <span>Import & Export (.zip)</span>
            </button>

            {/* Map Settings */}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenSettings();
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span>Map Settings</span>
            </button>

            {/* Help & System Info */}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenHelp();
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
            >
              <HelpCircle className="w-4 h-4 text-emerald-400" />
              <span>Help & Info (v{BUILD_VERSION_INFO.version})</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

