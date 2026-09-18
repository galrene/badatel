import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { uploadFileWithProgress } from '../api';
import { DocumentItem } from '../types';

export type UploadStatus = 'queued' | 'uploading' | 'processing' | 'completed' | 'error' | 'cancelled';

export interface UploadTask {
  id: string;
  file: File;
  filename: string;
  target: 'doc' | 'map';
  targetId?: string; // buildingId or mapId
  targetName?: string; // e.g. "[A] Administration" or "Site Plan"
  subfolder?: string;
  status: UploadStatus;
  progress: number; // 0 - 100
  loadedBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  error?: string;
  resultUrl?: string;
  resultWidth?: number;
  resultHeight?: number;
  startedAt?: number;
  completedAt?: number;
}

export interface EnqueueOptions {
  target: 'doc' | 'map';
  targetId?: string;
  targetName?: string;
  subfolder?: string;
}

interface UploadContextType {
  tasks: UploadTask[];
  activeCount: number;
  queuedCount: number;
  completedCount: number;
  errorCount: number;
  isUploading: boolean;
  overallProgress: number;
  overallSpeed: number;
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  openMenu: () => void;
  closeMenu: () => void;
  enqueueUploads: (files: File[], options: EnqueueOptions) => string[];
  cancelUpload: (taskId: string) => void;
  cancelAll: () => void;
  retryUpload: (taskId: string) => void;
  clearCompleted: () => void;
  clearAll: () => void;
  registerDocumentHandler: (handler: (buildingId: string, doc: DocumentItem) => void) => () => void;
}

const UploadContext = createContext<UploadContextType | null>(null);

const MAX_CONCURRENT = 2;

export interface UploadProviderProps {
  children: React.ReactNode;
  onDocumentCompleted?: (buildingId: string, doc: DocumentItem) => void;
}

