export function isValidLocation(loc: any): loc is { latitude: number; longitude: number } {
  return !!loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number';
}
