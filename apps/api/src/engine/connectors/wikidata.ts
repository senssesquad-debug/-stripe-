import { htmlToText, type ImageDTO } from '@passtra/core';
import type { Connector, ConnectorContext, NormalizedPlace, RawRecord } from '../types';

/**
 * Wikidata (CC0) notable places + Wikimedia Commons images with per-file licence and author.
 * Images are kept only if their licence allows reuse with attribution (CC0/PD/CC BY/CC BY-SA).
 * Config: { countryQid: "Q229" }
 */
const CLASSES: Array<{ qid: string; category: string }> = [
  { qid: 'Q33506', category: 'museum' },
  { qid: 'Q839954', category: 'historic-site' }, // archaeological site
  { qid: 'Q23413', category: 'historic-site' }, // castle
  { qid: 'Q57821', category: 'historic-site' }, // fortification
  { qid: 'Q44613', category: 'religious-site' }, // monastery
  { qid: 'Q2977', category: 'religious-site' }, // cathedral
  { qid: 'Q40080', category: 'beach' },
  { qid: 'Q46169', category: 'park' }, // national park
  { qid: 'Q179049', category: 'park' }, // nature reserve
  { qid: 'Q34038', category: 'hiking' }, // waterfall → reached via trails
  { qid: 'Q207694', category: 'art-gallery' }, // art museum
];

interface Binding {
  item: { value: string };
  cls: { value: string };
  coord: { value: string };
  label_en?: { value: string };
  label_el?: { value: string };
  label_ru?: { value: string };
  desc_en?: { value: string };
  image?: { value: string };
  website?: { value: string };
}

export function buildWikidataQuery(countryQid: string): string {
  const values = CLASSES.map((c) => `wd:${c.qid}`).join(' ');
  return `SELECT ?item ?cls ?coord ?label_en ?label_el ?label_ru ?desc_en ?image ?website WHERE {
  VALUES ?cls { ${values} }
  ?item wdt:P31/wdt:P279* ?cls ; wdt:P17 wd:${countryQid} ; wdt:P625 ?coord .
  FILTER NOT EXISTS { ?item wdt:P576 ?dissolved }
  OPTIONAL { ?item rdfs:label ?label_en FILTER(LANG(?label_en) = "en") }
  OPTIONAL { ?item rdfs:label ?label_el FILTER(LANG(?label_el) = "el") }
  OPTIONAL { ?item rdfs:label ?label_ru FILTER(LANG(?label_ru) = "ru") }
  OPTIONAL { ?item schema:description ?desc_en FILTER(LANG(?desc_en) = "en") }
  OPTIONAL { ?item wdt:P18 ?image }
  OPTIONAL { ?item wdt:P856 ?website }
}`;
}

const ALLOWED_LICENSE = /^(cc0|public domain|pd|cc by(-sa)? [0-9.]+|cc by(-sa)?)/i;

interface CommonsMeta {
  url: string;
  license: string;
  artist: string;
}

async function commonsMetadata(ctx: ConnectorContext, files: string[]): Promise<Map<string, CommonsMeta>> {
  const out = new Map<string, CommonsMeta>();
  for (let i = 0; i < files.length; i += 40) {
    const batch = files.slice(i, i + 40);
    const titles = batch.map((f) => `File:${f}`).join('|');
    const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1024&titles=${encodeURIComponent(titles)}`;
    try {
      const res = await ctx.http.json<{ query?: { pages?: Record<string, { title: string; imageinfo?: Array<{ thumburl?: string; url: string; extmetadata?: Record<string, { value: string }> }> }> } }>(url, { timeoutMs: 30_000 });
      for (const p of Object.values(res.data?.query?.pages ?? {})) {
        const info = p.imageinfo?.[0];
        if (!info) continue;
        const license = info.extmetadata?.LicenseShortName?.value ?? '';
        const artist = htmlToText(info.extmetadata?.Artist?.value ?? '').slice(0, 120);
        if (!ALLOWED_LICENSE.test(license.trim())) continue;
        out.set(p.title.replace(/^File:/, ''), { url: info.thumburl ?? info.url, license, artist });
      }
    } catch (e) {
      ctx.log.warn({ err: (e as Error).message }, 'commons metadata batch failed; images skipped');
    }
  }
  return out;
}

export const wikidataConnector: Connector = {
  id: 'wikidata',
  entityType: 'place',
  fullSnapshot: true,

  async *fetch(ctx): AsyncIterable<RawRecord> {
    const qid = (ctx.source.config.countryQid as string) ?? 'Q229';
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(buildWikidataQuery(qid))}`;
    const res = await ctx.http.json<{ results: { bindings: Binding[] } }>(url, { headers: { accept: 'application/sparql-results+json' }, timeoutMs: 90_000 });
    const byItem = new Map<string, Binding & { classes: Set<string> }>();
    for (const b of res.data?.results.bindings ?? []) {
      const id = b.item.value.split('/').pop()!;
      const prev = byItem.get(id);
      if (prev) prev.classes.add(b.cls.value.split('/').pop()!);
      else byItem.set(id, { ...b, classes: new Set([b.cls.value.split('/').pop()!]) });
    }
    const files = [...new Set([...byItem.values()].map((b) => (b.image ? decodeURIComponent(b.image.value.split('/').pop()!) : null)).filter((x): x is string => !!x))];
    const meta = await commonsMetadata(ctx, files);
    for (const [id, b] of byItem) {
      const file = b.image ? decodeURIComponent(b.image.value.split('/').pop()!) : null;
      yield { externalId: id, url: `https://www.wikidata.org/wiki/${id}`, payload: { ...b, classes: [...b.classes], commons: file ? meta.get(file) ?? null : null, file } };
    }
  },

  normalize(raw): NormalizedPlace | null {
    const b = raw.payload as Binding & { classes: string[]; commons: CommonsMeta | null; file: string | null };
    const m = b.coord?.value.match(/Point\(([-\d.]+) ([-\d.]+)\)/);
    if (!m) return null;
    const name = b.label_en?.value ?? b.label_el?.value ?? b.label_ru?.value;
    if (!name || /^Q\d+$/.test(name)) return null;
    const categories = [...new Set(b.classes.map((q) => CLASSES.find((c) => c.qid === q)?.category).filter((x): x is string => !!x))];
    if (!categories.length) return null;
    const nameI18n: Record<string, string> = {};
    if (b.label_en) nameI18n.en = b.label_en.value;
    if (b.label_el) nameI18n.el = b.label_el.value;
    if (b.label_ru) nameI18n.ru = b.label_ru.value;
    const images: ImageDTO[] = b.commons
      ? [{ url: b.commons.url, license: b.commons.license, attribution: `${b.commons.artist || 'Unknown author'} · ${b.commons.license} · Wikimedia Commons`, source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(b.file!)}` }]
      : [];
    return {
      kind: 'place',
      externalId: raw.externalId,
      name,
      nameI18n,
      description: b.desc_en?.value ?? null,
      categories,
      location: { lat: Number(m[2]), lng: Number(m[1]) },
      address: null,
      cityHint: null,
      phone: null,
      website: b.website?.value ?? null,
      openingHours: null,
      isFree: null,
      wheelchair: null,
      status: 'active',
      images,
      externalIds: { wikidata: raw.externalId },
      sourceUrl: raw.url ?? null,
    };
  },
};
