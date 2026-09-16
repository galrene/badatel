import React from 'react';
import { X } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/90 animate-in fade-in duration-150">
      <div className="bg-slate-900 border-2 border-slate-600 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b-2 border-slate-800 flex items-center justify-between bg-slate-950">
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <span>📖 How to Use Your Interactive Site Plan</span>
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-sm text-slate-200 max-h-[75vh] overflow-y-auto leading-relaxed bg-slate-900">
          {/* Step 1 */}
          <div className="flex items-start space-x-3.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/30 border border-blue-500/50 text-blue-300 flex items-center justify-center font-bold text-sm shrink-0">
              1
            </div>
            <div>
              <h3 className="font-bold text-white">Using your own photographed site map</h3>
              <p className="text-xs text-slate-300 mt-1">
                Click the <strong className="text-white">Settings icon (⚙️)</strong> in the top header. You can upload your photograph or scan directly from your computer, or drop it into the <code className="text-blue-300 bg-slate-800 px-1 py-0.5 rounded border border-slate-700">public/uploads/</code> folder.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start space-x-3.5">
            <div className="w-8 h-8 rounded-xl bg-amber-600/30 border border-amber-500/50 text-amber-300 flex items-center justify-center font-bold text-sm shrink-0">
              2
            </div>
            <div>
              <h3 className="font-bold text-white">Marking buildings with letters</h3>
              <p className="text-xs text-slate-300 mt-1">
                Switch to <strong className="text-amber-400">Edit Footprints</strong> mode, then click <strong className="text-blue-400">+ Draw Building Footprint</strong>. Click around the building boundary on the map and double-click (or click the start point) to finish. The app automatically computes the center and assigns the next letter badge (<code className="text-emerald-400 font-mono font-bold">A, B, C...</code>).
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start space-x-3.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 flex items-center justify-center font-bold text-sm shrink-0">
              3
            </div>
            <div>
              <h3 className="font-bold text-white">Attaching photographed documentation</h3>
              <p className="text-xs text-slate-300 mt-1">
                In Edit mode, click any building or letter badge to open its editor. Upload your photos or scans of blueprints, permits, or notes. You can attach multiple photos per building and add titles or descriptions to each document.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex items-start space-x-3.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/50 text-indigo-300 flex items-center justify-center font-bold text-sm shrink-0">
              4
            </div>
            <div>
              <h3 className="font-bold text-white">Automatic persistence to disk</h3>
              <p className="text-xs text-slate-300 mt-1">
                All coordinates, letters, building descriptions, and uploaded images are saved directly on disk in:
              </p>
              <ul className="text-xs text-slate-300 list-disc list-inside mt-1 space-y-0.5 font-mono">
                <li><span className="text-blue-300">data/buildings.json</span> (all marked polygons & metadata)</li>
                <li><span className="text-blue-300">public/uploads/</span> (all uploaded photographs)</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t-2 border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md"
          >
            Got it, Let's Go
          </button>
        </div>
      </div>
    </div>
  );
};
