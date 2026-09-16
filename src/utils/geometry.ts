/**
 * Computes the center (centroid) of a 2D polygon given as [lat, lng] array.
 * If polygon has fewer than 3 vertices, returns average of vertices.
 */
export function computeCentroid(points: [number, number][]): [number, number] {
  if (!points || points.length === 0) return [0, 0];
  if (points.length === 1) return points[0];
  if (points.length === 2) {
    return [(points[0][0] + points[1][0]) / 2, (points[0][1] + points[1][1]) / 2];
  }

  let signedArea = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    // points are [lat, lng] -> [y, x]
    const y0 = points[i][0];
    const x0 = points[i][1];
    const y1 = points[j][0];
    const x1 = points[j][1];

    const a = x0 * y1 - x1 * y0;
    signedArea += a;
    cx += (x0 + x1) * a;
    cy += (y0 + y1) * a;
  }

  signedArea *= 0.5;
  if (Math.abs(signedArea) < 1e-6) {
    // Fallback: standard arithmetic mean
    const avgY = points.reduce((sum, p) => sum + p[0], 0) / points.length;
    const avgX = points.reduce((sum, p) => sum + p[1], 0) / points.length;
    return [Math.round(avgY), Math.round(avgX)];
  }

  cx = cx / (6 * signedArea);
  cy = cy / (6 * signedArea);

  return [Math.round(cy), Math.round(cx)];
}

/**
 * Suggests the next available letter in the alphabet (A, B, C... Z, AA, AB...)
 */
export function getNextLetter(existingLetters: string[]): string {
  const upperLetters = new Set(existingLetters.map(l => l.toUpperCase().trim()));
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let i = 0; i < alphabet.length; i++) {
    const char = alphabet[i];
    if (!upperLetters.has(char)) {
      return char;
    }
  }
  return `Bld-${existingLetters.length + 1}`;
}
