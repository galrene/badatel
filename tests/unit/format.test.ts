import { describe, it, expect } from 'vitest';
import { formatBytes } from '../../src/utils/format';

describe('Format Utilities', () => {
  describe('formatBytes', () => {
    it('handles zero, negative, and falsy values', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(-100)).toBe('0 B');
      expect(formatBytes(null as any)).toBe('0 B');
      expect(formatBytes(undefined as any)).toBe('0 B');
    });

    it('formats raw bytes accurately', () => {
      expect(formatBytes(500)).toBe('500 B');
      expect(formatBytes(1023)).toBe('1023 B');
    });

    it('formats kilobytes accurately', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1024 * 50)).toBe('50 KB');
    });

    it('formats megabytes accurately', () => {
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1024 * 1024 * 4.5)).toBe('4.5 MB');
    });

    it('formats gigabytes and custom decimals', () => {
      expect(formatBytes(1024 * 1024 * 1024 * 2.75, 2)).toBe('2.75 GB');
      expect(formatBytes(1024 * 1024 * 1024 * 2.75, 0)).toBe('3 GB');
    });
  });
});
