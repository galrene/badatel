import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiMiddleware } from './server/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf'
};

export function createServer(options = {}) {
  const distDir = options.distDir || process.env.DIST_DIR || path.join(__dirname, 'dist');
  const publicDir = options.publicDir || process.env.PUBLIC_DIR || path.join(__dirname, 'public');
  const uploadsDir = options.uploadsDir || process.env.UPLOADS_DIR || path.join(publicDir, 'uploads');
  const sampleDir = options.sampleDir || process.env.SAMPLE_DIR || path.join(publicDir, 'sample-map');

  const apiHandler = createApiMiddleware();

  const server = http.createServer((req, res) => {
    // Graceful catch-all wrapper to prevent server process termination
    try {
      apiHandler(req, res, () => {
        // 1. Safe URL extraction & validation
        let rawPathname;
        try {
          const parsedUrl = new URL(req.url, 'http://localhost');
          rawPathname = parsedUrl.pathname;
        } catch {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          return res.end('Bad Request: Invalid URL');
        }

        if (rawPathname === '/') rawPathname = '/index.html';

        // 2. Prevent path traversal attacks
        const safePath = path.normalize(rawPathname).replace(/^(\.\.[\/\\])+/, '');

        // Check uploads, sample-map, public, and dist directories
        const checkPaths = [];
        if (safePath.startsWith('/uploads/') || safePath === '/uploads') {
          const rel = safePath.replace(/^\/uploads\/?/, '');
          checkPaths.push(path.join(uploadsDir, rel));
        }
        if (safePath.startsWith('/sample-map/') || safePath === '/sample-map') {
          const rel = safePath.replace(/^\/sample-map\/?/, '');
          checkPaths.push(path.join(sampleDir, rel));
        }
        checkPaths.push(path.join(publicDir, safePath));
        checkPaths.push(path.join(distDir, safePath));

        for (const filePath of checkPaths) {
          try {
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              const ext = path.extname(filePath).toLowerCase();
              res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
              const stream = fs.createReadStream(filePath);
              stream.on('error', (streamErr) => {
                console.warn('Stream read error:', streamErr.message);
                if (!res.headersSent) res.writeHead(500);
                res.end();
              });
              return stream.pipe(res);
            }
          } catch {
            // File stat / access error, proceed to fallback
          }
        }

        // Fallback to dist/index.html for SPA routing if available
        const indexPath = path.join(distDir, 'index.html');
        if (fs.existsSync(indexPath)) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          const stream = fs.createReadStream(indexPath);
          stream.on('error', () => res.end());
          return stream.pipe(res);
        }

        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      });
    } catch (err) {
      console.error('Unhandled server error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
      }
      res.end('Internal Server Error');
    }
  });

  return server;
}

export function startServer(options = {}) {
  const server = createServer(options);
  const port = options.port !== undefined ? options.port : (process.env.PORT || 5173);
  const host = options.host || process.env.HOST || '0.0.0.0';

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, host, () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      console.log(`Badatel Server running at http://${host}:${actualPort}`);
      resolve({ server, port: actualPort, host });
    });
  });
}

// Auto-start when executed directly: `node server.js`
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  startServer().catch(err => {
    console.error('Fatal server startup error:', err);
    process.exit(1);
  });
}
