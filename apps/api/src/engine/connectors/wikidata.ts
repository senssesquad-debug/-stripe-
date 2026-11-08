import { htmlToText, type ImageDTO } from '@passtra/core';
import { HttpError } from '../../lib/http';
import type { Connector, ConnectorContext, NormalizedPlace, RawRecord } from '../types';

/**
 * Wikidata (CC0) notable places, enriched with:
 *  - photos from the place's Wikimedia Commons category, selected for quality and recency. The main photo must show
 *    how the place looks today; old photos/engravings go to a separate "historical" gallery with their year.
 *    Only openly licensed files are kept, with author and licence.
 *  - the introduction of the Wikipedia article (en/el/ru) as a longer description (CC BY-SA, attributed and linked).
 *  - confirmed practical facts present in Wikidata (street address P6375, official website P856).
 * Config: { countryQid: "Q229", maxImagesPerPlace?: 6 }
 */
export const CLASSES: Array<{ qid: string; category: string }> = [
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
  commonscat?: { value: string };
  address?: { value: string };
  wiki_en?: { value: string };
  wiki_el?: { value: string };
  wiki_ru?: { value: string };
}

export function buildWikidataQuery(countryQid: string): string {
  const values = CLASSES.map((c) => `wd:${c.qid}`).join(' ');
  const wiki = (l: string) => `OPTIONAL { ?a_${l} schema:about ?item ; schema:isPartOf <https://${l}.wikipedia.org/> ; schema:name ?wiki_${l} . }`;
  return `SELECT ?item ?cls ?coord ?label_en ?label_el ?label_ru ?desc_en ?image ?website ?commonscat ?address ?wiki_en ?wiki_el ?wiki_ru WHERE {
  VALUES ?cls { ${values} }
  ?item wdt:P31/wdt:P279* ?cls ; wdt:P17 wd:${countryQid} ; wdt:P625 ?coord .
  FILTER NOT EXISTS { ?item wdt:P576 ?dissolved }
  OPTIONAL { ?item rdfs:label ?label_en FILTER(LANG(?label_en) = "en") }
  OPTIONAL { ?item rdfs:label ?label_el FILTER(LANG(?label_el) = "el") }
  OPTIONAL { ?item rdfs:label ?label_ru FILTER(LANG(?label_ru) = "ru") }
  OPTIONAL { ?item schema:description ?desc_en FILTER(LANG(?desc_en) = "en") }
  OPTIONAL { ?item wdt:P18 ?image }
  OPTIONAL { ?item wdt:P856 ?website }
  OPTIONAL { ?item wdt:P373 ?commonscat }
  OPTIONAL { ?item wdt:P6375 ?address FILTER(LANG(?address) = "en") }
  ${wiki('en')} ${wiki('el')} ${wiki('ru')}
}`;
}

// ── Commons photo selection ────────────────────────────────────────────────

const ALLOWED_LICENSE = /^(cc0|public domain|pd|cc by(-sa)? [0-9.]+|cc by(-sa)?)/i;
/** Files that don't show the place itself (or can't serve as a photo of it). */
const NOT_A_PHOTO = /\b(map|karte|plan|diagram|drawing|sketch|engraving|lithograph|painting|logo|coat[ _]of[ _]arms|flag|stamp|coin|banknote|postcard|icon|scheme|reconstruction|model|inscription|text|signboard|sign|ticket)\b/i;
const HISTORICAL_HINT = /\b(old photograph|historic(al)? photo|black[ _]and[ _]white|19th|early 20th|vintage|archive|1[89]\d\d)\b/i;

export interface CommonsFile {
  title: string;
  url: string;
  width: number;
  height: number;
  mime: string;
  license: string;
  artist: string;
  year: number | null;
  categories: string;
  description: string;
}

function yearOf(dateTimeOriginal: string | undefined): number | null {
  const m = (dateTimeOriginal ?? '').match(/\b(1[89]\d\d|20\d\d)\b/);
  return m ? Number(m[1]) : null;
}

