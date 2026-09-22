import React, { useState, useEffect } from 'react';
import { Building, DocumentItem } from '../types';
import { rotateImage } from '../api';
import { 
  X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, RotateCw,
  FileText, Calendar, Edit3, ExternalLink, Maximize2, Save
} from 'lucide-react';

interface DocLightboxModalProps {
  building: Building;
  allBuildings: Building[];
  onClose: () => void;
  onSelectBuilding: (b: Building) => void;
  onOpenEdit: (b: Building) => void;
}

export const DocLightboxModal: React.FC<DocLightboxModalProps> = ({
  building,
  allBuildings,
  onClose,
  onSelectBuilding,
  onOpenEdit
}) => {
  const [activeDocIndex, setActiveDocIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isRotating, setIsRotating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const activeDoc: DocumentItem | undefined = building.documents[activeDocIndex];

  // Reset zoom & pan & rotation when switching documents or buildings
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  }, [building.id, activeDocIndex]);

  const handleRotatePermanent = async () => {
    if (!activeDoc) return;
    try {
      setIsRotating(true);
      const res = await rotateImage(activeDoc.url, 90);
      activeDoc.url = res.url;
      setRotation(0);
    } catch (err: any) {
      alert('Failed to save rotation: ' + (err.message || 'Unknown error'));
    } finally {
      setIsRotating(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && building.documents.length > 1) {
        setActiveDocIndex(prev => (prev + 1) % building.documents.length);
      }
      if (e.key === 'ArrowLeft' && building.documents.length > 1) {
        setActiveDocIndex(prev => (prev - 1 + building.documents.length) % building.documents.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [building.documents.length, onClose]);

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom(prev => Math.min(Math.max(prev * zoomFactor, 0.5), 8));
  };

  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col h-full h-dvh max-h-dvh bg-slate-950 text-slate-100 select-none animate-in fade-in duration-150">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3.5 bg-slate-900 border-b-2 border-slate-800 shadow-xl z-20 pt-[calc(0.625rem+env(safe-area-inset-top,0px))]">
        <div className="flex items-center space-x-2.5 sm:space-x-4 min-w-0 pr-2">
          <div 
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-bold text-lg sm:text-xl text-white shadow-lg border-2 border-white/40 shrink-0"
            style={{ backgroundColor: building.color || '#3b82f6' }}
          >
            {building.letter}
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h2 className="text-sm sm:text-lg font-bold text-white tracking-wide truncate max-w-[140px] sm:max-w-xs">{building.name}</h2>
              <span className="hidden xs:inline-block text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 font-mono border border-slate-700 font-bold shrink-0">
                [{building.letter}]
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 line-clamp-1 max-w-2xl">{building.description}</p>
          </div>
        </div>

        {/* Building Selector Quick-Switch */}
        <div className="hidden md:flex items-center space-x-1.5 bg-slate-950 p-1.5 rounded-xl border-2 border-slate-800 shrink-0">
          {allBuildings.map(b => (
            <button
              key={b.id}
              onClick={() => {
                onSelectBuilding(b);
                setActiveDocIndex(0);
              }}
              className={`w-9 h-9 rounded-lg font-bold text-sm transition-all flex items-center justify-center ${
                b.id === building.id
                  ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title={`${b.letter}: ${b.name}`}
            >
              {b.letter}
            </button>
          ))}
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1.5 sm:space-x-2.5 shrink-0">
          <button
            onClick={() => onOpenEdit(building)}
            className="flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border-2 border-slate-700 shadow transition"
            title="Edit building or add documentation photos"
          >
            <Edit3 className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Edit Building</span>
            <span className="inline sm:hidden">Edit</span>
          </button>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white border-2 border-slate-700 shadow transition"
            title="Close Lightbox (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Document Viewer Area */}
      <div className="flex-1 relative flex overflow-hidden bg-slate-950">
        {building.documents.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <FileText className="w-16 h-16 stroke-1 text-slate-600 mb-4" />
            <h3 className="text-xl font-bold text-slate-200">No Documentation Photographed Yet</h3>
            <p className="text-sm text-slate-400 max-w-md mt-2">
              You haven't attached any document photos or blueprints to Building {building.letter} yet.
            </p>
            <button
              onClick={() => onOpenEdit(building)}
              className="mt-6 flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/20 transition"
            >
              <Edit3 className="w-4 h-4" />
              <span>Attach Photos Now</span>
            </button>
          </div>
        ) : (
          <div 
            className="flex-1 relative flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing bg-slate-950"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            {/* The Document Image Canvas */}
            {activeDoc && (
              <div
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                  transition: isDragging ? 'none' : 'transform 0.15s ease-out'
                }}
                className="max-w-full max-h-full flex items-center justify-center select-none"
              >
                <img
                  src={activeDoc.url}
                  alt={activeDoc.title}
                  className="max-h-[80vh] max-w-[90vw] object-contain rounded-lg shadow-2xl border-2 border-slate-700 pointer-events-none bg-slate-900"
                  draggable={false}
                />
              </div>
            )}

            {/* Navigation Arrows for Multiple Documents */}
            {building.documents.length > 1 && (
              <>
                <button
                  onClick={() => setActiveDocIndex(prev => (prev - 1 + building.documents.length) % building.documents.length)}
                  className="absolute left-6 top-1/2 -translate-y-1/2 p-3.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white border-2 border-slate-700 shadow-2xl transition"
                  title="Previous Document (Left Arrow)"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={() => setActiveDocIndex(prev => (prev + 1) % building.documents.length)}
                  className="absolute right-6 top-1/2 -translate-y-1/2 p-3.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white border-2 border-slate-700 shadow-2xl transition"
                  title="Next Document (Right Arrow)"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            {/* Floating Zoom & Pan Controls */}
            <div className="absolute top-3 right-3 sm:top-auto sm:bottom-6 sm:right-6 flex items-center space-x-1 sm:space-x-2 bg-slate-900/95 border-2 border-slate-700 p-1 sm:p-2 rounded-2xl shadow-2xl z-30 backdrop-blur-sm">
              <button
                onClick={() => setZoom(prev => Math.min(prev * 1.3, 8))}
                className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition"
                title="Zoom In (+)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoom(prev => Math.max(prev * 0.75, 0.5))}
                className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition"
                title="Zoom Out (-)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={resetZoom}
                className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition text-xs font-mono font-bold"
                title="Reset Zoom (100%)"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <span className="px-1.5 font-mono text-[11px] sm:text-xs text-slate-300 font-bold min-w-[3rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setRotation(r => (r + 90) % 360)}
                className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition flex items-center space-x-1"
                title="Rotate View 90°"
              >
                <RotateCw className="w-4 h-4 text-amber-400" />
              </button>
              {rotation !== 0 && (
                <button
                  onClick={handleRotatePermanent}
                  disabled={isRotating}
                  className="px-2 py-1 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-[11px] sm:text-xs font-bold transition flex items-center space-x-1 shadow"
                  title="Permanently save this 90° rotation to file"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isRotating ? '...' : 'Save'}</span>
                </button>
              )}
              {activeDoc && (
                <a
                  href={activeDoc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 transition"
                  title="Open Original Photo in New Tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>

            {/* Active Document Info Overlay (Bottom Left) */}
            {activeDoc && (
              <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:bottom-6 sm:left-6 max-w-sm sm:max-w-lg bg-slate-900/95 border-2 border-slate-700 p-3 sm:p-4 rounded-2xl shadow-2xl z-20 backdrop-blur-sm">
                <div className="flex items-center space-x-2">
                  <h4 className="font-bold text-white text-xs sm:text-sm truncate">{activeDoc.title}</h4>
                  <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-700 font-mono font-bold shrink-0">
                    {activeDocIndex + 1}/{building.documents.length}
                  </span>
                </div>
                {activeDoc.description && (
                  <p className="text-[11px] sm:text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed font-medium">
                    {activeDoc.description}
                  </p>
                )}
                {activeDoc.uploadedAt && (
                  <div className="flex items-center space-x-1.5 mt-1.5 text-[10px] sm:text-[11px] text-slate-400 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Attached {new Date(activeDoc.uploadedAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Thumbnails Carousel Bar */}
      {building.documents.length > 1 && (
        <div className="bg-slate-900 border-t-2 border-slate-800 px-3 sm:px-6 py-2 sm:py-3.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] flex items-center space-x-3 sm:space-x-4 overflow-x-auto z-20 shadow-2xl">
          <div className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5 shrink-0">
            <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
            <span className="hidden sm:inline">Documents ({building.documents.length}):</span>
            <span className="inline sm:hidden">Docs ({building.documents.length}):</span>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3">
            {building.documents.map((doc, idx) => (
              <button
                key={doc.id || idx}
                onClick={() => setActiveDocIndex(idx)}
                className={`relative group rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                  idx === activeDocIndex
                    ? 'border-blue-500 ring-4 ring-blue-500/40 shadow-xl scale-105'
                    : 'border-slate-700 hover:border-slate-500 opacity-70 hover:opacity-100'
                }`}
              >
                <img
                  src={doc.url}
                  alt={doc.title}
                  className="w-16 h-12 sm:w-24 sm:h-16 object-cover bg-slate-950"
                />
                <div className="absolute inset-x-0 bottom-0 bg-slate-950/95 px-1 py-0.5 text-[9px] sm:text-[10px] text-slate-200 font-bold truncate text-center max-w-[4rem] sm:max-w-[6rem]">
                  {doc.title || `Doc ${idx + 1}`}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