export const UploadProvider: React.FC<UploadProviderProps> = ({ children, onDocumentCompleted }) => {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Active abort controllers & throttle tracking
  const activeControllersRef = useRef<Map<string, AbortController>>(new Map());
  const lastProgressUpdateRef = useRef<Map<string, number>>(new Map());
  const tasksRef = useRef<UploadTask[]>([]);
  tasksRef.current = tasks;

  const onDocumentCompletedRef = useRef(onDocumentCompleted);
  onDocumentCompletedRef.current = onDocumentCompleted;

  // Registered document completion handlers
  const docHandlersRef = useRef<Set<(buildingId: string, doc: DocumentItem) => void>>(new Set());

  const registerDocumentHandler = useCallback((handler: (buildingId: string, doc: DocumentItem) => void) => {
    docHandlersRef.current.add(handler);
    return () => {
      docHandlersRef.current.delete(handler);
    };
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<UploadTask>) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  // Worker loop to start next queued tasks
  const runQueue = useCallback(() => {
    const currentTasks = tasksRef.current;
    const activeTasks = currentTasks.filter(t => t.status === 'uploading' || t.status === 'processing');
    const availableSlots = MAX_CONCURRENT - activeTasks.length;

    if (availableSlots <= 0) return;

    const queuedTasks = currentTasks.filter(t => t.status === 'queued');
    const tasksToStart = queuedTasks.slice(0, availableSlots);

    tasksToStart.forEach(task => {
      startTask(task.id);
    });
  }, []);

  // Run the queue whenever tasks change
  useEffect(() => {
    runQueue();
  }, [tasks, runQueue]);

  const startTask = async (taskId: string) => {
    const task = tasksRef.current.find(t => t.id === taskId);
    if (!task || task.status !== 'queued') return;

    const abortController = new AbortController();
    activeControllersRef.current.set(taskId, abortController);

    const startTime = Date.now();
    let lastBytes = 0;
    let lastTime = startTime;

    updateTask(taskId, {
      status: 'uploading',
      progress: 0,
      loadedBytes: 0,
      startedAt: startTime,
      error: undefined
    });

    try {
      const res = await uploadFileWithProgress(task.file, {
        target: task.target,
        subfolder: task.subfolder,
        signal: abortController.signal,
        onProgress: (info) => {
          const now = Date.now();
          const lastUpdate = lastProgressUpdateRef.current.get(taskId) || 0;
          const shouldUpdateState = now - lastUpdate >= 100 || info.percent === 100;

          const timeDelta = (now - lastTime) / 1000;
          let speed = 0;
          if (timeDelta > 0.4) {
            const fileBytes = Math.min(task.file.size, Math.round((info.loaded / info.total) * task.file.size));
            speed = Math.max(0, (fileBytes - lastBytes) / timeDelta);
            lastBytes = fileBytes;
            lastTime = now;
          }

          if (shouldUpdateState) {
            lastProgressUpdateRef.current.set(taskId, now);
            const currentFileBytes = Math.min(task.file.size, Math.round((info.loaded / info.total) * task.file.size));
            updateTask(taskId, {
              progress: info.percent,
              loadedBytes: currentFileBytes,
              totalBytes: task.file.size,
              ...(speed > 0 ? { speedBytesPerSec: speed } : {})
            });
          }
        },
        onProcessing: () => {
          updateTask(taskId, {
            status: 'processing',
            progress: 100,
            loadedBytes: task.file.size
          });
        }
      });

      activeControllersRef.current.delete(taskId);
      lastProgressUpdateRef.current.delete(taskId);

      const completedAt = Date.now();
      updateTask(taskId, {
        status: 'completed',
        progress: 100,
        loadedBytes: task.file.size,
        resultUrl: res.url,
        resultWidth: res.width,
        resultHeight: res.height,
        completedAt,
        speedBytesPerSec: 0
      });

      // If document upload with building target, trigger handlers
      if (task.target === 'doc' && task.targetId) {
        const newDoc: DocumentItem = {
          id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title: task.file.name.replace(/\.[^/.]+$/, ''),
          description: task.subfolder ? `Folder: ${task.subfolder}` : '',
          url: res.url,
          uploadedAt: new Date().toISOString()
        };

        if (onDocumentCompletedRef.current) {
          try {
            onDocumentCompletedRef.current(task.targetId, newDoc);
          } catch (err) {
            console.error('Error in onDocumentCompleted callback:', err);
          }
        }

        docHandlersRef.current.forEach(handler => {
          try {
            handler(task.targetId!, newDoc);
          } catch (err) {
            console.error('Error in document upload completion handler:', err);
          }
        });
      }
    } catch (err: any) {
      activeControllersRef.current.delete(taskId);
      if (err.name === 'AbortError') {
        updateTask(taskId, {
          status: 'cancelled',
          speedBytesPerSec: 0
        });
      } else {
        console.error('Upload task error:', err);
        updateTask(taskId, {
          status: 'error',
          error: err.message || 'Upload failed',
          speedBytesPerSec: 0
        });
      }
    }
  };

  const enqueueUploads = useCallback((files: File[], options: EnqueueOptions): string[] => {
    const newTasks: UploadTask[] = files.map((file, idx) => ({
      id: `task-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      file,
      filename: file.name,
      target: options.target,
      targetId: options.targetId,
      targetName: options.targetName,
      subfolder: options.subfolder,
      status: 'queued',
      progress: 0,
      loadedBytes: 0,
      totalBytes: file.size,
      speedBytesPerSec: 0
    }));

    setTasks(prev => [...prev, ...newTasks]);
    return newTasks.map(t => t.id);
  }, []);

  const cancelUpload = useCallback((taskId: string) => {
    const controller = activeControllersRef.current.get(taskId);
    if (controller) {
      controller.abort();
      activeControllersRef.current.delete(taskId);
    }
    updateTask(taskId, {
      status: 'cancelled',
      speedBytesPerSec: 0
    });
  }, [updateTask]);

  const cancelAll = useCallback(() => {
    activeControllersRef.current.forEach(ctrl => ctrl.abort());
    activeControllersRef.current.clear();
    setTasks(prev =>
      prev.map(t =>
        t.status === 'queued' || t.status === 'uploading' || t.status === 'processing'
          ? { ...t, status: 'cancelled', speedBytesPerSec: 0 }
          : t
      )
    );
  }, []);

  const retryUpload = useCallback((taskId: string) => {
    updateTask(taskId, {
      status: 'queued',
      progress: 0,
      loadedBytes: 0,
      error: undefined,
      speedBytesPerSec: 0
    });
  }, [updateTask]);

  const clearCompleted = useCallback(() => {
    setTasks(prev => prev.filter(t => t.status !== 'completed' && t.status !== 'cancelled'));
  }, []);

  const clearAll = useCallback(() => {
    activeControllersRef.current.forEach(ctrl => ctrl.abort());
    activeControllersRef.current.clear();
    setTasks([]);
  }, []);

  const activeCount = tasks.filter(t => t.status === 'uploading' || t.status === 'processing').length;
  const queuedCount = tasks.filter(t => t.status === 'queued').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const errorCount = tasks.filter(t => t.status === 'error').length;
  const isUploading = activeCount + queuedCount > 0;

  // Aggregate overall progress across all non-cancelled tasks
  const relevantTasks = tasks.filter(t => t.status !== 'cancelled');
  const totalBytesSum = relevantTasks.reduce((acc, t) => acc + t.totalBytes, 0);
  const loadedBytesSum = relevantTasks.reduce((acc, t) => {
    if (t.status === 'completed') return acc + t.totalBytes;
    return acc + t.loadedBytes;
  }, 0);
  const overallProgress = totalBytesSum > 0 ? Math.min(100, Math.round((loadedBytesSum / totalBytesSum) * 100)) : 0;

  const overallSpeed = tasks
    .filter(t => t.status === 'uploading')
    .reduce((acc, t) => acc + (t.speedBytesPerSec || 0), 0);

  const openMenu = useCallback(() => setIsMenuOpen(true), []);
  const closeMenu = useCallback(() => setIsMenuOpen(false), []);

  const contextValue = React.useMemo<UploadContextType>(
    () => ({
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
      openMenu,
      closeMenu,
      enqueueUploads,
      cancelUpload,
      cancelAll,
      retryUpload,
      clearCompleted,
      clearAll,
      registerDocumentHandler
    }),
    [
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
      openMenu,
      closeMenu,
      enqueueUploads,
      cancelUpload,
      cancelAll,
      retryUpload,
      clearCompleted,
      clearAll,
      registerDocumentHandler
    ]
  );

  return (
    <UploadContext.Provider value={contextValue}>
      {children}
    </UploadContext.Provider>
  );
};

export const useUploadQueue = () => {
  const ctx = useContext(UploadContext);
  if (!ctx) {
    throw new Error('useUploadQueue must be used within an UploadProvider');
  }
  return ctx;
};