/** Score files and split into current (main + gallery) and historical. Exported for tests. */
export function selectPhotos(files: CommonsFile[], preferred: string | null, max = 6, nowYear = new Date().getFullYear()): ImageDTO[] {
  const usable = files.filter((f) => /^image\/(jpeg|png|webp)$/.test(f.mime) && ALLOWED_LICENSE.test(f.license.trim()) && !NOT_A_PHOTO.test(`${f.title} ${f.description}`)
    && f.width >= 800 && f.height >= 500 && f.width / f.height <= 2.6 && f.width / f.height >= 0.55);
  const isHistorical = (f: CommonsFile) => (f.year !== null && f.year < 1990) || HISTORICAL_HINT.test(`${f.title} ${f.categories} ${f.description}`);
  const score = (f: CommonsFile) => {
    let s = Math.log2(Math.min(f.width, 4000) / 800); // resolution, saturating
    if (f.year !== null) s += f.year >= nowYear - 8 ? 3 : f.year >= nowYear - 15 ? 2 : f.year >= 2000 ? 1 : 0;
    const ratio = f.width / f.height;
    if (ratio >= 1.2 && ratio <= 1.9) s += 1; // landscape reads best on cards
    if (preferred && f.title === preferred) s += 0.5; // Wikidata's chosen image is a mild hint, not a guarantee
    return s;
  };
  const current = usable.filter((f) => !isHistorical(f)).sort((a, b) => score(b) - score(a));
  const historical = usable.filter(isHistorical).sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
  const toDTO = (f: CommonsFile, kind: 'current' | 'historical'): ImageDTO => ({
    url: f.url, kind, year: f.year, width: f.width, height: f.height, license: f.license,
    attribution: `${f.artist || 'Unknown author'} · ${f.license} · Wikimedia Commons`,
    source: `https://commons.wikimedia.org/wiki/${encodeURIComponent(f.title.replace(/ /g, '_'))}`,
  });
  return [...current.slice(0, max).map((f) => toDTO(f, 'current')), ...historical.slice(0, 3).map((f) => toDTO(f, 'historical'))];
}

/** Polite MediaWiki API call: identified UA (HttpClient), sequential, one retry honouring Retry-After on 429. */
async function mw<T>(ctx: ConnectorContext, url: string): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return (await ctx.http.json<T>(`${url}&maxlag=5`, { timeoutMs: 30_000 })).data;
    } catch (e) {
      if (e instanceof HttpError && e.status === 429 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 30_000));
        continue;
      }
      ctx.log.warn({ err: (e as Error).message }, 'mediawiki request failed');
      return null;
    }
  }
  return null;
}

interface ImageInfoPage { title: string; imageinfo?: Array<{ thumburl?: string; url: string; width: number; height: number; mime: string; extmetadata?: Record<string, { value: string }> }> }

