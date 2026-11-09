/**
 * Turn-by-turn navigation logic, independent of any map SDK or GPS API so it can be tested without a device:
 *  - progress along a route: snapped position, distance travelled / remaining, next manoeuvre and distance to it
 *  - off-route detection (with accuracy and a short confirmation time, so one noisy fix doesn't trigger a re-route)
 *  - arrival, stops, GPS loss
 *  - ETA from the planned speed blended with the measured moving speed
 *  - camera: follow / overview / manual, with a stable zoom per travel mode, a dead-band against GPS jitter and
 *    smoothed rotation
 *  - a simulator that produces fixes along a route for test scenarios. Simulated fixes are always marked
 *    `simulated: true` and must never be presented or stored as the user's real position.
 */

export type NavMode = 'walk' | 'bike' | 'scooter' | 'drive' | 'transit';
export type LngLat = [number, number];

export interface NavStep {
  text: string;
  distanceM: number;
  location: LngLat;
  maneuver?: { type: string; modifier?: string | null } | null;
}

export interface NavRouteInput {
  mode: NavMode;
  geometry: LngLat[];
  steps: NavStep[];
  /** Planned duration of the whole route (from the router), used for the expected speed. */
  durationMin: number;
}

export interface NavFix {
  lat: number;
  lng: number;
  accuracyM: number | null;
  /** ms since epoch when the fix was taken */
  at: number;
  speedMs: number | null;
  /** degrees clockwise from north, if the device reports it */
  heading: number | null;
  simulated?: boolean;
}

export interface PreparedRoute {
  mode: NavMode;
  points: LngLat[];
  /** cumulative distance in metres at each point */
  cum: number[];
  lengthM: number;
  steps: Array<NavStep & { alongM: number }>;
  plannedSpeedMs: number;
  destination: LngLat;
}

export type NavStatus = 'navigating' | 'stopped' | 'off_route' | 'gps_lost' | 'arrived';

export interface NavState {
  status: NavStatus;
  /** position shown to the user: snapped to the route while on it, the raw fix when off it */
  position: { lat: number; lng: number };
  /** distance from the raw fix to the route */
  offRouteM: number;
  alongM: number;
  remainingM: number;
  progress: number;
  segIndex: number;
  nextStepIndex: number | null;
  distanceToNextM: number | null;
  /** smoothed moving speed (m/s), null until known */
  speedMs: number | null;
  /** smoothed direction of travel (degrees from north) */
  headingDeg: number;
  etaAt: number;
  remainingMin: number;
  lastFixAt: number | null;
  /** when the fixes started to be off the route (for the confirmation delay) */
  offSince: number | null;
  stoppedSince: number | null;
  simulated: boolean;
}

export interface NavOptions {
  /** off-route distance threshold before accuracy is added (metres) */
  offRouteM?: number;
  /** how long fixes must stay off the route before it counts (ms) */
  offRouteConfirmMs?: number;
  /** no fix for this long = GPS lost (ms) */
  gpsLostMs?: number;
  arrivalM?: number;
}

const MODE: Record<NavMode, { offRouteM: number; arrivalM: number; speedMs: number; zoom: number; minZoom: number; maxZoom: number }> = {
  walk: { offRouteM: 30, arrivalM: 20, speedMs: 1.3, zoom: 17.5, minZoom: 16.5, maxZoom: 18.5 },
  bike: { offRouteM: 35, arrivalM: 25, speedMs: 4.2, zoom: 16.8, minZoom: 15.5, maxZoom: 18 },
  scooter: { offRouteM: 35, arrivalM: 25, speedMs: 5.0, zoom: 16.8, minZoom: 15.5, maxZoom: 18 },
  drive: { offRouteM: 50, arrivalM: 35, speedMs: 10, zoom: 16, minZoom: 14, maxZoom: 17.5 },
  transit: { offRouteM: 120, arrivalM: 40, speedMs: 6, zoom: 15.5, minZoom: 13, maxZoom: 17 },
};
export const modeSettings = (m: NavMode) => MODE[m];

