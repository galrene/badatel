import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestServer, TestServerContext } from '../test-utils';
import fs from 'node:fs';
import path from 'node:path';

describe('Backend API: System, Diagnostics & Local Files (WF-13, WF-14)', () => {
  let ctx: TestServerContext;

  beforeEach(async () => {
    ctx = await createTestServer();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it('GET /api/local-files scans uploads and groups files by subfolder', async () => {
    // Populate some files in root uploads and subfolders
    fs.writeFileSync(path.join(ctx.uploadsDir, 'doc1.jpg'), Buffer.from('img1'));
    
    const subDir = path.join(ctx.uploadsDir, 'blueprints');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, 'elevation.png'), Buffer.from('img2'));

    const res = await ctx.fetch('/api/local-files');
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(Array.isArray(data.files)).toBe(true);
    expect(Array.isArray(data.folders)).toBe(true);
    expect(data.folders).toContain('blueprints');

    const elevationFile = data.files.find((f: any) => f.name === 'elevation.png');
    expect(elevationFile).toBeDefined();
    expect(elevationFile.subfolder).toBe('blueprints');
  });

  it('GET /api/version returns valid application and commit metadata', async () => {
    const res = await ctx.fetch('/api/version');
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('commitHash');
    expect(data).toHaveProperty('shortHash');
    expect(typeof data.version).toBe('string');
  });

  it('handles unknown API routes with 404', async () => {
    const res = await ctx.fetch('/api/non-existent-endpoint');
    expect(res.status).toBe(404);
  });
});
