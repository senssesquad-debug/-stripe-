import { CATEGORIES, categoriesForOsmTags, COUNTRIES, getCategory, INTEREST_GROUPS, type InterestGroup } from '@passtra/core';
import { HttpError } from '../../lib/http';
import type { Connector, ConnectorContext, NormalizedPlace, RawRecord } from '../types';

/**
 * OpenStreetMap places (ODbL — attribution "© OpenStreetMap contributors" is shown in the app).
 *
 * mode "overpass" (production): one Overpass query per interest group and bounding-box tile of the country
 *   (small, independent requests: one failure doesn't stop the rest, and memory stays low on small hosts).
 *   OVERPASS_URL may list several instances separated by commas; each request tries them in turn.
 * mode "osm_api_tiles" (development only): small bbox tiles from api.openstreetmap.org — the same
 *   element format; used where Overpass is unreachable. Not for production (OSM API usage policy).
 *
 * Config: { mode?, countryIso?, groups?, tiles?: [south, west, north, east][] }
 */
export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  nodes?: number[];
  tags?: Record<string, string>;
}

function matcherQl(m: Record<string, string | true>, requireAny: string[] | undefined, area: string): string[] {
  const filt = Object.entries(m).map(([k, v]) => (v === true ? `["${k}"]` : `["${k}"="${v}"]`)).join('');
  const req = requireAny?.length ? requireAny : [''];
  return req.map((r) => `nwr${filt}${r ? `["${r}"]` : ''}(${area});`);
}

/** Overpass query for the given categories inside a bbox [south, west, north, east]. */
export function buildOverpassQuery(groupOrSlugs: InterestGroup | string[], bbox: [number, number, number, number]): string | null {
  const parts: string[] = [];
  const area = bbox.join(',');
  const wanted = (c: (typeof CATEGORIES)[number]) => (Array.isArray(groupOrSlugs) ? groupOrSlugs.includes(c.slug) : c.group === groupOrSlugs);
  for (const c of CATEGORIES) {
    if (!wanted(c) || !c.osm) continue;
    for (const m of c.osm) parts.push(...matcherQl(m, c.osmRequireAny, area));
  }
  if (!parts.length) return null;
  return `[out:json][timeout:90];(${parts.join('')});out center tags;`;
}

/** Categories that people search for most go first, so a partial import is already useful. */
const PRIORITY = ['restaurant', 'cafe', 'bar', 'supermarket', 'beach', 'pharmacy', 'museum', 'nightclub', 'park', 'bakery', 'fast-food', 'hiking', 'historic-site', 'viewpoint'];

/** Country bbox split into a 2×2 grid of [south, west, north, east] tiles. */
export function countryTiles(iso: string): Array<[number, number, number, number]> {
  const c = COUNTRIES.find((x) => x.code === iso);
  if (!c) throw new Error(`Unknown country ${iso}`);
  const [w, s, e, n] = c.bbox;
  const mx = (w + e) / 2;
  const my = (s + n) / 2;
  return [[s, w, my, mx], [s, mx, my, e], [my, w, n, mx], [my, mx, n, e]].map((t) => t.map((v) => Math.round(v * 1000) / 1000) as [number, number, number, number]);
}

async function overpass(ctx: ConnectorContext, query: string): Promise<OsmElement[]> {
  const endpoints = ctx.config.OVERPASS_URL.split(',').map((u) => u.trim()).filter(Boolean);
  let last: Error = new Error('no Overpass endpoint configured');
  for (const url of endpoints) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await ctx.http.json<{ elements: OsmElement[]; remark?: string }>(url, {
          method: 'POST', body: `data=${encodeURIComponent(query)}`, headers: { 'content-type': 'application/x-www-form-urlencoded' }, timeoutMs: 150_000,
        });
        // Overpass reports server-side timeouts/limits as a "remark" with partial or no data — treat as a failure.
        if (res.data?.remark && /error|timed out|out of memory/i.test(res.data.remark)) throw new Error(`Overpass: ${res.data.remark.slice(0, 160)}`);
        return res.data?.elements ?? [];
      } catch (e) {
        last = e as Error;
        const busy = e instanceof HttpError && (e.status === 429 || e.status === 504 || e.status === 503);
        ctx.log.warn({ url, attempt, err: last.message }, 'overpass request failed');
        if (busy && attempt === 0) { await new Promise((r) => setTimeout(r, 20_000)); continue; }
        break; // try the next instance
      }
    }
  }
  throw last;
}

