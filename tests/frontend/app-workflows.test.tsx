import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../../src/App';
import * as api from '../../src/api';
import { Building, MapSettings } from '../../src/types';

const mockSettings: MapSettings = {
  title: 'Janov Industrial Zone',
  activeMapId: 'sheet-1',
  maps: [
    {
      id: 'sheet-1',
      title: 'Sheet 1 - Master Site Plan',
      imageUrl: '/sample-map/sample_site_plan.png',
      width: 2400,
      height: 1600
    },
    {
      id: 'sheet-2',
      title: 'Sheet 2 - Western Sector',
      imageUrl: '/sample-map/sample_site_plan.png',
      width: 2400,
      height: 1600
    }
  ]
};

const mockBuildings: Building[] = [
  {
    id: 'b-1',
    mapId: 'sheet-1',
    letter: 'A',
    name: 'Administration Building',
    description: 'Main offices',
    color: '#3b82f6',
    polygon: [[100, 100], [100, 200], [200, 200], [200, 100]],
    badgePosition: [150, 150],
    documents: [
      {
        id: 'doc-1',
        title: 'Admin Floor Plan',
        url: '/uploads/admin.png',
        uploadedAt: '2026-01-01T00:00:00Z'
      }
    ]
  }
];

// Mock MapViewer to focus on testing App orchestrations deterministically
vi.mock('../../src/components/MapViewer', () => ({
  MapViewer: ({
    currentMap,
    buildings,
    mode,
    onSelectBuilding,
    onEditBuilding,
    onAddBuilding,
    onSwitchPage
  }: any) => (
    <div data-testid="map-viewer">
      <div data-testid="current-map-title">{currentMap.title}</div>
      <div data-testid="app-mode">{mode}</div>
      <div data-testid="buildings-count">{buildings.length}</div>
      <button
        data-testid="mock-select-building-btn"
        onClick={() => onSelectBuilding(buildings[0])}
      >
        Select Building A
      </button>
      <button
        data-testid="mock-edit-building-btn"
        onClick={() => onEditBuilding(buildings[0])}
      >
        Edit Building A
      </button>
      <button
        data-testid="mock-add-building-btn"
        onClick={() =>
          onAddBuilding({
            id: 'b-new',
            mapId: currentMap.id,
            letter: 'B',
            name: 'New Building B',
            description: '',
            color: '#10b981',
            polygon: [[300, 300], [300, 400], [400, 400]],
            documents: []
          })
        }
      >
        Add Building B
      </button>
      <button
        data-testid="mock-switch-sheet-btn"
        onClick={() => onSwitchPage('sheet-2')}
      >
        Switch To Sheet 2
      </button>
    </div>
  )
}));

describe('Frontend: App Workflows & Orchestration (WF-1, WF-2, WF-3, WF-4, WF-5, WF-8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads initial data and renders active site plan and buildings', async () => {
    vi.spyOn(api, 'fetchInitialData').mockResolvedValue({
      settings: mockSettings,
      buildings: mockBuildings
    });

    render(<App />);

    // Initially displays loading state
    expect(screen.getByText(/loading site plan/i)).toBeInTheDocument();

    // Resolves and renders main view
    await waitFor(() => {
      expect(screen.getByText('Janov Industrial Zone')).toBeInTheDocument();
      expect(screen.getByTestId('current-map-title')).toHaveTextContent('Sheet 1 - Master Site Plan');
      expect(screen.getByTestId('buildings-count')).toHaveTextContent('1');
    });
  });

  it('handles mode switching between View and Edit modes', async () => {
    vi.spyOn(api, 'fetchInitialData').mockResolvedValue({
      settings: mockSettings,
      buildings: mockBuildings
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('app-mode')).toHaveTextContent('view');
    });

    // Toggle mode to Edit via Header button
    const editModeBtn = screen.getByRole('button', { name: /edit footprints/i });
    fireEvent.click(editModeBtn);

    expect(screen.getByTestId('app-mode')).toHaveTextContent('edit');
  });

  it('switches map sheets and updates settings persistence', async () => {
    vi.spyOn(api, 'fetchInitialData').mockResolvedValue({
      settings: mockSettings,
      buildings: mockBuildings
    });
    const saveSettingsSpy = vi.spyOn(api, 'saveSettings').mockResolvedValue({
      ...mockSettings,
      activeMapId: 'sheet-2'
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('current-map-title')).toHaveTextContent('Sheet 1 - Master Site Plan');
    });

    // Switch to sheet 2
    fireEvent.click(screen.getByTestId('mock-switch-sheet-btn'));

    expect(saveSettingsSpy).toHaveBeenCalledWith({ activeMapId: 'sheet-2' });
    await waitFor(() => {
      expect(screen.getByTestId('current-map-title')).toHaveTextContent('Sheet 2 - Western Sector');
    });
  });

  it('adds a new building footprint and opens edit modal', async () => {
    vi.spyOn(api, 'fetchInitialData').mockResolvedValue({
      settings: mockSettings,
      buildings: mockBuildings
    });
    const saveBuildingsSpy = vi.spyOn(api, 'saveBuildings').mockResolvedValue();

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('buildings-count')).toHaveTextContent('1');
    });

    // Trigger adding building
    fireEvent.click(screen.getByTestId('mock-add-building-btn'));

    // Verify building added to state and auto-saved
    expect(saveBuildingsSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ letter: 'A' }),
        expect.objectContaining({ letter: 'B', name: 'New Building B' })
      ])
    );

    // Edit modal should open automatically for the newly added building
    await waitFor(() => {
      expect(screen.getByDisplayValue('New Building B')).toBeInTheDocument();
    });
  });

  it('opens DocLightboxModal when building is selected in View mode', async () => {
    vi.spyOn(api, 'fetchInitialData').mockResolvedValue({
      settings: mockSettings,
      buildings: mockBuildings
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-select-building-btn')).toBeInTheDocument();
    });

    // Click to view building
    fireEvent.click(screen.getByTestId('mock-select-building-btn'));

    // Lightbox modal displays building doc
    await waitFor(() => {
      expect(screen.getByText('Admin Floor Plan')).toBeInTheDocument();
    });
  });

  it('renders friendly error screen with retry button when initial load fails', async () => {
    vi.spyOn(api, 'fetchInitialData').mockRejectedValue(new Error('Network offline'));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/error loading map/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });
});
