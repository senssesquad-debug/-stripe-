import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Precise device position for navigation (separate from the coarse, rounded location used for discovery).
 * Reports accuracy and age so the app never presents an old or vague fix as the current position:
 *  - stale: the fix is older than STALE_S (e.g. a cached last-known position)
 *  - weak: accuracy worse than WEAK_M (typical indoors or with poor GPS)
 *  - lost: while following, no update for LOST_S
 */
export const STALE_S = 60;
export const WEAK_M = 100;
export const LOST_S = 30;
const FIX_TIMEOUT_MS = 20_000;

export type PositionStatus = 'idle' | 'locating' | 'ok' | 'weak' | 'stale' | 'lost' | 'denied' | 'unavailable';
export interface Fix { lat: number; lng: number; accuracyM: number | null; at: number; speedMs: number | null; heading: number | null }

export function classify(fix: Fix | null, now: number, following: boolean, lastUpdate: number | null): PositionStatus {
  if (!fix) return 'idle';
  if (following && lastUpdate !== null && now - lastUpdate > LOST_S * 1000) return 'lost';
  if (now - fix.at > STALE_S * 1000) return 'stale';
  if (fix.accuracyM !== null && fix.accuracyM > WEAK_M) return 'weak';
  return 'ok';
}

const toFix = (p: Location.LocationObject): Fix => ({
  lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: p.coords.accuracy ?? null, at: p.timestamp || Date.now(),
  speedMs: p.coords.speed ?? null, heading: p.coords.heading ?? null,
});

export function usePosition() {
  const [fix, setFix] = useState<Fix | null>(null);
  const [error, setError] = useState<'denied' | 'unavailable' | null>(null);
  const [locating, setLocating] = useState(false);
  const [following, setFollowing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const lastUpdate = useRef<number | null>(null);
  const sub = useRef<Location.LocationSubscription | null>(null);

  // Re-evaluate age every few seconds so "updated 40 s ago" and staleness stay true.
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(id); }, []);

  const ensurePermission = useCallback(async (ask: boolean) => {
    let perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted && ask && perm.canAskAgain !== false) perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) { setError('denied'); return false; }
    return true;
  }, []);

  /** A fresh, high-accuracy fix (never a cached last-known position). Asks for permission only when `ask`. */
  const refresh = useCallback(async (ask = true) => {
    setLocating(true);
    setError(null);
    try {
      if (!(await ensurePermission(ask))) return null;
      // Always a fresh fix: on the web expo-location would otherwise accept a cached position of any age
      // (maximumAge: Infinity). A timeout covers "no signal" (indoors, tunnels).
      const p = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, mayShowUserSettingsDialog: true, maximumAge: 0, timeout: FIX_TIMEOUT_MS } as Location.LocationOptions),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), FIX_TIMEOUT_MS + 2000)),
      ]);
      const f = toFix(p);
      setFix(f);
      lastUpdate.current = Date.now();
      setNow(Date.now());
      return f;
    } catch {
      setError('unavailable');
      return null;
    } finally {
      setLocating(false);
    }
  }, [ensurePermission]);

  /** Follow the position while moving. */
  const follow = useCallback(async (on: boolean) => {
    sub.current?.remove();
    sub.current = null;
    setFollowing(on);
    if (!on) return;
    if (!(await ensurePermission(true))) { setFollowing(false); return; }
    lastUpdate.current = Date.now();
    sub.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, timeInterval: 3000, distanceInterval: 5, maximumAge: 0 } as Location.LocationOptions, (p) => {
      setFix(toFix(p));
      lastUpdate.current = Date.now();
      setNow(Date.now());
    });
  }, [ensurePermission]);

  useEffect(() => () => sub.current?.remove(), []);

  const status: PositionStatus = locating ? 'locating' : error ?? classify(fix, now, following, lastUpdate.current);
  return { fix, status, following, ageS: fix ? Math.max(0, Math.round((now - fix.at) / 1000)) : null, refresh, follow, ensurePermission };
}
