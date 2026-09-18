import React, { useState, useEffect } from 'react';
import { MapSettings, MapPage } from '../types';
import { rotateImage } from '../api';
import { useUploadQueue } from '../context/UploadContext';
import { X, Upload, Check, Map as MapIcon, RotateCw, Plus, Trash2 } from 'lucide-react';

interface MapSettingsModalProps {
  settings: MapSettings;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: Partial<MapSettings>) => void;
  onSwitchPage: (mapId: string) => void;
}

export const MapSettingsModal: React.FC<MapSettingsModalProps> = ({
  settings,
  isOpen,
  onClose,
  onSave,
  onSwitchPage
}) => {
  const { enqueueUploads, tasks } = useUploadQueue();
  const [formData, setFormData] = useState<MapSettings>({ ...settings });
  const [isUploading, setIsUploading] = useState(false);
  const [activeMapTaskId, setActiveMapTaskId] = useState<string | null>(null);

  // New map page form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageFile, setNewPageFile] = useState<File | null>(null);
  const [newPagePreview, setNewPagePreview] = useState<string | null>(null);
  const [newPageDimensions, setNewPageDimensions] = useState<{ width: number; height: number } | null>(null);

  const activeMapTask = activeMapTaskId ? tasks.find(t => t.id === activeMapTaskId) : null;

  useEffect(() => {
    if (!activeMapTask) return;
    if (activeMapTask.status === 'completed' && activeMapTask.resultUrl) {
      setNewPagePreview(activeMapTask.resultUrl);
      if (activeMapTask.resultWidth && activeMapTask.resultHeight) {
        setNewPageDimensions({ width: activeMapTask.resultWidth, height: activeMapTask.resultHeight });
      }
      setIsUploading(false);
      setActiveMapTaskId(null);
    } else if (activeMapTask.status === 'error') {
      alert('Map upload failed: ' + (activeMapTask.error || 'Unknown error'));
      setIsUploading(false);
      setActiveMapTaskId(null);
    } else if (activeMapTask.status === 'cancelled') {
      setIsUploading(false);
      setActiveMapTaskId(null);
    }
  }, [activeMapTask]);

  if (!isOpen) return null;

  const handlePageTitleChange = (id: string, title: string) => {
    setFormData(prev => ({
      ...prev,
      maps: prev.maps.map(m => m.id === id ? { ...m, title } : m)
    }));
  };

  const handleRotatePage = async (mapId: string, url: string) => {
    try {
      setIsUploading(true);
      const res = await rotateImage(url, 90, true, mapId);
      setFormData(prev => ({
        ...prev,
        maps: prev.maps.map(m => m.id === mapId ? {
          ...m,
          imageUrl: res.url,
          width: res.width,
          height: res.height
        } : m)
      }));
    } catch (err: any) {
      alert('Failed to rotate map page: ' + (err.message || 'Unknown error'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePage = (mapId: string) => {
    if (formData.maps.length <= 1) {
      alert('You must have at least one map page.');
      return;
    }
    if (!confirm('Are you sure you want to delete this map page?')) return;

    const remaining = formData.maps.filter(m => m.id !== mapId);
    const nextActive = formData.activeMapId === mapId ? remaining[0].id : formData.activeMapId;
    setFormData(prev => ({
      ...prev,
      maps: remaining,
      activeMapId: nextActive
    }));
    onSwitchPage(nextActive);
  };

  const handleNewPageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setNewPageFile(file);
    const title = newPageTitle || file.name.replace(/\.[^/.]+$/, '');
    if (!newPageTitle) {
      setNewPageTitle(title);
    }

    setIsUploading(true);
    const [id] = enqueueUploads([file], {
      target: 'map',
      targetName: `Map Sheet: ${title}`
    });
    setActiveMapTaskId(id);
    e.target.value = '';
  };

  const handleConfirmAddPage = () => {
    if (!newPagePreview || !newPageDimensions) {
      alert('Please select and upload a map image file first.');
      return;
    }

    const newPage: MapPage = {
      id: `page-${Date.now()}`,
      title: newPageTitle || `Page ${formData.maps.length + 1}`,
      imageUrl: newPagePreview,
      width: newPageDimensions.width,
      height: newPageDimensions.height
    };

    const updatedMaps = [...formData.maps, newPage];
    setFormData(prev => ({
      ...prev,
      maps: updatedMaps,
      activeMapId: newPage.id
    }));

    // Reset add form
    setShowAddForm(false);
    setNewPageTitle('');
    setNewPageFile(null);
    setNewPagePreview(null);
    setNewPageDimensions(null);

    onSwitchPage(newPage.id);
  };

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/90 animate-in fade-in duration-150">
      <div className="bg-slate-900 border-2 border-slate-600 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b-2 border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400 flex items-center justify-center">
              <MapIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Site Map Pages & Settings</h2>
              <p className="text-xs text-slate-400">Manage multiple pages, switch plans, or upload new sheets</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 bg-slate-900 flex-1 overflow-y-auto">
          {/* Project Title */}
          <div>
            <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5">
              Project Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-slate-800 border-2 border-slate-600 rounded-xl px-3.5 py-2.5 text-white font-medium focus:outline-none focus:border-blue-500 text-sm shadow-inner"
            />
          </div>

          {/* Map Pages List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Map Pages / Sheets ({formData.maps.length})</h3>
                <p className="text-xs text-slate-400">Click a page to activate it or rotate it</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Map Page</span>
              </button>
            </div>

            <div className="space-y-3">
              {formData.maps.map((mapPage, index) => {
                const isActive = mapPage.id === formData.activeMapId;
                return (
                  <div
                    key={mapPage.id}
                    className={`p-3.5 rounded-xl border-2 transition-all flex items-center justify-between ${
                      isActive
                        ? 'bg-slate-850 border-blue-500 ring-2 ring-blue-500/30 shadow-lg'
                        : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center space-x-3.5 flex-1 min-w-0 mr-3">
                      <img
                        src={mapPage.imageUrl}
                        alt={mapPage.title}
                        className="w-16 h-16 object-cover rounded-lg bg-slate-950 border border-slate-700 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-slate-300">
                            Sheet {index + 1}
                          </span>
                          {isActive && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-900/60 border border-blue-500 text-blue-300 font-mono">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          value={mapPage.title}
                          onChange={e => handlePageTitleChange(mapPage.id, e.target.value)}
                          className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-bold focus:outline-none focus:border-blue-500"
                        />
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {mapPage.width} × {mapPage.height} px
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 shrink-0">
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, activeMapId: mapPage.id }));
                            onSwitchPage(mapPage.id);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-blue-600 text-white text-xs font-semibold transition"
                        >
                          Switch To
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRotatePage(mapPage.id, mapPage.imageUrl)}
                        disabled={isUploading}
                        className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-amber-400 hover:text-amber-300 transition"
                        title="Rotate this map sheet 90° clockwise"
                      >
                        <RotateCw className="w-4 h-4" />
                      </button>
                      {formData.maps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeletePage(mapPage.id)}
                          className="p-2 rounded-lg bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white transition"
                          title="Delete this map page"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Map Page Modal / Sub-section */}
          {showAddForm && (
            <div className="p-4 bg-slate-950 border-2 border-blue-500 rounded-xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h4 className="text-xs font-bold text-blue-300 uppercase tracking-wider">Add New Map Page / Sheet</h4>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Sheet / Page Title</label>
                <input
                  type="text"
                  value={newPageTitle}
                  onChange={e => setNewPageTitle(e.target.value)}
                  placeholder="e.g. Sector 2 - Southern Infrastructure"
                  className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Photographed Map File (.jpg, .png, .heic)</label>
                <label className="flex items-center justify-center space-x-2 p-4 rounded-xl border-2 border-dashed border-slate-700 hover:border-blue-500 bg-slate-900 cursor-pointer transition text-xs text-slate-300">
                  <Upload className="w-4 h-4 text-blue-400" />
                  <span>{isUploading ? 'Uploading & converting HEIC...' : (newPageFile ? newPageFile.name : 'Click to select or drop map photo')}</span>
                  <input
                    type="file"
                    accept="image/*,.heic,.HEIC"
                    onChange={handleNewPageFileSelect}
                    disabled={isUploading}
                    className="hidden"
                  />
                </label>
                {newPageDimensions && (
                  <p className="text-xs text-emerald-400 mt-1.5 font-bold flex items-center">
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Detected Dimensions: {newPageDimensions.width} × {newPageDimensions.height} px
                  </p>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAddPage}
                  disabled={!newPagePreview || isUploading}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow"
                >
                  Confirm & Add Sheet
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t-2 border-slate-800 bg-slate-950 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg transition"
          >
            <Check className="w-4 h-4" />
            <span>Apply Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};
