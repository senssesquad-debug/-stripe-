export interface LatLng {
  lat: number;
  lng: number;
}

const R = 6371.0088; // mean Earth radius, km

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const RADIUS_OPTIONS_KM = [1, 3, 5, 10, 25, 50] as const;

export type TravelMode = 'walk' | 'drive';

/**
 * Rough travel-time estimate when no routing API is configured. Always presented as approximate ("≈").
 * Straight-line distance × detour factor ÷ typical speed, plus a fixed overhead for driving (parking).
 */
export function estimateTravelMinutes(distanceKm: number, mode: TravelMode): number {
  if (mode === 'walk') return Math.max(1, Math.round(((distanceKm * 1.3) / 4.5) * 60));
  const speed = distanceKm < 5 ? 25 : distanceKm < 20 ? 40 : 65;
  return Math.max(3, Math.round(((distanceKm * 1.35) / speed) * 60 + 4));
}

/** Suggest a travel mode from distance. */
export function suggestMode(distanceKm: number): TravelMode {
  return distanceKm <= 1.5 ? 'walk' : 'drive';
}

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);
}

export function navigationLinks(dest: LatLng, label?: string): { google: string; apple: string } {
  const d = `${dest.lat.toFixed(6)},${dest.lng.toFixed(6)}`;
  const q = label ? `&q=${encodeURIComponent(label)}` : '';
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${d}`,
    apple: `https://maps.apple.com/?daddr=${d}${q}`,
  };
}
