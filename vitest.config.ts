import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environmentMatchGlobs: [
      ['tests/backend/**', 'node'],
      ['tests/unit/**', 'node'],
      ['tests/frontend/**', 'jsdom']
    ],
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
