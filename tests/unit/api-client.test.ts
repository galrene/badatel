// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeFileHash, uploadFileWithProgress, checkDuplicateHashes, rotateImage, fetchInitialData } from '../../src/api';

describe('Frontend API Client (WF-6, WF-7, WF-9)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('computeFileHash', () => {
    it('computes SHA-256 hash client-side deterministically', async () => {
      const content = 'Hello Badatel Map';
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      const hash = await computeFileHash(file);
      
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // standard 64 hex characters for SHA-256
      
      // Computing again on the exact same content must yield the exact same hash
      const file2 = new File([content], 'test2.txt', { type: 'text/plain' });
      const hash2 = await computeFileHash(file2);
      expect(hash).toBe(hash2);
    });
  });

  describe('uploadFileWithProgress', () => {
    it('handles progress callbacks, processing state, and successful completion', async () => {
      const mockXHR = {
        open: vi.fn(),
        send: vi.fn(),
        setRequestHeader: vi.fn(),
        status: 200,
        responseText: JSON.stringify({ url: '/uploads/doc.png', filename: 'doc.png' }),
        upload: {
          addEventListener: vi.fn((event, cb) => {
            if (event === 'progress') {
              // Simulate progress events
              cb({ lengthComputable: true, loaded: 50, total: 100 });
              cb({ lengthComputable: true, loaded: 100, total: 100 });
            }
          })
        },
        addEventListener: vi.fn((event, cb) => {
          if (event === 'load') {
            setTimeout(cb, 10);
          }
        })
      };

      vi.stubGlobal('XMLHttpRequest', vi.fn(() => mockXHR));

      const file = new File(['dummy-image-bytes'], 'blueprint.png', { type: 'image/png' });
      const progressCalls: number[] = [];
      let processingCalled = false;

      const promise = uploadFileWithProgress(file, {
        target: 'doc',
        subfolder: 'blocks',
        onProgress: (p) => progressCalls.push(p.percent),
        onProcessing: () => { processingCalled = true; }
      });

      const res = await promise;
      expect(res.url).toBe('/uploads/doc.png');
      expect(res.filename).toBe('doc.png');
      expect(progressCalls).toContain(50);
      expect(progressCalls).toContain(99); // Capped at 99 until server responds
      expect(processingCalled).toBe(true);
      expect(mockXHR.open).toHaveBeenCalledWith('POST', '/api/upload');
    });

    it('handles server HTTP error response properly', async () => {
      const mockXHR = {
        open: vi.fn(),
        send: vi.fn(),
        setRequestHeader: vi.fn(),
        status: 500,
        responseText: JSON.stringify({ error: 'Disk write failed' }),
        upload: { addEventListener: vi.fn() },
        addEventListener: vi.fn((event, cb) => {
          if (event === 'load') setTimeout(cb, 10);
        })
      };

      vi.stubGlobal('XMLHttpRequest', vi.fn(() => mockXHR));

      const file = new File(['bytes'], 'blueprint.png', { type: 'image/png' });
      await expect(uploadFileWithProgress(file)).rejects.toThrow('Disk write failed');
    });

    it('handles cancellation via AbortSignal', async () => {
      const abortController = new AbortController();
      abortController.abort(); // already aborted

      const file = new File(['bytes'], 'blueprint.png', { type: 'image/png' });
      await expect(uploadFileWithProgress(file, { signal: abortController.signal })).rejects.toThrow('Aborted');
    });
  });

  describe('fetchInitialData', () => {
    it('fetches settings and buildings successfully', async () => {
      const fakeData = {
        settings: { title: 'Site Map', activeMapId: 'p1', maps: [] },
        buildings: []
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => fakeData
      }));

      const res = await fetchInitialData();
      expect(res.settings.title).toBe('Site Map');
      expect(res.buildings).toEqual([]);
    });

    it('throws error when server responds with failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      }));

      await expect(fetchInitialData()).rejects.toThrow('Failed to load map data');
    });
  });

  describe('checkDuplicateHashes', () => {
    it('posts hash items and returns check results', async () => {
      const mockResults = [
        { hash: 'abc123', exists: true, url: '/uploads/existing.jpg' }
      ];

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, results: mockResults })
      }));

      const res = await checkDuplicateHashes([{ hash: 'abc123', filename: 'existing.jpg', size: 1000 }]);
      expect(res).toEqual(mockResults);
    });
  });

  describe('rotateImage', () => {
    it('sends rotate request and returns updated image info', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, url: '/uploads/map.png?t=123', width: 800, height: 600 })
      }));

      const res = await rotateImage('/uploads/map.png', 90, true, 'map-1');
      expect(res.url).toContain('?t=123');
      expect(res.width).toBe(800);
      expect(res.height).toBe(600);
    });
  });
});
