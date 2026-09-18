import React from 'react';
import { AppMode, Building, MapSettings, MapPage } from '../types';
import { Eye, Edit3, Settings, HelpCircle, Building2, FileArchive } from 'lucide-react';

interface HeaderProps {
  settings: MapSettings;
  currentMap: MapPage;
  buildings: Building[];
  mode: AppMode;
  onToggleMode: (newMode: AppMode) => void;
  onSelectBuilding: (building: Building) => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onOpenImportExport: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  currentMap,
  buildings,
  mode,
  onToggleMode,
  onSelectBuilding,
  onOpenSettings,
  onOpenHelp,
  onOpenImportExport,
}) => {
  return (
    <header className="h-16 bg-slate-900 border-b-2 border-slate-800 px-6 flex items-center justify-between select-none z-[1100] relative shadow-xl">
      {/* Left: Project Branding & Active Sheet Name */}
      <div className="flex items-center space-x-3.5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md">
          <Building2 className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-wide flex items-center space-x-2">
            <span>{settings.title}</span>
            <span className="text-[11px] bg-slate-950 text-blue-300 px-2.5 py-0.5 rounded-full border border-slate-700 font-mono font-semibold">
              {currentMap.title}
            </span>
          </h1>
        </div>
      </div>

      {/* Center: Search / Jump-to-building selector */}
      <div className="hidden md:flex items-center mx-4">
        <div className="relative">
          <select
            onChange={(e) => {
              const b = buildings.find(item => item.id === e.target.value);
              if (b) onSelectBuilding(b);
            }}
            value=""
            className="bg-slate-800 border-2 border-slate-700 text-slate-200 text-xs font-semibold rounded-xl px-4 py-2 focus:outline-none focus:border-blue-500 cursor-pointer pr-9 shadow-inner"
          >
            <option value="" disabled>🔍 Jump to building ({buildings.length} on this sheet)...</option>
            {buildings.map(b => (
              <option key={b.id} value={b.id}>
                [{b.letter}] {b.name} ({b.documents.length} docs)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right: Mode Toggle & Settings */}
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

        {/* Backup / Export / Import Button */}
        <button
          onClick={onOpenImportExport}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-2 border-slate-700 shadow transition flex items-center space-x-1.5"
          title="Export / Import Project Data (.zip)"
        >
          <FileArchive className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold hidden xl:inline">Backup & Transfer</span>
        </button>

        {/* Plan Settings Button */}
        <button
          onClick={onOpenSettings}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-2 border-slate-700 shadow transition"
          title="Manage Site Map pages & settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Help / Guide Button */}
        <button
          onClick={onOpenHelp}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-2 border-slate-700 shadow transition"
          title="How it works & instructions"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
