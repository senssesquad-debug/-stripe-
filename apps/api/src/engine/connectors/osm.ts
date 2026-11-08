import { CATEGORIES, categoriesForOsmTags, getCategory, INTEREST_GROUPS, type InterestGroup } from '@passtra/core';
import type { Connector, ConnectorContext, NormalizedPlace, RawRecord } from '../types';

/**
 * OpenStreetMap places (ODbL — attribution "© OpenStreetMap contributors" is shown in the app).
 *
 * mode "overpass" (production): one Overpass query per interest group over the country area.
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

export function buildOverpassQuery(group: InterestGroup, countryIso: string): string | null {
  const parts: string[] = [];
  for (const c of CATEGORIES) {
    if (c.group !== group || !c.osm) continue;
    for (const m of c.osm) parts.push(...matcherQl(m, c.osmRequireAny, 'area.a'));
  }
  if (!parts.length) return null;
  return `[out:json][timeout:180];area["ISO3166-1"="${countryIso}"][admin_level=2]->.a;(${parts.join('')});out center tags;`;
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
    const iso = cfg.countryIso ?? ctx.source.country_code ?? 'CY';
    for (const group of cfg.groups ?? [...INTEREST_GROUPS]) {
      const q = buildOverpassQuery(group, iso);
      if (!q) continue;
      const res = await ctx.http.json<{ elements: OsmElement[] }>(ctx.config.OVERPASS_URL, {
        method: 'POST',
        body: `data=${encodeURIComponent(q)}`,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        timeoutMs: 200_000,
      });
      for (const el of res.data?.elements ?? []) {
        yield { externalId: `${el.type}/${el.id}`, url: `https://www.openstreetmap.org/${el.type}/${el.id}`, payload: el };
      }
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
    };
  },
};
