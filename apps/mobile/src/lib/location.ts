import { COUNTRIES, cityBySlug, isInsideBbox } from '@passtra/core';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import type { LocationParams } from './api';
import { store, useAppState } from './store';

export type LocationStatus = 'unknown' | 'loading' | 'granted' | 'denied' | 'unavailable' | 'outside';

let cached: { lat: number; lng: number; at: number } | null = null;

/** Foreground location only, never stored server-side; coordinates are rounded to ~100 m before use. */
export function useUserLocation() {
  const enabled = useAppState((s) => s.useLocation);
  const [status, setStatus] = useState<LocationStatus>(cached ? 'granted' : 'unknown');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(cached);

  const locate = useCallback(async (ask: boolean) => {
    try {
      let perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted && ask && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setStatus('denied');
        return;
      }
      setStatus('loading');
      const pos = (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 })) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const lat = Math.round(pos.coords.latitude * 1000) / 1000;
      const lng = Math.round(pos.coords.longitude * 1000) / 1000;
      const inside = COUNTRIES.some((c) => c.enabled && isInsideBbox(c, lat, lng));
      if (!inside) {
        setStatus('outside');
        return;
      }
      cached = { lat, lng, at: Date.now() };
      setCoords({ lat, lng });
      setStatus('granted');
    } catch {
      setStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    if (enabled && (!cached || Date.now() - cached.at > 5 * 60_000)) void locate(false);
  }, [enabled, locate]);

  return { status: enabled ? status : 'denied', coords: enabled ? coords : null, request: () => { store.set({ useLocation: true }); return locate(true); } };
}

/** Parameters for discovery requests: GPS when available, otherwise the chosen city ("Explore the City"). */
export function useDiscoveryParams(): LocationParams & { label: string | null; usingGps: boolean; status: LocationStatus; request: () => Promise<void> } {
  const loc = useUserLocation();
  const city = useAppState((s) => s.city);
  const radius = useAppState((s) => s.radiusKm);
  if (loc.coords) return { lat: loc.coords.lat, lng: loc.coords.lng, radius, label: null, usingGps: true, status: loc.status, request: loc.request };
  return { city, radius: undefined, label: cityBySlug(city)?.name.en ?? city, usingGps: false, status: loc.status, request: loc.request };
}
