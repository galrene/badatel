import { Building, MapSettings, LocalFilesResponse } from './types';

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

export async function uploadImageFile(
  file: File,
  target: 'map' | 'doc' = 'doc',
  subfolder?: string
): Promise<{ url: string; filename: string; width?: number; height?: number; subfolder?: string }> {
  // Convert file to base64
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

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
