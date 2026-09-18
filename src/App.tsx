import React, { useState, useEffect, useCallback } from 'react';
import { Building, DocumentItem, MapSettings, MapPage, AppMode } from './types';
import { fetchInitialData, saveBuildings, saveSettings, rotateImage } from './api';
import { Header } from './components/Header';
import { MapViewer } from './components/MapViewer';
import { DocLightboxModal } from './components/DocLightboxModal';
import { BuildingEditModal } from './components/BuildingEditModal';
import { MapSettingsModal } from './components/MapSettingsModal';
import { ImportExportModal } from './components/ImportExportModal';
import { HelpModal } from './components/HelpModal';
import { FloatingUploadPill } from './components/FloatingUploadPill';
import { UploadProvider } from './context/UploadContext';
import { Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const [settings, setSettings] = useState<MapSettings | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [mode, setMode] = useState<AppMode>('view');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [viewingBuilding, setViewingBuilding] = useState<Building | null>(null);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Load initial data
  useEffect(() => {
    fetchInitialData()
      .then(data => {
        setSettings(data.settings);
        setBuildings(data.buildings || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load initial data:', err);
        setError('Failed to load map data. Please check server connection.');
        setLoading(false);
      });
  }, []);

  // Auto-persist documents when completed by global upload queue
  const handleDocumentCompleted = useCallback((buildingId: string, newDoc: DocumentItem) => {
    setBuildings(prev => {
      const building = prev.find(b => b.id === buildingId);
      if (!building) return prev;
      if (building.documents.some(d => d.url === newDoc.url)) return prev;
      const updatedBuilding: Building = {
        ...building,
        documents: [...building.documents, newDoc]
      };
      const updatedList = prev.map(b => (b.id === buildingId ? updatedBuilding : b));
      saveBuildings(updatedList).catch(err => console.error('Failed to auto-persist uploaded document:', err));
      return updatedList;
    });

    setEditingBuilding(prev => {
      if (!prev || prev.id !== buildingId) return prev;
      if (prev.documents.some(d => d.url === newDoc.url)) return prev;
      return {
        ...prev,
        documents: [...prev.documents, newDoc]
      };
    });

    setViewingBuilding(prev => {
      if (!prev || prev.id !== buildingId) return prev;
      if (prev.documents.some(d => d.url === newDoc.url)) return prev;
      return {
        ...prev,
        documents: [...prev.documents, newDoc]
      };
    });
  }, []);

  // Modal open/close and building selection handlers
  const handleSelectBuilding = useCallback((b: Building) => {
    setViewingBuilding(b);
  }, []);

  const handleEditBuilding = useCallback((b: Building) => {
    setEditingBuilding(b);
  }, []);

  const handleCloseViewing = useCallback(() => {
    setViewingBuilding(null);
  }, []);

  const handleCloseEditing = useCallback(() => {
    setEditingBuilding(null);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const handleOpenHelp = useCallback(() => {
    setIsHelpOpen(true);
  }, []);

  const handleCloseHelp = useCallback(() => {
    setIsHelpOpen(false);
  }, []);

  const handleOpenImportExport = useCallback(() => {
    setIsImportExportOpen(true);
  }, []);

  const handleCloseImportExport = useCallback(() => {
    setIsImportExportOpen(false);
  }, []);

  // Currently active map sheet
  const currentMap: MapPage | null = settings
    ? (settings.maps.find(m => m.id === settings.activeMapId) || settings.maps[0] || null)
    : null;

  // Switch active map page
  const handleSwitchPage = useCallback(async (mapId: string) => {
    if (!settings) return;
    setSettings(prev => prev ? ({ ...prev, activeMapId: mapId }) : null);
    try {
      await saveSettings({ activeMapId: mapId });
    } catch (err) {
      console.error('Failed to persist active map page:', err);
    }
  }, [settings]);

  // Update building geometry from Map (polygon move, corner reshape, or badge drag)
  const handleUpdateGeometry = useCallback((id: string, polygon: [number, number][], badgePosition?: [number, number]) => {
    setBuildings(prev => {
      const updated = prev.map(b => b.id === id ? { ...b, polygon, badgePosition } : b);
      saveBuildings(updated).catch(err => console.error(err));
      return updated;
    });
  }, []);

  // Add new building drawn on map
  const handleAddBuilding = useCallback((newBuilding: Building) => {
    setBuildings(prev => {
      const updated = [...prev, newBuilding];
      saveBuildings(updated).catch(err => console.error(err));
      return updated;
    });
    setEditingBuilding(newBuilding);
  }, []);

  // Save individual edited building
  const handleSaveBuildingEdit = useCallback((updated: Building) => {
    setBuildings(prev => {
      const newList = prev.map(b => b.id === updated.id ? updated : b);
      saveBuildings(newList).catch(err => console.error(err));
      return newList;
    });
    if (viewingBuilding?.id === updated.id) {
      setViewingBuilding(updated);
    }
  }, [viewingBuilding]);

  // Delete building
  const handleDeleteBuilding = useCallback((id: string) => {
    setBuildings(prev => {
      const newList = prev.filter(b => b.id !== id);
      saveBuildings(newList).catch(err => console.error(err));
      return newList;
    });
    if (editingBuilding?.id === id) setEditingBuilding(null);
    if (viewingBuilding?.id === id) setViewingBuilding(null);
  }, [editingBuilding, viewingBuilding]);

  // Save settings (e.g. map image change or sheets update)
  const handleSaveSettings = useCallback(async (newSettings: Partial<MapSettings>) => {
    try {
      const updated = await saveSettings(newSettings);
      setSettings(updated);
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  }, []);

  // Handler for successful archive import
  const handleImportSuccess = useCallback((newSettings: MapSettings, newBuildings: Building[]) => {
    setSettings(newSettings);
    setBuildings(newBuildings);
    setViewingBuilding(null);
    setEditingBuilding(null);
  }, []);

  // Rotate active map page 90 degrees
  const handleRotateMap = useCallback(async () => {
    if (!settings || !currentMap) return;
    try {
      const res = await rotateImage(currentMap.imageUrl, 90, true, currentMap.id);
      setSettings(prev => {
        if (!prev) return null;
        return {
          ...prev,
          maps: prev.maps.map(m => m.id === currentMap.id ? {
            ...m,
            imageUrl: res.url,
            width: res.width,
            height: res.height
          } : m)
        };
      });
    } catch (err: any) {
      alert('Failed to rotate map: ' + (err.message || 'Unknown error'));
    }
  }, [settings, currentMap]);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <p className="text-sm font-bold">Loading Site Plan & Documentation...</p>
      </div>
    );
  }

  if (error || !settings || !currentMap) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-red-400 p-6 text-center">
        <p className="text-lg font-bold">Error loading map</p>
        <p className="text-sm text-slate-400 mt-2">{error || 'Settings not loaded'}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold"
        >
          Retry
        </button>
      </div>
    );
  }

  // Filter buildings for the lightbox quick-switch (buildings on current sheet)
  const currentSheetBuildings = buildings.filter(b => (b.mapId || currentMap.id) === currentMap.id);

  return (
    <UploadProvider onDocumentCompleted={handleDocumentCompleted}>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950">
        {/* Top Header */}
        <Header
          settings={settings}
          currentMap={currentMap}
          buildings={currentSheetBuildings}
          mode={mode}
          onToggleMode={setMode}
          onSelectBuilding={b => {
            if (mode === 'edit') handleEditBuilding(b);
            else handleSelectBuilding(b);
          }}
          onOpenSettings={handleOpenSettings}
          onOpenHelp={handleOpenHelp}
          onOpenImportExport={handleOpenImportExport}
        />

        {/* Main Map Canvas Area */}
        <div className="flex-1 relative overflow-hidden">
          <MapViewer
            currentMap={currentMap}
            maps={settings.maps}
            buildings={buildings}
            mode={mode}
            onSelectBuilding={handleSelectBuilding}
            onEditBuilding={handleEditBuilding}
            onUpdateBuildingGeometry={handleUpdateGeometry}
            onAddBuilding={handleAddBuilding}
            onSwitchPage={handleSwitchPage}
            onOpenSettings={handleOpenSettings}
            onRotateMap={handleRotateMap}
          />
        </div>

        {/* Documentation Lightbox Modal */}
        {viewingBuilding && (
          <DocLightboxModal
            building={viewingBuilding}
            allBuildings={currentSheetBuildings}
            onClose={handleCloseViewing}
            onSelectBuilding={handleSelectBuilding}
            onOpenEdit={b => {
              handleCloseViewing();
              handleEditBuilding(b);
            }}
          />
        )}

        {/* Building Edit Modal */}
        {editingBuilding && (
          <BuildingEditModal
            building={editingBuilding}
            isOpen={true}
            onClose={handleCloseEditing}
            onSave={handleSaveBuildingEdit}
            onDelete={handleDeleteBuilding}
          />
        )}

        {/* Map Settings Modal */}
        <MapSettingsModal
          settings={settings}
          isOpen={isSettingsOpen}
          onClose={handleCloseSettings}
          onSave={handleSaveSettings}
          onSwitchPage={handleSwitchPage}
        />

        {/* Help Modal */}
        <HelpModal
          isOpen={isHelpOpen}
          onClose={handleCloseHelp}
        />

        {/* Backup, Import & Export Modal */}
        <ImportExportModal
          isOpen={isImportExportOpen}
          onClose={handleCloseImportExport}
          settings={settings}
          buildings={buildings}
          onImportSuccess={handleImportSuccess}
        />

        {/* Global Floating Upload Pill */}
        <FloatingUploadPill />
      </div>
    </UploadProvider>
  );
};
