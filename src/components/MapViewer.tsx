import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import { Building, MapPage, AppMode, EditTool } from '../types';
import { computeCentroid, getNextLetter } from '../utils/geometry';
import { PenTool, RotateCw, Move, Scissors, ZoomIn, ZoomOut, Layers, Plus } from 'lucide-react';

interface MapViewerProps {
  currentMap: MapPage;
  maps: MapPage[];
  buildings: Building[];
  mode: AppMode;
  onSelectBuilding: (building: Building) => void;
  onEditBuilding: (building: Building) => void;
  onUpdateBuildingGeometry: (id: string, polygon: [number, number][], badgePosition?: [number, number]) => void;
  onAddBuilding: (newBuilding: Building) => void;
  onSwitchPage: (mapId: string) => void;
  onOpenSettings?: () => void;
  onRotateMap?: () => void;
}

export const MapViewer: React.FC<MapViewerProps> = ({
  currentMap,
  maps,
  buildings,
  mode,
  onSelectBuilding,
  onEditBuilding,
  onUpdateBuildingGeometry,
  onAddBuilding,
  onSwitchPage,
  onOpenSettings,
  onRotateMap,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const imageOverlayRef = useRef<L.ImageOverlay | null>(null);
  const polygonsLayerRef = useRef<L.FeatureGroup | null>(null);
  const badgesLayerRef = useRef<L.LayerGroup | null>(null);

  const currentMapRef = useRef(currentMap);
  currentMapRef.current = currentMap;
  const buildingsRef = useRef(buildings);
  buildingsRef.current = buildings;
  const onAddBuildingRef = useRef(onAddBuilding);
  onAddBuildingRef.current = onAddBuilding;
  const onSelectBuildingRef = useRef(onSelectBuilding);
  onSelectBuildingRef.current = onSelectBuilding;
  const onEditBuildingRef = useRef(onEditBuilding);
  onEditBuildingRef.current = onEditBuilding;
  const onUpdateBuildingGeometryRef = useRef(onUpdateBuildingGeometry);
  onUpdateBuildingGeometryRef.current = onUpdateBuildingGeometry;
  const mapsRef = useRef(maps);
  mapsRef.current = maps;

  const [editTool, setEditTool] = useState<EditTool>('drag');
  const [isDrawing, setIsDrawing] = useState(false);
  const [showGuide, setShowGuide] = useState(true);

  // Auto-fade guide message after 4 seconds whenever mode or edit tool changes
  useEffect(() => {
    setShowGuide(true);
    const timer = setTimeout(() => {
      setShowGuide(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [mode, editTool]);

  // Initialize Map without default zoom control
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      crs: L.CRS.Simple,
      minZoom: -2,
      maxZoom: 4,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      zoomControl: false,
      attributionControl: false,
    });

    const bounds: L.LatLngBoundsExpression = [
      [0, 0],
      [currentMap.height, currentMap.width]
    ];

    const overlay = L.imageOverlay(currentMap.imageUrl, bounds).addTo(map);
    imageOverlayRef.current = overlay;

    const latLngBounds = L.latLngBounds(bounds);
    map.fitBounds(latLngBounds);
    map.setMaxBounds(latLngBounds.pad(0.3));

    const polyGroup = L.featureGroup().addTo(map);
    const badgeGroup = L.layerGroup().addTo(map);

    polygonsLayerRef.current = polyGroup;
    badgesLayerRef.current = badgeGroup;
    mapInstanceRef.current = map;

    // Configure Geoman global settings
    if ((map as any).pm) {
      (map as any).pm.setGlobalOptions({
        allowSelfIntersection: false,
        snappable: true,
        snapDistance: 15,
      });

      // Handle shape creation event
      map.on('pm:create', (e: any) => {
        let points: [number, number][] = [];
        const layer = e.layer;

        if (e.shape === 'Polygon' || e.shape === 'Rectangle') {
          const latLngs = layer.getLatLngs()[0] as L.LatLng[];
          if (latLngs && latLngs.length > 0) {
            points = latLngs.map(ll => [Math.round(ll.lat), Math.round(ll.lng)]);
          }
        } else if (e.shape === 'Circle' || e.shape === 'CircleMarker') {
          const center = layer.getLatLng();
          const radius = (typeof layer.getRadius === 'function' ? layer.getRadius() : 40) || 40;
          for (let i = 0; i < 24; i++) {
            const angle = (i / 24) * 2 * Math.PI;
            points.push([
              Math.round(center.lat + radius * Math.sin(angle)),
              Math.round(center.lng + radius * Math.cos(angle)),
            ]);
          }
        }

        if (points.length < 3) return;

        const centroid = computeCentroid(points);

        map.removeLayer(layer);
        setIsDrawing(false);

        const curMap = currentMapRef.current;
        const curBuildings = buildingsRef.current;

        const existingLetters = curBuildings.map(b => b.letter);
        const nextLetter = getNextLetter(existingLetters);

        const newBuilding: Building = {
          id: `bldg-${Date.now()}`,
          mapId: curMap.id,
          letter: nextLetter,
          name: `Building ${nextLetter}`,
          description: 'Newly marked building footprint.',
          color: '#3b82f6',
          polygon: points,
          badgePosition: centroid,
          documents: []
        };

        onAddBuildingRef.current(newBuilding);
      });
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update map image & bounds if map page or its dimensions change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (isDrawing && (map as any).pm) {
      (map as any).pm.disableDraw();
      setIsDrawing(false);
    }

    const bounds: L.LatLngBoundsExpression = [
      [0, 0],
      [currentMap.height, currentMap.width]
    ];

    if (imageOverlayRef.current) {
      imageOverlayRef.current.setUrl(currentMap.imageUrl);
      imageOverlayRef.current.setBounds(L.latLngBounds(bounds));
    }
    const latLngBounds = L.latLngBounds(bounds);
    map.setMaxBounds(latLngBounds.pad(0.3));
    map.fitBounds(latLngBounds);
  }, [currentMap.id, currentMap.imageUrl, currentMap.width, currentMap.height]);

  // Render Polygons and Letter Badges
  useEffect(() => {
    const map = mapInstanceRef.current;
    const polyGroup = polygonsLayerRef.current;
    const badgeGroup = badgesLayerRef.current;
    if (!map || !polyGroup || !badgeGroup) return;

    polyGroup.clearLayers();
    badgeGroup.clearLayers();

    const currentBuildings = buildings.filter(b => {
      const mapId = b.mapId || (maps.length > 0 ? maps[0].id : currentMap.id);
      return mapId === currentMap.id;
    });

    currentBuildings.forEach(building => {
      if (!building.polygon || building.polygon.length < 3) return;

      const latLngs = building.polygon.map(p => L.latLng(p[0], p[1]));

      // 1. Polygon Footprint Layer
      const polygonLayer = L.polygon(latLngs, {
        color: building.color || '#3b82f6',
        weight: mode === 'edit' ? 3 : 2.5,
        fillColor: building.color || '#3b82f6',
        fillOpacity: 0.35,
        dashArray: mode === 'edit' ? '6, 6' : undefined,
      });

      const getTooltipContent = () => {
        const latest = buildingsRef.current.find(b => b.id === building.id) || building;
        return `
          <div class="px-2.5 py-1.5 bg-slate-900 text-slate-100 rounded-lg">
            <div class="font-bold text-sm flex items-center gap-1.5">
              <span class="inline-block w-3 h-3 rounded-full" style="background-color: ${latest.color}"></span>
              <span>Building [${latest.letter}]</span>
            </div>
            <div class="text-xs text-slate-200 mt-0.5">${latest.name}</div>
            <div class="text-[11px] text-blue-300 font-mono mt-0.5">${latest.documents.length} document photos</div>
            ${mode === 'edit' ? '<div class="text-[10px] text-amber-400 font-semibold mt-1">💡 Click to edit building</div>' : ''}
          </div>
        `;
      };

      polygonLayer.bindTooltip(getTooltipContent, {
        direction: 'top',
        className: 'leaflet-custom-tooltip',
        opacity: 0.95
      });

      // 2. Letter Badge Marker
      const center = building.badgePosition || computeCentroid(building.polygon);
      const badgeIcon = L.divIcon({
        className: 'custom-letter-badge-wrapper',
        html: `
          <div class="custom-letter-badge" style="
            background: ${building.color || '#3b82f6'};
            border: 2px solid #ffffff;
            color: #ffffff;
            width: 34px;
            height: 34px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 15px;
            font-family: 'JetBrains Mono', monospace;
            box-shadow: 0 4px 14px rgba(0,0,0,0.5);
            cursor: pointer;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
          ">
            ${building.letter}
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const badgeMarker = L.marker([center[0], center[1]], {
        icon: badgeIcon,
        draggable: mode === 'edit',
        zIndexOffset: 500
      });

      // Hover styling without destroying DOM or triggering React re-renders
      const applyHover = () => {
        polygonLayer.setStyle({
          weight: 4,
          fillOpacity: 0.6,
        });
        badgeMarker.setZIndexOffset(1000);
        const el = badgeMarker.getElement()?.querySelector('.custom-letter-badge');
        if (el) {
          el.classList.add('scale-110', 'shadow-2xl', 'ring-2', 'ring-white');
        }
      };

      const removeHover = () => {
        polygonLayer.setStyle({
          weight: mode === 'edit' ? 3 : 2.5,
          fillOpacity: 0.35,
        });
        badgeMarker.setZIndexOffset(500);
        const el = badgeMarker.getElement()?.querySelector('.custom-letter-badge');
        if (el) {
          el.classList.remove('scale-110', 'shadow-2xl', 'ring-2', 'ring-white');
        }
      };

      polygonLayer.on('mouseover', applyHover);
      polygonLayer.on('mouseout', removeHover);
      badgeMarker.on('mouseover', applyHover);
      badgeMarker.on('mouseout', removeHover);

      const triggerBuildingClick = () => {
        const latest = buildingsRef.current.find(b => b.id === building.id) || building;
        if (mode === 'edit') {
          onEditBuildingRef.current(latest);
        } else {
          onSelectBuildingRef.current(latest);
        }
      };

      polygonLayer.on('click', triggerBuildingClick);
      badgeMarker.on('click', triggerBuildingClick);

      if (mode === 'edit') {
        badgeMarker.on('dragend', (e: any) => {
          const newPos = e.target.getLatLng();
          const latest = buildingsRef.current.find(b => b.id === building.id) || building;
          onUpdateBuildingGeometryRef.current(
            building.id,
            latest.polygon,
            [Math.round(newPos.lat), Math.round(newPos.lng)]
          );
        });
      }

      polyGroup.addLayer(polygonLayer);
      badgeGroup.addLayer(badgeMarker);

      // Configure Edit Mode tools on attached layer
      if (mode === 'edit') {
        if (editTool === 'reshape') {
          if ((polygonLayer as any).pm) {
            (polygonLayer as any).pm.enable({
              allowSelfIntersection: false,
              draggable: false,
            });

            polygonLayer.on('pm:edit', () => {
              const updatedLatLngs = (polygonLayer.getLatLngs()[0] as L.LatLng[]).map(
                ll => [Math.round(ll.lat), Math.round(ll.lng)] as [number, number]
              );
              const newCentroid = computeCentroid(updatedLatLngs);
              onUpdateBuildingGeometry(building.id, updatedLatLngs, building.badgePosition || newCentroid);
            });

            polygonLayer.on('pm:markerdragend', () => {
              const updatedLatLngs = (polygonLayer.getLatLngs()[0] as L.LatLng[]).map(
                ll => [Math.round(ll.lat), Math.round(ll.lng)] as [number, number]
              );
              const newCentroid = computeCentroid(updatedLatLngs);
              onUpdateBuildingGeometry(building.id, updatedLatLngs, building.badgePosition || newCentroid);
            });
          }
        } else if (editTool === 'drag') {
          if ((polygonLayer as any).pm) {
            (polygonLayer as any).pm.disable();
          }

          let isDraggingRegion = false;
          let dragStartLatLng: L.LatLng | null = null;
          let startPoint: L.Point | null = null;
          let hasMoved = false;
          let initialPolygon = [...building.polygon];
          let initialBadge: [number, number] = [center[0], center[1]];

          polygonLayer.on('mousedown', (e: L.LeafletMouseEvent) => {
            if (e.originalEvent.button !== 0) return;
            L.DomEvent.stopPropagation(e);
            isDraggingRegion = true;
            dragStartLatLng = e.latlng;
            startPoint = e.layerPoint;
            hasMoved = false;
            initialPolygon = (polygonLayer.getLatLngs()[0] as L.LatLng[]).map(p => [p.lat, p.lng]);
            const markerPos = badgeMarker.getLatLng();
            initialBadge = [markerPos.lat, markerPos.lng];

            map.dragging.disable();

            const onMouseMove = (moveEvent: L.LeafletMouseEvent) => {
              if (!isDraggingRegion || !dragStartLatLng || !startPoint) return;
              if (startPoint.distanceTo(moveEvent.layerPoint) > 4) {
                hasMoved = true;
              }
              const dLat = moveEvent.latlng.lat - dragStartLatLng.lat;
              const dLng = moveEvent.latlng.lng - dragStartLatLng.lng;

              const shiftedLatLngs = initialPolygon.map(p => L.latLng(p[0] + dLat, p[1] + dLng));
              polygonLayer.setLatLngs(shiftedLatLngs);

              badgeMarker.setLatLng(L.latLng(initialBadge[0] + dLat, initialBadge[1] + dLng));
            };

            const onMouseUp = () => {
              if (!isDraggingRegion) return;
              isDraggingRegion = false;
              map.dragging.enable();

              map.off('mousemove', onMouseMove);
              map.off('mouseup', onMouseUp);

              if (!hasMoved) {
                triggerBuildingClick();
                return;
              }

              const finalLatLngs = (polygonLayer.getLatLngs()[0] as L.LatLng[]).map(
                ll => [Math.round(ll.lat), Math.round(ll.lng)] as [number, number]
              );
              const finalBadge = badgeMarker.getLatLng();
              onUpdateBuildingGeometry(
                building.id,
                finalLatLngs,
                [Math.round(finalBadge.lat), Math.round(finalBadge.lng)]
              );
            };

            map.on('mousemove', onMouseMove);
            map.on('mouseup', onMouseUp);
          });
        }
      } else {
        if ((polygonLayer as any).pm) {
          (polygonLayer as any).pm.disable();
        }
      }
    });
  }, [
    // Create a fingerprint that only changes when footprints/letter/colors/mode/editTool change,
    // NOT when documents change or upload progress updates.
    buildings.map(b => `${b.id}:${b.letter}:${b.color}:${b.mapId}:${JSON.stringify(b.polygon)}:${JSON.stringify(b.badgePosition)}`).join('|'),
    currentMap.id,
    mode,
    editTool
  ]);

  // Toggle Draw Mode
  const toggleDrawMode = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || !(map as any).pm) return;

    if (isDrawing) {
      (map as any).pm.disableDraw();
      setIsDrawing(false);
    } else {
      (map as any).pm.enableDraw('Polygon', {
        snappable: true,
        snapDistance: 20,
        hintText: 'Click corners of building. Click first point to finish.',
      });
      setIsDrawing(true);
    }
  }, [isDrawing]);

  // Cancel drawing on Escape key
  useEffect(() => {
    if (!isDrawing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const map = mapInstanceRef.current;
        if (map && (map as any).pm) {
          (map as any).pm.disableDraw();
          setIsDrawing(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawing]);

  // Zoom controls
  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();

  // Reset view to fit current map (100%)
  const handleFitFullSitePlan = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.fitBounds([
      [0, 0],
      [currentMap.height, currentMap.width]
    ]);
  };


  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950 select-none">
      {/* The Leaflet Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Controls at TOP RIGHT */}
      <div className="absolute top-5 right-6 z-[500] flex flex-col items-end space-y-2.5 max-w-[90vw]">
        {/* View Mode Status Indicator (Fades out after 4s) */}
        {mode === 'view' && (
          <div className={`transition-opacity duration-1000 ${showGuide ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="px-4 py-2 rounded-2xl bg-slate-900 border-2 border-slate-700 shadow-2xl flex items-center space-x-2 text-xs font-bold text-slate-200">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>VIEW MODE: Click any building letter to inspect documents</span>
            </div>
          </div>
        )}

        {/* Edit Mode Sub-Tools Bar */}
        {mode === 'edit' && (
          <div className="flex flex-col items-end space-y-2">
            <div className="flex items-center bg-slate-900 border-2 border-amber-500/80 p-1.5 rounded-2xl shadow-2xl space-x-1.5">
              <div className="px-3 py-1 text-xs font-black uppercase tracking-wider text-amber-400 flex items-center border-r border-slate-700 mr-1">
                Edit Mode:
              </div>

              <button
                onClick={() => {
                  if (isDrawing) toggleDrawMode();
                  setEditTool('drag');
                }}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  editTool === 'drag' && !isDrawing
                    ? 'bg-amber-600 text-white shadow-md ring-2 ring-amber-400/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title="Click and drag inside any building polygon to move the whole region"
              >
                <Move className="w-4 h-4" />
                <span>Move Region</span>
              </button>

              <button
                onClick={() => {
                  if (isDrawing) toggleDrawMode();
                  setEditTool('reshape');
                }}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  editTool === 'reshape' && !isDrawing
                    ? 'bg-amber-600 text-white shadow-md ring-2 ring-amber-400/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title="Drag corner handles to reshape building footprint"
              >
                <Scissors className="w-4 h-4" />
                <span>Reshape Corners</span>
              </button>

              <button
                onClick={toggleDrawMode}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                  isDrawing
                    ? 'bg-red-600 text-white animate-pulse'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'
                }`}
                title="Draw a brand new building footprint"
              >
                <PenTool className="w-4 h-4" />
                <span>{isDrawing ? 'Cancel Drawing' : '+ Draw Footprint'}</span>
              </button>
            </div>

            {/* Helper tooltip under the edit tools (Fades out after 4s) */}
            <div className={`transition-opacity duration-1000 ${showGuide || isDrawing ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <div className="bg-slate-900/95 border border-slate-700 text-slate-300 text-[11px] px-3.5 py-1.5 rounded-xl shadow-xl">
                {editTool === 'drag' && !isDrawing && '✋ Click & drag inside any building to move region. Drag badge to offset letter.'}
                {editTool === 'reshape' && !isDrawing && '📐 Drag any white corner handle to adjust polygon shape.'}
                {isDrawing && '✏️ Click on corners of building. Click first point to finish.'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sheets Menu (Moved to BOTTOM LEFT) */}
      <div className="absolute bottom-6 left-6 z-[500] bg-slate-900 border-2 border-slate-700 px-4 py-2 rounded-2xl shadow-2xl flex items-center space-x-2.5 max-w-[45vw] overflow-hidden">
        <span className="text-xs font-bold text-slate-300 uppercase flex items-center shrink-0">
          <Layers className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
          Sheets:
        </span>
        <div className="flex items-center space-x-2 overflow-x-auto py-0.5">
          {maps.map((mapPage, idx) => {
            const isActive = mapPage.id === currentMap.id;
            return (
              <button
                key={mapPage.id}
                onClick={() => onSwitchPage(mapPage.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shrink-0 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800 bg-slate-950 border border-slate-800'
                }`}
                title={`${mapPage.title} (${mapPage.width}x${mapPage.height})`}
              >
                <span>{mapPage.title || `Sheet ${idx + 1}`}</span>
              </button>
            );
          })}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-1.5 rounded-xl text-slate-400 hover:text-blue-400 hover:bg-slate-800 bg-slate-950 border border-slate-800 transition shrink-0"
              title="Add another site map sheet"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Floating Map Controls (Bottom Right): Zoom In (+), Fit Full Plan (100%), Zoom Out (-), Rotate */}
      <div className="absolute bottom-6 right-6 z-[500] flex flex-col space-y-1.5 bg-slate-900 border-2 border-slate-700 p-1.5 rounded-2xl shadow-2xl">
        {/* Zoom In Button */}
        <button
          onClick={handleZoomIn}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition flex items-center justify-center"
          title="Zoom In (+)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        {/* 100% Fit Full Site Plan Button */}
        <button
          onClick={handleFitFullSitePlan}
          className="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white transition flex items-center justify-center font-mono text-[11px] font-extrabold tracking-tight"
          title="Fit full site plan (100%)"
        >
          100%
        </button>

        {/* Zoom Out Button */}
        <button
          onClick={handleZoomOut}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition flex items-center justify-center"
          title="Zoom Out (-)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <div className="h-px bg-slate-700 my-0.5" />

        {/* Rotate Button */}
        {onRotateMap && (
          <button
            onClick={onRotateMap}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 transition flex items-center justify-center"
            title="Rotate Current Sheet 90° Clockwise"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
