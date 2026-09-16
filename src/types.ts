export interface DocumentItem {
  id: string;
  title: string;
  description?: string;
  url: string;
  uploadedAt: string;
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
