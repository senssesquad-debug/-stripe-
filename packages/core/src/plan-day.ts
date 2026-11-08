import { getCategory } from './categories';
import { estimateTravelMinutes, haversineKm, suggestMode, type LatLng, type TravelMode } from './geo';
import { DateTime } from 'luxon';
import { normalizeZone } from './time';

export interface Interval {
  start: Date;
  end: Date;
}

export interface PlanCandidate {
  id: string;
  type: 'event' | 'place';
  title: string;
  category: string;
  location: LatLng;
  score: number; // relevance from the ranking engine
  /** Events: fixed time. */
  startsAt?: Date;
  endsAt?: Date | null;
  /** Places: opening intervals for the planned day. Undefined = hours unknown. */
  openIntervals?: Interval[];
  /** Known minimum price per person (EUR); null = unknown; 0 = free. */
  price?: number | null;
  durationMin?: number;
}

export interface PlanRequest {
  start: Date;
  end: Date;
  tz: string;
  origin: LatLng;
  budget?: number | null; // per person, EUR
  mode?: TravelMode | 'auto';
  candidates: PlanCandidate[];
  maxStops?: number;
}

export type StopNote = 'meal' | 'hours_unknown' | 'price_unknown' | 'fixed_time';

export interface PlanStop {
  candidateId: string;
  title: string;
  category: string;
  arrive: Date;
  depart: Date;
  travelMinFromPrev: number;
  travelMode: TravelMode;
  travelIsEstimate: true;
  price: number | null;
  notes: StopNote[];
}

export interface DayPlan {
  stops: PlanStop[];
  totalKnownCost: number;
  stopsWithUnknownPrice: number;
  totalTravelMin: number;
  freeMinutes: number;
}

const MEAL_CATEGORIES = new Set(['restaurant', 'cafe', 'bakery', 'fast-food']);
/**
 * Places without listed hours are planned only inside conservative daytime slots and always carry the
 * "hours not listed" note: outdoor spots in daylight, sights (museums, churches, ruins) in core visiting hours.
 * Nothing else is planned without hours.
 */
const OUTDOOR_HOURS_OK = new Set(['beach', 'viewpoint', 'park', 'hiking', 'marina', 'playground']);
const SIGHTS_HOURS_UNKNOWN_OK = new Set(['museum', 'historic-site', 'religious-site', 'art-gallery']);
const UNKNOWN_HOURS_SLOT: Record<'outdoor' | 'sight', [number, number]> = { outdoor: [8 * 60, 19 * 60], sight: [10 * 60, 16 * 60 + 30] };
/** Only nightlife is planned late; everything else stays between 07:00 and 23:00. */
const NIGHT_GROUPS = new Set(['nightlife']);
const DAY_LIMITS: [number, number] = [7 * 60, 23 * 60];
const MIN_GAP = 20;

interface Meal {
  kind: 'breakfast' | 'lunch' | 'dinner';
  from: Date;
  to: Date;
  cats: string[];
}

function mealsFor(req: PlanRequest): Meal[] {
  const zone = normalizeZone(req.tz);
  const day = DateTime.fromJSDate(req.start, { zone }).startOf('day');
  const mk = (kind: Meal['kind'], h1: number, m1: number, h2: number, m2: number, cats: string[]): Meal => ({
    kind, from: day.set({ hour: h1, minute: m1 }).toJSDate(), to: day.set({ hour: h2, minute: m2 }).toJSDate(), cats,
  });
  return [
    mk('breakfast', 8, 0, 10, 30, ['cafe', 'bakery']),
    mk('lunch', 12, 30, 14, 30, ['restaurant', 'fast-food', 'cafe']),
    mk('dinner', 19, 0, 21, 30, ['restaurant']),
  ].filter((m) => m.from < req.end && m.to > req.start && (Math.min(m.to.getTime(), req.end.getTime()) - Math.max(m.from.getTime(), req.start.getTime())) / 60_000 >= 45);
}

const addMin = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);

