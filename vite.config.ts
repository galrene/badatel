import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createApiMiddleware } from './server/api.js';
import { getVersionInfo } from './server/version-helper.js';

const versionInfo = getVersionInfo();

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(versionInfo.version),
    __COMMIT_HASH__: JSON.stringify(versionInfo.commitHash),
    __COMMIT_SHORT_HASH__: JSON.stringify(versionInfo.shortHash),
    __COMMIT_MESSAGE__: JSON.stringify(versionInfo.commitMessage),
    __COMMIT_DATE__: JSON.stringify(versionInfo.commitDate),
    __BUILD_TIME__: JSON.stringify(versionInfo.buildTime),
  },
  plugins: [
    react(),
    {
      name: 'api-middleware',
      configureServer(server) {
        server.middlewares.use(createApiMiddleware());
      },
      configurePreviewServer(server) {
        server.middlewares.use(createApiMiddleware());
      }
    }
  ],
  server: {
    port: 5173,
    host: true
  }
});
