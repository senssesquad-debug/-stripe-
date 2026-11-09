import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import type { FeedResponse } from '@passtra/core';
import { bucketOf } from '@passtra/core';
import { buildApp } from '../src/app';
import { runSource } from '../src/engine/pipeline';
import { HttpClient } from '../src/lib/http';
import { engineDeps, fakeFetch, fixture, freshDb, source } from './helpers';

const NOW = new Date('2026-11-08T12:00:00Z'); // Sunday 14:00 in Cyprus, November
let app: FastifyInstance;
let pool: pg.Pool;

// Real OSM fixture (Limassol centre: mostly cafés and restaurants) plus a few test activities with known hours.
const node = (id: number, lat: number, lng: number, tags: Record<string, string>) => ({ type: 'node', id, lat, lon: lng, tags });
const EXTRA = [
  node(990101, 34.6745, 33.0430, { sport: 'karting', name: 'Test Karting', opening_hours: 'Mo-Su 10:00-22:00' }),
  node(990102, 34.6748, 33.0432, { leisure: 'escape_game', name: 'Test Escape Room', opening_hours: 'Mo-Su 18:00-23:00' }),
  node(990103, 34.6750, 33.0440, { shop: 'scuba_diving', name: 'Test Dive Centre' }),
  node(990104, 34.6752, 33.0445, { leisure: 'water_park', name: 'Test Water Park', opening_hours: 'Mo-Su 10:00-18:00' }),
  node(990105, 34.6755, 33.0450, { natural: 'beach', name: 'Test Beach' }),
  node(990106, 34.6757, 33.0455, { sport: 'padel', leisure: 'pitch', name: 'Test Padel Club', opening_hours: 'Mo-Su 08:00-23:00' }),
  node(990107, 34.6760, 33.0460, { tourism: 'attraction', name: 'Test Bay Cruise' }),
];

beforeAll(async () => {
  const db = await freshDb('acts');
  pool = db.pool;
  const osm = fixture<{ elements: unknown[] }>('osm-limassol-center-2026-11-08.json');
  const f = fakeFetch([[/api\.openstreetmap\.org/, () => ({ ...osm, elements: [...osm.elements, ...EXTRA] })], [/api\.met\.no/, () => new Response('{}', { status: 503 })]]);
  const osmSrc = await source(pool, 'osm_cy');
  osmSrc.config = { mode: 'osm_api_tiles', tiles: [[34.673, 33.04, 34.678, 33.047]] };
  await runSource(engineDeps(pool, db.config, f, NOW), osmSrc, 'test');
  app = (await buildApp(db.config, pool, { now: () => NOW, http: new HttpClient('passtra-bot/test', 0, f) })).app;
});
afterAll(async () => { await app.close(); await pool.end(); });

type Ideas = { ideas: Array<{ key: string; total: number; available: number; options: Array<{ entity: { name?: string }; availability: string }> }> };
const get = async (q: string) => (await app.inject(`/v1/activities?lat=34.675&lng=33.044&radius=5&locale=en&${q}`)).json<Ideas>();
const idea = (r: Ideas, key: string) => r.ideas.find((i) => i.key === key);

