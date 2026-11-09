import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import type { AppConfig } from '../src/config';
import { runMaintenance } from '../src/engine/maintenance';
import { runSource } from '../src/engine/pipeline';
import { nextInterval } from '../src/engine/scheduler';
import { addSource, engineDeps, fakeFetch, fixture, freshDb, source } from './helpers';

const NOW = new Date('2026-11-08T12:00:00Z'); // Sunday 14:00 in Cyprus
const TRIBE = fixture<{ events: Array<{ id: number; title: string }> }>('tribe-visitcyprus-2026-11-08.json');
const OSM = fixture<{ elements: unknown[] }>('osm-limassol-center-2026-11-08.json');

let pool: pg.Pool;
let config: AppConfig;

const tribeFetch = (events = TRIBE.events) => fakeFetch([[/visitcyprus\.com\/wp-json\/tribe/, () => ({ events, total: events.length, total_pages: 1 })]]);

const jsonLdPage = (events: object[]) => `<html><head><script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': events })}</script></head><body></body></html>`;

async function event(where: string, params: unknown[] = []) {
  return (await pool.query(`SELECT *, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng FROM events WHERE merged_into IS NULL AND ${where}`, params)).rows[0];
}

beforeAll(async () => {
  ({ pool, config } = await freshDb('engine'));
});
afterAll(async () => {
  await pool.end();
});

