import { describe, expect, it } from 'vitest';
import { computeConfidence, freshness, resolveField, valuesEqual, type FieldObservation } from '../src/confidence';
import { eventMatchScore, placeMatchScore, EVENT_AUTO_MERGE, EVENT_REVIEW, PLACE_AUTO_MERGE } from '../src/dedup';

const now = new Date('2026-11-08T12:00:00Z');
const h = (hours: number) => new Date(now.getTime() + hours * 3_600_000);

describe('freshness', () => {
  it('decays faster for imminent events', () => {
    const weekOld = h(-24 * 7);
    expect(freshness(weekOld, now, h(48))).toBeLessThan(0.1);
    expect(freshness(weekOld, now, h(24 * 60))).toBeGreaterThan(0.6);
    expect(freshness(now, now, h(2))).toBe(1);
  });
});

describe('computeConfidence', () => {
  const gov = { sourceId: 1, authority: 0.9, isOfficial: false, lastSeenAt: h(-0.25) };
  it('fresh government listing with an official page → confirmed', () => {
    const r = computeConfidence({ sources: [gov], agreementCount: 1, hasOfficialPage: true, organizerConfirmed: false, openConflicts: [], startsAt: h(72), now });
    expect(r.status).toBe('confirmed');
    expect(r.score).toBeGreaterThanOrEqual(62);
  });
  it('a single user submission stays unverified', () => {
    const r = computeConfidence({ sources: [{ sourceId: 9, authority: 0.3, isOfficial: false, lastSeenAt: h(-1) }], agreementCount: 1, hasOfficialPage: false, organizerConfirmed: false, openConflicts: [], startsAt: h(72), now });
    expect(r.status).toBe('unverified');
  });
  it('any critical conflict → conflicting, regardless of score', () => {
    const r = computeConfidence({ sources: [gov, { ...gov, sourceId: 2 }], agreementCount: 2, hasOfficialPage: true, organizerConfirmed: true, openConflicts: [{ field: 'starts_at', critical: true }], startsAt: h(72), now });
    expect(r.status).toBe('conflicting');
  });
  it('stale data is not "confirmed" even from a strong source', () => {
    const r = computeConfidence({ sources: [{ ...gov, lastSeenAt: h(-24 * 10) }], agreementCount: 1, hasOfficialPage: true, organizerConfirmed: false, openConflicts: [], startsAt: h(24), now });
    expect(r.status).not.toBe('confirmed');
  });
  it('no sources → 0', () => {
    expect(computeConfidence({ sources: [], agreementCount: 0, hasOfficialPage: false, organizerConfirmed: false, openConflicts: [], now }).score).toBe(0);
  });
});

describe('resolveField — conflicting sources are never resolved randomly', () => {
  const o = (sourceId: number, authority: number, value: unknown): FieldObservation => ({ sourceId, sourceKey: `s${sourceId}`, authority, value, lastSeenAt: now });

  it('unanimous', () => {
    const r = resolveField('starts_at', [o(1, 0.9, '2026-11-19T18:30:00.000Z'), o(2, 0.75, '2026-11-19T18:30:00Z')]);
    expect(r.decision).toBe('unanimous');
    expect(r.agreeingSources).toBe(2);
  });
  it('clear authority gap → strongest source wins, recorded as "authority"', () => {
    const r = resolveField('starts_at', [o(1, 0.95, '2026-11-19T18:30:00Z'), o(2, 0.65, '2026-11-19T19:00:00Z')]);
    expect(r.decision).toBe('authority');
    expect(r.sourceId).toBe(1);
  });
  it('similar authority → conflict (caller must mark the field unconfirmed)', () => {
    const r = resolveField('starts_at', [o(2, 0.85, '2026-11-19T19:00:00Z'), o(1, 0.9, '2026-11-19T18:30:00Z')]);
    expect(r.decision).toBe('conflict');
    expect(r.candidates).toHaveLength(2);
  });
  it('is deterministic regardless of input order', () => {
    const a = resolveField('price_min', [o(1, 0.8, 10), o(2, 0.8, 12)]);
    const b = resolveField('price_min', [o(2, 0.8, 12), o(1, 0.8, 10)]);
    expect(a.value).toBe(b.value);
    expect(a.decision).toBe('conflict');
  });
  it('the majority wins among equally authoritative sources only as a tie-break, still flagged', () => {
    const r = resolveField('venue_name', [o(1, 0.8, 'Rialto Theatre'), o(2, 0.8, 'rialto theatre'), o(3, 0.8, 'Pattihio')]);
    expect(r.value).toBe('Rialto Theatre');
    expect(r.decision).toBe('conflict');
  });
  it('field-aware equality', () => {
    expect(valuesEqual('location', { lat: 34.67, lng: 33.04 }, { lat: 34.6705, lng: 33.0405 })).toBe(true);
    expect(valuesEqual('location', { lat: 34.67, lng: 33.04 }, { lat: 34.68, lng: 33.04 })).toBe(false);
    expect(valuesEqual('website', 'https://www.rialto.com.cy/', 'http://rialto.com.cy')).toBe(true);
  });
});

