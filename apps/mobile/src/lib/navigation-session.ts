import {
  advance, followCamera, initialState, nextCameraMode, overviewBounds, prepareRoute, simulate,
  type Camera, type CameraBounds, type CameraMode, type NavFix, type NavMode, type NavRouteInput, type NavState, type NavStep, type PreparedRoute, type SimScenario,
} from '@passtra/core';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type Directions, type TransitOption } from './api';

/**
 * One navigation session: position source (the device's GPS, or a clearly labelled simulation for testing),
 * progress along the route, re-routing when the user leaves it, and the camera mode.
 *
 * Simulated positions never leave this hook: they are not saved, not sent as "my location" and not used for
 * discovery. The only network call they cause is the test re-route request.
 */

export type NavKind = 'walk' | 'bike' | 'scooter' | 'drive' | 'transit';
export interface Dest { lat: number; lng: number; title: string }

/** Speed used for e-scooter ETAs (bicycle routes; Cyprus caps e-scooters at 25 km/h, typical ~18). */
const SCOOTER_SPEED_MS = 5;

/** The route to follow for a travel mode, from the directions response. */
export function routeFor(kind: NavKind, d: Directions, transitIdx = 0): { input: NavRouteInput; transit: TransitOption | null } | null {
  if (kind === 'transit') {
    const o = d.transit.status === 'ok' ? d.transit.options[transitIdx] ?? d.transit.options[0] : null;
    if (!o) return null;
    const geometry: Array<[number, number]> = [];
    const steps: NavStep[] = [];
    o.legs.forEach((l, i) => {
      const pts = l.type === 'bus' && l.stopList?.length ? l.stopList.map((s) => s.point) : [l.fromPoint, l.toPoint];
      for (const p of pts) geometry.push(p);
      // Transit step texts are structured (rendered and translated by the screen).
      if (l.type === 'walk') steps.push({ text: JSON.stringify({ k: 'walk', to: l.to === 'destination' ? null : l.to, leg: i }), distanceM: l.distanceM, location: l.fromPoint, maneuver: { type: 'walk' } });
      else {
        steps.push({ text: JSON.stringify({ k: 'board', route: l.route, headsign: l.headsign, stop: l.from, at: l.departure, leg: i }), distanceM: 0, location: l.fromPoint, maneuver: { type: 'board' } });
        steps.push({ text: JSON.stringify({ k: 'alight', stop: l.to, at: l.arrival, leg: i }), distanceM: 0, location: l.toPoint, maneuver: { type: 'alight' } });
      }
    });
    const last = o.legs[o.legs.length - 1]!;
    steps.push({ text: JSON.stringify({ k: 'arrive' }), distanceM: 0, location: last.toPoint, maneuver: { type: 'arrive' } });
    return { input: { mode: 'transit', geometry, steps, durationMin: o.durationMin }, transit: o };
  }
  const r = kind === 'scooter' ? d.bike : d[kind];
  if (!r || r.estimate) return null;
  const durationMin = kind === 'scooter' ? Math.max(1, Math.round((r.distanceKm * 1000) / SCOOTER_SPEED_MS / 60)) : r.durationMin;
  return {
    input: { mode: kind as NavMode, geometry: r.geometry, steps: r.steps.map((s) => ({ text: s.text, distanceM: s.distanceM, location: s.location, maneuver: s.maneuver ?? null })), durationMin },
    transit: null,
  };
}

export type CameraView = { kind: 'follow'; cam: Camera } | { kind: 'overview'; bounds: CameraBounds } | { kind: 'manual' };

export interface SessionOptions {
  kind: NavKind;
  dest: Dest;
  initial: Directions;
  transitIdx: number;
  /** null = real GPS */
  sim: SimScenario | null;
  /** simulation speed-up (1 = real time) */
  simSpeed?: number;
}

