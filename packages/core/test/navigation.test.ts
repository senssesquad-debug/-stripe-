import { describe, expect, it } from 'vitest';
import {
  advance, distanceM, followCamera, initialState, nextCameraMode, offsetPoint, prepareRoute, simulate,
  type Camera, type LngLat, type NavState, type PreparedRoute, type SimScenario, type NavMode,
} from '../src/navigation';

// A real-shaped route in Limassol: ~600 m east along the seafront, a right turn, ~500 m south-east, a left turn, ~300 m east.
const A: LngLat = [33.0300, 34.6800];
const B = offsetPoint(A, 90, 600);
const C = offsetPoint(B, 150, 500);
const D = offsetPoint(C, 80, 300);
const densify = (pts: LngLat[]) => pts.flatMap((p, i) => (i === 0 ? [p] : Array.from({ length: 10 }, (_, k) => {
  const a = pts[i - 1]!; const f = (k + 1) / 10; return [a[0] + (p[0] - a[0]) * f, a[1] + (p[1] - a[1]) * f] as LngLat;
})));
const GEOM = densify([A, B, C, D]);
const steps = [
  { text: 'Head east', distanceM: 600, location: A, maneuver: { type: 'depart' } },
  { text: 'Turn right', distanceM: 500, location: B, maneuver: { type: 'turn', modifier: 'right' } },
  { text: 'Turn left', distanceM: 300, location: C, maneuver: { type: 'turn', modifier: 'left' } },
  { text: 'You have arrived', distanceM: 0, location: D, maneuver: { type: 'arrive' } },
];
const route = (mode: NavMode, durationMin = 18): PreparedRoute => prepareRoute({ mode, geometry: GEOM, steps, durationMin });

function run(r: PreparedRoute, scenario: SimScenario, rotate = true) {
  const events = simulate(r, scenario, { start: 1_000_000 });
  let s: NavState = initialState(r, 1_000_000);
  let cam: Camera | null = null;
  const states: NavState[] = [];
  const cams: Camera[] = [];
  for (const e of events) {
    s = advance(r, s, e.fix, e.t);
    cam = followCamera(r, s, cam, { rotate });
    states.push(s);
    cams.push(cam);
  }
  return { events, states, cams, last: s };
}

describe('route preparation', () => {
  it('measures the route and places each manoeuvre along it', () => {
    const r = route('walk');
    expect(r.lengthM).toBeGreaterThan(1350);
    expect(r.lengthM).toBeLessThan(1450);
    expect(r.steps.map((s) => Math.round(s.alongM / 10) * 10)).toEqual([0, 600, 1100, Math.round(r.lengthM / 10) * 10]);
  });
});

describe.each<[SimScenario, NavMode]>([['walk', 'walk'], ['bike', 'bike'], ['scooter', 'scooter'], ['drive', 'drive']])('simulated %s (%s)', (scenario, mode) => {
  const r = route(mode, mode === 'walk' ? 18 : mode === 'drive' ? 3 : 6);
  const { states, cams, last } = run(r, scenario);

  it('reaches the destination and stops navigating', () => {
    expect(last.status).toBe('arrived');
    expect(last.remainingM).toBe(0);
  });
  it('remaining distance only goes down (GPS noise does not make it jump back)', () => {
    for (let i = 1; i < states.length; i++) expect(states[i]!.remainingM).toBeLessThanOrEqual(states[i - 1]!.remainingM + 0.5);
  });
  it('next turn and distance to it follow the route', () => {
    const atStart = states[3]!;
    expect(atStart.nextStepIndex).toBe(1);
    expect(atStart.distanceToNextM!).toBeGreaterThan(500);
    const afterFirstTurn = states.find((s) => s.alongM > 700)!;
    expect(afterFirstTurn.nextStepIndex).toBe(2);
  });
  it('the zoom never changes with GPS updates (except drive speed classes)', () => {
    const zooms = new Set(cams.map((c) => c.zoom));
    expect(zooms.size).toBe(1);
  });
  it('the camera does not jump: consecutive centres are close and rotation is limited', () => {
    for (let i = 1; i < cams.length; i++) {
      const a = cams[i - 1]!; const b = cams[i]!;
      expect(distanceM([a.center.lng, a.center.lat], [b.center.lng, b.center.lat])).toBeLessThan(40);
      const turn = Math.abs(((b.bearing - a.bearing + 540) % 360) - 180);
      expect(turn).toBeLessThanOrEqual(30.001);
    }
  });
  it('the map turns with the route (east, then south-east, then east)', () => {
    const bearingAt = (m: number) => cams[states.findIndex((s) => s.alongM > m)]!.bearing;
    expect(Math.abs(bearingAt(300) - 90)).toBeLessThan(15);
    expect(Math.abs(bearingAt(950) - 150)).toBeLessThan(20);
  });
  it('ETA counts down to the arrival time', () => {
    const mid = states[Math.floor(states.length / 2)]!;
    const actualArrival = states.find((s) => s.status === 'arrived')!.lastFixAt!;
    expect(Math.abs(mid.etaAt - actualArrival)).toBeLessThan(0.35 * (actualArrival - 1_000_000));
  });
  it('fixes from the simulator are marked as simulated', () => {
    expect(last.simulated).toBe(true);
  });
});

