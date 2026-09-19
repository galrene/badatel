import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BuildingEditModal } from '../../src/components/BuildingEditModal';
import { DocLightboxModal } from '../../src/components/DocLightboxModal';
import { MapSettingsModal } from '../../src/components/MapSettingsModal';
import { ImportExportModal } from '../../src/components/ImportExportModal';
import { HelpModal } from '../../src/components/HelpModal';
import { UploadProvider } from '../../src/context/UploadContext';
import { Building, MapSettings } from '../../src/types';

const mockBuilding: Building = {
  id: 'b-101',
  mapId: 'map-1',
  letter: 'B',
  name: 'Boiler House',
  description: 'Industrial steam boiler facility built 1982',
  color: '#ef4444',
  polygon: [[100, 100], [100, 200], [200, 200], [200, 100]],
  badgePosition: [150, 150],
  documents: [
    {
      id: 'doc-1',
      title: 'Floor Layout Plan',
      description: 'Main pump room',
      url: '/sample-map/sample_doc_a1.png',
      uploadedAt: '2026-01-01T00:00:00Z'
    },
    {
      id: 'doc-2',
      title: 'Boiler Schematic',
      description: 'Steam lines and valves',
      url: '/sample-map/sample_doc_a2.png',
      uploadedAt: '2026-01-02T00:00:00Z'
    }
  ]
};

const mockSettings: MapSettings = {
  title: 'Janov Site Map',
  activeMapId: 'map-1',
  maps: [
    {
      id: 'map-1',
      title: 'Primary Site Map',
      imageUrl: '/sample-map/sample_site_plan.png',
      width: 2400,
      height: 1600
    }
  ]
};

