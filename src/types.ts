export interface DocumentItem {
  id: string;
  title: string;
  description?: string;
  url: string;
  uploadedAt: string;
}

export interface LocalFileItem {
  name: string;
  path: string;
  subfolder: string;
  url: string;
  size: number;
  hash?: string | null;
}

export interface HashCheckItem {
  hash: string;
  filename: string;
  size: number;
  subfolder?: string;
  target?: 'map' | 'doc';
}

export interface HashCheckResult {
  hash: string;
  exists: boolean;
  url?: string;
  filename?: string;
  subfolder?: string;
  width?: number | null;
  height?: number | null;
  deduplicated?: boolean;
}

export interface LocalFilesResponse {
  files: LocalFileItem[];
  folders: string[];
}

export interface Building {
  id: string;
  mapId: string; // which map page this building is on
  letter: string;
  name: string;
  description: string;
  color: string;
  polygon: [number, number][]; // [lat, lng]
  badgePosition?: [number, number]; // [lat, lng]
  documents: DocumentItem[];
}

export interface MapPage {
  id: string;
  title: string;
  imageUrl: string;
  width: number;
  height: number;
}

export interface MapSettings {
  title: string;
  activeMapId: string;
  maps: MapPage[];
}

export type AppMode = 'view' | 'edit';
export type EditTool = 'drag' | 'reshape' | 'draw';

export interface ImportPreview {
  title: string;
  exportedAt: string | null;
  mapCount: number;
  buildingCount: number;
  documentCount: number;
  mediaFileCount: number;
  archiveSizeBytes: number;
  token?: string;
}

export interface AppVersionInfo {
  version: string;
  commitHash: string;
  shortHash: string;
  commitMessage: string;
  commitDate: string;
  branch?: string;
  buildTime?: string;
}

// Vite compile-time injected constants
declare global {
  const __APP_VERSION__: string;
  const __COMMIT_HASH__: string;
  const __COMMIT_SHORT_HASH__: string;
  const __COMMIT_MESSAGE__: string;
  const __COMMIT_DATE__: string;
  const __BUILD_TIME__: string;
}
