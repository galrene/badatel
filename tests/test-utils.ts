import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Readable, Writable } from 'node:stream';

export interface MockResponse {
  status: number;
  statusCode: number;
  headers: {
    get: (name: string) => string | null;
  };
  text: () => Promise<string>;
  json: () => Promise<any>;
  arrayBuffer: () => Promise<ArrayBuffer>;
  rawBuffer: Buffer;
  buffer: () => Promise<Buffer>;
}

export interface TestServerContext {
  tempDir: string;
  dataDir: string;
  uploadsDir: string;
  sampleDir: string;
  baseUrl: string;
  fetch: (urlOrPath: string, options?: any) => Promise<MockResponse>;
  cleanup: () => Promise<void>;
  createApiMiddleware: any;
  resetHashIndexForTesting: any;
}

/**
 * Creates an in-process, deterministic test environment that dispatches
 * requests directly through createApiMiddleware without requiring TCP socket permissions.
 */
export async function createTestServer(): Promise<TestServerContext> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'badatel-test-'));
  const dataDir = path.join(tempDir, 'data');
  const publicDir = path.join(tempDir, 'public');
  const uploadsDir = path.join(publicDir, 'uploads');
  const sampleDir = path.join(publicDir, 'sample-map');

  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(sampleDir, { recursive: true });

  // Point environment variables to test isolated directories
  process.env.DATA_DIR = dataDir;
  process.env.BACKUP_DIR = path.join(dataDir, 'backups');
  process.env.TEMP_DIR = path.join(dataDir, 'temp');
  process.env.PUBLIC_DIR = publicDir;
  process.env.UPLOADS_DIR = uploadsDir;
  process.env.SAMPLE_DIR = sampleDir;

  // Import api module with environment overrides applied
  const apiModule = await import('../server/api.js');
  apiModule.resetHashIndexForTesting();
  apiModule.ensureDirsExist();

  const apiMiddleware = apiModule.createApiMiddleware();

  const localFetch = async (urlOrPath: string, options: any = {}): Promise<MockResponse> => {
    // Extract pathname and search from full URL or relative path
    let pathname = urlOrPath;
    try {
      const parsed = new URL(urlOrPath, 'http://localhost');
      pathname = parsed.pathname + parsed.search;
    } catch {}

    const method = (options.method || 'GET').toUpperCase();
    const headers: Record<string, string> = {};
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((v: string, k: string) => {
          headers[k.toLowerCase()] = v;
        });
      } else if (typeof options.headers === 'object') {
        for (const [k, v] of Object.entries(options.headers)) {
          headers[k.toLowerCase()] = String(v);
        }
      }
    }

    let bodyBuffer: Buffer | null = null;
    if (options.body) {
      if (typeof options.body === 'string') {
        bodyBuffer = Buffer.from(options.body, 'utf8');
      } else if (Buffer.isBuffer(options.body) || options.body?.constructor?.name === 'Buffer') {
        bodyBuffer = options.body;
      } else if (options.body instanceof Uint8Array || options.body?.constructor?.name === 'Uint8Array') {
        bodyBuffer = Buffer.from(options.body.buffer, options.body.byteOffset, options.body.byteLength);
      } else if (options.body instanceof ArrayBuffer || options.body?.byteLength !== undefined) {
        bodyBuffer = Buffer.from(options.body);
      }
    }

    // Build mock Readable request using Readable.from
    const req = Readable.from(bodyBuffer ? [bodyBuffer] : []) as any;
    req.url = pathname;
    req.method = method;
    req.headers = headers;
    req.destroy = () => {};

    return new Promise<MockResponse>((resolve, reject) => {
      const resHeaders: Record<string, string> = {};
      const resChunks: Buffer[] = [];
      let statusCode = 200;
      let isResolved = false;

      const finish = () => {
        if (isResolved) return;
        isResolved = true;
        const fullBuffer = Buffer.concat(resChunks);
        const mockRes: MockResponse = {
          status: statusCode,
          statusCode,
          headers: {
            get: (name: string) => resHeaders[name.toLowerCase()] || null
          },
          text: async () => fullBuffer.toString('utf8'),
          json: async () => {
            const str = fullBuffer.toString('utf8');
            return str ? JSON.parse(str) : {};
          },
          arrayBuffer: async () => {
            const ab = new ArrayBuffer(fullBuffer.length);
            const view = new Uint8Array(ab);
            for (let i = 0; i < fullBuffer.length; ++i) {
              view[i] = fullBuffer[i];
            }
            return ab;
          },
          rawBuffer: fullBuffer,
          buffer: async () => fullBuffer
        };
        resolve(mockRes);
      };

      const res = new Writable({
        write(chunk, encoding, callback) {
          resChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
          callback();
        },
        final(callback) {
          callback();
          finish();
        }
      }) as any;

      res.on('finish', finish);

      Object.defineProperty(res, 'statusCode', {
        get: () => statusCode,
        set: (code: number) => { statusCode = code; }
      });

      res.setHeader = (key: string, value: any) => {
        resHeaders[key.toLowerCase()] = String(value);
      };

      res.getHeader = (key: string) => resHeaders[key.toLowerCase()];

      res.writeHead = (code: number, headersOrReason?: any, maybeHeaders?: any) => {
        statusCode = code;
        const h = maybeHeaders || (typeof headersOrReason === 'object' ? headersOrReason : {});
        for (const [k, v] of Object.entries(h)) {
          resHeaders[k.toLowerCase()] = String(v);
        }
        return res;
      };

      try {
        apiMiddleware(req, res, () => {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Not Found' }));
        });
      } catch (err) {
        reject(err);
      }
    });
  };

  const cleanup = async () => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      // ignore cleanup errors
    }
  };

  return {
    tempDir,
    dataDir,
    uploadsDir,
    sampleDir,
    baseUrl: '',
    fetch: localFetch,
    cleanup,
    createApiMiddleware: apiModule.createApiMiddleware,
    resetHashIndexForTesting: apiModule.resetHashIndexForTesting
  };
}
