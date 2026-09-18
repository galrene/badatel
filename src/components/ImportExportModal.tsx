import React, { useState, useRef } from 'react';
import { MapSettings, Building, ImportPreview } from '../types';
import { downloadProjectZip, inspectImportZip, executeImportZip } from '../api';
import {
  X,
  Download,
  Upload,
  FileArchive,
  Layers,
  Building2,
  FileText,
  ShieldCheck,
  Check,
  AlertCircle,
  Loader2,
  HardDrive
} from 'lucide-react';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: MapSettings;
  buildings: Building[];
  onImportSuccess: (newSettings: MapSettings, newBuildings: Building[]) => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  settings,
  buildings,
  onImportSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // Import state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [isInspecting, setIsInspecting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Calculate current project stats
  const currentTotalDocs = buildings.reduce((acc, b) => acc + (b.documents?.length || 0), 0);

  const handleExport = () => {
    setIsExporting(true);
    try {
      downloadProjectZip();
    } catch (err: any) {
      alert('Failed to start download: ' + (err.message || 'Unknown error'));
    } finally {
      setTimeout(() => setIsExporting(false), 1200);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setPreview(null);
    setImportError(null);
    setImportSuccessMsg(null);
    setIsInspecting(true);

    try {
      const inspectData = await inspectImportZip(file);
      setPreview(inspectData);
    } catch (err: any) {
      console.error('Inspection failed:', err);
      setImportError(err.message || 'The selected file is not a valid Badatel backup archive.');
    } finally {
      setIsInspecting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExecuteImport = async () => {
    if (!selectedFile || !preview) return;

    if (importMode === 'replace') {
      const confirmed = window.confirm(
        'Are you sure you want to replace all current project data with the contents of this archive? ' +
        'A timestamped safety backup will be created on the server before replacing.'
      );
      if (!confirmed) return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      const res = await executeImportZip(selectedFile, importMode);
      setImportSuccessMsg(
        importMode === 'replace'
          ? 'Project data restored successfully!'
          : 'Archive merged into current project successfully!'
      );
      onImportSuccess(res.settings, res.buildings);
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err: any) {
      console.error('Import error:', err);
      setImportError(err.message || 'Failed to complete project import.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleResetImport = () => {
    setSelectedFile(null);
    setPreview(null);
    setImportError(null);
    setImportSuccessMsg(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/90 animate-in fade-in duration-150">
      <div className="bg-slate-900 border-2 border-slate-600 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b-2 border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400 flex items-center justify-center">
              <FileArchive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Project Data & Backup</h2>
              <p className="text-xs text-slate-400">Export or restore all map pages, footprints, and documents</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b-2 border-slate-800 bg-slate-950/60 px-6 pt-2">
          <button
            onClick={() => setActiveTab('export')}
            className={`flex items-center space-x-2 py-3 px-4 border-b-2 font-bold text-xs transition ${
              activeTab === 'export'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Export Archive (.zip)</span>
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex items-center space-x-2 py-3 px-4 border-b-2 font-bold text-xs transition ${
              activeTab === 'import'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Import / Restore Archive</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 bg-slate-900 flex-1 overflow-y-auto">
          {activeTab === 'export' ? (
            <div className="space-y-6">
              {/* Current Project Snapshot Card */}
              <div className="p-5 rounded-xl bg-slate-950 border-2 border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Current Project Contents</h3>
                    <p className="text-xs text-slate-400">Everything below will be bundled into the archive</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-blue-950 border border-blue-600/50 text-blue-300">
                    {settings.title}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-center">
                    <Layers className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                    <div className="text-lg font-bold text-white">{settings.maps.length}</div>
                    <div className="text-[11px] text-slate-400">Map Sheets</div>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-center">
                    <Building2 className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                    <div className="text-lg font-bold text-white">{buildings.length}</div>
                    <div className="text-[11px] text-slate-400">Buildings & Polygons</div>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-center">
                    <FileText className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                    <div className="text-lg font-bold text-white">{currentTotalDocs}</div>
                    <div className="text-[11px] text-slate-400">Attached Documents</div>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  The generated ZIP archive includes full metadata (<code className="text-blue-300">manifest.json</code>) with all drawn polygon coordinates, building attributes, badge positions, and an assets folder containing all high-resolution site plan photos and document scans.
                </p>
              </div>

              {/* Export Action */}
              <div className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/40 space-y-3">
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex items-center space-x-2.5 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm shadow-xl transition"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Preparing Archive...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      <span>Download Complete Archive (.zip)</span>
                    </>
                  )}
                </button>
                <span className="text-[11px] text-slate-500 font-medium">
                  Direct browser download • No cloud upload required
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Error message banner */}
              {importError && (
                <div className="p-4 rounded-xl bg-red-950/70 border border-red-500/50 flex items-start space-x-3 text-red-200 text-xs">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">Import failed</p>
                    <p className="mt-0.5">{importError}</p>
                  </div>
                </div>
              )}

              {/* Success message banner */}
              {importSuccessMsg && (
                <div className="p-4 rounded-xl bg-emerald-950/70 border border-emerald-500/50 flex items-center space-x-3 text-emerald-200 text-xs">
                  <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                  <p className="font-bold">{importSuccessMsg}</p>
                </div>
              )}

              {/* Step 1: Select Archive if no preview yet */}
              {!preview && !isInspecting && (
                <div className="space-y-4">
                  <label className="flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed border-slate-700 hover:border-blue-500 bg-slate-950 cursor-pointer transition text-center group">
                    <Upload className="w-10 h-10 text-slate-500 group-hover:text-blue-400 mb-3 transition" />
                    <span className="text-sm font-bold text-slate-200">
                      Select or drop a Badatel backup archive (.zip)
                    </span>
                    <span className="text-xs text-slate-400 mt-1">
                      Must contain a valid <code className="text-blue-300">manifest.json</code> and media files
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".zip,application/zip"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* Inspecting Spinner */}
              {isInspecting && (
                <div className="p-8 bg-slate-950 rounded-xl border-2 border-slate-800 flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  <p className="text-sm font-bold text-slate-200">Inspecting archive structure & media...</p>
                  <p className="text-xs text-slate-400">Verifying manifest integrity</p>
                </div>
              )}

              {/* Step 2: Archive Preview & Import Options */}
              {preview && !isInspecting && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  {/* Preview summary card */}
                  <div className="p-4 rounded-xl bg-slate-950 border-2 border-blue-500/60 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 font-mono">
                          Archive Preview
                        </span>
                        <h4 className="text-sm font-bold text-white">{preview.title}</h4>
                      </div>
                      {preview.exportedAt && (
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400">Exported</span>
                          <p className="text-xs text-slate-300 font-mono">
                            {new Date(preview.exportedAt).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-2 pt-1">
                      <div className="p-2.5 bg-slate-900 rounded-lg text-center border border-slate-800">
                        <div className="text-base font-bold text-blue-300">{preview.mapCount}</div>
                        <div className="text-[10px] text-slate-400">Map Sheets</div>
                      </div>
                      <div className="p-2.5 bg-slate-900 rounded-lg text-center border border-slate-800">
                        <div className="text-base font-bold text-emerald-300">{preview.buildingCount}</div>
                        <div className="text-[10px] text-slate-400">Buildings</div>
                      </div>
                      <div className="p-2.5 bg-slate-900 rounded-lg text-center border border-slate-800">
                        <div className="text-base font-bold text-amber-300">{preview.documentCount}</div>
                        <div className="text-[10px] text-slate-400">Documents</div>
                      </div>
                      <div className="p-2.5 bg-slate-900 rounded-lg text-center border border-slate-800">
                        <div className="text-base font-bold text-slate-200">{formatFileSize(preview.archiveSizeBytes)}</div>
                        <div className="text-[10px] text-slate-400">{preview.mediaFileCount} files</div>
                      </div>
                    </div>
                  </div>

                  {/* Mode Selector */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Choose Import Strategy
                    </label>

                    <div className="space-y-2.5">
                      {/* Replace option */}
                      <label
                        className={`flex items-start p-3.5 rounded-xl border-2 cursor-pointer transition ${
                          importMode === 'replace'
                            ? 'bg-blue-950/30 border-blue-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="importMode"
                          value="replace"
                          checked={importMode === 'replace'}
                          onChange={() => setImportMode('replace')}
                          className="mt-1 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="ml-3">
                          <span className="text-xs font-bold text-white block">
                            Replace all current data (Full Restore)
                          </span>
                          <span className="text-[11px] text-slate-400 leading-normal block mt-0.5">
                            Replaces current sheets and buildings with this backup.
                          </span>
                          <div className="flex items-center space-x-1 text-[11px] text-emerald-400 mt-1.5 font-medium">
                            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                            <span>A safety backup of current data is automatically created on the server first.</span>
                          </div>
                        </div>
                      </label>

                      {/* Merge option */}
                      <label
                        className={`flex items-start p-3.5 rounded-xl border-2 cursor-pointer transition ${
                          importMode === 'merge'
                            ? 'bg-blue-950/30 border-blue-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="importMode"
                          value="merge"
                          checked={importMode === 'merge'}
                          onChange={() => setImportMode('merge')}
                          className="mt-1 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="ml-3">
                          <span className="text-xs font-bold text-white block">
                            Merge with existing data (Append)
                          </span>
                          <span className="text-[11px] text-slate-400 leading-normal block mt-0.5">
                            Appends the imported sheets and buildings to your existing project. IDs are automatically deduplicated.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Actions for Step 2 */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={handleResetImport}
                      disabled={isImporting}
                      className="text-xs text-slate-400 hover:text-white underline transition"
                    >
                      Choose different file
                    </button>

                    <button
                      type="button"
                      onClick={handleExecuteImport}
                      disabled={isImporting}
                      className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg transition"
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Importing & restoring assets...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Confirm & Apply Import</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t-2 border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-1.5">
            <HardDrive className="w-4 h-4 text-slate-500" />
            <span>Badatel Backup Engine v1</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