const PRACTICAL_UNNAMED_OK = new Set(['atm', 'fuel', 'ev-charging', 'pharmacy', 'post-office', 'police', 'car-wash', 'hospital']);

function addressOf(t: Record<string, string>): string | null {
  const street = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ');
  const parts = [street, t['addr:postcode'], t['addr:city']].filter(Boolean);
  return parts.length ? parts.join(', ') : t['addr:full'] ?? null;
}

export const osmConnector: Connector = {
  id: 'osm',
  entityType: 'place',
  fullSnapshot: true,

  async *fetch(ctx: ConnectorContext): AsyncIterable<RawRecord> {
    const cfg = ctx.source.config as { mode?: string; countryIso?: string; groups?: InterestGroup[]; tiles?: Array<[number, number, number, number]> };
    if (cfg.mode === 'osm_api_tiles') {
      if (ctx.config.NODE_ENV === 'production') throw new Error('osm_api_tiles mode is for development only; use Overpass in production.');
      for (const [s, w, n, e] of cfg.tiles ?? []) {
        const res = await ctx.http.json<{ elements: OsmElement[] }>(`https://api.openstreetmap.org/api/0.6/map.json?bbox=${w},${s},${e},${n}`, { timeoutMs: 60_000 });
        const elements = res.data?.elements ?? [];
        const nodes = new Map<number, OsmElement>();
        for (const el of elements) if (el.type === 'node') nodes.set(el.id, el);
        for (const el of elements) {
          if (!el.tags || el.type === 'relation') continue;
          if (el.type === 'way' && el.nodes?.length) {
            const pts = el.nodes.map((id) => nodes.get(id)).filter((x): x is OsmElement => !!x && x.lat !== undefined);
            if (!pts.length) continue;
            el.center = { lat: pts.reduce((a, p) => a + p.lat!, 0) / pts.length, lon: pts.reduce((a, p) => a + p.lon!, 0) / pts.length };
            delete el.nodes;
          }
          yield { externalId: `${el.type}/${el.id}`, url: `https://www.openstreetmap.org/${el.type}/${el.id}`, payload: el };
        }
      }
      return;
    }
    // Resumable import: one unit = one category in one quarter of the country. Finished units are remembered for
    // the current cycle, so an interrupted run (host sleep, Overpass overload) continues where it stopped.
    const iso = cfg.countryIso ?? ctx.source.country_code ?? 'CY';
    const tiles = cfg.tiles ?? countryTiles(iso);
    const groups = new Set(cfg.groups ?? [...INTEREST_GROUPS]);
    const slugs = CATEGORIES.filter((c) => c.osm && groups.has(c.group as InterestGroup)).map((c) => c.slug)
      .sort((a, b) => ((PRIORITY.indexOf(a) + 1 || 99) - (PRIORITY.indexOf(b) + 1 || 99)));
    const units = slugs.flatMap((slug) => tiles.map((tile) => ({ key: `${slug}@${tile.join(',')}`, slug, tile })));
    type Cycle = { startedAt: string; done: Record<string, string> };
    let cycle = await ctx.state.get<Cycle>('osm_cycle');
    if (!cycle) cycle = { startedAt: ctx.now.toISOString(), done: {} };
    const seen = new Set<string>();
    const failures: string[] = [];
    let outOfTime = false;
    for (const u of units) {
      if (cycle.done[u.key]) continue;
      if (Date.now() > ctx.deadline) { outOfTime = true; break; }
      const q = buildOverpassQuery([u.slug], u.tile);
      if (!q) { cycle.done[u.key] = ctx.now.toISOString(); continue; }
      let elements: OsmElement[];
      try {
        elements = await overpass(ctx, q);
      } catch (e) {
        failures.push(`${u.key}: ${(e as Error).message}`);
        continue; // other units still import; this one is retried next run
      }
      for (const el of elements) {
        const id = `${el.type}/${el.id}`;
        if (seen.has(id)) continue; // objects on tile borders / in two categories come twice
        seen.add(id);
        yield { externalId: id, url: `https://www.openstreetmap.org/${id}`, payload: el };
      }
      cycle.done[u.key] = new Date().toISOString(); // after its records were ingested
      await ctx.state.set('osm_cycle', cycle);
    }
    const remaining = units.filter((u) => !cycle!.done[u.key]).length;
    ctx.log.info({ source: ctx.source.key, done: units.length - remaining, total: units.length, failures: failures.length }, 'osm import progress');
    if (remaining === 0) {
      // Whole country covered: records not seen since the cycle began are missing. Next run starts a new cycle.
      ctx.snapshot.since = new Date(cycle.startedAt);
      await ctx.state.set('osm_cycle', null);
      return;
    }
    ctx.snapshot.complete = false;
    if (failures.length && !outOfTime && failures.length === remaining) {
      throw new Error(`Overpass: ${failures.length}/${units.length} parts failed — ${failures[0]}`);
    }
  },

  normalize(raw): NormalizedPlace | null {
    const el = raw.payload as OsmElement;
    const t = el.tags ?? {};
    if (t['disused:amenity'] || t['abandoned:amenity'] || t.disused === 'yes' || t.abandoned === 'yes' || t.access === 'private') return null;
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat === undefined || lng === undefined) return null;
    const cats = categoriesForOsmTags(t).map((c) => c.slug);
    if (!cats.length) return null;

    const primary = cats[0]!;
    let name = t.name ?? t['name:en'] ?? null;
    if (!name) {
      if (!PRACTICAL_UNNAMED_OK.has(primary)) return null;
      const label = getCategory(primary)!.label.en.replace(/s$/, '');
      const brand = t.brand ?? t.operator;
      name = brand ? `${label} · ${brand}` : label;
    }
    const nameI18n: Record<string, string> = {};
    for (const l of ['en', 'el', 'ru']) if (t[`name:${l}`]) nameI18n[l] = t[`name:${l}`]!;

    // Searchable details people ask for: cuisine ("sushi", "pizza"), diets, brand, sport.
    const tags = new Set<string>();
    for (const c of (t.cuisine ?? '').split(';')) if (c.trim()) tags.add(c.trim().replace(/_/g, ' '));
    for (const d of ['vegan', 'vegetarian', 'gluten_free', 'halal', 'kosher']) if (t[`diet:${d}`] === 'yes' || t[`diet:${d}`] === 'only') tags.add(d.replace('_', ' '));
    for (const k of ['brand', 'sport']) for (const v of (t[k] ?? '').split(';')) if (v.trim()) tags.add(v.trim().replace(/_/g, ' '));
    if (t.outdoor_seating === 'yes') tags.add('outdoor seating');

    const externalIds: Record<string, string> = { osm: raw.externalId };
    if (t.wikidata && /^Q\d+$/.test(t.wikidata)) externalIds.wikidata = t.wikidata;

    return {
      kind: 'place',
      externalId: raw.externalId,
      name,
      nameI18n,
      description: t.description ?? null,
      categories: cats,
      location: { lat, lng },
      address: addressOf(t),
      cityHint: t['addr:city'] ?? null,
      phone: t.phone ?? t['contact:phone'] ?? null,
      website: t.website ?? t['contact:website'] ?? t.url ?? null,
      openingHours: t.opening_hours ? { format: 'osm', value: t.opening_hours } : null,
      isFree: t.fee === 'no' ? true : t.fee === 'yes' ? false : null,
      wheelchair: t.wheelchair ?? null,
      status: 'active',
      images: [],
      externalIds,
      sourceUrl: raw.url ?? null,
      tags: [...tags].slice(0, 12),
    };
  },
};
