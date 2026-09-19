import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Automatically clean up DOM after each test
afterEach(() => {
  cleanup();
});

// Polyfill window.URL.createObjectURL and revokeObjectURL for tests
if (typeof window !== 'undefined') {
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  }
  if (!window.URL.revokeObjectURL) {
    window.URL.revokeObjectURL = vi.fn();
  }

  // Mock window.alert
  window.alert = vi.fn();

  // Mock scrollTo
  window.scrollTo = vi.fn();
}

// Polyfill File.prototype.arrayBuffer and Blob.prototype.arrayBuffer if missing in jsdom
if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function () {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(this);
    });
  };
}

if (typeof File !== 'undefined' && !File.prototype.arrayBuffer) {
  File.prototype.arrayBuffer = function () {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(this);
    });
  };
}

// Injected compile-time Vite globals
(globalThis as any).__APP_VERSION__ = '0.1.0';
(globalThis as any).__COMMIT_HASH__ = '930adb7a69b76c8c';
(globalThis as any).__COMMIT_SHORT_HASH__ = '930adb7';
(globalThis as any).__COMMIT_MESSAGE__ = 'Test commit message';
(globalThis as any).__COMMIT_DATE__ = '2026-09-18';
(globalThis as any).__BUILD_TIME__ = '2026-09-18T23:00:00.000Z';