export function useNavigationSession(o: SessionOptions) {
  const [built] = useState(() => routeFor(o.kind, o.initial, o.transitIdx));
  const [route, setRoute] = useState<PreparedRoute | null>(() => (built ? prepareRoute(built.input) : null));
  const [transit, setTransit] = useState<TransitOption | null>(built?.transit ?? null);
  const [state, setState] = useState<NavState | null>(() => (route ? initialState(route, Date.now()) : null));
  const [camMode, setCamMode] = useState<CameraMode>('follow');
  const [rotate, setRotate] = useState(true);
  const [rerouting, setRerouting] = useState(false);
  const [rerouteError, setRerouteError] = useState<string | null>(null);
  const [lastFix, setLastFix] = useState<NavFix | null>(null);
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>(o.sim ? 'granted' : 'unknown');
  const [view, setView] = useState<CameraView>({ kind: 'manual' });
  const [arrivalAt, setArrivalAt] = useState<number | null>(null);
  const camRef = useRef<Camera | null>(null);
  const routeRef = useRef(route);
  const stateRef = useRef(state);
  const lastReroute = useRef(0);
  const simClock = useRef<number | null>(null); // simulated "now" (ms)
  useEffect(() => { routeRef.current = route; }, [route]);

  const onFix = useCallback((fix: NavFix | null, now: number) => {
    const r = routeRef.current;
    const s = stateRef.current;
    if (!r || !s) return;
    const next = advance(r, s, fix, now);
    if (next !== s) {
      stateRef.current = next;
      setState(next);
      if (next.status === 'arrived' && s.status !== 'arrived') setCamMode((m) => nextCameraMode(m, 'arrived')); // show the whole trip
    }
    if (fix) setLastFix(fix);
  }, []);

  // Position source.
  useEffect(() => {
    if (!route) return;
    if (o.sim) {
      const speed = o.simSpeed ?? 1;
      const events = simulate(route, o.sim, { start: Date.now(), tickMs: 1000 });
      let i = 0;
      simClock.current = events[0]?.t ?? Date.now();
      const id = setInterval(() => {
        const e = events[i++];
        if (!e) { clearInterval(id); return; }
        simClock.current = e.t;
        onFix(e.fix, e.t);
      }, 1000 / speed);
      return () => clearInterval(id);
    }
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    void (async () => {
      let perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted && perm.canAskAgain !== false) perm = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (!perm.granted) { setPermission('denied'); return; }
      setPermission('granted');
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 2, maximumAge: 0 } as Location.LocationOptions,
        (p) => onFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: p.coords.accuracy ?? null, at: p.timestamp || Date.now(), speedMs: p.coords.speed ?? null, heading: p.coords.heading ?? null }, Date.now()),
      );
    })();
    // Without fixes the state must still notice the GPS is gone.
    const tick = setInterval(() => onFix(null, Date.now()), 2000);
    return () => { cancelled = true; sub?.remove(); clearInterval(tick); };
    // A new route keeps the same source; only the simulation restarts with the first route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.sim, !!route]);

  // Re-route after leaving the route (at most every 15 s).
  useEffect(() => {
    if (state?.status !== 'off_route' || rerouting || !lastFix) return;
    if (Date.now() - lastReroute.current < 15_000) return;
    lastReroute.current = Date.now();
    setRerouting(true);
    setRerouteError(null);
    api.directions({ lat: lastFix.lat, lng: lastFix.lng }, o.dest)
      .then((d) => {
        const b = routeFor(o.kind, d, 0);
        if (!b) throw new Error('no_route');
        const r = prepareRoute(b.input);
        const s0 = advance(r, initialState(r, lastFix.at), lastFix, lastFix.at);
        routeRef.current = r;
        stateRef.current = s0;
        setRoute(r);
        setTransit(b.transit);
        setState(s0);
      })
      .catch(() => setRerouteError('reroute_failed'))
      .finally(() => setRerouting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.status]);

  // Camera for the current mode: recomputed when the position, the mode or the route changes. The follow camera
  // returns the previous one for GPS jitter, and the overview is fixed while shown, so the map only moves when it should.
  // The camera depends on the previous camera (dead-band, limited rotation), so it can't be derived during render:
  // it is synced here from the navigation state.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!route || !state) return;
    if (camMode === 'follow' && state.lastFixAt !== null) {
      const cam = followCamera(route, state, camRef.current, { rotate });
      if (cam !== camRef.current) { camRef.current = cam; setView({ kind: 'follow', cam }); }
    } else if (camMode === 'overview' || camMode === 'follow') {
      camRef.current = null;
      setView((v) => (v.kind === 'overview' ? v : { kind: 'overview', bounds: overviewBounds(route, state) }));
    } else {
      camRef.current = null;
      setView((v) => (v.kind === 'manual' ? v : { kind: 'manual' }));
    }
    // Wall-clock arrival (the simulation may run faster than real time).
    const nowRef = o.sim ? simClock.current ?? Date.now() : state.lastFixAt ?? Date.now();
    setArrivalAt(Date.now() + (state.etaAt - nowRef));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, state, camMode, rotate]);
  // A new route gets a new overview.
  useEffect(() => { setView((v) => (v.kind === 'overview' ? { kind: 'manual' } : v)); }, [route]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return {
    route, state, transit, view, camMode, rotate, rerouting, rerouteError, lastFix, permission, arrivalAt,
    simulated: !!o.sim,
    gesture: () => setCamMode((m) => nextCameraMode(m, 'gesture')),
    recenter: () => { camRef.current = null; setCamMode(nextCameraMode(camMode, 'recenter')); },
    toggleOverview: () => setCamMode((m) => nextCameraMode(m, 'overview')),
    toggleRotate: () => { camRef.current = null; setRotate((r) => !r); },
  };
}
