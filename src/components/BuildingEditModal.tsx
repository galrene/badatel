import React, { useState, useEffect } from 'react';
import { Building, DocumentItem } from '../types';
import { uploadImageFile, fetchLocalFiles, rotateImage } from '../api';
import { 
  X, Trash2, Upload, Check, AlertTriangle, 
  Image as ImageIcon, FolderOpen, RotateCw 
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
  const [localFiles, setLocalFiles] = useState<{ name: string; url: string; size: number }[]>([]);
  const [showLocalBrowser, setShowLocalBrowser] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setFormData({ ...building });
    setConfirmDelete(false);
  }, [building]);

  useEffect(() => {
    if (showLocalBrowser) {
      fetchLocalFiles().then(setLocalFiles);
    }
  }, [showLocalBrowser]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const res = await uploadImageFile(file, 'doc');
      const newDoc: DocumentItem = {
        id: `doc-${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ''),
        description: '',
        url: res.url,
        uploadedAt: new Date().toISOString()
      };
      setFormData(prev => ({
        ...prev,
        documents: [...prev.documents, newDoc]
      }));
    } catch (err: any) {
      console.error('File upload error:', err);
      alert('Upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleAddLocalFile = (fileUrl: string, fileName: string) => {
    const newDoc: DocumentItem = {
      id: `doc-${Date.now()}`,
      title: fileName.replace(/\.[^/.]+$/, ''),
      description: '',
      url: fileUrl,
      uploadedAt: new Date().toISOString()
    };
    setFormData(prev => ({
      ...prev,
      documents: [...prev.documents, newDoc]
    }));
    setShowLocalBrowser(false);
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
                  onClick={() => setShowLocalBrowser(true)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-600 transition"
                  title="Pick a photo dropped into public/uploads"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-yellow-400" />
                  <span>Choose Folder File</span>
                </button>
                <label className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer shadow-md transition">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isUploading ? 'Uploading...' : 'Upload Photo'}</span>
                  <input
                    type="file"
                    accept="image/*,.heic,.HEIC,.pdf"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Local file picker popup if opened */}
            {showLocalBrowser && (
              <div className="mb-4 p-3 bg-slate-950 border-2 border-slate-700 rounded-xl shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-200">Files available in /public/uploads:</span>
                  <button onClick={() => setShowLocalBrowser(false)} className="text-slate-400 hover:text-white text-xs font-semibold">
                    Close
                  </button>
                </div>
                {localFiles.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">No files in public/uploads/ yet. Drop images there or use Upload Photo.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {localFiles.map(f => (
                      <button
                        key={f.url}
                        type="button"
                        onClick={() => handleAddLocalFile(f.url, f.name)}
                        className="flex items-center space-x-2 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left text-xs text-slate-200 hover:text-white transition"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="truncate">{f.name}</span>
                      </button>
                    ))}
                  </div>
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