// ── Geometry (local metric projection; accurate to well under 1 % over a city-sized route) ──────────────────

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function distanceM(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDeg(a: LngLat, b: LngLat): number {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Point at `m` metres from `a` in direction `bearing`. */
export function offsetPoint(a: LngLat, bearing: number, m: number): LngLat {
  const d = m / R;
  const lat1 = rad(a[1]);
  const lng1 = rad(a[0]);
  const b = rad(bearing);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b));
  const lng2 = lng1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return [deg(lng2), deg(lat2)];
}

/** Projection of p on segment a→b: fraction t in [0,1] and distance from p (metres). */
function projectOnSegment(p: LngLat, a: LngLat, b: LngLat): { t: number; d: number; point: LngLat } {
  const k = Math.cos(rad(a[1])) * (Math.PI / 180) * R;
  const ky = (Math.PI / 180) * R;
  const ax = 0, ay = 0;
  const bx = (b[0] - a[0]) * k, by = (b[1] - a[1]) * ky;
  const px = (p[0] - a[0]) * k, py = (p[1] - a[1]) * ky;
  const len2 = bx * bx + by * by;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * bx + (py - ay) * by) / len2));
  const qx = bx * t, qy = by * t;
  return { t, d: Math.hypot(px - qx, py - qy), point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] };
}

/** Distance along the route of the point closest to p, searching segments [from, to). */
function snap(route: PreparedRoute, p: LngLat, from = 0, to = route.points.length - 1) {
  let best = { seg: 0, along: 0, d: Infinity, point: route.points[0]! };
  for (let i = Math.max(0, from); i < Math.min(to, route.points.length - 1); i++) {
    const a = route.points[i]!;
    const b = route.points[i + 1]!;
    const pr = projectOnSegment(p, a, b);
    if (pr.d < best.d) best = { seg: i, along: route.cum[i]! + (route.cum[i + 1]! - route.cum[i]!) * pr.t, d: pr.d, point: pr.point };
  }
  return best;
}

export function prepareRoute(input: NavRouteInput): PreparedRoute {
  const points = input.geometry.filter((p, i, arr) => i === 0 || p[0] !== arr[i - 1]![0] || p[1] !== arr[i - 1]![1]);
  if (points.length === 1) points.push(points[0]!);
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1]! + distanceM(points[i - 1]!, points[i]!));
  const lengthM = cum[cum.length - 1]!;
  const base: PreparedRoute = { mode: input.mode, points, cum, lengthM, steps: [], plannedSpeedMs: MODE[input.mode].speedMs, destination: points[points.length - 1]! };
  // Where along the route each manoeuvre happens (steps are in order, so search forward from the previous one).
  let from = 0;
  base.steps = input.steps.map((s) => {
    const sn = snap(base, s.location, from);
    from = sn.seg;
    return { ...s, alongM: sn.along };
  });
  const planned = input.durationMin > 0 ? lengthM / (input.durationMin * 60) : 0;
  // The router's own speed for this route when it is plausible for the mode; otherwise the mode's typical speed.
  if (planned > MODE[input.mode].speedMs * 0.4 && planned < MODE[input.mode].speedMs * 2.5) base.plannedSpeedMs = planned;
  return base;
}

const angleDiff = (a: number, b: number) => ((b - a + 540) % 360) - 180;
const smoothAngle = (prev: number, next: number, alpha: number) => (prev + angleDiff(prev, next) * alpha + 360) % 360;

function routeBearingAt(route: PreparedRoute, seg: number): number {
  const a = route.points[seg]!;
  // Look a little ahead so a tiny segment doesn't swing the map.
  let j = seg + 1;
  while (j < route.points.length - 1 && distanceM(a, route.points[j]!) < 15) j++;
  return bearingDeg(a, route.points[Math.min(j, route.points.length - 1)]!);
}

export function initialState(route: PreparedRoute, now: number): NavState {
  const start = route.points[0]!;
  return {
    status: 'navigating', position: { lat: start[1], lng: start[0] }, offRouteM: 0, alongM: 0, remainingM: route.lengthM, progress: 0, segIndex: 0,
    nextStepIndex: route.steps.length ? 0 : null, distanceToNextM: route.steps[0]?.alongM ?? null, speedMs: null,
    headingDeg: routeBearingAt(route, 0), etaAt: now + (route.lengthM / route.plannedSpeedMs) * 1000, remainingMin: Math.ceil(route.lengthM / route.plannedSpeedMs / 60),
    lastFixAt: null, offSince: null, stoppedSince: null, simulated: false,
  };
}