async function commonsFiles(ctx: ConnectorContext, titles: string[]): Promise<CommonsFile[]> {
  const out: CommonsFile[] = [];
  for (let i = 0; i < titles.length; i += 40) {
    const batch = titles.slice(i, i + 40).map((t) => (t.startsWith('File:') ? t : `File:${t}`));
    const data = await mw<{ query?: { pages?: Record<string, ImageInfoPage> } }>(ctx,
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1600&titles=${encodeURIComponent(batch.join('|'))}`);
    for (const p of Object.values(data?.query?.pages ?? {})) {
      const info = p.imageinfo?.[0];
      if (!info) continue;
      const md = info.extmetadata ?? {};
      out.push({
        title: p.title, url: info.thumburl ?? info.url, width: info.width, height: info.height, mime: info.mime,
        license: md.LicenseShortName?.value ?? '', artist: htmlToText(md.Artist?.value ?? '').slice(0, 120),
        year: yearOf(md.DateTimeOriginal?.value), categories: md.Categories?.value ?? '', description: htmlToText(md.ImageDescription?.value ?? '').slice(0, 300),
      });
    }
  }
  return out;
}

async function wikipediaIntros(ctx: ConnectorContext, lang: string, titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < titles.length; i += 20) {
    const batch = titles.slice(i, i + 20);
    const data = await mw<{ query?: { pages?: Record<string, { title: string; extract?: string }>; redirects?: Array<{ from: string; to: string }> } }>(ctx,
      `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&exlimit=20&redirects=1&titles=${encodeURIComponent(batch.join('|'))}`);
    const redirects = new Map((data?.query?.redirects ?? []).map((r) => [r.to, r.from]));
    for (const p of Object.values(data?.query?.pages ?? {})) {
      const text = (p.extract ?? '').replace(/\n{2,}/g, '\n\n').trim();
      if (text.length > 80) out.set(redirects.get(p.title) ?? p.title, text.length > 1600 ? `${text.slice(0, 1600).replace(/\s+\S*$/, '')}…` : text);
    }
  }
  return out;
}

const articleUrl = (lang: string, title: string) => `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

type Item = Binding & { classes: string[]; images: ImageDTO[]; texts: Record<string, string> };

export const wikidataConnector: Connector = {
  id: 'wikidata',
  entityType: 'place',
  fullSnapshot: true,

  async *fetch(ctx): AsyncIterable<RawRecord> {
    const qid = (ctx.source.config.countryQid as string) ?? 'Q229';
    const maxImages = (ctx.source.config.maxImagesPerPlace as number) ?? 6;
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(buildWikidataQuery(qid))}`;
    const res = await ctx.http.json<{ results: { bindings: Binding[] } }>(url, { headers: { accept: 'application/sparql-results+json' }, timeoutMs: 90_000 });
    const byItem = new Map<string, Item>();
    for (const b of res.data?.results.bindings ?? []) {
      const id = b.item.value.split('/').pop()!;
      const prev = byItem.get(id);
      const cls = b.cls.value.split('/').pop()!;
      if (prev) { if (!prev.classes.includes(cls)) prev.classes.push(cls); }
      else byItem.set(id, { ...b, classes: [cls], images: [], texts: {} });
    }
    const items = [...byItem.entries()];

    // Wikipedia intros, batched per language.
    for (const lang of ['en', 'el', 'ru'] as const) {
      const key = `wiki_${lang}` as const;
      const titles = items.map(([, b]) => b[key]?.value).filter((t): t is string => !!t);
      const intros = await wikipediaIntros(ctx, lang, titles);
      for (const [, b] of items) {
        const t = b[key]?.value;
        if (t && intros.has(t)) b.texts[lang] = intros.get(t)!;
      }
    }

    // Photos: candidates from the Commons category + the Wikidata image, then quality/recency selection.
    for (const [, b] of items) {
      const preferred = b.image ? `File:${decodeURIComponent(b.image.value.split('/').pop()!).replace(/_/g, ' ')}` : null;
      const titles = new Set<string>(preferred ? [preferred] : []);
      if (b.commonscat) {
        const cat = await mw<{ query?: { categorymembers?: Array<{ title: string }> } }>(ctx,
          `https://commons.wikimedia.org/w/api.php?action=query&format=json&list=categorymembers&cmtype=file&cmlimit=40&cmtitle=${encodeURIComponent(`Category:${b.commonscat.value}`)}`);
        for (const m of cat?.query?.categorymembers ?? []) if (/\.(jpe?g|png|webp)$/i.test(m.title)) titles.add(m.title);
      }
      if (titles.size) b.images = selectPhotos(await commonsFiles(ctx, [...titles]), preferred, maxImages);
    }

    for (const [id, b] of items) yield { externalId: id, url: `https://www.wikidata.org/wiki/${id}`, payload: b };
  },

  normalize(raw): NormalizedPlace | null {
    const b = raw.payload as Item;
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
    const lang = b.texts.en ? 'en' : Object.keys(b.texts)[0];
    const wikiTitle = lang ? b[`wiki_${lang}` as 'wiki_en']?.value : undefined;
    return {
      kind: 'place',
      externalId: raw.externalId,
      name,
      nameI18n,
      description: b.texts.en ?? b.desc_en?.value ?? null,
      descriptionI18n: b.texts,
      aboutSource: lang && wikiTitle ? { name: 'Wikipedia', url: articleUrl(lang, wikiTitle), license: 'CC BY-SA 4.0', urls: Object.fromEntries(Object.keys(b.texts).map((l) => [l, articleUrl(l, b[`wiki_${l}` as 'wiki_en']!.value)])) } : null,
      categories,
      location: { lat: Number(m[2]), lng: Number(m[1]) },
      address: b.address?.value ?? null,
      cityHint: null,
      phone: null,
      website: b.website?.value ?? null,
      openingHours: null,
      isFree: null,
      wheelchair: null,
      status: 'active',
      images: b.images ?? [],
      externalIds: { wikidata: raw.externalId },
      sourceUrl: raw.url ?? null,
    };
  },
};
