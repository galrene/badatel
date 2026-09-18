import { Building, MapSettings, ImportPreview, LocalFilesResponse, AppVersionInfo, HashCheckItem, HashCheckResult } from './types';

export async function fetchInitialData(): Promise<{ settings: MapSettings; buildings: Building[] }> {
  const res = await fetch('/api/data');
  if (!res.ok) throw new Error('Failed to load map data');
  return res.json();
}

export async function saveBuildings(buildings: Building[]): Promise<void> {
  const res = await fetch('/api/buildings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ buildings }),
  });
  if (!res.ok) throw new Error('Failed to save buildings');
}

export async function saveSettings(settings: Partial<MapSettings>): Promise<MapSettings> {
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  const data = await res.json();
  return data.settings;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Computes SHA-256 hash of a file client-side in milliseconds using Web Crypto API
 */
export async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Checks with the server if files with the given hashes already exist in uploads
 */
export async function checkDuplicateHashes(items: HashCheckItem[]): Promise<HashCheckResult[]> {
  const res = await fetch('/api/upload/check-hashes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error('Failed to check duplicate hashes');
  const data = await res.json();
  return data.results || [];
}

export async function uploadImageFile(
  file: File,
  target: 'map' | 'doc' = 'doc',
  subfolder?: string
): Promise<{ url: string; filename: string; width?: number; height?: number; subfolder?: string; deduplicated?: boolean }> {
  const base64 = await fileToBase64(file);

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      base64,
      target,
      subfolder
    })
  });

  if (!res.ok) throw new Error('Failed to upload image file');
  return res.json();
}

export interface UploadProgressInfo {
  loaded: number;
  total: number;
  percent: number;
}

export interface UploadFileOptions {
  target?: 'map' | 'doc';
  subfolder?: string;
  onProgress?: (info: UploadProgressInfo) => void;
  onProcessing?: () => void;
  signal?: AbortSignal;
}

export function uploadFileWithProgress(
  file: File,
  options: UploadFileOptions = {}
): Promise<{ url: string; filename: string; originalName?: string; width?: number; height?: number; subfolder?: string; deduplicated?: boolean }> {
  return new Promise(async (resolve, reject) => {
    try {
      if (options.signal?.aborted) {
        return reject(new DOMException('Aborted', 'AbortError'));
      }

      const base64 = await fileToBase64(file);
      if (options.signal?.aborted) {
        return reject(new DOMException('Aborted', 'AbortError'));
      }

      const xhr = new XMLHttpRequest();

      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          xhr.abort();
          reject(new DOMException('Aborted', 'AbortError'));
        });
      }

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && e.total > 0) {
          const percent = Math.min(99, Math.round((e.loaded / e.total) * 100));
          options.onProgress?.({
            loaded: e.loaded,
            total: e.total,
            percent
          });
          if (e.loaded >= e.total) {
            options.onProcessing?.();
          }
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch (err) {
            reject(new Error('Invalid JSON response from server'));
          }
        } else {
          try {
            const data = JSON.parse(xhr.responseText);
            reject(new Error(data.error || `Upload failed with status ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      xhr.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      });

      xhr.open('POST', '/api/upload');
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify({
        filename: file.name,
        base64,
        target: options.target || 'doc',
        subfolder: options.subfolder
      }));
    } catch (err) {
      reject(err);
    }
  });
}

export async function rotateImage(url: string, degrees: number = 90, isMap: boolean = false, mapId?: string): Promise<{ url: string; width: number; height: number; settings?: MapSettings }> {
  const res = await fetch('/api/rotate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, degrees, isMap, mapId }),
  });
  if (!res.ok) throw new Error('Failed to rotate image');
  return res.json();
}

export async function fetchLocalFiles(): Promise<LocalFilesResponse> {
  try {
    const res = await fetch('/api/local-files');
    if (!res.ok) return { files: [], folders: [] };
    const data = await res.json();
    return {
      files: data.files || [],
      folders: data.folders || []
    };
  } catch {
    return { files: [], folders: [] };
  }
}

export function downloadProjectZip(): void {
  const link = document.createElement('a');
  link.href = '/api/export';
  link.download = `badatel-backup-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function inspectImportZip(file: File): Promise<ImportPreview> {
  const res = await fetch('/api/import/inspect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-File-Name': encodeURIComponent(file.name)
    },
    body: file
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to inspect backup archive');
  return { ...data.preview, token: data.token };
}

export async function executeImportZip(tokenOrFile: string | File, mode: 'replace' | 'merge'): Promise<{ settings: MapSettings; buildings: Building[] }> {
  let res: Response;
  if (typeof tokenOrFile === 'string') {
    // Fast path: use already uploaded archive via server token (instant, no re-upload)
    res = await fetch('/api/import/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenOrFile, mode })
    });
  } else {
    // Fallback: stream file directly
    res = await fetch(`/api/import/execute?mode=${encodeURIComponent(mode)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-File-Name': encodeURIComponent(tokenOrFile.name)
      },
      body: tokenOrFile
    });
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to import backup archive');
  return { settings: data.settings, buildings: data.buildings };
}

export async function fetchVersionInfo(): Promise<AppVersionInfo> {
  const res = await fetch('/api/version');
  if (!res.ok) throw new Error('Failed to fetch version info');
  return res.json();
}
