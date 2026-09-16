import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiMiddleware } from './server/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');
const publicDir = path.join(__dirname, 'public');

const apiHandler = createApiMiddleware();
const PORT = process.env.PORT || 5173;

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

const server = http.createServer((req, res) => {
  // Graceful catch-all wrapper to prevent server process termination
  try {
    apiHandler(req, res, () => {
      // 1. Safe URL extraction & validation
      let rawPathname;
      try {
        const parsedUrl = new URL(req.url, 'http://localhost');
        rawPathname = parsedUrl.pathname;
      } catch (urlErr) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        return res.end('Bad Request: Invalid URL');
      }

      if (rawPathname === '/') rawPathname = '/index.html';

      // 2. Prevent path traversal attacks
      const safePath = path.normalize(rawPathname).replace(/^(\.\.[\/\\])+/, '');

      // Check uploads/public first for active user content, then dist
      const checkPaths = [
        path.join(publicDir, safePath),
        path.join(distDir, safePath)
      ];

      for (const filePath of checkPaths) {
        // Enforce boundary within allowed root dirs
        if (!filePath.startsWith(publicDir) && !filePath.startsWith(distDir)) continue;

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
        } catch (fileErr) {
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

const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`Badatel Server running at http://${HOST}:${PORT}`);
});
