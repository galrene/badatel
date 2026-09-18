import { Building, MapSettings, ImportPreview } from './types';

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

export async function uploadImageFile(file: File, target: 'map' | 'doc' = 'doc'): Promise<{ url: string; filename: string; width?: number; height?: number }> {
  const base64 = await fileToBase64(file);

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      base64,
      target
    })
  });

  if (!res.ok) throw new Error('Failed to upload image file');
  return res.json();
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

export async function fetchLocalFiles(): Promise<{ name: string; url: string; size: number }[]> {
  try {
    const res = await fetch('/api/local-files');
    if (!res.ok) return [];
    const data = await res.json();
    return data.files || [];
  } catch {
    return [];
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
  const base64 = await fileToBase64(file);
  const res = await fetch('/api/import/inspect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64 })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to inspect backup archive');
  return data.preview;
}

export async function executeImportZip(file: File, mode: 'replace' | 'merge'): Promise<{ settings: MapSettings; buildings: Building[] }> {
  const base64 = await fileToBase64(file);
  const res = await fetch('/api/import/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, mode })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to import backup archive');
  return { settings: data.settings, buildings: data.buildings };
}
