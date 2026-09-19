import { describe, it, expect } from 'vitest';
import { computeCentroid, getNextLetter } from '../../src/utils/geometry';

describe('Geometry Utilities (WF-15)', () => {
  describe('computeCentroid', () => {
    it('returns [0, 0] for null, undefined, or empty vertices', () => {
      expect(computeCentroid([] as any)).toEqual([0, 0]);
      expect(computeCentroid(null as any)).toEqual([0, 0]);
      expect(computeCentroid(undefined as any)).toEqual([0, 0]);
    });

    it('returns the vertex itself for a single vertex', () => {
      expect(computeCentroid([[100, 200]])).toEqual([100, 200]);
    });

    it('returns the midpoint for two vertices', () => {
      expect(computeCentroid([[100, 200], [200, 400]])).toEqual([150, 300]);
    });

    it('computes accurate centroid for a standard rectangle', () => {
      // Rectangle with corners at (100, 100), (100, 300), (300, 300), (300, 100)
      const rect: [number, number][] = [
        [100, 100],
        [100, 300],
        [300, 300],
        [300, 100]
      ];
      const centroid = computeCentroid(rect);
      expect(centroid).toEqual([200, 200]);
    });

    it('computes accurate centroid for an inverted winding order', () => {
      const rectCounterClockwise: [number, number][] = [
        [300, 100],
        [300, 300],
        [100, 300],
        [100, 100]
      ];
      const centroid = computeCentroid(rectCounterClockwise);
      expect(centroid).toEqual([200, 200]);
    });

    it('falls back to arithmetic mean for collinear points (zero area)', () => {
      const collinear: [number, number][] = [
        [100, 100],
        [200, 200],
        [300, 300]
      ];
      const centroid = computeCentroid(collinear);
      expect(centroid).toEqual([200, 200]);
    });

    it('falls back to arithmetic mean for self-cancelling bowtie polygon', () => {
      // Self-intersecting figure-8 where opposite triangles cancel area
      const bowtie: [number, number][] = [
        [0, 0],
        [100, 100],
        [0, 100],
        [100, 0]
      ];
      const centroid = computeCentroid(bowtie);
      // Average of (0+100+0+100)/4 = 50, (0+100+100+0)/4 = 50
      expect(centroid).toEqual([50, 50]);
    });

    it('ensures centroid always falls within bounding box', () => {
      const poly: [number, number][] = [
        [50, 60],
        [80, 200],
        [150, 180],
        [120, 70]
      ];
      const [cy, cx] = computeCentroid(poly);
      expect(cy).toBeGreaterThanOrEqual(50);
      expect(cy).toBeLessThanOrEqual(150);
      expect(cx).toBeGreaterThanOrEqual(60);
      expect(cx).toBeLessThanOrEqual(200);
    });

    it('filters out non-numeric or NaN coordinates safely', () => {
      const dirty: any = [
        [100, 100],
        ['invalid', 200],
        [NaN, 50],
        [300, 300],
        [100, 300]
      ];
      const centroid = computeCentroid(dirty);
      expect(Number.isFinite(centroid[0])).toBe(true);
      expect(Number.isFinite(centroid[1])).toBe(true);
    });
  });

  describe('getNextLetter', () => {
    it('suggests "A" when no letters exist', () => {
      expect(getNextLetter([])).toBe('A');
    });

    it('suggests next sequential letter', () => {
      expect(getNextLetter(['A'])).toBe('B');
      expect(getNextLetter(['A', 'B'])).toBe('C');
    });

    it('fills in missing letter gaps', () => {
      expect(getNextLetter(['A', 'C'])).toBe('B');
      expect(getNextLetter(['B', 'C', 'D'])).toBe('A');
    });

    it('is case-insensitive and trims whitespace', () => {
      expect(getNextLetter(['a ', ' B'])).toBe('C');
    });

    it('falls back to numbered format when alphabet is exhausted', () => {
      const allAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      expect(getNextLetter(allAlphabet)).toBe('Bld-27');
    });
  });
});