/**
 * Next navigation state from the previous one and the latest fix (or none). Pure: call it on every fix and on a
 * timer (so GPS loss is noticed even when no fix arrives).
 */
export function advance(route: PreparedRoute, prev: NavState, fix: NavFix | null, now: number, opts: NavOptions = {}): NavState {
  const m = MODE[route.mode];
  const gpsLostMs = opts.gpsLostMs ?? 15_000;
  if (prev.status === 'arrived') return prev;
  const fresh = fix && fix.at > (prev.lastFixAt ?? -Infinity) ? fix : null;
  if (!fresh) {
    const lastAt = prev.lastFixAt;
    if (lastAt !== null && now - lastAt > gpsLostMs) return { ...prev, status: 'gps_lost', speedMs: null };
    return prev;
  }

  const p: LngLat = [fresh.lng, fresh.lat];
  // Search near the previous position first (a route can pass the same street twice), widen if that fails.
  const near = snap(route, p, prev.segIndex - 3, prev.segIndex + 60);
  const sn = near.d < m.offRouteM * 2 ? near : snap(route, p);
  const acc = Math.min(fresh.accuracyM ?? 15, 80);
  const threshold = (opts.offRouteM ?? m.offRouteM) + acc * 0.5;
  const isOff = sn.d > threshold;
  const offSince = isOff ? prev.offSince ?? fresh.at : null;
  const offConfirmed = isOff && fresh.at - (offSince ?? fresh.at) >= (opts.offRouteConfirmMs ?? 5_000);

  // Progress: small backwards jitter is ignored; a real turn-around (well beyond accuracy) is followed.
  let along = sn.along;
  if (!isOff && along < prev.alongM && prev.alongM - along < Math.max(12, acc)) along = prev.alongM;
  const remainingM = Math.max(0, route.lengthM - along);

  // Speed: device speed when the fix is precise, else movement between fixes; smoothed.
  const dt = prev.lastFixAt !== null ? (fresh.at - prev.lastFixAt) / 1000 : 0;
  const moved = dt > 0 ? distanceM([prev.position.lng, prev.position.lat], isOff ? p : [sn.point[0], sn.point[1]]) : 0;
  const measured = fresh.speedMs !== null && fresh.speedMs >= 0 && acc <= 30 ? fresh.speedMs : dt > 0 ? moved / dt : null;
  const speedMs = measured === null ? prev.speedMs : prev.speedMs === null ? measured : prev.speedMs * 0.6 + measured * 0.4;
  const stoppedNow = speedMs !== null && speedMs < 0.4;
  const stoppedSince = stoppedNow ? prev.stoppedSince ?? fresh.at : null;

  // Heading: the device's when moving, else the route's direction at this point; rotated smoothly.
  const target = fresh.heading !== null && fresh.heading >= 0 && (speedMs ?? 0) > 1.2 ? fresh.heading : isOff ? prev.headingDeg : routeBearingAt(route, sn.seg);
  const headingDeg = stoppedNow ? prev.headingDeg : smoothAngle(prev.headingDeg, target, 0.35);

  // ETA: planned speed blended with the measured moving speed (ignored while stopped or implausible).
  let v = route.plannedSpeedMs;
  if (speedMs !== null && !stoppedNow && speedMs > v * 0.3 && speedMs < v * 2.5) v = v * 0.5 + speedMs * 0.5;
  const etaAt = fresh.at + (remainingM / v) * 1000;

  const nextIdx = route.steps.findIndex((s) => s.alongM > along + 8);
  const arrived = remainingM <= (opts.arrivalM ?? m.arrivalM) || distanceM(p, route.destination) <= (opts.arrivalM ?? m.arrivalM);

  return {
    status: arrived ? 'arrived' : offConfirmed ? 'off_route' : stoppedSince !== null && fresh.at - stoppedSince > 8_000 ? 'stopped' : 'navigating',
    position: isOff ? { lat: fresh.lat, lng: fresh.lng } : { lat: sn.point[1], lng: sn.point[0] },
    offRouteM: Math.round(sn.d),
    alongM: along,
    remainingM: arrived ? 0 : remainingM,
    progress: route.lengthM > 0 ? Math.min(1, along / route.lengthM) : 1,
    segIndex: sn.seg,
    nextStepIndex: nextIdx >= 0 ? nextIdx : null,
    distanceToNextM: nextIdx >= 0 ? Math.max(0, route.steps[nextIdx]!.alongM - along) : null,
    speedMs,
    headingDeg,
    etaAt: arrived ? fresh.at : etaAt,
    remainingMin: arrived ? 0 : Math.max(1, Math.ceil(remainingM / v / 60)),
    lastFixAt: fresh.at,
    offSince,
    stoppedSince,
    simulated: !!fresh.simulated,
  };
}

