import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import type { EventDTO, FeedResponse, PlaceDTO, SearchResponse } from '@passtra/core';
import { buildApp } from '../src/app';
import { runSource } from '../src/engine/pipeline';
import { HttpClient } from '../src/lib/http';
import { ADMIN_ID, addSource, engineDeps, fakeFetch, fixture, freshDb, source, token } from './helpers';

const NOW = new Date('2026-11-08T12:00:00Z'); // Sunday 14:00 Cyprus
const USER = '11111111-1111-4111-8111-111111111111';
let app: FastifyInstance;
let pool: pg.Pool;
let userToken: string;
let adminToken: string;

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

beforeAll(async () => {
  const db = await freshDb('api');
  pool = db.pool;
  const tribe = fixture<{ events: unknown[] }>('tribe-visitcyprus-2026-11-08.json');
  const osm = fixture('osm-limassol-center-2026-11-08.json');
  const f = fakeFetch([
    [/visitcyprus\.com\/wp-json\/tribe/, () => ({ ...tribe, total_pages: 1 })],
    [/api\.openstreetmap\.org/, () => osm],
    [/api\.met\.no/, () => new Response(JSON.stringify({ properties: { meta: { updated_at: '2026-11-08T11:00:00Z' }, timeseries: [{ time: '2026-11-08T12:00:00Z', data: { instant: { details: { air_temperature: 23.4 } }, next_1_hours: { summary: { symbol_code: 'fair_day' } } } }] } }), { headers: { expires: 'Sun, 08 Nov 2026 12:30:00 GMT' } })],
  ]);
  const deps = engineDeps(pool, db.config, f, NOW);
  const osmSrc = await source(pool, 'osm_cy');
  osmSrc.config = { mode: 'osm_api_tiles', tiles: [[34.673, 33.04, 34.678, 33.047]] };
  await runSource(deps, osmSrc, 'test');
  await runSource(deps, await source(pool, 'visitcyprus_events'), 'test');
  // A second source disagreeing on a time, to exercise conflict display and moderation.
  const tix = await addSource(pool, 'test_ticketing', 'jsonld_events', 0.85, { urls: ['https://tickets.example/list'] });
  const page = `<script type="application/ld+json">${JSON.stringify({ '@type': 'MusicEvent', '@id': 'r1', name: 'Recital: Anousha Nazari (mezzo-soprano)', startDate: '2026-11-19T21:00:00+02:00', location: { name: 'The Shoe Factory', address: { addressLocality: 'Nicosia' } } })}</script>`;
  await runSource(engineDeps(pool, db.config, fakeFetch([[/tickets\.example/, () => new Response(page)]]), NOW), tix, 'test');
  const built = await buildApp(db.config, pool, { now: () => NOW, http: new HttpClient('passtra-bot/test', 0, f) });
  app = built.app;
  userToken = await token(USER);
  adminToken = await token(ADMIN_ID);
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('public API', () => {
  it('health, readiness and meta', async () => {
    expect((await app.inject('/v1/health')).json()).toEqual({ ok: true });
    expect((await app.inject('/v1/ready')).statusCode).toBe(200);
    const meta = (await app.inject('/v1/meta?locale=ru')).json();
    expect(meta.cities.find((c: { slug: string }) => c.slug === 'limassol').name).toBe('Лимассол');
    expect(meta.interests.map((i: { key: string }) => i.key)).toContain('other');
    expect(meta.attributions.map((a: { name: string }) => a.name)).toContain('OpenStreetMap contributors');
  });

  it('Today feed for a city: sections, weather, honest labels', async () => {
    const res = await app.inject('/v1/feed/today?city=limassol&locale=en');
    expect(res.statusCode).toBe(200);
    const feed = res.json<FeedResponse>();
    expect(feed.timezone).toBe('Europe/Nicosia');
    expect(feed.weather).toMatchObject({ temperatureC: 23, summary: 'Mostly clear' });
    const keys = feed.sections.map((s) => s.key);
    expect(keys).toEqual(expect.arrayContaining(['happening_today', 'right_now', 'tonight']));
    const today = feed.sections.find((s) => s.key === 'happening_today')!.items as EventDTO[];
    const regatta = today.find((e) => e.title.startsWith('Regatta'))!;
    expect(regatta.time.precision).toBe('date_only');
    expect(regatta.time.label).not.toMatch(/00:00/);
    expect(regatta.price.label).toBe('Free');
    // No fake popularity before real users exist.
    expect(keys).not.toContain('popular');
  });

  it('Today feed with GPS location uses distance and Near You', async () => {
    const feed = (await app.inject('/v1/feed/today?lat=34.6755&lng=33.0435&radius=3&locale=el')).json<FeedResponse>();
    expect(feed.context.usedLocation).toBe(true);
    expect(feed.context.city?.slug).toBe('limassol');
    const near = feed.sections.find((s) => s.key === 'near_you');
    expect(near?.items.length).toBeGreaterThan(0);
    expect(near!.items.every((i) => (i.distanceKm ?? 99) <= 3)).toBe(true);
    expect(near!.title).toBe('Κοντά σας');
  });

  it('events list never contains past events', async () => {
    const items = (await app.inject('/v1/events?limit=100')).json<{ items: EventDTO[] }>().items;
    expect(items.length).toBeGreaterThan(5);
    for (const e of items) {
      const end = e.time.precision === 'date_only' ? new Date(`${e.time.localEndDate ?? e.time.localStartDate}T23:59:59+02:00`) : new Date(e.time.endsAt ?? new Date(new Date(e.time.startsAt).getTime() + 3 * 3600_000));
      expect(end.getTime()).toBeGreaterThan(NOW.getTime());
    }
  });

  it('event detail exposes sources, last check time and open conflicts', async () => {
    const id = (await pool.query(`SELECT id FROM events WHERE title ILIKE 'Recital:%'`)).rows[0].id;
    const { event } = (await app.inject(`/v1/events/${id}?locale=ru`)).json<{ event: EventDTO }>();
    expect(event.verification.status).toBe('conflicting');
    expect(event.time.unconfirmed).toBe(true);
    expect(event.verification.sources.map((s) => s.key).sort()).toEqual(['test_ticketing', 'visitcyprus_events']);
    expect(event.verification.conflicts[0]!.candidates.flatMap((c) => c.sources)).toContain('Visit Cyprus — Deputy Ministry of Tourism');
    expect(event.verification.lastVerifiedAt).toBeTruthy();
    const c = event.verification.conflicts.find((x) => x.field === 'starts_at')!;
    expect(c.candidates).toHaveLength(2);
  });

  it('place detail with hours evaluated in Cyprus time and navigation links', async () => {
    const id = (await pool.query(`SELECT id FROM places WHERE name = 'Sunday Market'`)).rows[0].id;
    const r = (await app.inject(`/v1/places/${id}?locale=en`)).json<{ place: PlaceDTO; navigation: { google: string; apple: string } }>();
    expect(r.place.hours.openNow).toBe(true); // Sunday 14:00 local, "Su 08:00-15:00"
    expect(r.place.hours.label).toBe('Open · closes 15:00');
    expect(r.navigation.google).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/);
    expect(r.place.verification.sources[0]!.attribution).toContain('OpenStreetMap');
  });

  it('unknown ids → 404, bad input → 400', async () => {
    expect((await app.inject('/v1/events/00000000-0000-4000-8000-000000000000')).statusCode).toBe(404);
    expect((await app.inject('/v1/events/not-a-uuid')).statusCode).toBe(400);
    expect((await app.inject('/v1/places?lat=999&lng=1')).statusCode).toBe(400);
  });

  it('smart search (deterministic engine without an AI key): Russian query → real results only', async () => {
    const r = (await app.inject({ method: 'POST', url: '/v1/search', payload: { q: 'Какие концерты будут в Лимассоле?', locale: 'ru' } })).json<SearchResponse>();
    expect(r.interpretation.engine).toBe('rules');
    expect(r.interpretation.city).toBe('limassol');
    expect(r.interpretation.summary).toContain('Лимассол');
    expect(r.results.length).toBeGreaterThan(0);
    expect(r.results.every((e) => e.type === 'event')).toBe(true);
  });

  it('search "open now" pharmacy near me returns only places open now', async () => {
    const r = (await app.inject({ method: 'POST', url: '/v1/search', payload: { q: 'pharmacy open now near me', lat: 34.6755, lng: 33.0435 } })).json<SearchResponse>();
    expect(r.interpretation.categories).toEqual(['pharmacy']);
    for (const p of r.results as PlaceDTO[]) expect(p.hours.openNow).toBe(true);
  });

  it('map markers in a bbox; huge bbox refused', async () => {
    const r = (await app.inject('/v1/map?bbox=33.03,34.66,33.06,34.69')).json<{ markers: Array<{ type: string }> }>();
    expect(r.markers.some((m) => m.type === 'place')).toBe(true);
    expect((await app.inject('/v1/map?bbox=30,30,40,40')).statusCode).toBe(400);
  });

  it('recommendations explain themselves with real reasons', async () => {
    const r = (await app.inject('/v1/recommendations?lat=34.6755&lng=33.0435&radius=10&interests=nightlife,food&locale=en')).json<{ items: Array<{ reason: string }> }>();
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items[0]!.reason.length).toBeGreaterThan(0);
  });

  it('plan my day: ordered, non-overlapping stops with honest notes', async () => {
    const r = (await app.inject({ method: 'POST', url: '/v1/plan-day', payload: { lat: 34.6755, lng: 33.0435, date: '2026-11-09', start: '09:00', end: '21:00', interests: ['food', 'culture'] } })).json<{ stops: Array<{ arrive: string; depart: string; notes: string[] }>; disclaimer: string }>();
    expect(r.stops.length).toBeGreaterThan(1);
    for (let i = 1; i < r.stops.length; i++) expect(Date.parse(r.stops[i]!.arrive)).toBeGreaterThanOrEqual(Date.parse(r.stops[i - 1]!.depart));
    expect(r.disclaimer).toMatch(/estimates/);
  });

  it('anonymous report is accepted', async () => {
    const id = (await pool.query(`SELECT id FROM events LIMIT 1`)).rows[0].id;
    const r = await app.inject({ method: 'POST', url: '/v1/reports', payload: { entityType: 'event', entityId: id, kind: 'cancelled', message: 'Organiser posted that it is cancelled' } });
    expect(r.statusCode).toBe(200);
  });
});

