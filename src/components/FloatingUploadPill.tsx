import React, { useState, useEffect } from 'react';
import { useUploadQueue } from '../context/UploadContext';
import { formatBytes } from '../utils/format';
import { Loader2, ChevronRight, X, CheckCircle2 } from 'lucide-react';

export const FloatingUploadPill: React.FC = () => {
  const {
    activeCount,
    queuedCount,
    completedCount,
    deduplicatedCount,
    isUploading,
    overallProgress,
    overallSpeed,
    isMenuOpen,
    openMenu
  } = useUploadQueue();

  const [isDismissed, setIsDismissed] = useState(false);
  const [showRecentlyCompleted, setShowRecentlyCompleted] = useState(false);

  // Reset dismissal when a new upload starts
  useEffect(() => {
    if (isUploading) {
      setIsDismissed(false);
    }
  }, [isUploading]);

  // Flash completed indicator briefly when batch finishes
  useEffect(() => {
    if (!isUploading && completedCount > 0) {
      setShowRecentlyCompleted(true);
      const timer = setTimeout(() => {
        setShowRecentlyCompleted(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isUploading, completedCount]);

  if (isMenuOpen || isDismissed || (!isUploading && !showRecentlyCompleted)) {
    return null;
  }

  const totalInFlight = activeCount + queuedCount;
  const freshlyUploadedCount = Math.max(0, completedCount - deduplicatedCount);
  const allDeduplicated = completedCount > 0 && freshlyUploadedCount === 0;
  const isMixed = freshlyUploadedCount > 0 && deduplicatedCount > 0;

  const completedTitle = allDeduplicated
    ? (deduplicatedCount === 1 ? '1 file deduplicated (reused)' : `All ${deduplicatedCount} files deduplicated (reused)`)
    : isMixed
    ? `${freshlyUploadedCount} uploaded, ${deduplicatedCount} deduplicated`
    : (completedCount === 1 ? '1 file uploaded' : 'Uploads completed');

  return (
    <div className="fixed top-[calc(4.5rem+env(safe-area-inset-top,0px))] left-3 right-3 sm:top-auto sm:left-auto sm:bottom-28 sm:right-6 z-[1150] select-none animate-in fade-in slide-in-from-top-2 sm:slide-in-from-bottom-3 duration-200">
      <div
        onClick={openMenu}
        className={`group flex items-center space-x-3.5 px-4 py-2.5 rounded-2xl border-2 shadow-2xl backdrop-blur-md cursor-pointer transition transform hover:scale-[1.02] ${
          showRecentlyCompleted && !isUploading
            ? allDeduplicated
              ? 'bg-slate-900/95 border-purple-500/60 shadow-purple-950/40 text-white'
              : 'bg-slate-900/95 border-emerald-500/60 shadow-emerald-950/40 text-white'
            : 'bg-slate-900/95 border-blue-500/60 shadow-blue-950/40 text-white'
        }`}
      >
        {/* Icon */}
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
            showRecentlyCompleted && !isUploading
              ? allDeduplicated
                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/30'
                : 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30'
              : 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
          }`}
        >
          {showRecentlyCompleted && !isUploading ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Loader2 className="w-4 h-4 animate-spin" />
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col min-w-[150px]">
          <div className="flex items-center justify-between text-xs font-bold space-x-2">
            <span>
              {showRecentlyCompleted && !isUploading
                ? completedTitle
                : deduplicatedCount > 0
                ? `Uploading ${totalInFlight} file${totalInFlight === 1 ? '' : 's'} (${deduplicatedCount} reused)`
                : `Uploading ${totalInFlight} file${totalInFlight === 1 ? '' : 's'}`}
            </span>
            <span className="font-mono text-blue-300 text-[11px]">
              {showRecentlyCompleted && !isUploading ? '100%' : `${overallProgress}%`}
            </span>
          </div>

          {/* Mini progress bar */}
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5 border border-slate-700/60">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                showRecentlyCompleted && !isUploading
                  ? allDeduplicated
                    ? 'bg-purple-500'
                    : 'bg-emerald-500'
                  : 'bg-gradient-to-r from-blue-500 to-indigo-500'
              }`}
              style={{ width: `${showRecentlyCompleted && !isUploading ? 100 : overallProgress}%` }}
            />
          </div>

          {isUploading && overallSpeed > 0 && (
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              {formatBytes(overallSpeed)}/s
            </div>
          )}
        </div>

        {/* View Queue action & Dismiss */}
        <div className="flex items-center space-x-1 pl-1 border-l border-slate-800">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openMenu();
            }}
            className="p-1 text-slate-400 group-hover:text-white rounded-lg hover:bg-slate-800 transition"
            title="View upload queue"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsDismissed(true);
            }}
            className="p-1 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-slate-800 transition"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