describe('visitcyprus.com (The Events Calendar) — real fixture', () => {
  it('ingests and normalises every listing', async () => {
    const s = await runSource(engineDeps(pool, config, tribeFetch(), NOW), await source(pool, 'visitcyprus_events'), 'test');
    expect(s.status).toBe('success');
    expect(s.fetched).toBe(18);
    expect(s.created + s.merged).toBe(18 - s.skipped);
    expect(s.skipped).toBe(0);
  });

  it('decodes HTML entities and strips duplicated date suffixes from titles', async () => {
    const regatta = await event(`title LIKE 'Regatta of Champions%'`);
    expect(regatta.title).toContain('(Optimist & ILCA4)');
    expect(regatta.title).not.toMatch(/&#\d+;/);
    const lefkara = await event(`title LIKE 'Lefkara Classic%'`);
    expect(lefkara.title).toBe('Lefkara Classic 2026');
  });

  it('keeps all-day events as date-only (never invents 00:00) and multi-day spans', async () => {
    const regatta = await event(`title LIKE 'Regatta of Champions%'`);
    expect(regatta.time_precision).toBe('date_only');
    expect(regatta.local_start_date).toBe('2026-11-08');
    expect(regatta.local_end_date).toBe('2026-11-15');
    expect(regatta.timezone).toBe('Europe/Nicosia');
    expect(regatta.is_free).toBe(true);
  });

  it('converts local times to UTC (EET = UTC+2 in November) and parses prices', async () => {
    const lefkara = await event(`title = 'Lefkara Classic 2026'`);
    expect(lefkara.time_precision).toBe('exact');
    expect(lefkara.starts_at.toISOString()).toBe('2026-11-12T14:00:00.000Z');
    expect(lefkara.price_min).toBe(60);
    const marathon = await event(`title LIKE 'Radisson Blu Larnaka International Marathon%'`);
    expect([marathon.price_min, marathon.price_max, marathon.currency]).toEqual([20, 70, 'EUR']);
    expect(marathon.primary_category).toBe('sports-event');
  });

  it('classifies deterministically from title and source labels', async () => {
    const cso = await event(`title ILIKE 'CYPRUS SYMPHONY ORCHESTRA%' AND local_start_date = '2026-11-20'`);
    expect(cso.primary_category).toBe('classical');
    const recital = await event(`title ILIKE 'Recital:%'`);
    expect(recital.categories).toContain('concert');
  });

  it('two performances of the same programme on different dates stay separate events', async () => {
    const r = await pool.query(`SELECT COUNT(*)::int AS n FROM events WHERE title ILIKE 'CYPRUS SYMPHONY ORCHESTRA%STARLIGHT%' AND merged_into IS NULL`);
    expect(r.rows[0].n).toBe(2);
  });

  it('records provenance for every field, with the source and check time', async () => {
    const lefkara = await event(`title = 'Lefkara Classic 2026'`);
    const obs = await pool.query(`SELECT field, value FROM field_observations WHERE entity_type = 'event' AND entity_id = $1`, [lefkara.id]);
    const fields = obs.rows.map((r) => r.field);
    expect(fields).toEqual(expect.arrayContaining(['title', 'starts_at', 'local_start_date', 'price_min', 'venue_name', 'status']));
    expect(lefkara.field_sources.starts_at.source).toBe('visitcyprus_events');
    expect(lefkara.last_verified_at).toBeTruthy();
    expect(['confirmed', 'likely']).toContain(lefkara.verification_status);
  });

  it('venues without coordinates are placed at the city centre and marked as such (no fake precision)', async () => {
    const marathon = await event(`title LIKE 'Radisson Blu Larnaka%'`);
    expect(marathon.location_precision).toBe('city');
  });

  it('a second identical run changes nothing', async () => {
    const before = await pool.query('SELECT COUNT(*)::int AS n FROM events');
    const s = await runSource(engineDeps(pool, config, tribeFetch(), NOW), await source(pool, 'visitcyprus_events'), 'test');
    expect(s.unchanged).toBe(18);
    expect(s.created + s.updated + s.merged).toBe(0);
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM events')).rows[0].n).toBe(before.rows[0].n);
  });
});

describe('cross-source merge, agreement and conflicts', () => {
  it('merges the same concert reported by the venue (JSON-LD) and raises confidence', async () => {
    const venue = await addSource(pool, 'test_venue_site', 'jsonld_events', 0.95, { urls: ['https://venue.example/events'] });
    const page = jsonLdPage([{
      '@type': 'MusicEvent', '@id': 'https://venue.example/e/starlight-2', name: 'Cyprus Symphony Orchestra – Starlight 2',
      startDate: '2026-11-20T20:30:00+02:00', endDate: '2026-11-20T22:00:00+02:00',
      location: { '@type': 'Place', name: 'Pattihio Municipal Theatre', address: { addressLocality: 'Limassol' }, geo: { latitude: 34.6765, longitude: 33.0435 } },
      offers: [{ price: '12', priceCurrency: 'EUR' }, { price: '25', priceCurrency: 'EUR', url: 'https://tickets.example/starlight' }],
      eventStatus: 'https://schema.org/EventScheduled',
    }]);
    const before = await event(`title ILIKE 'CYPRUS SYMPHONY ORCHESTRA%' AND local_start_date = '2026-11-20'`);
    const s = await runSource(engineDeps(pool, config, fakeFetch([[/venue\.example\/events/, () => new Response(page, { headers: { 'content-type': 'text/html' } })]]), NOW), venue, 'test');
    expect(s.merged).toBe(1);
    const after = await event(`id = $1`, [before.id]);
    expect(after.source_count).toBe(2);
    expect(after.location_precision).toBe('exact'); // venue's exact coordinates win over the city centre
    expect(after.confidence).toBeGreaterThan(before.confidence);
    expect(after.verification_status).toBe('confirmed');
  });

  it('flags a time disagreement between similarly authoritative sources instead of picking one', async () => {
    const ticketing = await addSource(pool, 'test_ticketing', 'jsonld_events', 0.85, { urls: ['https://tickets.example/list'] });
    const page = jsonLdPage([{
      '@type': 'MusicEvent', '@id': 'tix-recital', name: 'Recital: Anousha Nazari (mezzo-soprano)', startDate: '2026-11-19T21:00:00+02:00',
      location: { name: 'The Shoe Factory', address: { addressLocality: 'Nicosia' } },
    }]);
    const s = await runSource(engineDeps(pool, config, fakeFetch([[/tickets\.example\/list/, () => new Response(page, { headers: { 'content-type': 'text/html' } })]]), NOW), ticketing, 'test');
    expect(s.merged).toBe(1);
    const recital = await event(`title ILIKE 'Recital:%'`);
    expect(recital.time_unconfirmed).toBe(true);
    expect(recital.verification_status).toBe('conflicting');
    const c = await pool.query(`SELECT * FROM data_conflicts WHERE entity_id = $1 AND field = 'starts_at'`, [recital.id]);
    expect(c.rows[0].status).toBe('open');
    expect(c.rows[0].critical).toBe(true);
    expect(c.rows[0].candidates).toHaveLength(2);
  });

  it('an authoritative cancellation marks the event cancelled', async () => {
    const ticketing = await source(pool, 'test_ticketing');
    const page = jsonLdPage([{
      '@type': 'SportsEvent', '@id': 'tix-marathon', name: 'Radisson Blu Larnaka International Marathon', startDate: '2026-11-15T07:00:00+02:00',
      location: { name: 'Finikoudes Larnaka', address: { addressLocality: 'Larnaka' } }, eventStatus: 'https://schema.org/EventCancelled',
    }]);
    await runSource(engineDeps(pool, config, fakeFetch([[/tickets\.example\/list/, () => new Response(page, { headers: { 'content-type': 'text/html' } })]]), NOW), ticketing, 'test');
    const m = await event(`title LIKE 'Radisson Blu Larnaka%'`);
    expect(m.status).toBe('cancelled');
  });

  it('robots.txt is enforced for website sources', async () => {
    const blocked = await addSource(pool, 'test_blocked_site', 'jsonld_events', 0.9, { urls: ['https://blocked.example/events'] });
    const f = fakeFetch([
      [/blocked\.example\/robots\.txt/, () => new Response('User-agent: *\nDisallow: /', { status: 200 })],
      [/blocked\.example\/events/, () => new Response(jsonLdPage([]), { status: 200 })],
    ]);
    const s = await runSource(engineDeps(pool, config, f, NOW), blocked, 'test');
    expect(s.status).toBe('failed');
    expect(s.error).toMatch(/robots\.txt disallows/);
    expect(f.calls.some((u) => u.includes('/events'))).toBe(false);
  });

  it('a website source cannot be enabled without a terms review (DB constraint)', async () => {
    await expect(pool.query(`INSERT INTO sources (key, name, connector, entity_type, authority, enabled) VALUES ('x','x','jsonld_events','event',0.5,true)`)).rejects.toThrow(/sources_terms_before_enable/);
  });
});

describe('geocoding never overrides the source city on contradictory evidence (real case: Famagusta Nautical Club, Limassol)', () => {
  it('keeps the stated city, marks the location as city-level and opens a critical conflict', async () => {
    const venue = await addSource(pool, 'test_geo_site', 'jsonld_events', 0.9, { urls: ['https://geo.example/events'] });
    const page = jsonLdPage([{ '@type': 'SportsEvent', '@id': 'geo-1', name: 'Autumn Optimist Regatta', startDate: '2026-11-21', location: { name: 'FAMAGUSTA NAUTICAL CLUB', address: { addressLocality: 'Limassol' } } }]);
    const f = fakeFetch([
      [/geo\.example\/events/, () => new Response(page, { headers: { 'content-type': 'text/html' } })],
      // Nominatim finds the original club in Famagusta, ~60 km from Limassol.
      [/nominatim.*FAMAGUSTA%20NAUTICAL%20CLUB%2C%20Limassol/, () => []],
      [/nominatim.*FAMAGUSTA%20NAUTICAL%20CLUB/, () => [{ lat: '35.1225', lon: '33.9403', display_name: 'Famagusta Nautical Club, Gazimağusa, Cyprus', type: 'yes', category: 'leisure' }]],
    ]);
    const deps = engineDeps(pool, { ...config, GEOCODING_ENABLED: true }, f, NOW);
    deps.geocoder = new (await import('../src/lib/geocode')).Geocoder(pool, deps.http, 'https://nominatim.openstreetmap.org', true);
    await runSource(deps, venue, 'test');
    const e = await event(`title = 'Autumn Optimist Regatta'`);
    expect(e.location_precision).toBe('city');
    expect(Math.abs(e.lat - 34.6786)).toBeLessThan(0.01); // Limassol centre, not Famagusta
    expect(e.verification_status).toBe('conflicting');
    const c = (await pool.query(`SELECT * FROM data_conflicts WHERE entity_id = $1 AND field = 'city'`, [e.id])).rows[0];
    expect(c.status).toBe('open');
    expect(c.candidates[1].display).toMatch(/Famagusta Nautical Club/);
  });
});

describe('absence and expiry', () => {
  it('a future event missing from 2 complete snapshots is hidden, but never marked cancelled; it returns when listed again', async () => {
    const without = TRIBE.events.filter((e) => !e.title.startsWith('Kambos Mountain Race'));
    const deps = (events: typeof TRIBE.events) => engineDeps(pool, config, tribeFetch(events), NOW);
    await runSource(deps(without), await source(pool, 'visitcyprus_events'), 'test');
    expect((await event(`title LIKE 'Kambos%'`)).status).toBe('scheduled');
    await runSource(deps(without), await source(pool, 'visitcyprus_events'), 'test');
    expect((await event(`title LIKE 'Kambos%'`)).status).toBe('unlisted');
    await runSource(deps(TRIBE.events), await source(pool, 'visitcyprus_events'), 'test');
    expect((await event(`title LIKE 'Kambos%'`)).status).toBe('scheduled');
  });

  it('maintenance completes finished events and they leave upcoming lists', async () => {
    const later = new Date('2026-11-20T23:00:00Z');
    await runMaintenance(pool, { info() {}, warn() {}, error() {}, debug() {} }, later);
    const recital = await event(`title ILIKE 'Recital:%'`);
    expect(recital.status).toBe('completed');
    const regatta = await event(`title LIKE 'Regatta of Champions%'`);
    expect(regatta.status).toBe('completed'); // all-day 8–15 Nov is over on 20 Nov
    const kambos = await event(`title LIKE 'Kambos%'`);
    expect(kambos.status).toBe('scheduled');
  });
});

describe('places: OpenStreetMap + Wikidata', () => {
  const osmFetch = () => fakeFetch([[/api\.openstreetmap\.org\/api\/0\.6\/map\.json/, () => OSM]]);

  it('imports real OSM elements with categories, hours and attribution-ready provenance', async () => {
    const osm = await source(pool, 'osm_cy');
    osm.config = { mode: 'osm_api_tiles', tiles: [[34.673, 33.04, 34.678, 33.047]] };
    const s = await runSource(engineDeps(pool, config, osmFetch(), NOW), osm, 'test');
    expect(s.status).toBe('success');
    expect(s.created).toBeGreaterThan(60);
    const ph = (await pool.query(`SELECT * FROM places WHERE name = 'Efstathinou Charalambos'`)).rows[0];
    expect(ph.primary_category).toBe('pharmacy');
    const club = (await pool.query(`SELECT * FROM places WHERE name = 'Metropole Retro Music Club'`)).rows[0];
    expect(club.primary_category).toBe('nightclub');
    expect(club.age_min).toBe(18);
    const market = (await pool.query(`SELECT * FROM places WHERE name = 'Sunday Market'`)).rows[0];
    expect(market.opening_hours).toEqual({ format: 'osm', value: 'Su 08:00-15:00' });
    expect(market.external_ids.osm).toMatch(/^node\//);
  });

  it('OSM via Overpass: per-tile requests, falls back to the next instance, keeps what arrived when a tile fails', async () => {
    const src = await addSource(pool, 'osm_tiles_test', 'osm', 0.6, { mode: 'overpass', countryIso: 'CY', groups: ['food'], tiles: [[34.66, 33.03, 34.69, 33.06], [34.90, 33.60, 34.95, 33.65]] }, 'place');
    const f = fakeFetch([
      [/primary\.example/, () => new Response('server error', { status: 500 })],
      [/backup\.example/, (_u, init) => {
        const q = decodeURIComponent(String(init?.body ?? ''));
        if (q.includes('34.9,33.6')) return new Response('gateway', { status: 500 });
        return { elements: [{ type: 'node', id: 990001, lat: 34.675, lon: 33.045, tags: { amenity: 'cafe', name: 'Tile Test Café', opening_hours: 'Mo-Su 08:00-20:00' } }] };
      }],
    ]);
    const s = await runSource(engineDeps(pool, { ...config, OVERPASS_URL: 'https://primary.example/api/interpreter, https://backup.example/api/interpreter' }, f, NOW), src, 'test');
    expect(s.status).toBe('partial');
    expect(s.created).toBe(1);
    expect(s.error).toMatch(/parts failed/);
    expect(f.calls.filter((u) => u.includes('primary.example/api')).length).toBeGreaterThan(0); // first instance tried first
    // Next run resumes: finished tiles are skipped, only the failed ones are requested again.
    const f2 = fakeFetch([[/backup\.example/, () => ({ elements: [] })]]);
    const s2 = await runSource(engineDeps(pool, { ...config, OVERPASS_URL: 'https://backup.example/api/interpreter' }, f2, NOW), src, 'test');
    const firstRunUnits = f.calls.filter((u) => u.includes('backup.example/api')).length;
    expect(f2.calls.filter((u) => u.includes('backup.example/api')).length).toBeLessThan(firstRunUnits);
    expect(s2.status).toBe('success'); // cycle completed
    expect((await pool.query(`SELECT 1 FROM places WHERE name = 'Tile Test Café'`)).rowCount).toBe(1);
  });

  it('OSM from a Geofabrik extract: places, way and relation centres, activities by name, resume, no re-download when unchanged', async () => {
    const pbf = readFileSync(new URL('./fixtures/cy-sample.osm.pbf', import.meta.url));
    const src = await addSource(pool, 'osm_pbf_test', 'osm', 0.6, { mode: 'pbf', url: 'https://extracts.example/cyprus-latest.osm.pbf' }, 'place');
    const stamp = 'Mon, 09 Nov 2026 03:00:00 GMT';
    const f = fakeFetch([[/extracts\.example/, (_u, init) => {
      const since = new Headers(init?.headers).get('if-modified-since');
      return since === stamp ? new Response(null, { status: 304 }) : new Response(pbf, { headers: { 'last-modified': stamp } });
    }]]);
    const s = await runSource(engineDeps(pool, config, f, NOW), src, 'test');
    expect(s.status).toBe('success');
    const rows = (await pool.query<{ name: string; primary_category: string; lat: number; lng: number }>(
      `SELECT p.name, p.primary_category, ST_Y(p.location::geometry) AS lat, ST_X(p.location::geometry) AS lng FROM places p
       JOIN source_records r ON r.entity_id = p.id WHERE r.source_id = $1 ORDER BY p.name`, [src.id])).rows;
    const by = Object.fromEntries(rows.map((r) => [r.name, r]));
    expect(by['Limassol Boat Hire']?.primary_category).toBe('boat-trip');
    expect(by['Blue Lagoon Cruise']?.primary_category).toBe('boat-trip'); // tourism=attraction, recognised by its name
    expect(by['Jeep Safari Troodos']?.primary_category).toBe('tours');
    expect(by['Φαρμακείο Ζήνωνος']?.primary_category).toBe('pharmacy');
    expect(by['Limassol Marina']?.lat).toBeCloseTo(34.6804, 3); // way: centre of its nodes
    expect(by['Kourion Beach']?.lng).toBeCloseTo(32.9013, 3); // multipolygon relation: centre of its outer way
    expect(by['Untagged Somewhere']).toBeUndefined();
    // Nothing changed upstream: a conditional request, no import, nothing marked missing.
    const s2 = await runSource(engineDeps(pool, config, f, NOW), src, 'test');
    expect(s2.fetched).toBe(0);
    expect(s2.missing).toBe(0);
    expect(f.calls.length).toBe(2);
  });

  it('OSM extract import resumes where the time budget stopped it, without downloading again', async () => {
    const { osmConnector, placesFromPbf } = await import('../src/engine/connectors/osm');
    const { HttpClient } = await import('../src/lib/http');
    const pbf = readFileSync(new URL('./fixtures/cy-sample.osm.pbf', import.meta.url));
    const all = await placesFromPbf(pbf);
    // Most-searched categories first: the pharmacy comes before boat trips.
    expect(all.findIndex((p) => p.tags?.amenity === 'pharmacy')).toBeLessThan(all.findIndex((p) => p.tags?.name === 'Blue Lagoon Cruise'));
    const store = new Map<string, unknown>();
    let downloads = 0;
    const http = new HttpClient('test', 0, (async () => { downloads++; return new Response(pbf, { headers: { 'last-modified': 'Tue, 10 Nov 2026 03:00:00 GMT' } }); }) as typeof fetch);
    const ctxFor = (budget: number) => {
      let yielded = 0;
      const ctx = {
        source: { key: 'osm_resume_test', config: { mode: 'pbf', url: 'https://extracts.example/x.pbf' }, country_code: 'CY' },
        http, now: NOW, log: { info: () => undefined, warn: () => undefined },
        state: { get: async (k: string) => store.get(k) ?? null, set: async (k: string, v: unknown) => { store.set(k, v); } },
        snapshot: { complete: true, since: null as Date | null },
        get deadline() { return yielded >= budget ? 0 : Number.MAX_SAFE_INTEGER; },
      };
      return { ctx, count: () => yielded, tick: () => { yielded++; } };
    };
    const run = async (budget: number) => {
      const c = ctxFor(budget);
      const ids: string[] = [];
      for await (const r of osmConnector.fetch(c.ctx as never)) { ids.push(r.externalId); c.tick(); }
      return { ids, snapshot: c.ctx.snapshot };
    };
    const first = await run(3);
    expect(first.ids).toHaveLength(3);
    expect(first.snapshot.complete).toBe(false);
    const second = await run(1000);
    expect(second.snapshot.complete).toBe(true);
    expect([...first.ids, ...second.ids]).toEqual(all.map((p) => `${p.type}/${p.id}`)); // nothing skipped, nothing twice
    expect(downloads).toBe(1); // the resumed run used the saved extract
  });

  it('merges a Wikidata item into the OSM place with the same wikidata id: current photos first, historical separate, Wikipedia text', async () => {
    const wd = await source(pool, 'wikidata_cy');
    const before = (await pool.query(`SELECT id FROM places WHERE external_ids->>'wikidata' = 'Q109944949'`)).rows[0];
    expect(before).toBeTruthy();
    const file = (title: string, w: number, h: number, license: string, date: string, extra: Record<string, string> = {}) => ({
      title, imageinfo: [{ url: `https://upload.wikimedia.org/${encodeURIComponent(title)}`, thumburl: `https://upload.wikimedia.org/thumb/${encodeURIComponent(title)}`, width: w, height: h, mime: 'image/jpeg',
        extmetadata: { LicenseShortName: { value: license }, Artist: { value: '<a href="#">Jane Doe</a>' }, DateTimeOriginal: { value: date }, ImageDescription: { value: extra.desc ?? '' } } }],
    });
    const f = fakeFetch([
      [/query\.wikidata\.org/, () => ({ results: { bindings: [{ item: { value: 'http://www.wikidata.org/entity/Q109944949' }, cls: { value: 'http://www.wikidata.org/entity/Q2977' }, coord: { value: 'Point(33.0427 34.6747)' },
        label_en: { value: 'Agia Napa Cathedral' }, label_el: { value: 'Μητρόπολη Αγίας Νάπας' }, image: { value: 'http://commons.wikimedia.org/wiki/Special:FilePath/Old%20cathedral.jpg' },
        commonscat: { value: 'Agia Napa Cathedral' }, wiki_en: { value: 'Agia Napa Cathedral' }, address: { value: 'Makariou III, Ayia Napa' } }] } })],
      [/list=categorymembers/, () => ({ query: { categorymembers: [{ title: 'File:Cathedral 2024.jpg' }, { title: 'File:Cathedral map.png' }, { title: 'File:Cathedral 1935.jpg' }, { title: 'File:Cathedral nonfree.jpg' }, { title: 'File:Tiny.jpg' }] } })],
      [/prop=imageinfo/, () => ({ query: { pages: {
        '1': file('File:Old cathedral.jpg', 1024, 768, 'CC BY-SA 3.0', '2009-05-01'),
        '2': file('File:Cathedral 2024.jpg', 4000, 2667, 'CC BY-SA 4.0', '2024-06-10 10:00'),
        '3': file('File:Cathedral map.png', 2000, 1500, 'CC BY-SA 4.0', '2020'),
        '4': file('File:Cathedral 1935.jpg', 1600, 1100, 'Public domain', '1935'),
        '5': file('File:Cathedral nonfree.jpg', 3000, 2000, 'All rights reserved', '2023'),
        '6': file('File:Tiny.jpg', 320, 240, 'CC0', '2025'),
      } } })],
      [/en\.wikipedia\.org/, () => ({ query: { pages: { '9': { title: 'Agia Napa Cathedral', extract: 'The Agia Napa Cathedral is a Greek Orthodox cathedral in Ayia Napa, Cyprus. It was completed in 1990s and is one of the largest churches on the island.' } } } })],
    ]);
    const s = await runSource(engineDeps(pool, config, f, NOW), wd, 'test');
    expect(s.merged).toBe(1);
    const p = (await pool.query(`SELECT * FROM places WHERE id = $1`, [before.id])).rows[0];
    expect(p.source_count).toBe(2);
    expect(p.external_ids).toMatchObject({ wikidata: 'Q109944949' });
    const urls = p.images.map((i: { source: string }) => decodeURIComponent(i.source));
    // Cover is the recent high-resolution photo, not Wikidata's older P18 image; maps, non-free and tiny files are dropped.
    expect(p.images[0]).toMatchObject({ kind: 'current', year: 2024, license: 'CC BY-SA 4.0', attribution: 'Jane Doe · CC BY-SA 4.0 · Wikimedia Commons' });
    expect(urls.some((u: string) => /map|nonfree|Tiny/.test(u))).toBe(false);
    expect(p.images.at(-1)).toMatchObject({ kind: 'historical', year: 1935 });
    expect(p.images.filter((i: { kind: string }) => i.kind === 'current')).toHaveLength(2);
    expect(p.name_i18n.el).toBe('Μητρόπολη Αγίας Νάπας');
    expect(p.description_i18n.en).toMatch(/Greek Orthodox cathedral/);
    expect(p.about_source).toMatchObject({ name: 'Wikipedia', license: 'CC BY-SA 4.0', urls: { en: 'https://en.wikipedia.org/wiki/Agia_Napa_Cathedral' } });
  });

  it('links an event to a known venue and uses its exact coordinates', async () => {
    const venue = await source(pool, 'test_venue_site');
    const page = jsonLdPage([{ '@type': 'MusicEvent', '@id': 'retro-night', name: 'Retro Night', startDate: '2026-11-14T22:00:00+02:00', location: { name: 'Metropole Retro Music Club', address: { addressLocality: 'Limassol' } } }]);
    await runSource(engineDeps(pool, config, fakeFetch([[/venue\.example\/events/, () => new Response(page, { headers: { 'content-type': 'text/html' } })]]), NOW), venue, 'test');
    const e = await event(`title = 'Retro Night'`);
    const club = (await pool.query(`SELECT id FROM places WHERE name = 'Metropole Retro Music Club'`)).rows[0];
    expect(e.place_id).toBe(club.id);
    expect(e.location_precision).toBe('exact');
  });
});

describe('scheduler cycle (claim → run → complete)', () => {
  it('claims due sources, records runs, unlocks them and adapts intervals', async () => {
    await pool.query(`UPDATE sources SET enabled = (key IN ('visitcyprus_events','ticketmaster_cy')), next_run_at = now() - interval '1 minute', locked_until = NULL`);
    const { tick } = await import('../src/engine/scheduler');
    const summaries = await tick(engineDeps(pool, config, tribeFetch(), NOW));
    expect(summaries.map((s) => s.status).sort()).toEqual(['skipped', 'success']); // ticketmaster has no key → skipped
    const rows = (await pool.query(`SELECT key, locked_until, current_interval_s, next_run_at > now() AS scheduled FROM sources WHERE key IN ('visitcyprus_events','ticketmaster_cy') ORDER BY key`)).rows;
    for (const r of rows) {
      expect(r.locked_until).toBeNull();
      expect(r.scheduled).toBe(true);
    }
    expect(rows.find((r) => r.key === 'ticketmaster_cy')!.current_interval_s).toBe(6 * 3600);
    expect(await tick(engineDeps(pool, config, tribeFetch(), NOW))).toHaveLength(0); // nothing due any more
  });
});

describe('adaptive scheduling', () => {
  const src = { min_interval_s: 900, max_interval_s: 1800, current_interval_s: 1200, consecutive_failures: 0 };
  it('speeds up on changes, backs off when quiet, backs off hard on failure', () => {
    expect(nextInterval(src, { status: 'success', changes: 3 })).toBe(900);
    expect(nextInterval(src, { status: 'success', changes: 0 })).toBe(1800);
    expect(nextInterval({ ...src, current_interval_s: 1800 }, { status: 'success', changes: 0 })).toBe(1800);
    expect(nextInterval(src, { status: 'failed', changes: 0 })).toBe(2400);
    expect(nextInterval({ ...src, consecutive_failures: 6 }, { status: 'failed', changes: 0 })).toBe(6 * 3600);
    expect(nextInterval(src, { status: 'skipped', changes: 0 })).toBe(6 * 3600);
  });
});
