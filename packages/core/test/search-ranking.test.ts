import { describe, expect, it } from 'vitest';
import { CATEGORIES, categoriesForGoogleTypes, categoriesForOsmTags, INTEREST_GROUPS } from '../src/categories';
import { LOCALES } from '../src/locales';
import { CITIES } from '../src/regions';
import { mergeFilters, parseQuery, SearchFiltersSchema } from '../src/query-parser';
import { buildAffinity, explain, isEligible, rank, scoreCandidate, surprise, type Candidate, type UserProfile } from '../src/ranking';
import { planDay, type PlanCandidate } from '../src/plan-day';

describe('taxonomy integrity', () => {
  it('unique slugs, labels in every locale, valid groups', () => {
    const slugs = CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const c of CATEGORIES) {
      for (const l of LOCALES) expect(c.label[l], `${c.slug}.${l}`).toBeTruthy();
      expect(INTEREST_GROUPS).toContain(c.group);
    }
    expect(CATEGORIES.length).toBeGreaterThan(70);
  });
  it('maps OSM tags', () => {
    expect(categoriesForOsmTags({ amenity: 'pharmacy' })[0]?.slug).toBe('pharmacy');
    expect(categoriesForOsmTags({ amenity: 'bank', atm: 'yes' }).map((c) => c.slug)).toEqual(['atm', 'bank']);
    expect(categoriesForOsmTags({ natural: 'beach' })).toEqual([]); // unnamed beaches are skipped
    expect(categoriesForOsmTags({ natural: 'beach', name: 'Lady’s Mile' })[0]?.slug).toBe('beach');
    expect(categoriesForOsmTags({ amenity: 'place_of_worship', name: 'X' })).toEqual([]); // only notable ones
    expect(categoriesForOsmTags({ amenity: 'place_of_worship', name: 'Kykkos', wikidata: 'Q1' })[0]?.slug).toBe('religious-site');
  });
  it('maps Google types', () => {
    expect(categoriesForGoogleTypes(['night_club', 'bar']).map((c) => c.slug).sort()).toEqual(['bar', 'nightclub']);
  });
  it('city data is sane', () => {
    for (const c of CITIES) {
      expect(c.lat).toBeGreaterThan(34.5);
      expect(c.lat).toBeLessThan(35.75);
      expect(c.lng).toBeGreaterThan(32.2);
      expect(c.lng).toBeLessThan(34.65);
    }
  });
});

describe('parseQuery — the example queries from the product brief', () => {
  it('Где сегодня вечером играет живая музыка?', () => {
    const f = parseQuery('Где сегодня вечером играет живая музыка?');
    expect(f.time).toBe('tonight');
    expect(f.categories).toContain('concert');
  });
  it('Найди лучшие рестораны рядом со мной.', () => {
    const f = parseQuery('Найди лучшие рестораны рядом со мной.');
    expect(f.categories).toEqual(['restaurant']);
    expect(f.nearMe).toBe(true);
    expect(f.sort).toBe('rating');
  });
  it('Что можно поделать с детьми сегодня?', () => {
    const f = parseQuery('Что можно поделать с детьми сегодня?');
    expect(f.groups).toContain('family');
    expect(f.time).toBe('today');
  });
  it('Какие концерты будут в Лимассоле на выходных?', () => {
    const f = parseQuery('Какие концерты будут в Лимассоле на выходных?');
    expect(f.categories).toContain('concert');
    expect(f.city).toBe('limassol');
    expect(f.time).toBe('weekend');
  });
  it('Где сегодня проходят вечеринки?', () => {
    const f = parseQuery('Где сегодня проходят вечеринки?');
    expect(f.categories).toContain('party');
    expect(f.time).toBe('today');
  });
  it('Найди бесплатные мероприятия.', () => {
    const f = parseQuery('Найди бесплатные мероприятия.');
    expect(f.freeOnly).toBe(true);
    expect(f.entityTypes).toEqual(['event']);
  });
  it('Какие магазины сейчас открыты?', () => {
    const f = parseQuery('Какие магазины сейчас открыты?');
    expect(f.groups).toContain('shopping');
    expect(f.openNow).toBe(true);
    expect(f.time).toBe('now');
  });
  it('Где можно покататься на картинге?', () => {
    expect(parseQuery('Где можно покататься на картинге?').categories).toEqual(['karting']);
  });
  it('Что интересного происходит в радиусе 10 километров?', () => {
    const f = parseQuery('Что интересного происходит в радиусе 10 километров?');
    expect(f.radiusKm).toBe(10);
    expect(f.nearMe).toBe(true);
  });
});

