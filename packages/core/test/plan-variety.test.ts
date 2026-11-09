import { describe, expect, it } from 'vitest';
import { bucketOf } from '../src/activities';
import { planDay, type PlanCandidate } from '../src/plan-day';

// Larnaca centre on a weekday: cafés and bars right next to the start, activities 1–4 km away.
const O = { lat: 34.9167, lng: 33.6333 };
const near = (i: number) => ({ lat: O.lat + 0.0005 * (i % 5), lng: O.lng + 0.0005 * Math.floor(i / 5) });
const away = (km: number, i: number) => ({ lat: O.lat + km / 111 * (i % 2 ? 1 : -0.6), lng: O.lng + km / 91 * (i % 3 ? 0.5 : -1) });
const open = (from = '08:00', to = '23:59') => [{ start: new Date(`2026-11-10T${from}:00+02:00`), end: new Date(`2026-11-10T${to}:00+02:00`) }];
const cands: PlanCandidate[] = [
  ...Array.from({ length: 30 }, (_, i) => ({ id: `cafe${i}`, type: 'place' as const, title: `Café ${i}`, category: 'cafe', location: near(i), score: 0.6, openIntervals: open() })),
  ...Array.from({ length: 30 }, (_, i) => ({ id: `bar${i}`, type: 'place' as const, title: `Bar ${i}`, category: 'bar', location: near(i + 3), score: 0.6, openIntervals: open('10:00') })),
  ...Array.from({ length: 10 }, (_, i) => ({ id: `rest${i}`, type: 'place' as const, title: `Restaurant ${i}`, category: 'restaurant', location: near(i + 1), score: 0.55, openIntervals: open('11:00') })),
  { id: 'kart', type: 'place', title: 'Karting', category: 'karting', location: away(3, 1), score: 0.5, openIntervals: open('10:00', '20:00') },
  { id: 'museum', type: 'place', title: 'Museum', category: 'museum', location: away(1.2, 2), score: 0.45, openIntervals: open('09:00', '17:00') },
  { id: 'beach', type: 'place', title: 'Beach', category: 'beach', location: away(1.5, 3), score: 0.45 },
  { id: 'escape', type: 'place', title: 'Escape room', category: 'escape-room', location: away(2, 4), score: 0.45, openIntervals: open('12:00', '23:00') },
  { id: 'salt', type: 'place', title: 'Salt lake trail', category: 'hiking', location: away(4, 5), score: 0.4 },
];
const req = { start: new Date('2026-11-10T10:00:00+02:00'), end: new Date('2026-11-10T21:00:00+02:00'), tz: 'Europe/Nicosia', origin: O, candidates: cands, mode: 'drive' as const };
const hour = (d: Date) => Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Europe/Nicosia' }).format(d));

describe('a day out is not a café and bar crawl', () => {
  const plan = planDay(req);
  const kinds = plan.stops.map((s) => bucketOf(s.category));
  it('most stops are things to do, not places to eat or drink', () => {
    const doing = kinds.filter((k) => k !== 'food' && k !== 'events_nightlife').length;
    expect(doing).toBeGreaterThanOrEqual(3);
  });
  it('no bars before the evening', () => {
    for (const s of plan.stops.filter((x) => x.category === 'bar')) expect(hour(s.arrive)).toBeGreaterThanOrEqual(17);
  });
  it('at most one coffee break outside meals, never two food stops in a row', () => {
    const cafes = plan.stops.filter((s) => s.category === 'cafe' && !s.notes.includes('meal'));
    expect(cafes.length).toBeLessThanOrEqual(1);
    for (let i = 1; i < plan.stops.length; i++) {
      const a = plan.stops[i - 1]!; const b = plan.stops[i]!;
      if (!a.notes.includes('meal') && !b.notes.includes('meal')) expect(bucketOf(a.category) === 'food' && bucketOf(b.category) === 'food').toBe(false);
    }
  });
  it('a nightlife trip may include a bar earlier', () => {
    const p = planDay({ ...req, nightlifeAnyTime: true, boost: { bar: 0.4 } });
    expect(p.stops.some((s) => s.category === 'bar')).toBe(true);
  });
});

describe('duplicates in the data', () => {
  it('two map objects with the same name are never both in one day', () => {
    const park = (id: string, i: number) => ({ id, type: 'place' as const, title: 'Gauguin Park', category: 'park', location: away(1 + i * 0.2, i), score: 0.9 });
    const p = planDay({ ...req, candidates: [...cands, park('gp1', 1), park('gp2', 2)] });
    expect(p.stops.filter((s) => s.title === 'Gauguin Park').length).toBeLessThanOrEqual(1);
  });
});