describe('What can I do?', () => {
  it('lists real things to do nearby, not places to eat', async () => {
    const r = await get('when=today');
    expect(r.ideas.length).toBeGreaterThan(3);
    expect(idea(r, 'karting')!.options[0]!.entity.name).toBe('Test Karting');
    expect(r.ideas.map((i) => i.key)).not.toContain('eat');
  });

  it('"now": open places are available, places closed all of that time are left out', async () => {
    const r = await get('when=now');
    expect(idea(r, 'karting')!.options[0]!.availability).toBe('open');
    // The test escape room opens at 18:00: not offered "now". (A real one in the data without hours stays, as unconfirmed.)
    const esc = idea(r, 'escape-room');
    expect((esc?.options ?? []).map((o) => o.entity.name)).not.toContain('Test Escape Room');
    for (const o of esc?.options ?? []) expect(o.availability).toBe('unconfirmed');
    const evening = await get('when=evening');
    expect(idea(evening, 'escape-room')!.options.find((o) => o.entity.name === 'Test Escape Room')!.availability).toBe('open');
  });

  it('places without opening hours are never shown as available', async () => {
    const r = await get('when=now');
    const dive = idea(r, 'scuba')!;
    expect(dive.options[0]!.availability).toBe('unconfirmed');
    expect(dive.available).toBe(0);
  });

  it('seasonal activities are flagged out of season in November, not offered as available', async () => {
    const r = await get('when=today');
    const wp = idea(r, 'water-park')!;
    expect(wp.options[0]!.availability).toBe('seasonal');
    expect(wp.available).toBe(0);
    const keys = r.ideas.map((i) => i.key);
    expect(keys.indexOf('water-park')).toBeGreaterThan(keys.indexOf('karting'));
  });

  it('filters: indoor, extreme, free', async () => {
    const indoor = await get('when=today&vibes=indoor');
    expect(indoor.ideas.every((i) => !['beach', 'hike'].includes(i.key))).toBe(true);
    const extreme = await get('when=today&vibes=extreme');
    expect(extreme.ideas.map((i) => i.key)).toContain('karting');
    expect(extreme.ideas.map((i) => i.key)).not.toContain('bowling');
    const free = await get('when=today&cost=free');
    expect(free.ideas.map((i) => i.key)).toContain('beach');
    expect(free.ideas.map((i) => i.key)).not.toContain('karting');
  });

  it('a boat trip business found by its name is offered', async () => {
    const r = await get('when=today');
    expect(idea(r, 'boat')!.options.map((o) => o.entity.name)).toContain('Test Bay Cruise');
  });

  it('one idea in full', async () => {
    const r = await get('when=today&idea=racket');
    expect(r.ideas).toHaveLength(1);
    expect(r.ideas[0]!.options[0]!.entity.name).toBe('Test Padel Club');
  });
});

describe('balanced home feed and coverage', () => {
  it('the feed does not open with a run of restaurants and cafés', async () => {
    const r = (await app.inject('/v1/feed/today?lat=34.675&lng=33.044&radius=5&locale=en')).json<FeedResponse>();
    for (const s of r.sections) {
      const b = s.items.map((e) => bucketOf(e.category.slug));
      for (let i = 2; i < b.length; i++) expect(b[i] === 'food' && b[i - 1] === 'food' && b[i - 2] === 'food', `${s.key}: ${b.join(',')}`).toBe(false);
    }
    const rn = r.sections.find((s) => s.key === 'right_now');
    if (rn && rn.items.length >= 4) expect(rn.items.slice(0, 4).filter((e) => bucketOf(e.category.slug) !== 'food').length).toBeGreaterThanOrEqual(2);
  });

  it('recommendations mix kinds of things', async () => {
    const r = (await app.inject('/v1/recommendations?lat=34.675&lng=33.044&radius=5&locale=en&limit=12')).json<{ items: Array<{ entity: { category: { slug: string } } }> }>();
    const food = r.items.filter((x) => bucketOf(x.entity.category.slug) === 'food').length;
    expect(food).toBeLessThanOrEqual(Math.ceil(r.items.length / 2));
  });

  it('coverage counts real objects per category, with photos, verified addresses and hours', async () => {
    const r = (await app.inject('/v1/coverage')).json<{ totals: { places: number; hours: number }; categories: Array<{ slug: string; places: number; withHours: number }>; buckets: Record<string, { places: number }> }>();
    expect(r.totals.places).toBeGreaterThan(20);
    const kart = r.categories.find((c) => c.slug === 'karting')!;
    expect(kart.places).toBe(1);
    expect(kart.withHours).toBe(1);
    expect(r.categories.find((c) => c.slug === 'cafe')!.places).toBeGreaterThan(5);
    expect(r.buckets.active!.places).toBeGreaterThan(0);
  });
});