// ── Camera ──────────────────────────────────────────────────────────────────────────────────────────────────

export type CameraMode = 'follow' | 'overview' | 'manual';

export interface Camera {
  center: { lat: number; lng: number };
  zoom: number;
  bearing: number;
  pitch: number;
  /** the user sits this fraction of the map height below the centre (more road ahead is visible) */
  offsetY: number;
}

export interface CameraBounds { west: number; south: number; east: number; north: number }

/**
 * Follow-mode camera. The zoom is chosen once per travel mode and only changes in coarse steps when the speed
 * class changes (drive), so GPS updates never zoom the map in and out. Small moves and small turns are ignored
 * (dead-band) and rotation is limited per update.
 */
export function followCamera(route: PreparedRoute, state: NavState, prev: Camera | null, opts: { rotate: boolean } = { rotate: true }): Camera {
  const m = MODE[route.mode];
  let zoom = prev?.zoom ?? m.zoom;
  if (route.mode === 'drive' && state.speedMs !== null) {
    // Two speed classes with hysteresis: town (16) and fast road (15).
    if (zoom > 15.5 && state.speedMs > 19) zoom = 15;
    else if (zoom < 15.5 && state.speedMs < 13) zoom = 16;
  }
  zoom = Math.min(m.maxZoom, Math.max(m.minZoom, zoom));
  const target = { lat: state.position.lat, lng: state.position.lng };
  if (prev) {
    const movedM = distanceM([prev.center.lng, prev.center.lat], [target.lng, target.lat]);
    const turn = Math.abs(angleDiff(prev.bearing, opts.rotate ? state.headingDeg : 0));
    if (movedM < 2 && turn < 5 && zoom === prev.zoom) return prev; // jitter: keep the camera still
  }
  let bearing = opts.rotate ? state.headingDeg : 0;
  if (prev && opts.rotate) {
    const d = angleDiff(prev.bearing, bearing);
    bearing = Math.abs(d) < 4 ? prev.bearing : (prev.bearing + Math.max(-30, Math.min(30, d)) + 360) % 360;
  }
  return { center: target, zoom, bearing, pitch: opts.rotate ? 45 : 0, offsetY: 0.2 };
}

/** Bounds of the part of the route still ahead (plus the user), for the overview camera. */
export function overviewBounds(route: PreparedRoute, state: NavState): CameraBounds {
  const pts = route.points.slice(state.segIndex);
  pts.push([state.position.lng, state.position.lat]);
  const lngs = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  return { west: Math.min(...lngs), south: Math.min(...lats), east: Math.max(...lngs), north: Math.max(...lats) };
}

/** Camera mode transitions: a gesture always wins over automatic following until the user asks to recenter. */
export function nextCameraMode(mode: CameraMode, event: 'gesture' | 'recenter' | 'overview' | 'arrived' | 'start'): CameraMode {
  if (event === 'gesture') return 'manual';
  if (event === 'recenter' || event === 'start') return 'follow';
  if (event === 'overview') return mode === 'overview' ? 'follow' : 'overview';
  if (event === 'arrived') return 'overview';
  return mode;
}

// ── Simulation (testing only) ───────────────────────────────────────────────────────────────────────────────

export type SimScenario = 'walk' | 'bike' | 'scooter' | 'drive' | 'off_route' | 'stop' | 'turn_around' | 'gps_loss';