describe('accounts, privacy and GDPR', () => {
  it('requires auth and rejects forged tokens', async () => {
    expect((await app.inject('/v1/me')).statusCode).toBe(401);
    const forged = await token(USER, 'wrong-secret-wrong-secret-wrong-secret');
    expect((await app.inject({ url: '/v1/me', headers: auth(forged) })).statusCode).toBe(401);
  });

  it('profile, interests, saved items, interactions', async () => {
    const me = (await app.inject({ url: '/v1/me', headers: auth(userToken) })).json();
    expect(me.id).toBe(USER);
    const patched = (await app.inject({ method: 'PATCH', url: '/v1/me', headers: auth(userToken), payload: { interests: ['music', 'other'], locale: 'ru', homeCity: 'limassol', notificationPrefs: { enabled: true } } })).json();
    expect(patched.interests).toEqual(['music', 'wellness', 'practical']);
    expect(patched.notificationPrefs.enabled).toBe(true);
    expect(patched.notificationPrefs.maxPerDay).toBe(1); // defaults preserved

    const placeId = (await pool.query(`SELECT id FROM places WHERE name = 'Sunday Market'`)).rows[0].id;
    expect((await app.inject({ method: 'PUT', url: `/v1/me/saved/place/${placeId}`, headers: auth(userToken) })).statusCode).toBe(200);
    const saved = (await app.inject({ url: '/v1/me/saved', headers: auth(userToken) })).json();
    expect(saved.items[0].entity.id).toBe(placeId);
    const inter = (await app.inject({ method: 'POST', url: '/v1/me/interactions', headers: auth(userToken), payload: { items: [{ entityType: 'place', entityId: placeId, kind: 'open' }] } })).json();
    expect(inter.stored).toBe(1);
  });

  it('turning personalisation off deletes interaction history', async () => {
    await app.inject({ method: 'PATCH', url: '/v1/me', headers: auth(userToken), payload: { personalizationEnabled: false } });
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM user_interactions WHERE user_id = $1', [USER])).rows[0].n).toBe(0);
  });

  it('export contains the data and states that no location history is kept', async () => {
    const ex = (await app.inject({ url: '/v1/me/export', headers: auth(userToken) })).json();
    expect(ex.savedItems).toHaveLength(1);
    expect(ex.note).toMatch(/location history/);
  });

  it('account deletion removes all personal data', async () => {
    expect((await app.inject({ method: 'DELETE', url: '/v1/me', headers: auth(userToken) })).statusCode).toBe(204);
    for (const t of ['users', 'saved_items', 'user_interactions']) {
      const col = t === 'users' ? 'id' : 'user_id';
      expect((await pool.query(`SELECT COUNT(*)::int AS n FROM ${t} WHERE ${col} = $1`, [USER])).rows[0].n).toBe(0);
    }
  });
});

