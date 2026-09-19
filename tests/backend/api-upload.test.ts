import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestServer, TestServerContext } from '../test-utils';
import crypto from 'node:crypto';
import fs from 'node:fs';

const TINY_PNG_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const RAW_PNG_BYTES = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const EXPECTED_HASH = crypto.createHash('sha256').update(RAW_PNG_BYTES).digest('hex');

describe('Backend API: Upload & Deduplication Pipeline (WF-6)', () => {
  let ctx: TestServerContext;

  beforeEach(async () => {
    ctx = await createTestServer();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it('POST /api/upload uploads an image to the uploads directory with dimension extraction', async () => {
    const uploadRes = await ctx.fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'test-blueprint.png',
        base64: TINY_PNG_BASE64,
        target: 'doc'
      })
    });

    expect(uploadRes.status).toBe(200);
    const data = await uploadRes.json();
    expect(data.url).toMatch(/^\/uploads\//);
    expect(data.filename).toMatch(/_test-blueprint\.png$/);
    expect(data.width).toBe(1);
    expect(data.height).toBe(1);
    expect(data.deduplicated).toBe(false);

    // Verify file exists on disk in uploadsDir
    const diskFiles = fs.readdirSync(ctx.uploadsDir);
    expect(diskFiles.some(f => f.endsWith('test-blueprint.png'))).toBe(true);
  });

  it('POST /api/upload supports subfolder categorization', async () => {
    const uploadRes = await ctx.fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'block-a-floor.png',
        base64: TINY_PNG_BASE64,
        target: 'doc',
        subfolder: 'building-a/floors'
      })
    });

    expect(uploadRes.status).toBe(200);
    const data = await uploadRes.json();
    expect(data.subfolder).toBe('building-a/floors');
    expect(data.url).toContain('/uploads/building-a/floors/');

    // Verify disk subfolder
    const subfolderPath = `${ctx.uploadsDir}/building-a/floors`;
    expect(fs.existsSync(subfolderPath)).toBe(true);
  });

  it('POST /api/upload/check-hashes detects duplicate files and returns metadata', async () => {
    // 1. Initial check on unknown hash returns exists: false
    const initialCheck = await ctx.fetch('/api/upload/check-hashes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ hash: EXPECTED_HASH, filename: 'my-file.png', size: RAW_PNG_BYTES.length }]
      })
    });

    const initialJson = await initialCheck.json();
    expect(initialJson.results[0].exists).toBe(false);

    // 2. Upload file
    await ctx.fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'my-file.png',
        base64: TINY_PNG_BASE64,
        target: 'doc'
      })
    });

    // 3. Second check with the same hash should return exists: true and deduplicated: true
    const secondCheck = await ctx.fetch('/api/upload/check-hashes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ hash: EXPECTED_HASH, filename: 'my-file.png', size: RAW_PNG_BYTES.length }]
      })
    });

    const secondJson = await secondCheck.json();
    expect(secondJson.results[0].exists).toBe(true);
    expect(secondJson.results[0].deduplicated).toBe(true);
    expect(secondJson.results[0].url).toMatch(/^\/uploads\//);
  });

  it('POST /api/upload deduplicates identical content automatically', async () => {
    // First upload
    const res1 = await ctx.fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'original.png',
        base64: TINY_PNG_BASE64,
        target: 'doc'
      })
    });
    const data1 = await res1.json();
    expect(data1.deduplicated).toBe(false);

    // Second upload with the exact same bytes to a different subfolder
    const res2 = await ctx.fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'copy.png',
        base64: TINY_PNG_BASE64,
        target: 'doc',
        subfolder: 'archive'
      })
    });
    const data2 = await res2.json();
    expect(data2.deduplicated).toBe(true);
  });

  it('POST /api/upload rejects invalid requests', async () => {
    const res = await ctx.fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'test.png' }) // missing base64
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });
});
