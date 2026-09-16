import React, { useState, useEffect, useCallback } from 'react';
import { Building, MapSettings, MapPage, AppMode } from './types';
import { fetchInitialData, saveBuildings, saveSettings, rotateImage } from './api';
import { Header } from './components/Header';
import { MapViewer } from './components/MapViewer';
import { DocLightboxModal } from './components/DocLightboxModal';
import { BuildingEditModal } from './components/BuildingEditModal';
import { MapSettingsModal } from './components/MapSettingsModal';
import { HelpModal } from './components/HelpModal';
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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950">
      {/* Top Header */}
      <Header
        settings={settings}
        currentMap={currentMap}
        buildings={currentSheetBuildings}
        mode={mode}
        onToggleMode={setMode}
        onSelectBuilding={b => {
          if (mode === 'edit') setEditingBuilding(b);
          else setViewingBuilding(b);
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      {/* Main Map Canvas Area */}
      <div className="flex-1 relative overflow-hidden">
        <MapViewer
          currentMap={currentMap}
          maps={settings.maps}
          buildings={buildings}
          mode={mode}
          onSelectBuilding={b => setViewingBuilding(b)}
          onEditBuilding={b => setEditingBuilding(b)}
          onUpdateBuildingGeometry={handleUpdateGeometry}
          onAddBuilding={handleAddBuilding}
          onSwitchPage={handleSwitchPage}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onRotateMap={handleRotateMap}
        />
      </div>

      {/* Documentation Lightbox Modal */}
      {viewingBuilding && (
        <DocLightboxModal
          building={viewingBuilding}
          allBuildings={currentSheetBuildings}
          onClose={() => setViewingBuilding(null)}
          onSelectBuilding={b => setViewingBuilding(b)}
          onOpenEdit={b => {
            setViewingBuilding(null);
            setMode('edit');
            setEditingBuilding(b);
          }}
        />
      )}

      {/* Building Edit Modal */}
      {editingBuilding && (
        <BuildingEditModal
          building={editingBuilding}
          isOpen={true}
          onClose={() => setEditingBuilding(null)}
          onSave={handleSaveBuildingEdit}
          onDelete={handleDeleteBuilding}
        />
      )}

      {/* Map Settings Modal */}
      <MapSettingsModal
        settings={settings}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
        onSwitchPage={handleSwitchPage}
      />

      {/* Help Modal */}
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
};