export interface SimEvent {
  /** ms from the start of the simulation */
  t: number;
  /** null = no fix delivered at this tick (GPS lost) */
  fix: NavFix | null;
  /** what the scenario is doing at this moment (for test reports) */
  phase: 'moving' | 'off_route' | 'stopped' | 'turning_back' | 'gps_lost' | 'gps_back' | 'arrived';
}

const SIM_SPEED: Record<SimScenario, number> = { walk: 1.4, bike: 4.5, scooter: 5.5, drive: 11, off_route: 1.4, stop: 1.4, turn_around: 1.4, gps_loss: 1.4 };

/** Deterministic pseudo-random numbers (tests must be repeatable). */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function pointAlong(route: PreparedRoute, along: number): { p: LngLat; bearing: number } {
  const a = Math.max(0, Math.min(route.lengthM, along));
  let i = 0;
  while (i < route.cum.length - 2 && route.cum[i + 1]! < a) i++;
  const p0 = route.points[i]!;
  const p1 = route.points[i + 1] ?? p0;
  const segLen = route.cum[i + 1]! - route.cum[i]!;
  const t = segLen > 0 ? (a - route.cum[i]!) / segLen : 0;
  return { p: [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t], bearing: bearingDeg(p0, p1) };
}

/**
 * Fixes along the route for a scenario, one per `tickMs`, with small GPS noise. The mode's speed comes from the
 * scenario; the shape of the trip (detour, stop, turn-around, signal loss) from its name. Ends at the destination.
 */
export function simulate(route: PreparedRoute, scenario: SimScenario, opts: { start?: number; tickMs?: number; noiseM?: number; seed?: number } = {}): SimEvent[] {
  const start = opts.start ?? 0;
  const tick = opts.tickMs ?? 1000;
  const noise = opts.noiseM ?? 3;
  const rand = rng(opts.seed ?? 7);
  const speed = SIM_SPEED[scenario];
  const out: SimEvent[] = [];
  let along = 0;
  let t = 0;
  let detour = 0; // metres sideways (off_route)
  let stopLeft = scenario === 'stop' ? 30_000 : 0;
  let backLeft = scenario === 'turn_around' ? 80 : 0; // metres to walk back
  let turning = false;
  let lostLeft = scenario === 'gps_loss' ? 25_000 : 0;
  let lostDone = false;
  const L = route.lengthM;
  while (t < 3 * 3_600_000) {
    let phase: SimEvent['phase'] = 'moving';
    let v = speed;
    const frac = along / L;
    if (scenario === 'off_route' && frac > 0.35 && frac < 0.55) { detour = Math.min(120, detour + speed * (tick / 1000)); phase = 'off_route'; }
    else if (detour > 0) { detour = Math.max(0, detour - speed * (tick / 1000)); phase = detour > 0 ? 'off_route' : 'moving'; }
    if (scenario === 'stop' && frac > 0.5 && stopLeft > 0 && stopLeft <= 30_000) { v = 0; stopLeft -= tick; phase = 'stopped'; }
    if (scenario === 'turn_around' && (turning || frac > 0.4) && backLeft > 0) { turning = true; v = -speed; backLeft -= speed * (tick / 1000); phase = 'turning_back'; }
    let deliver = true;
    if (scenario === 'gps_loss' && frac > 0.3 && lostLeft > 0) { lostLeft -= tick; deliver = false; phase = 'gps_lost'; }
    else if (scenario === 'gps_loss' && lostLeft <= 0 && !lostDone && frac > 0.3) { lostDone = true; phase = 'gps_back'; }

    along = Math.max(0, Math.min(L, along + v * (tick / 1000)));
    const { p, bearing } = pointAlong(route, along);
    let pos = detour > 0 ? offsetPoint(p, (bearing + 90) % 360, detour) : p;
    pos = offsetPoint(pos, rand() * 360, rand() * noise);
    const heading = v === 0 ? null : v < 0 ? (bearing + 180) % 360 : bearing;
    const arrived = along >= L;
    out.push({
      t: start + t,
      fix: deliver ? { lat: pos[1], lng: pos[0], accuracyM: 5 + rand() * 4, at: start + t, speedMs: Math.abs(v), heading, simulated: true } : null,
      phase: arrived ? 'arrived' : phase,
    });
    if (arrived) break;
    t += tick;
  }
  return out;
}