describe('parseQuery — English & Greek', () => {
  it('live music tonight in Paphos', () => {
    const f = parseQuery('live music tonight in Paphos');
    expect(f).toMatchObject({ time: 'tonight', city: 'paphos' });
    expect(f.categories).toContain('concert');
  });
  it('free things to do this weekend near me', () => {
    expect(parseQuery('free things to do this weekend near me')).toMatchObject({ freeOnly: true, time: 'weekend', nearMe: true, sort: 'distance' });
  });
  it('barbershop is not a bar', () => {
    expect(parseQuery('barbershop open now').categories).toEqual(['barbershop']);
    expect(parseQuery('барбершоп').categories).toEqual(['barbershop']);
  });
  it('pharmacy in Λεμεσό (Greek accusative)', () => {
    expect(parseQuery('φαρμακείο στη Λεμεσό')).toMatchObject({ categories: ['pharmacy'], city: 'limassol' });
  });
  it('Greek: συναυλίες απόψε στη Λευκωσία', () => {
    expect(parseQuery('συναυλίες απόψε στη Λευκωσία')).toMatchObject({ categories: ['concert'], time: 'tonight', city: 'nicosia' });
  });
  it('keeps unknown words as keywords (e.g. an artist)', () => {
    expect(parseQuery('Monsieur Doumani concert').keywords).toEqual(['monsieur', 'doumani']);
  });
  it('walking distance', () => {
    expect(parseQuery('cafe 15 min walk').radiusKm).toBeCloseTo(1.1, 1);
  });
  it('output always validates against the schema', () => {
    for (const q of ['', '???', 'x'.repeat(500), 'ресторан ресторан ресторан']) expect(() => SearchFiltersSchema.parse(parseQuery(q))).not.toThrow();
  });
  it('rules override AI on hard signals', () => {
    const ai = SearchFiltersSchema.parse({ categories: ['bar'], time: 'today', city: 'larnaca' });
    const rules = parseQuery('pubs in Limassol tonight');
    const m = mergeFilters(ai, rules);
    expect(m.city).toBe('limassol');
    expect(m.time).toBe('tonight');
    expect(m.categories).toEqual(expect.arrayContaining(['pub', 'bar']));
  });
});

describe('ranking & explanations', () => {
  const now = new Date('2026-11-08T15:00:00Z'); // 17:00 local
  const ctx = { now, tz: 'Europe/Nicosia', radiusKm: 10 };
  const profile: UserProfile = { interests: ['music'], affinity: {} };
  const concert: Candidate = { id: 'e1', type: 'event', categories: ['rock-metal'], distanceKm: 4, startsAt: new Date('2026-11-08T18:00:00Z'), timePrecision: 'exact', verificationStatus: 'confirmed' };
  const pharmacy: Candidate = { id: 'p1', type: 'place', categories: ['pharmacy'], distanceKm: 0.5, openNow: true, verificationStatus: 'likely' };

  it('a nearby concert tonight ranks above a pharmacy for a music fan', () => {
    const [first] = rank([pharmacy, concert], profile, ctx);
    expect(first!.item.id).toBe('e1');
  });
  it('explains with real reasons only', () => {
    const s = scoreCandidate(concert, profile, ctx);
    const text = explain(s.reasons, 'ru', (g) => (g === 'music' ? 'музыкой' : g));
    expect(text).toContain('музыкой');
    expect(text).toContain('4 км');
  });
  it('age-gated and conflicting items are never recommended', () => {
    expect(isEligible({ id: 'n', type: 'place', categories: ['nightclub'] }, { interests: [], affinity: {}, ageRange: 'under_18' })).toBe(false);
    expect(isEligible({ ...concert, verificationStatus: 'conflicting' }, profile)).toBe(false);
    expect(isEligible(concert, { ...profile, dismissed: new Set(['e1']) })).toBe(false);
  });
  it('learns affinity from interactions with decay', () => {
    const aff = buildAffinity([
      { kind: 'save', categories: ['museum'], at: now },
      { kind: 'hide', categories: ['nightclub'], at: now },
      { kind: 'save', categories: ['beach'], at: new Date(now.getTime() - 60 * 86_400_000) },
    ], now);
    expect(aff.museum).toBeGreaterThan(0.3);
    expect(aff.nightclub).toBeLessThan(-0.4);
    expect(aff.beach!).toBeLessThan(aff.museum!);
  });
  it('diversifies the feed', () => {
    const bars: Candidate[] = Array.from({ length: 6 }, (_, i) => ({ id: `b${i}`, type: 'place', categories: ['bar'], distanceKm: 1 + i * 0.1, openNow: true }));
    const museum: Candidate = { id: 'm', type: 'place', categories: ['museum'], distanceKm: 3, openNow: true };
    const top4 = rank([...bars, museum], { interests: ['nightlife'], affinity: {} }, ctx, 4).map((s) => s.item.id);
    expect(top4).toContain('m');
  });
  it('surprise is deterministic with a seeded random and varied', () => {
    const items: Candidate[] = [concert, pharmacy, { id: 'm', type: 'place', categories: ['museum'], distanceKm: 2 }, { id: 'b', type: 'place', categories: ['beach'], distanceKm: 3 }, { id: 'r', type: 'place', categories: ['restaurant'], distanceKm: 1 }];
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const picks = surprise(items, profile, ctx, 3, rnd);
    expect(picks).toHaveLength(3);
    expect(new Set(picks.map((p) => p.item.id)).size).toBe(3);
  });
});

