import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestServer, TestServerContext } from '../test-utils';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

describe('Backend API: Image & Map Rotation (WF-9, WF-14)', () => {
  let ctx: TestServerContext;

  beforeEach(async () => {
    ctx = await createTestServer();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it('POST /api/rotate rotates an image by 90 degrees and updates cache-buster', async () => {
    // Create an asymmetric 200x100 test image in uploads
    const imgBuffer = await sharp({
      create: { width: 200, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } }
    }).png().toBuffer();

    const imgPath = path.join(ctx.uploadsDir, 'doc-to-rotate.png');
    fs.writeFileSync(imgPath, imgBuffer);

    const res = await ctx.fetch('/api/rotate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: '/uploads/doc-to-rotate.png',
        degrees: 90
      })
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.width).toBe(100);
    expect(data.height).toBe(200);
    expect(data.url).toMatch(/^\/uploads\/doc-to-rotate\.png\?t=\d+$/);

    // Verify rotated file on disk has new dimensions
    const meta = await sharp(imgPath).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(200);
  });

  it('POST /api/rotate updates map settings when isMap is true', async () => {
    // Add a map sheet to settings
    const mapImgBuffer = await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 0, g: 255, b: 0 } }
    }).png().toBuffer();

    const mapPath = path.join(ctx.uploadsDir, 'site-map-1.png');
    fs.writeFileSync(mapPath, mapImgBuffer);

    await ctx.fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        maps: [
          {
            id: 'test-map-id',
            title: 'Test Map Sheet',
            imageUrl: '/uploads/site-map-1.png',
            width: 400,
            height: 300
          }
        ],
        activeMapId: 'test-map-id'
      })
    });

    const rotateRes = await ctx.fetch('/api/rotate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: '/uploads/site-map-1.png',
        degrees: 90,
        isMap: true,
        mapId: 'test-map-id'
      })
    });

    expect(rotateRes.status).toBe(200);
    const rotateData = await rotateRes.json();
    expect(rotateData.width).toBe(300);
    expect(rotateData.height).toBe(400);
    expect(rotateData.settings).toBeDefined();
    expect(rotateData.settings.maps[0].width).toBe(300);
    expect(rotateData.settings.maps[0].height).toBe(400);
    expect(rotateData.settings.maps[0].imageUrl).toContain('/uploads/site-map-1.png?t=');
  });

  it('POST /api/rotate strictly blocks path traversal attacks (403 Forbidden)', async () => {
    const maliciousAttempts = [
      '../../data/settings.json',
      '/../data/buildings.json',
      '../../../etc/passwd'
    ];

    for (const badUrl of maliciousAttempts) {
      const res = await ctx.fetch('/api/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: badUrl,
          degrees: 90
        })
      });

      expect([403, 404]).toContain(res.status);
    }
  });

  it('POST /api/rotate rejects non-existent files with 404', async () => {
    const res = await ctx.fetch('/api/rotate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: '/uploads/non-existent-image.png',
        degrees: 90
      })
    });

    expect(res.status).toBe(404);
  });

  it('POST /api/rotate rejects invalid rotation angles with 400', async () => {
    const res = await ctx.fetch('/api/rotate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: '/uploads/test.png',
        degrees: 45 // Not allowed (only 90, 180, 270)
      })
    });

    expect(res.status).toBe(400);
  });
});