describe('event deduplication', () => {
  const base = {
    title: 'CYPRUS SYMPHONY ORCHESTRA – STARLIGHT 2',
    startsAt: new Date('2026-11-19T18:30:00Z'),
    timePrecision: 'exact' as const,
    localStartDate: '2026-11-19',
    location: { lat: 35.1428, lng: 33.3407 },
    venueName: 'Strovolos Municipal Theatre',
  };
  it('the same concert from two sources merges', () => {
    const r = eventMatchScore(base, { ...base, title: 'Cyprus Symphony Orchestra: Starlight 2 – Works by Mozart', location: { lat: 35.1429, lng: 33.3409 } });
    expect(r.score).toBeGreaterThanOrEqual(EVENT_AUTO_MERGE);
  });
  it('the same tour on the next day in another city does NOT merge (real visitcyprus case)', () => {
    const r = eventMatchScore(base, { ...base, startsAt: new Date('2026-11-20T18:30:00Z'), localStartDate: '2026-11-20', location: { lat: 34.6756, lng: 33.0436 }, venueName: 'Pattihio Municipal Theatre' });
    expect(r.score).toBeLessThan(EVENT_REVIEW);
  });
  it('different dates never match', () => {
    expect(eventMatchScore(base, { ...base, localStartDate: '2026-11-25' }).score).toBe(0);
  });
  it('date-only vs exact time on the same date with same venue → review or merge', () => {
    const r = eventMatchScore(base, { ...base, timePrecision: 'date_only' });
    expect(r.score).toBeGreaterThanOrEqual(EVENT_REVIEW);
  });
  it('cross-script titles', () => {
    const r = eventMatchScore(
      { ...base, title: 'Λα Τραβιάτα', venueName: 'Δημοτικό Θέατρο Λευκωσίας' },
      { ...base, title: 'La Traviata', venueName: 'Dimotiko Theatro Lefkosias' },
    );
    expect(r.score).toBeGreaterThanOrEqual(EVENT_AUTO_MERGE);
  });
});

describe('place deduplication', () => {
  const p = { name: 'Pattihio Municipal Theatre', location: { lat: 34.6756, lng: 33.0436 }, primaryCategory: 'theatre' };
  it('same OSM id → same place; different OSM ids → different', () => {
    expect(placeMatchScore({ ...p, externalIds: { osm: 'way/1' } }, { ...p, externalIds: { osm: 'way/1' } }).score).toBe(1);
    expect(placeMatchScore({ ...p, externalIds: { osm: 'way/1' } }, { ...p, externalIds: { osm: 'way/2' } }).score).toBe(0);
  });
  it('same name a few metres apart merges', () => {
    expect(placeMatchScore(p, { ...p, name: 'Pattihio Theatre', location: { lat: 34.67565, lng: 33.04365 } }).score).toBeGreaterThanOrEqual(PLACE_AUTO_MERGE);
  });
  it('different businesses in the same building stay separate', () => {
    expect(placeMatchScore({ ...p, name: 'Starbucks', primaryCategory: 'cafe' }, { ...p, name: 'Costa Coffee', primaryCategory: 'cafe' }).score).toBeLessThan(0.62);
  });
  it('far apart → no match unless same website/phone', () => {
    const far = { ...p, location: { lat: 34.7, lng: 33.1 } };
    expect(placeMatchScore(p, far).score).toBe(0);
    expect(placeMatchScore({ ...p, website: 'https://pattihio.com.cy' }, { ...far, website: 'www.pattihio.com.cy/en' }).score).toBeGreaterThan(0.5);
  });
});
