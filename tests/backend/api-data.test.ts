import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestServer, TestServerContext } from '../test-utils';

describe('Backend API: Data & Settings Persistence (WF-1, WF-2, WF-5)', () => {
  let ctx: TestServerContext;

  beforeEach(async () => {
    ctx = await createTestServer();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it('GET /api/data bootstraps and returns default settings and sample buildings', async () => {
    const res = await ctx.fetch('/api/data');
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.settings).toBeDefined();
    expect(data.settings.title).toBe('Badatel');
    expect(data.settings.activeMapId).toBe('page-1');
    expect(Array.isArray(data.settings.maps)).toBe(true);
    expect(data.settings.maps.length).toBeGreaterThan(0);

    expect(Array.isArray(data.buildings)).toBe(true);
    expect(data.buildings.length).toBeGreaterThan(0);
    expect(data.buildings[0]).toHaveProperty('letter', 'A');
    expect(data.buildings[0]).toHaveProperty('polygon');
    expect(data.buildings[0]).toHaveProperty('documents');
  });

  it('POST /api/settings merges and persists updated settings', async () => {
    const updatePayload = {
      title: 'Janov Historic Archive Site',
      activeMapId: 'page-2'
    };

    const res = await ctx.fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload)
    });

    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.success).toBe(true);
    expect(result.settings.title).toBe('Janov Historic Archive Site');
    expect(result.settings.activeMapId).toBe('page-2');

    // Fetch again to verify persistence
    const checkRes = await ctx.fetch('/api/data');
    const checkData = await checkRes.json();
    expect(checkData.settings.title).toBe('Janov Historic Archive Site');
    expect(checkData.settings.activeMapId).toBe('page-2');
  });

  it('POST /api/buildings saves and validates updated buildings list', async () => {
    const newBuildings = [
      {
        id: 'bld-custom-1',
        mapId: 'page-1',
        letter: 'X',
        name: 'Warehouse X',
        description: 'New test warehouse',
        color: '#ef4444',
        polygon: [[100, 100], [100, 200], [200, 200], [200, 100]],
        badgePosition: [150, 150],
        documents: []
      }
    ];

    const saveRes = await ctx.fetch('/api/buildings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buildings: newBuildings })
    });

    expect(saveRes.status).toBe(200);
    const saveJson = await saveRes.json();
    expect(saveJson.success).toBe(true);
    expect(saveJson.count).toBe(1);

    // Verify persistence via GET /api/data
    const checkRes = await ctx.fetch('/api/data');
    const checkData = await checkRes.json();
    expect(checkData.buildings.length).toBe(1);
    expect(checkData.buildings[0].letter).toBe('X');
    expect(checkData.buildings[0].name).toBe('Warehouse X');
  });

  it('POST /api/buildings rejects invalid payloads', async () => {
    const invalidRes = await ctx.fetch('/api/buildings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buildings: 'not-an-array' })
    });

    expect(invalidRes.status).toBe(400);
    const errJson = await invalidRes.json();
    expect(errJson.error).toContain('Expected array');
  });
});