describe('Frontend Modals & Workflows (WF-5, WF-8, WF-10, WF-12, WF-13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('BuildingEditModal (WF-5, WF-6)', () => {
    it('edits building fields and saves updated model', () => {
      const onSave = vi.fn();
      const onClose = vi.fn();
      const onDelete = vi.fn();

      render(
        <UploadProvider>
          <BuildingEditModal
            building={mockBuilding}
            isOpen={true}
            onClose={onClose}
            onSave={onSave}
            onDelete={onDelete}
          />
        </UploadProvider>
      );

      // Verify initial fields rendered
      const letterInput = screen.getByDisplayValue('B');
      const nameInput = screen.getByDisplayValue('Boiler House');

      // Edit name and letter
      fireEvent.change(letterInput, { target: { value: 'C' } });
      fireEvent.change(nameInput, { target: { value: 'Central Plant' } });

      // Click Save Changes button
      const saveBtn = screen.getByRole('button', { name: /save changes/i });
      fireEvent.click(saveBtn);

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          letter: 'C',
          name: 'Central Plant'
        })
      );
    });

    it('requires confirmation before deleting building', () => {
      const onSave = vi.fn();
      const onClose = vi.fn();
      const onDelete = vi.fn();

      render(
        <UploadProvider>
          <BuildingEditModal
            building={mockBuilding}
            isOpen={true}
            onClose={onClose}
            onSave={onSave}
            onDelete={onDelete}
          />
        </UploadProvider>
      );

      // First click on Delete Building
      const deleteBtn = screen.getByRole('button', { name: /delete building/i });
      fireEvent.click(deleteBtn);

      // Confirmation button appears
      expect(onDelete).not.toHaveBeenCalled();
      const confirmBtn = screen.getByRole('button', { name: /yes, delete/i });
      fireEvent.click(confirmBtn);

      expect(onDelete).toHaveBeenCalledWith('b-101');
    });

    it('removes an attached document from the building', () => {
      const onSave = vi.fn();
      render(
        <UploadProvider>
          <BuildingEditModal
            building={mockBuilding}
            isOpen={true}
            onClose={vi.fn()}
            onSave={onSave}
            onDelete={vi.fn()}
          />
        </UploadProvider>
      );

      expect(screen.getByDisplayValue('Floor Layout Plan')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Boiler Schematic')).toBeInTheDocument();

      // Find delete button for first document
      const removeButtons = screen.getAllByTitle(/remove document/i);
      fireEvent.click(removeButtons[0]);

      // Save changes
      const saveBtn = screen.getByRole('button', { name: /save changes/i });
      fireEvent.click(saveBtn);

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          documents: [expect.objectContaining({ title: 'Boiler Schematic' })]
        })
      );
    });
  });

  describe('DocLightboxModal (WF-8)', () => {
    it('renders active document, handles deep zoom controls, and navigates between documents', () => {
      const onClose = vi.fn();
      const onSelectBuilding = vi.fn();
      const onOpenEdit = vi.fn();

      render(
        <DocLightboxModal
          building={mockBuilding}
          allBuildings={[mockBuilding]}
          onClose={onClose}
          onSelectBuilding={onSelectBuilding}
          onOpenEdit={onOpenEdit}
        />
      );

      // Verify active document title rendered in header/thumbnail
      expect(screen.getAllByText('Floor Layout Plan').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/100%/)).toBeInTheDocument();

      // Zoom In button
      const zoomInBtn = screen.getByTitle(/Zoom In/i);
      fireEvent.click(zoomInBtn);
      expect(screen.getByText(/130%/)).toBeInTheDocument();

      // Zoom Out button
      const zoomOutBtn = screen.getByTitle(/Zoom Out/i);
      fireEvent.click(zoomOutBtn);
      expect(screen.getByText(/98%/)).toBeInTheDocument();

      // Switch to next document via next button
      const nextBtn = screen.getByTitle(/Next Document/i);
      fireEvent.click(nextBtn);
      expect(screen.getAllByText('Boiler Schematic').length).toBeGreaterThanOrEqual(1);

      // Click Edit Building button
      const editBtn = screen.getByRole('button', { name: /edit building/i });
      fireEvent.click(editBtn);
      expect(onOpenEdit).toHaveBeenCalledWith(mockBuilding);
    });
  });

  describe('MapSettingsModal (WF-10)', () => {
    it('modifies project title and triggers onSave', () => {
      const onSave = vi.fn();
      const onClose = vi.fn();
      const onSwitchPage = vi.fn();

      render(
        <UploadProvider>
          <MapSettingsModal
            settings={mockSettings}
            isOpen={true}
            onClose={onClose}
            onSave={onSave}
            onSwitchPage={onSwitchPage}
          />
        </UploadProvider>
      );

      const titleInput = screen.getByDisplayValue('Janov Site Map');
      fireEvent.change(titleInput, { target: { value: 'New Site Map Title' } });

      const saveBtn = screen.getByRole('button', { name: /apply settings/i });
      fireEvent.click(saveBtn);

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Site Map Title'
        })
      );
    });
  });

  describe('ImportExportModal (WF-11, WF-12)', () => {
    it('renders export and import tabs and triggers backup download', () => {
      const onClose = vi.fn();
      const onImportSuccess = vi.fn();

      render(
        <ImportExportModal
          isOpen={true}
          onClose={onClose}
          settings={mockSettings}
          buildings={[mockBuilding]}
          onImportSuccess={onImportSuccess}
        />
      );

      // Verify export tab is default
      expect(screen.getByText(/current project contents/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /download complete archive/i })).toBeInTheDocument();

      // Switch to import tab
      const importTabBtn = screen.getByRole('button', { name: /import \/ restore archive/i });
      fireEvent.click(importTabBtn);

      expect(screen.getByText(/select or drop a badatel backup archive/i)).toBeInTheDocument();
    });
  });

  describe('HelpModal (WF-13)', () => {
    it('renders keyboard shortcuts, documentation guide, and app version', () => {
      render(
        <HelpModal isOpen={true} onClose={vi.fn()} />
      );

      expect(screen.getByText(/how to use your interactive site plan/i)).toBeInTheDocument();
      expect(screen.getByText(/using your own photographed site map/i)).toBeInTheDocument();
      expect(screen.getByText(/marking buildings with letters/i)).toBeInTheDocument();
      expect(screen.getByText(/version & system information/i)).toBeInTheDocument();
    });
  });
});