describe('admin & moderation', () => {
  it('regular users cannot access admin routes', async () => {
    const t = await token('22222222-2222-4222-8222-222222222222');
    expect((await app.inject({ url: '/v1/admin/stats', headers: auth(t) })).statusCode).toBe(403);
  });

  it('stats and sources for admins', async () => {
    const s = (await app.inject({ url: '/v1/admin/stats', headers: auth(adminToken) })).json();
    expect(s.totals.events).toBeGreaterThan(10);
    expect(s.totals.openConflicts).toBeGreaterThan(0);
    const src = (await app.inject({ url: '/v1/admin/sources', headers: auth(adminToken) })).json();
    const tm = src.items.find((x: { key: string }) => x.key === 'ticketmaster_cy');
    expect(tm.keyConfigured).toBe(false);
  });

  it('resolving a conflict locks the chosen value and clears the warning', async () => {
    const list = (await app.inject({ url: '/v1/admin/conflicts', headers: auth(adminToken) })).json();
    const c = list.items.find((x: { field: string; entity_title: string }) => x.field === 'starts_at' && x.entity_title.startsWith('Recital'));
    const idx = c.candidates.findIndex((x: { sources: string[] }) => x.sources.includes('visitcyprus_events'));
    expect((await app.inject({ method: 'POST', url: `/v1/admin/conflicts/${c.id}/resolve`, headers: auth(adminToken), payload: { candidateIndex: idx, note: 'Checked with venue' } })).statusCode).toBe(200);
    const { event } = (await app.inject(`/v1/events/${c.entity_id}`)).json<{ event: EventDTO }>();
    expect(event.time.unconfirmed).toBe(false);
    expect(event.verification.status).not.toBe('conflicting');
    expect(event.time.startsAt).toBe('2026-11-19T20:30:00.000+02:00');
    const audit = (await app.inject({ url: '/v1/admin/audit', headers: auth(adminToken) })).json();
    expect(audit.items[0].action).toBe('conflict.resolve');
  });

  it('organiser submission → moderator approval → published, organiser-confirmed event', async () => {
    const org = await token('33333333-3333-4333-8333-333333333333');
    const sub = (await app.inject({ method: 'POST', url: '/v1/submissions/events', headers: auth(org), payload: {
      title: 'Jazz on the Old Port', category: 'jazz-blues', venueName: 'Limassol Old Port', city: 'limassol', lat: 34.6713, lng: 33.0423,
      startDate: '2026-11-14', startTime: '19:00', endTime: '22:00', isFree: true, organizer: 'Old Port Events', contact: 'events@example.org',
    } })).json();
    expect(sub.status).toBe('pending_review');
    expect((await app.inject('/v1/events?q=Jazz%20on%20the%20Old%20Port')).json().items).toHaveLength(0); // not public before approval
    const ok = (await app.inject({ method: 'POST', url: `/v1/admin/submissions/${sub.id}/approve`, headers: auth(adminToken) })).json();
    const { event } = (await app.inject(`/v1/events/${ok.eventId}`)).json<{ event: EventDTO }>();
    expect(event.title).toBe('Jazz on the Old Port');
    expect(event.time.startsAt).toBe('2026-11-14T19:00:00.000+02:00');
    expect(event.verification.status).toBe('confirmed');
    expect(event.price.isFree).toBe(true);
  });

  it('accepting a cancellation report with apply=true cancels the event', async () => {
    const reports = (await app.inject({ url: '/v1/admin/reports', headers: auth(adminToken) })).json();
    const r = reports.items[0];
    await app.inject({ method: 'POST', url: `/v1/admin/reports/${r.id}/resolve`, headers: auth(adminToken), payload: { action: 'accept', apply: true } });
    const { event } = (await app.inject(`/v1/events/${r.entity_id}`)).json<{ event: EventDTO }>();
    expect(event.status).toBe('cancelled');
    const listed = (await app.inject('/v1/events?limit=100')).json<{ items: EventDTO[] }>().items.map((e) => e.id);
    expect(listed).not.toContain(r.entity_id);
  });
});
