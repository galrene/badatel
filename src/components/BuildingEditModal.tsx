import React, { useState, useEffect } from 'react';
import { Building, DocumentItem, LocalFileItem } from '../types';
import { uploadImageFile, fetchLocalFiles, rotateImage } from '../api';
import { 
  X, Trash2, Upload, Check, AlertTriangle, 
  Image as ImageIcon, FolderOpen, RotateCw,
  FolderPlus, Search, CheckSquare
} from 'lucide-react';

interface BuildingEditModalProps {
  building: Building;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: Building) => void;
  onDelete: (id: string) => void;
}

const COLOR_PRESETS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#ef4444', // Red
  '#64748b'  // Slate
];

export const BuildingEditModal: React.FC<BuildingEditModalProps> = ({
  building,
  isOpen,
  onClose,
  onSave,
  onDelete
}) => {
  const [formData, setFormData] = useState<Building>({ ...building });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [localFiles, setLocalFiles] = useState<LocalFileItem[]>([]);
  const [localFolders, setLocalFolders] = useState<string[]>([]);
  const [selectedSubfolder, setSelectedSubfolder] = useState<string>('__all__');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [showLocalBrowser, setShowLocalBrowser] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setFormData({ ...building });
    setConfirmDelete(false);
  }, [building]);

  useEffect(() => {
    if (showLocalBrowser) {
      fetchLocalFiles().then(res => {
        setLocalFiles(res.files);
        setLocalFolders(res.folders);
      });
    }
  }, [showLocalBrowser]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      setIsUploading(true);
      const newDocs: DocumentItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(`Uploading ${i + 1}/${files.length}...`);
        const res = await uploadImageFile(file, 'doc');
        newDocs.push({
          id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${i}`,
          title: file.name.replace(/\.[^/.]+$/, ''),
          description: '',
          url: res.url,
          uploadedAt: new Date().toISOString()
        });
      }
      setFormData(prev => ({
        ...prev,
        documents: [...prev.documents, ...newDocs]
      }));
    } catch (err: any) {
      console.error('File upload error:', err);
      alert('Upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      e.target.value = '';
    }
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles = files.filter(f => {
      const ext = f.name.toLowerCase().slice(f.name.lastIndexOf('.'));
      return ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.heic', '.pdf'].includes(ext);
    });

    if (validFiles.length === 0) {
      alert('No supported photos or documents (.jpg, .png, .heic, .webp, .pdf) found in selected folder.');
      e.target.value = '';
      return;
    }

    try {
      setIsUploading(true);
      const newDocs: DocumentItem[] = [];
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        setUploadProgress(`Uploading folder: ${i + 1}/${validFiles.length}...`);

        let subfolder = '';
        if (file.webkitRelativePath) {
          const parts = file.webkitRelativePath.split('/');
          parts.pop(); // Remove filename
          subfolder = parts.join('/');
        }

        const res = await uploadImageFile(file, 'doc', subfolder);
        newDocs.push({
          id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${i}`,
          title: file.name.replace(/\.[^/.]+$/, ''),
          description: subfolder ? `Folder: ${subfolder}` : '',
          url: res.url,
          uploadedAt: new Date().toISOString()
        });
      }
      setFormData(prev => ({
        ...prev,
        documents: [...prev.documents, ...newDocs]
      }));
    } catch (err: any) {
      console.error('Folder upload error:', err);
      alert('Folder upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      e.target.value = '';
    }
  };

  const handleAddLocalFile = (file: LocalFileItem) => {
    const newDoc: DocumentItem = {
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: file.name.replace(/\.[^/.]+$/, ''),
      description: file.subfolder ? `Folder: ${file.subfolder}` : '',
      url: file.url,
      uploadedAt: new Date().toISOString()
    };
    setFormData(prev => ({
      ...prev,
      documents: [...prev.documents, newDoc]
    }));
  };

  const handleAddAllFiltered = (filesToAdd: LocalFileItem[]) => {
    if (filesToAdd.length === 0) return;
    const newDocs: DocumentItem[] = filesToAdd.map((file, idx) => ({
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${idx}`,
      title: file.name.replace(/\.[^/.]+$/, ''),
      description: file.subfolder ? `Folder: ${file.subfolder}` : '',
      url: file.url,
      uploadedAt: new Date().toISOString()
    }));
    setFormData(prev => ({
      ...prev,
      documents: [...prev.documents, ...newDocs]
    }));
  };

  const handleRemoveDoc = (docId: string) => {
    setFormData(prev => ({
      ...prev,
      documents: prev.documents.filter(d => d.id !== docId)
    }));
  };

  const handleUpdateDoc = (docId: string, field: 'title' | 'description', value: string) => {
    setFormData(prev => ({
      ...prev,
      documents: prev.documents.map(d => d.id === docId ? { ...d, [field]: value } : d)
    }));
  };

  const handleRotateDoc = async (docId: string, docUrl: string) => {
    try {
      const res = await rotateImage(docUrl, 90);
      setFormData(prev => ({
        ...prev,
        documents: prev.documents.map(d => d.id === docId ? { ...d, url: res.url } : d)
      }));
    } catch (err: any) {
      alert('Failed to rotate document photo: ' + (err.message || 'Unknown error'));
    }
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
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xl text-white shadow-md border-2 border-white/40"
              style={{ backgroundColor: formData.color }}
            >
              {formData.letter}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Edit Building [{formData.letter}]</h2>
              <p className="text-xs text-slate-400">Configure building details and photographed documents</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-900">
          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5">
                Letter / Code
              </label>
              <input
                type="text"
                value={formData.letter}
                onChange={e => setFormData({ ...formData, letter: e.target.value.toUpperCase() })}
                maxLength={4}
                className="w-full bg-slate-800 border-2 border-slate-600 rounded-xl px-3.5 py-2.5 text-white font-bold text-xl focus:outline-none focus:border-blue-500 focus:bg-slate-750 font-mono text-center shadow-inner"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5">
                Building Name / Title
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Block A - Residential"
                className="w-full bg-slate-800 border-2 border-slate-600 rounded-xl px-3.5 py-2.5 text-white font-medium focus:outline-none focus:border-blue-500 focus:bg-slate-750 text-sm shadow-inner"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5">
              Description / Notes
            </label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="e.g. 4 floors, 32 apartments, renovated roof..."
              className="w-full bg-slate-800 border-2 border-slate-600 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 focus:bg-slate-750 text-sm leading-relaxed shadow-inner"
            />
          </div>

          {/* Color Presets */}
          <div>
            <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5">
              Map Footprint Color
            </label>
            <div className="flex items-center space-x-2.5">
              {COLOR_PRESETS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: c })}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    formData.color === c ? 'scale-125 ring-3 ring-white shadow-xl' : 'hover:scale-110 opacity-80'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={formData.color}
                onChange={e => setFormData({ ...formData, color: e.target.value })}
                className="w-8 h-8 rounded-full bg-transparent cursor-pointer ml-2 border border-slate-500"
                title="Custom color"
              />
            </div>
          </div>

          {/* Attached Photographed Documentation */}
          <div className="pt-4 border-t-2 border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Photographed Documentation</h3>
                <p className="text-xs text-slate-400">Attach photos of blueprints, plans, permits, or inspections</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowLocalBrowser(prev => !prev)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    showLocalBrowser 
                      ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40 shadow-sm' 
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600'
                  }`}
                  title="Browse and pick photos organized in /uploads and its subfolders"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-yellow-400" />
                  <span>Choose Folder File</span>
                </button>

                <label 
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-600 cursor-pointer transition shadow-sm"
                  title="Upload an entire folder of photos to /uploads"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Upload Folder</span>
                  <input
                    type="file"
                    // @ts-expect-error webkitdirectory is supported by modern browsers
                    webkitdirectory=""
                    directory=""
                    multiple
                    onChange={handleFolderUpload}
                    disabled={isUploading}
                    className="hidden"
                  />
                </label>

                <label 
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer shadow-md transition"
                  title="Upload one or multiple photos"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadProgress || (isUploading ? 'Uploading...' : 'Upload Photos')}</span>
                  <input
                    type="file"
                    accept="image/*,.heic,.HEIC,.pdf"
                    multiple
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Local file picker popup if opened */}
            {showLocalBrowser && (
              <div className="mb-4 p-3 bg-slate-950 border-2 border-slate-700 rounded-xl shadow-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-200 flex items-center">
                      <FolderOpen className="w-4 h-4 text-yellow-400 mr-1.5" />
                      Files in /public/uploads ({localFiles.length} found)
                    </span>
                  </div>
                  <button 
                    onClick={() => setShowLocalBrowser(false)} 
                    className="text-slate-400 hover:text-white text-xs font-semibold px-2 py-0.5 rounded hover:bg-slate-800 transition"
                  >
                    Close
                  </button>
                </div>

                {/* Subfolder and Search Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-[140px]">
                    <select
                      value={selectedSubfolder}
                      onChange={e => setSelectedSubfolder(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                    >
                      <option value="__all__">📁 All Folders ({localFiles.length} files)</option>
                      <option value="__root__">📁 / (Root uploads)</option>
                      {localFolders.map(f => (
                        <option key={f} value={f}>📂 {f}</option>
                      ))}
                    </select>
                  </div>

                  <div className="relative flex-1 min-w-[140px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={e => setSearchFilter(e.target.value)}
                      placeholder="Search photos..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {(() => {
                    const filtered = localFiles.filter(f => {
                      const matchesSubfolder = 
                        selectedSubfolder === '__all__' ? true :
                        selectedSubfolder === '__root__' ? !f.subfolder :
                        f.subfolder === selectedSubfolder || f.subfolder.startsWith(selectedSubfolder + '/');
                      const matchesSearch = !searchFilter.trim() ? true :
                        f.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                        f.subfolder.toLowerCase().includes(searchFilter.toLowerCase());
                      return matchesSubfolder && matchesSearch;
                    });

                    if (filtered.length > 0) {
                      return (
                        <button
                          type="button"
                          onClick={() => handleAddAllFiltered(filtered)}
                          className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow shrink-0"
                          title="Attach all matching photos to this building"
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                          <span>Add All ({filtered.length})</span>
                        </button>
                      );
                    }
                    return null;
                  })()}
                </div>

                {localFiles.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">
                    No files found in public/uploads/ or its subfolders. Drop files/folders there or use Upload Photos / Upload Folder.
                  </p>
                ) : (
                  (() => {
                    const filtered = localFiles.filter(f => {
                      const matchesSubfolder = 
                        selectedSubfolder === '__all__' ? true :
                        selectedSubfolder === '__root__' ? !f.subfolder :
                        f.subfolder === selectedSubfolder || f.subfolder.startsWith(selectedSubfolder + '/');
                      const matchesSearch = !searchFilter.trim() ? true :
                        f.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                        f.subfolder.toLowerCase().includes(searchFilter.toLowerCase());
                      return matchesSubfolder && matchesSearch;
                    });

                    if (filtered.length === 0) {
                      return (
                        <p className="text-xs text-slate-400 py-3 text-center">
                          No files match current folder or search filter.
                        </p>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                        {filtered.map(f => (
                          <button
                            key={f.url}
                            type="button"
                            onClick={() => handleAddLocalFile(f)}
                            className="flex items-center space-x-2.5 p-2 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-blue-500/50 text-left text-xs text-slate-200 hover:text-white transition group"
                            title={`Click to add: ${f.path || f.name}`}
                          >
                            <ImageIcon className="w-4 h-4 text-blue-400 shrink-0 group-hover:scale-110 transition-transform" />
                            <div className="flex-1 min-w-0">
                              <div className="truncate font-medium">{f.name}</div>
                              {f.subfolder ? (
                                <div className="text-[10px] text-amber-400 font-mono truncate mt-0.5">
                                  📁 {f.subfolder}
                                </div>
                              ) : (
                                <div className="text-[10px] text-slate-500 font-mono truncate mt-0.5">
                                  📁 / (root)
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono shrink-0">
                              {f.size ? `${Math.round(f.size / 1024)} KB` : ''}
                            </span>
                          </button>
                        ))}
                      </div>
                    );
                  })()
                )}
              </div>
            )}

            {/* Document list */}
            {formData.documents.length === 0 ? (
              <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center text-slate-400 text-xs bg-slate-950/50">
                <p className="font-medium text-slate-300">No documentation photos attached yet.</p>
                <p className="mt-1 text-slate-500">Click 'Upload Photo' above or choose a file from the uploads folder.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {formData.documents.map((doc, index) => (
                  <div key={doc.id || index} className="p-3 bg-slate-800 border-2 border-slate-700 rounded-xl flex items-start space-x-3 shadow-md">
                    <img 
                      src={doc.url} 
                      alt={doc.title} 
                      className="w-18 h-18 rounded-lg object-cover bg-slate-950 border-2 border-slate-600 shrink-0 shadow"
                    />
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={doc.title}
                        onChange={e => handleUpdateDoc(doc.id, 'title', e.target.value)}
                        placeholder="Document Title (e.g. Ground Floor Blueprint)"
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="text"
                        value={doc.description || ''}
                        onChange={e => handleUpdateDoc(doc.id, 'description', e.target.value)}
                        placeholder="Document details or notes..."
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="flex flex-col space-y-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRotateDoc(doc.id, doc.url)}
                        className="p-2 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition"
                        title="Rotate photo 90° clockwise"
                      >
                        <RotateCw className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveDoc(doc.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
                        title="Remove document photo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t-2 border-slate-800 bg-slate-950 flex items-center justify-between">
          <div>
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-red-400 hover:bg-red-500/10 text-xs font-semibold transition"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Building</span>
              </button>
            ) : (
              <div className="flex items-center space-x-2">
                <span className="text-xs text-red-400 font-bold flex items-center">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                  Confirm delete?
                </span>
                <button
                  type="button"
                  onClick={() => onDelete(formData.id)}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow"
                >
                  Yes, Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
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
              <span>Save Changes</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