describe('planDay', () => {
  const tz = 'Europe/Nicosia';
  const day = (hhmm: string) => new Date(`2026-11-14T${hhmm}:00+02:00`);
  const origin = { lat: 34.6786, lng: 33.0413 };
  const open = (from: string, to: string) => [{ start: day(from), end: day(to) }];
  const cands: PlanCandidate[] = [
    { id: 'cafe', type: 'place', title: 'Café', category: 'cafe', location: { lat: 34.679, lng: 33.042 }, score: 0.5, openIntervals: open('07:00', '20:00'), price: null },
    { id: 'museum', type: 'place', title: 'Museum', category: 'museum', location: { lat: 34.674, lng: 33.044 }, score: 0.7, openIntervals: open('09:00', '17:00'), price: 4 },
    { id: 'museum-closed', type: 'place', title: 'Closed museum', category: 'art-gallery', location: { lat: 34.675, lng: 33.045 }, score: 0.95, openIntervals: [], price: 0 },
    { id: 'lunch', type: 'place', title: 'Taverna', category: 'restaurant', location: { lat: 34.676, lng: 33.046 }, score: 0.6, openIntervals: open('12:00', '23:00'), price: null },
    { id: 'beach', type: 'place', title: 'Beach', category: 'beach', location: { lat: 34.67, lng: 33.06 }, score: 0.4, price: 0 },
    { id: 'shop', type: 'place', title: 'Mystery shop', category: 'clothing-store', location: { lat: 34.677, lng: 33.043 }, score: 0.9, price: 0 },
    { id: 'concert', type: 'event', title: 'Concert', category: 'concert', location: { lat: 34.6756, lng: 33.0436 }, score: 0.8, startsAt: day('20:30'), endsAt: day('22:00'), price: 25 },
    { id: 'dinner', type: 'place', title: 'Dinner', category: 'restaurant', location: { lat: 34.6758, lng: 33.044 }, score: 0.55, openIntervals: open('18:00', '23:30'), price: 30 },
  ];

  it('builds a breakfast → museum → lunch … → concert day, respecting hours and budget', () => {
    const plan = planDay({ start: day('08:30'), end: day('23:00'), tz, origin, candidates: cands, budget: 80 });
    const ids = plan.stops.map((s) => s.candidateId);
    expect(ids[0]).toBe('cafe');
    expect(ids).toContain('museum');
    expect(ids).toContain('lunch');
    expect(ids.at(-1)).toBe('concert');
    expect(ids).not.toContain('museum-closed'); // closed all day
    expect(ids).not.toContain('shop'); // hours unknown and not an outdoor spot
    for (let i = 1; i < plan.stops.length; i++) expect(plan.stops[i]!.arrive.getTime()).toBeGreaterThanOrEqual(plan.stops[i - 1]!.depart.getTime());
    expect(plan.totalKnownCost).toBeLessThanOrEqual(80);
    expect(plan.stopsWithUnknownPrice).toBeGreaterThan(0); // unknown prices are not counted as free
    const lunch = plan.stops.find((s) => s.candidateId === 'lunch')!;
    expect(lunch.notes).toContain('meal');
  });
  it('never plans daytime places at night, even when they are open 24/7', () => {
    const night: PlanCandidate[] = [
      { id: 'park247', type: 'place', title: 'Park', category: 'park', location: { lat: 34.676, lng: 33.046 }, score: 0.9, openIntervals: [{ start: day('00:00'), end: new Date(day('00:00').getTime() + 48 * 3600_000) }], price: 0 },
      { id: 'bar', type: 'place', title: 'Bar', category: 'bar', location: { lat: 34.677, lng: 33.045 }, score: 0.5, openIntervals: [{ start: day('18:00'), end: new Date(day('00:00').getTime() + 26 * 3600_000) }], price: null },
    ];
    const plan = planDay({ start: day('22:30'), end: new Date(day('00:00').getTime() + 26 * 3600_000), tz, origin, candidates: night });
    expect(plan.stops.map((s) => s.candidateId)).toEqual(['bar']);
  });
  it('plans sights without listed hours only in core visiting hours, flagged as unknown', () => {
    const sights: PlanCandidate[] = [
      { id: 'church', type: 'place', title: 'Church', category: 'religious-site', location: { lat: 34.676, lng: 33.046 }, score: 0.8, price: null },
      { id: 'ruins', type: 'place', title: 'Ruins', category: 'historic-site', location: { lat: 34.674, lng: 33.044 }, score: 0.7, price: null },
    ];
    const morning = planDay({ start: day('10:00'), end: day('16:00'), tz, origin, candidates: sights });
    expect(morning.stops.length).toBe(2);
    for (const st of morning.stops) expect(st.notes).toContain('hours_unknown');
    const evening = planDay({ start: day('18:00'), end: day('22:00'), tz, origin, candidates: sights });
    expect(evening.stops).toHaveLength(0);
  });
  it('drops paid items over budget', () => {
    const plan = planDay({ start: day('18:00'), end: day('23:00'), tz, origin, candidates: cands, budget: 20 });
    expect(plan.stops.map((s) => s.candidateId)).not.toContain('concert');
  });
});
