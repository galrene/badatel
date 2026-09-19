import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestServer, TestServerContext } from '../test-utils';
import AdmZip from 'adm-zip';
import fs from 'node:fs';
import path from 'node:path';

describe('Backend API: Project Backup Export & Import Pipeline (WF-11, WF-12)', () => {
  let ctx: TestServerContext;

  beforeEach(async () => {
    ctx = await createTestServer();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it('GET /api/export generates a valid ZIP archive containing settings and buildings in manifest.json', async () => {
    // Add sample building and map file
    const sampleFilePath = path.join(ctx.uploadsDir, 'sample_doc.png');
    fs.writeFileSync(sampleFilePath, Buffer.from('fake-image-data'));

    await ctx.fetch('/api/buildings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        buildings: [
          {
            id: 'b-export-1',
            mapId: 'page-1',
            letter: 'Z',
            name: 'Export Zone',
            description: 'Backup test',
            color: '#10b981',
            polygon: [[10, 10], [20, 20]],
            documents: [
              {
                id: 'd-1',
                title: 'Blueprint Z',
                url: '/uploads/sample_doc.png',
                uploadedAt: new Date().toISOString()
              }
            ]
          }
        ]
      })
    });

    const exportRes = await ctx.fetch('/api/export');
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers.get('content-type')).toBe('application/zip');

    const zip = new AdmZip(exportRes.rawBuffer);
    const zipEntries = zip.getEntries().map(e => e.entryName);
    expect(zipEntries).toContain('manifest.json');
    expect(zipEntries.some(name => name.startsWith('media/'))).toBe(true);

    // Verify settings inside manifest.json
    const manifestEntry = zip.getEntry('manifest.json');
    const parsedManifest = JSON.parse(manifestEntry!.getData().toString('utf8'));
    expect(parsedManifest.settings.title).toBe('Badatel');
    expect(parsedManifest.buildings.some((b: any) => b.letter === 'Z')).toBe(true);
  });

  it('POST /api/import/inspect validates zip structure and returns preview metadata with token', async () => {
    // Build a mock backup zip with manifest.json
    const zip = new AdmZip();
    zip.addFile('manifest.json', Buffer.from(JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: {
        title: 'Imported Project',
        activeMapId: 'map-new',
        maps: [{ id: 'map-new', title: 'New Map', imageUrl: 'media/map.png', width: 500, height: 400 }]
      },
      buildings: [
        {
          id: 'b-imported',
          mapId: 'map-new',
          letter: 'M',
          name: 'Imported Building',
          description: '',
          color: '#3b82f6',
          polygon: [[1, 1], [2, 2]],
          documents: [{ id: 'doc-m', title: 'Doc', url: 'media/doc.png', uploadedAt: new Date().toISOString() }]
        }
      ]
    }, null, 2)));
    zip.addFile('media/map.png', Buffer.from('map-bytes'));
    zip.addFile('media/doc.png', Buffer.from('doc-bytes'));

    const zipBuffer = zip.toBuffer();

    const inspectRes = await ctx.fetch('/api/import/inspect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-File-Name': 'backup.zip'
      },
      body: zipBuffer
    });

    const inspectJson = await inspectRes.json();
    expect(inspectRes.status).toBe(200);
    expect(inspectJson.success).toBe(true);
    expect(inspectJson.token).toBeDefined();
    expect(inspectJson.preview.title).toBe('Imported Project');
    expect(inspectJson.preview.mapCount).toBe(1);
    expect(inspectJson.preview.buildingCount).toBe(1);
    expect(inspectJson.preview.documentCount).toBe(1);
    expect(inspectJson.preview.mediaFileCount).toBe(2);
  });

  it('POST /api/import/inspect rejects corrupted archives with 400', async () => {
    const corruptBuffer = Buffer.from('this is not a zip file');

    const inspectRes = await ctx.fetch('/api/import/inspect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-File-Name': 'corrupt.zip'
      },
      body: corruptBuffer
    });

    expect(inspectRes.status).toBe(400);
    const json = await inspectRes.json();
    expect(json.error).toBeDefined();
  });

  it('POST /api/import/execute executes restore in replace mode', async () => {
    const zip = new AdmZip();
    zip.addFile('manifest.json', Buffer.from(JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: {
        title: 'Restored Title',
        activeMapId: 'map-restored',
        maps: [{ id: 'map-restored', title: 'Restored Map', imageUrl: 'media/map.png', width: 600, height: 400 }]
      },
      buildings: [
        {
          id: 'b-restored',
          mapId: 'map-restored',
          letter: 'R',
          name: 'Restored Building',
          description: 'Restored desc',
          color: '#8b5cf6',
          polygon: [[10, 10], [20, 20]],
          documents: []
        }
      ]
    }, null, 2)));
    zip.addFile('media/map.png', Buffer.from('map-data'));

    // Inspect first to get token
    const inspectRes = await ctx.fetch('/api/import/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': 'restore.zip' },
      body: zip.toBuffer()
    });
    const { token } = await inspectRes.json();

    // Execute import in 'replace' mode
    const execRes = await ctx.fetch('/api/import/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, mode: 'replace' })
    });

    expect(execRes.status).toBe(200);
    const execJson = await execRes.json();
    expect(execJson.success).toBe(true);
    expect(execJson.settings.title).toBe('Restored Title');
    expect(execJson.buildings.length).toBe(1);
    expect(execJson.buildings[0].letter).toBe('R');

    // Confirm state on server
    const dataRes = await ctx.fetch('/api/data');
    const serverData = await dataRes.json();
    expect(serverData.settings.title).toBe('Restored Title');
    expect(serverData.buildings.length).toBe(1);
    expect(serverData.buildings[0].id).toBe('b-restored');
  });

  it('POST /api/import/execute executes restore in merge mode', async () => {
    // Existing data has building 'A'
    const zip = new AdmZip();
    zip.addFile('manifest.json', Buffer.from(JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: {
        title: 'Merge Test',
        activeMapId: 'page-1',
        maps: []
      },
      buildings: [
        {
          id: 'b-merged-new',
          mapId: 'page-1',
          letter: 'M',
          name: 'Merged Building',
          description: '',
          color: '#f59e0b',
          polygon: [[5, 5]],
          documents: []
        }
      ]
    }, null, 2)));

    const inspectRes = await ctx.fetch('/api/import/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': 'merge.zip' },
      body: zip.toBuffer()
    });
    const { token } = await inspectRes.json();

    const execRes = await ctx.fetch('/api/import/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, mode: 'merge' })
    });

    expect(execRes.status).toBe(200);
    const execJson = await execRes.json();
    expect(execJson.success).toBe(true);
    
    // In merge mode, existing default buildings remain and new building is merged
    expect(execJson.buildings.some((b: any) => b.id === 'b-merged-new')).toBe(true);
    expect(execJson.buildings.some((b: any) => b.letter === 'A')).toBe(true);
  });
});
