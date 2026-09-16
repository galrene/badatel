/**
 * Computes the center (centroid) of a 2D polygon given as [lat, lng] array.
 * If polygon has fewer than 3 vertices, returns average of vertices.
 */
export function computeCentroid(rawPoints: [number, number][]): [number, number] {
  if (!rawPoints || !Array.isArray(rawPoints) || rawPoints.length === 0) return [0, 0];

  // Filter out non-numeric or NaN coordinates
  const points = rawPoints.filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (points.length === 0) return [0, 0];
  if (points.length === 1) return [Math.round(points[0][0]), Math.round(points[0][1])];
  if (points.length === 2) {
    return [Math.round((points[0][0] + points[1][0]) / 2), Math.round((points[0][1] + points[1][1]) / 2)];
  }

  // Calculate polygon bounding box for sanity checks
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  for (const [lat, lng] of points) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  const avgY = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const avgX = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  const fallback: [number, number] = [Math.round(avgY), Math.round(avgX)];

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

  // Fallback if signed area is too close to zero (e.g. collinear points or self-cancelling bowtie)
  if (Math.abs(signedArea) < 1.0) {
    return fallback;
  }

  cx = cx / (6 * signedArea);
  cy = cy / (6 * signedArea);

  // If calculated centroid falls outside the bounding box (bowtie/distortion), use arithmetic mean
  if (!Number.isFinite(cy) || !Number.isFinite(cx) || cy < minLat || cy > maxLat || cx < minLng || cx > maxLng) {
    return fallback;
  }

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