function travel(from: LatLng, to: LatLng, mode: PlanRequest['mode']): { min: number; mode: TravelMode } {
  const km = haversineKm(from, to);
  const m: TravelMode = !mode || mode === 'auto' ? suggestMode(km) : mode;
  return { min: estimateTravelMinutes(km, m), mode: m };
}

/** Minutes since local midnight of `d` (depart times after midnight count as 24h+). */
function localMinutes(d: Date, dayStart: DateTime, zone: string): number {
  return Math.round(DateTime.fromJSDate(d, { zone }).diff(dayStart, 'minutes').minutes);
}

function isOpenThrough(c: PlanCandidate, from: Date, to: Date): boolean | 'unknown' {
  if (!c.openIntervals) return 'unknown';
  return c.openIntervals.some((i) => i.start <= from && i.end >= to);
}

/**
 * Greedy day planner:
 *  1. lock in the best events that fit the window (fixed times),
 *  2. walk through the day filling gaps with the best reachable places,
 *     preferring food during meal windows, honouring opening hours, travel time and budget.
 * Unknown prices are never treated as free; unknown hours are only accepted for outdoor spots.
 */
export function planDay(req: PlanRequest): DayPlan {
  const maxStops = req.maxStops ?? 7;
  const budget = req.budget ?? Infinity;
  const used = new Set<string>();
  let spent = 0;

  // 1. Fixed events (at most 2, non-overlapping)
  const events = req.candidates
    .filter((c) => c.type === 'event' && c.startsAt && c.startsAt >= req.start && addMin(c.startsAt, c.durationMin ?? 120) <= addMin(req.end, 30))
    .sort((a, b) => b.score - a.score);
  const fixed: PlanCandidate[] = [];
  for (const e of events) {
    if (fixed.length >= 2) break;
    const eEnd = e.endsAt ?? addMin(e.startsAt!, e.durationMin ?? getCategory(e.category)?.visitMinutes ?? 120);
    const clash = fixed.some((f) => {
      const fEnd = f.endsAt ?? addMin(f.startsAt!, f.durationMin ?? 120);
      return e.startsAt! < addMin(fEnd, 30) && addMin(eEnd, 30) > f.startsAt!;
    });
    const price = e.price ?? 0;
    if (clash || spent + price > budget) continue;
    fixed.push({ ...e, endsAt: eEnd });
    spent += price;
    used.add(e.id);
  }
  fixed.sort((a, b) => a.startsAt!.getTime() - b.startsAt!.getTime());

  const zone = normalizeZone(req.tz);
  const dayStart = DateTime.fromJSDate(req.start, { zone }).startOf('day');
  const within = (from: Date, to: Date, [a, b]: [number, number]) => localMinutes(from, dayStart, zone) >= a && localMinutes(to, dayStart, zone) <= b;

  const meals = mealsFor(req);
  const mealsDone = new Set<Meal['kind']>();
  const stops: PlanStop[] = [];
  let t = req.start;
  let pos = req.origin;
  let lastCat = '';
  let totalTravel = 0;

  const pushFixed = (f: PlanCandidate) => {
    const tr = travel(pos, f.location, req.mode);
    stops.push({
      candidateId: f.id, title: f.title, category: f.category, arrive: f.startsAt!, depart: f.endsAt!,
      travelMinFromPrev: tr.min, travelMode: tr.mode, travelIsEstimate: true, price: f.price ?? null,
      notes: ['fixed_time', ...(f.price === null || f.price === undefined ? (['price_unknown'] as StopNote[]) : [])],
    });
    totalTravel += tr.min;
    t = f.endsAt!;
    pos = f.location;
    lastCat = f.category;
    if (MEAL_CATEGORIES.has(f.category)) {
      const m = meals.find((x) => f.startsAt! >= x.from && f.startsAt! <= x.to);
      if (m) mealsDone.add(m.kind);
    }
  };

  let fixedIdx = 0;
  while (stops.length < maxStops) {
    const nextFixed = fixed[fixedIdx];
    const horizon = nextFixed ? nextFixed.startsAt! : req.end;
    const activeMeal = meals.find((m) => !mealsDone.has(m.kind) && t < m.to && addMin(t, 60) > m.from);

    let best: { c: PlanCandidate; arrive: Date; depart: Date; tr: { min: number; mode: TravelMode }; value: number; notes: StopNote[] } | null = null;
    for (const c of req.candidates) {
      if (c.type !== 'place' || used.has(c.id)) continue;
      if (activeMeal && !activeMeal.cats.includes(c.category)) continue;
      if (!activeMeal && MEAL_CATEGORIES.has(c.category) && c.category !== 'cafe') continue; // restaurants only at meal times
      if (c.category === lastCat) continue;
      const tr = travel(pos, c.location, req.mode);
      let arrive = addMin(t, tr.min);
      if (activeMeal && arrive < activeMeal.from) arrive = activeMeal.from;
      const dur = c.durationMin ?? getCategory(c.category)?.visitMinutes ?? 60;
      const depart = addMin(arrive, dur);
      const backToFixed = nextFixed ? travel(c.location, nextFixed.location, req.mode).min : 0;
      if (addMin(depart, backToFixed) > horizon) continue;
      if (!NIGHT_GROUPS.has(getCategory(c.category)?.group ?? '') && !within(arrive, depart, DAY_LIMITS)) continue;
      const open = isOpenThrough(c, arrive, depart);
      const notes: StopNote[] = [];
      let penalty = 0;
      if (open === false) continue;
      if (open === 'unknown') {
        const slot = OUTDOOR_HOURS_OK.has(c.category) ? UNKNOWN_HOURS_SLOT.outdoor : SIGHTS_HOURS_UNKNOWN_OK.has(c.category) ? UNKNOWN_HOURS_SLOT.sight : null;
        if (!slot || !within(arrive, depart, slot)) continue;
        notes.push('hours_unknown');
        penalty = 0.15; // prefer places with confirmed hours
      }
      if (c.price === null || c.price === undefined) notes.push('price_unknown');
      else if (spent + c.price > budget) continue;
      if (activeMeal) notes.push('meal');
      const value = c.score - tr.min / 120 - penalty;
      if (!best || value > best.value) best = { c, arrive, depart, tr, value, notes };
    }

    if (best) {
      stops.push({
        candidateId: best.c.id, title: best.c.title, category: best.c.category, arrive: best.arrive, depart: best.depart,
        travelMinFromPrev: best.tr.min, travelMode: best.tr.mode, travelIsEstimate: true, price: best.c.price ?? null, notes: best.notes,
      });
      used.add(best.c.id);
      spent += best.c.price ?? 0;
      totalTravel += best.tr.min;
      t = best.depart;
      pos = best.c.location;
      lastCat = best.c.category;
      if (activeMeal) mealsDone.add(activeMeal.kind);
      continue;
    }
    if (activeMeal) {
      mealsDone.add(activeMeal.kind); // nothing suitable for this meal; move on
      continue;
    }
    if (nextFixed) {
      pushFixed(nextFixed);
      fixedIdx++;
      continue;
    }
    // Nothing fits right now: jump forward to the next meal if any, otherwise stop.
    const nextMeal = meals.find((m) => !mealsDone.has(m.kind) && m.from > t);
    if (nextMeal && (Math.abs(nextMeal.from.getTime() - t.getTime()) / 60_000) >= MIN_GAP) {
      t = nextMeal.from;
      continue;
    }
    break;
  }
  while (fixedIdx < fixed.length && stops.length < maxStops + 2) pushFixed(fixed[fixedIdx++]!);

  stops.sort((a, b) => a.arrive.getTime() - b.arrive.getTime());
  const busy = stops.reduce((s, x) => s + (x.depart.getTime() - x.arrive.getTime()) / 60_000 + x.travelMinFromPrev, 0);
  return {
    stops,
    totalKnownCost: Math.round(stops.reduce((s, x) => s + (x.price ?? 0), 0) * 100) / 100,
    stopsWithUnknownPrice: stops.filter((x) => x.price === null).length,
    totalTravelMin: totalTravel,
    freeMinutes: Math.max(0, Math.round((req.end.getTime() - req.start.getTime()) / 60_000 - busy)),
  };
}
