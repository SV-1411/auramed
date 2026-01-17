export function formatCoords(lat?: number, lon?: number) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return 'Unknown';
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}
