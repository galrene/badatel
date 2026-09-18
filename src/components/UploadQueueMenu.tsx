import React, { useRef, useEffect } from 'react';
import { useUploadQueue, UploadTask } from '../context/UploadContext';
import { formatBytes } from '../utils/format';
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  X,
  RotateCw,
  Clock,
  Loader2,
  Trash2,
  XCircle,
  Building2,
  Map as MapIcon
} from 'lucide-react';

export const UploadQueueMenu: React.FC = () => {
  const {
    tasks,
    activeCount,
    queuedCount,
    completedCount,
    errorCount,
    isUploading,
    overallProgress,
    overallSpeed,
    isMenuOpen,
    setIsMenuOpen,
    cancelUpload,
    cancelAll,
    retryUpload,
    clearCompleted
  } = useUploadQueue();

  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen, setIsMenuOpen]);

  const totalInFlight = activeCount + queuedCount;
  const hasItemsToClear = completedCount > 0 || tasks.some(t => t.status === 'cancelled');

  return (
    <div className="relative inline-block" ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className={`p-2.5 rounded-xl border-2 transition relative flex items-center justify-center ${
          isUploading
            ? 'bg-blue-600/20 text-blue-400 border-blue-500/60 shadow-lg shadow-blue-500/20 animate-pulse'
            : errorCount > 0
            ? 'bg-rose-900/30 text-rose-300 border-rose-600/50 hover:bg-rose-900/40'
            : isMenuOpen
            ? 'bg-slate-700 text-white border-slate-600'
            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700 shadow'
        }`}
        title={`Upload Queue & Status (${totalInFlight} in progress, ${completedCount} done, ${errorCount} errors)`}
      >
        {isUploading ? (
          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
        ) : errorCount > 0 ? (
          <AlertCircle className="w-4 h-4 text-rose-400" />
        ) : (
          <UploadCloud className="w-4 h-4" />
        )}

        {/* Badge for in-flight or failed count */}
        {totalInFlight > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full border-2 border-slate-900 shadow-md min-w-[18px] text-center">
            {totalInFlight}
          </span>
        )}

        {totalInFlight === 0 && errorCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full border-2 border-slate-900 shadow-md min-w-[18px] text-center">
            {errorCount}
          </span>
        )}

        {totalInFlight === 0 && errorCount === 0 && completedCount > 0 && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900" />
        )}
      </button>

      {/* Dropdown Panel */}
      {isMenuOpen && (
        <div className="absolute right-0 mt-2.5 w-[420px] max-w-[92vw] bg-slate-900 border-2 border-slate-700/80 rounded-2xl shadow-2xl z-[1250] overflow-hidden text-left animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="p-4 bg-slate-950/80 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <UploadCloud className="w-4 h-4 text-blue-400" />
                <h2 className="text-xs font-bold text-white tracking-wide uppercase">
                  Upload Queue
                </h2>
                {tasks.length > 0 && (
                  <span className="text-[11px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700 font-mono">
                    {tasks.length}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {isUploading && (
                  <button
                    onClick={cancelAll}
                    className="text-[11px] bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 px-2 py-1 rounded-lg transition flex items-center space-x-1"
                    title="Cancel all pending and active uploads"
                  >
                    <XCircle className="w-3 h-3" />
                    <span>Cancel All</span>
                  </button>
                )}

                {hasItemsToClear && (
                  <button
                    onClick={clearCompleted}
                    className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2 py-1 rounded-lg transition flex items-center space-x-1"
                    title="Clear completed and cancelled tasks"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                )}

                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                  title="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Overall Status Bar & Speed */}
            {isUploading && (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="text-slate-300 font-medium">
                    Uploading {activeCount + completedCount} of {tasks.filter(t => t.status !== 'cancelled').length} files
                  </span>
                  <span className="font-mono text-blue-300">
                    {overallProgress}% {overallSpeed > 0 && `• ${formatBytes(overallSpeed)}/s`}
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden p-0.5 border border-slate-700">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Task List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-800/80 p-2 space-y-1">
            {tasks.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <UploadCloud className="w-10 h-10 text-slate-600 mx-auto mb-2.5 stroke-[1.5]" />
                <p className="text-xs font-semibold text-slate-300">Queue is empty</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-[240px] mx-auto">
                  Photos, folders, or map sheets uploaded will display live progress here.
                </p>
              </div>
            ) : (
              tasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onCancel={() => cancelUpload(task.id)}
                  onRetry={() => retryUpload(task.id)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface TaskRowProps {
  task: UploadTask;
  onCancel: () => void;
  onRetry: () => void;
}

const TaskRow: React.FC<TaskRowProps> = ({ task, onCancel, onRetry }) => {
  return (
    <div className="p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 border border-slate-800 transition flex flex-col space-y-2">
      <div className="flex items-start justify-between space-x-2">
        {/* Left: Destination & Filename */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-1.5 mb-1">
            {task.target === 'doc' ? (
              <span className="inline-flex items-center space-x-1 text-[10px] font-semibold bg-blue-950 text-blue-300 px-1.5 py-0.2 rounded border border-blue-800/60 max-w-[180px] truncate">
                <Building2 className="w-2.5 h-2.5 flex-shrink-0" />
                <span className="truncate">{task.targetName || 'Building Document'}</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 text-[10px] font-semibold bg-indigo-950 text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-800/60 max-w-[180px] truncate">
                <MapIcon className="w-2.5 h-2.5 flex-shrink-0" />
                <span className="truncate">{task.targetName || 'Map Sheet'}</span>
              </span>
            )}

            {task.subfolder && (
              <span className="text-[10px] text-slate-400 font-mono truncate max-w-[110px]" title={`Folder: ${task.subfolder}`}>
                /{task.subfolder}
              </span>
            )}
          </div>

          <p className="text-xs font-semibold text-slate-200 truncate" title={task.filename}>
            {task.filename}
          </p>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-1 flex-shrink-0 pt-0.5">
          {(task.status === 'queued' || task.status === 'uploading' || task.status === 'processing') && (
            <button
              onClick={onCancel}
              className="p-1 rounded-md text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 transition"
              title="Cancel upload"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {(task.status === 'error' || task.status === 'cancelled') && (
            <button
              onClick={onRetry}
              className="p-1 rounded-md text-blue-400 hover:text-blue-200 hover:bg-blue-950/40 transition"
              title="Retry upload"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar (if uploading or processing) */}
      {(task.status === 'uploading' || task.status === 'processing') && (
        <div className="w-full bg-slate-700/80 h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-200 ${
              task.status === 'processing'
                ? 'bg-amber-500 animate-pulse w-full'
                : 'bg-blue-500'
            }`}
            style={{ width: task.status === 'processing' ? '100%' : `${task.progress}%` }}
          />
        </div>
      )}

      {/* Status Footer */}
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center space-x-1.5">
          {task.status === 'queued' && (
            <>
              <Clock className="w-3 h-3 text-slate-500" />
              <span className="text-slate-400">Queued</span>
            </>
          )}

          {task.status === 'uploading' && (
            <>
              <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
              <span className="text-blue-300 font-mono">
                {task.progress}% • {formatBytes(task.loadedBytes)} / {formatBytes(task.totalBytes)}
                {task.speedBytesPerSec > 0 && ` • ${formatBytes(task.speedBytesPerSec)}/s`}
              </span>
            </>
          )}

          {task.status === 'processing' && (
            <>
              <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
              <span className="text-amber-300">Processing on server...</span>
            </>
          )}

          {task.status === 'completed' && (
            <>
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Uploaded</span>
            </>
          )}

          {task.status === 'error' && (
            <>
              <AlertCircle className="w-3 h-3 text-rose-400" />
              <span className="text-rose-400 truncate max-w-[220px]" title={task.error}>
                {task.error || 'Failed'}
              </span>
            </>
          )}

          {task.status === 'cancelled' && (
            <>
              <X className="w-3 h-3 text-slate-500" />
              <span className="text-slate-500">Cancelled</span>
            </>
          )}
        </div>

        <span className="text-slate-500 font-mono text-[10px]">
          {formatBytes(task.totalBytes)}
        </span>
      </div>
    </div>
  );
};