describe('scenarios', () => {
  it('leaving the route is detected after a short confirmation, not on the first noisy fix', () => {
    const r = route('walk');
    const { events, states } = run(r, 'off_route');
    const firstOffEvent = events.findIndex((e) => e.phase === 'off_route');
    const firstOffState = states.findIndex((s) => s.status === 'off_route');
    expect(firstOffState).toBeGreaterThan(firstOffEvent);
    expect(states.some((s) => s.status === 'off_route')).toBe(true);
    expect(states[firstOffState]!.offRouteM).toBeGreaterThan(30);
    // While off the route the user's real (raw) position is shown, not a snapped one.
    expect(states[firstOffState]!.position.lat).toBeCloseTo(events[firstOffState]!.fix!.lat, 6);
  });

  it('a single far-off fix (GPS glitch) does not trigger re-routing', () => {
    const r = route('walk');
    let s = initialState(r, 0);
    const on = (m: number, t: number) => { const p = offsetPoint(A, 90, m); return { lat: p[1], lng: p[0], accuracyM: 6, at: t, speedMs: 1.4, heading: 90 }; };
    for (let i = 1; i <= 5; i++) s = advance(r, s, on(i * 1.4, i * 1000), i * 1000);
    const glitch = offsetPoint(offsetPoint(A, 90, 9), 0, 120);
    s = advance(r, s, { lat: glitch[1], lng: glitch[0], accuracyM: 6, at: 6000, speedMs: 1.4, heading: 90 }, 6000);
    expect(s.status).not.toBe('off_route');
    s = advance(r, s, on(10, 7000), 7000);
    expect(s.status).toBe('navigating');
    expect(s.offSince).toBeNull();
  });

  it('stopping is recognised and the ETA does not run to infinity', () => {
    const r = route('walk');
    const { states, events } = run(r, 'stop');
    const stopped = states.filter((_, i) => events[i]!.phase === 'stopped');
    expect(stopped.some((s) => s.status === 'stopped')).toBe(true);
    for (const s of stopped) expect(Number.isFinite(s.etaAt)).toBe(true);
  });

  it('turning back is followed (progress goes back), then forward again to the end', () => {
    const r = route('walk');
    const { states, last } = run(r, 'turn_around');
    const peak = Math.max(...states.slice(0, states.findIndex((s, i) => i > 0 && s.alongM < states[i - 1]!.alongM - 5) + 1).map((s) => s.alongM));
    expect(states.some((s) => s.alongM < peak - 40)).toBe(true);
    expect(last.status).toBe('arrived');
  });

  it('GPS loss is reported after 15 s without fixes, and navigation resumes when fixes return', () => {
    const r = route('walk');
    const events = simulate(r, 'gps_loss', { start: 0 });
    let s = initialState(r, 0);
    const seen: string[] = [];
    for (const e of events) {
      s = advance(r, s, e.fix, e.t);
      seen.push(`${e.phase}:${s.status}`);
    }
    expect(seen).toContain('gps_lost:gps_lost');
    const backIdx = seen.findIndex((x) => x.startsWith('gps_back'));
    expect(seen[backIdx]).toBe('gps_back:navigating');
    expect(s.status).toBe('arrived');
  });

  it('a new route after leaving the old one continues from the current position', () => {
    const r = route('walk');
    const detourStart = offsetPoint(offsetPoint(A, 90, 300), 0, 80);
    const r2 = prepareRoute({ mode: 'walk', geometry: densify([detourStart, offsetPoint(A, 90, 300), B, C, D]), steps, durationMin: 16 });
    let s = initialState(r2, 0);
    s = advance(r2, s, { lat: detourStart[1], lng: detourStart[0], accuracyM: 5, at: 1000, speedMs: 1.4, heading: 180 }, 1000);
    expect(s.status).toBe('navigating');
    expect(s.alongM).toBeLessThan(10);
    expect(s.remainingM).toBeGreaterThan(r.lengthM - 300);
  });
});

describe('camera modes', () => {
  it('a gesture switches to manual and stays there until Recenter', () => {
    let m = nextCameraMode('follow', 'gesture');
    expect(m).toBe('manual');
    m = nextCameraMode(m, 'gesture');
    expect(m).toBe('manual');
    expect(nextCameraMode(m, 'recenter')).toBe('follow');
    expect(nextCameraMode('follow', 'overview')).toBe('overview');
    expect(nextCameraMode('overview', 'overview')).toBe('follow');
  });
  it('small GPS jitter does not move the camera at all', () => {
    const r = route('walk');
    let s = initialState(r, 0);
    s = advance(r, s, { lat: A[1], lng: A[0], accuracyM: 5, at: 1000, speedMs: 0, heading: null }, 1000);
    const cam = followCamera(r, s, null);
    const j = offsetPoint(A, 10, 1.2);
    const s2 = advance(r, s, { lat: j[1], lng: j[0], accuracyM: 5, at: 2000, speedMs: 0, heading: null }, 2000);
    expect(followCamera(r, s2, cam)).toBe(cam);
  });
  it('driving zoom changes only between two speed classes, with hysteresis', () => {
    const r = route('drive', 3);
    const base = initialState(r, 0);
    let cam = followCamera(r, { ...base, speedMs: 10 }, null);
    expect(cam.zoom).toBe(16);
    cam = followCamera(r, { ...base, speedMs: 16 }, cam);
    expect(cam.zoom).toBe(16);
    cam = followCamera(r, { ...base, speedMs: 22 }, cam);
    expect(cam.zoom).toBe(15);
    cam = followCamera(r, { ...base, speedMs: 15 }, cam);
    expect(cam.zoom).toBe(15);
    cam = followCamera(r, { ...base, speedMs: 9 }, cam);
    expect(cam.zoom).toBe(16);
  });
  it('north-up mode never rotates', () => {
    const r = route('walk');
    const { cams } = run(r, 'walk', false);
    expect(new Set(cams.map((c) => c.bearing))).toEqual(new Set([0]));
  });
});
