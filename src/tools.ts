const ISRAEL_BOUNDS = {
  minLat: 29.0,
  maxLat: 33.5,
  minLon: 34.0,
  maxLon: 35.9,
};

export function isInIsrael(lat: number, lon: number): boolean {
  return (
    lat >= ISRAEL_BOUNDS.minLat &&
    lat <= ISRAEL_BOUNDS.maxLat &&
    lon >= ISRAEL_BOUNDS.minLon &&
    lon <= ISRAEL_BOUNDS.maxLon
  );
}
