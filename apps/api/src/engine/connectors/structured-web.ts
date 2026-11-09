import { cleanTitle, excerpt, htmlToText, localDate, localToUtc, normalizeZone, parsePrice, type ImageDTO, type ParsedPrice } from '@passtra/core';
import { detectStatus } from '../classify';
import type { Connector, ConnectorContext, NormalizedEvent, RawRecord } from '../types';

/**
 * Reads only machine-readable data that websites publish on purpose:
 *  - schema.org Event in JSON-LD (<script type="application/ld+json">)
 *  - iCalendar feeds (.ics)
 * Always honours robots.txt and Crawl-delay; no JavaScript execution, no logins, no CAPTCHA/WAF bypass.
 * The database refuses to enable these sources until a human recorded a terms-of-use review.
 */

// ── JSON-LD ────────────────────────────────────────────────────────────────

const EVENT_TYPES = /^(Event|MusicEvent|TheaterEvent|SportsEvent|Festival|ExhibitionEvent|ComedyEvent|DanceEvent|ChildrensEvent|FoodEvent|ScreeningEvent|SocialEvent|EducationEvent|LiteraryEvent|BusinessEvent|VisualArtsEvent)$/;

type Json = Record<string, unknown>;

export function extractJsonLdEvents(html: string): Json[] {
  const out: Json[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let data: unknown;
    try {
      data = JSON.parse(m[1]!.trim());
    } catch {
      continue;
    }
    const queue: unknown[] = Array.isArray(data) ? [...data] : [data];
    while (queue.length) {
      const node = queue.shift(); // breadth-first keeps document order
      if (!node || typeof node !== 'object') continue;
      const obj = node as Json;
      if (Array.isArray(obj['@graph'])) queue.push(...(obj['@graph'] as unknown[]));
      const types = ([] as unknown[]).concat(obj['@type'] ?? []).map(String);
      if (types.some((t) => EVENT_TYPES.test(t.replace(/^https?:\/\/schema\.org\//, '')))) out.push(obj);
      if (obj.itemListElement) queue.push(...([] as unknown[]).concat(obj.itemListElement).map((x) => (x as Json)?.item ?? x));
    }
  }
  return out;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

function firstImage(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return firstImage(v[0]);
  if (v && typeof v === 'object') return str((v as Json).url) ?? str((v as Json).contentUrl);
  return null;
}

/** Parse schema.org date strings into an instant + precision; local times use the source zone. */
export function parseSchemaDate(v: string, tz: string): { at: Date; precision: 'exact' | 'date_only'; localDate: string } | null {
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { at: localToUtc(`${s} 00:00`, tz).utc, precision: 'date_only', localDate: s };
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) {
    const at = new Date(s);
    return Number.isNaN(at.getTime()) ? null : { at, precision: 'exact', localDate: localDate(at, tz) };
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
    try {
      const at = localToUtc(s.slice(0, 16), tz).utc;
      return { at, precision: 'exact', localDate: localDate(at, tz) };
    } catch {
      return null;
    }
  }
  return null;
}

function offersPrice(offers: unknown): ParsedPrice | null {
  const list = ([] as unknown[]).concat(offers ?? []).filter((o) => o && typeof o === 'object') as Json[];
  if (!list.length) return null;
  const nums: number[] = [];
  let currency: string | null = null;
  for (const o of list) {
    for (const k of ['price', 'lowPrice', 'highPrice']) {
      const n = Number(o[k]);
      if (o[k] !== undefined && o[k] !== '' && Number.isFinite(n)) nums.push(n);
    }
    currency ??= str(o.priceCurrency);
  }
  if (!nums.length) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  return { isFree: max === 0, min, max, currency, confident: true, text: '' };
}

/** schema.org doorTime: a full date-time, or a time on the start day. Kept only if it is not after the start. */
function doorsOf(v: string | null, start: { at: Date; localDate: string; precision: string }, tz: string): Date | null {
  if (!v || start.precision !== 'exact') return null;
  const full = /\d{4}-\d{2}-\d{2}/.test(v) ? parseSchemaDate(v, tz) : parseSchemaDate(`${start.localDate}T${v.replace(/^T/, '')}`, tz);
  return full && full.precision === 'exact' && full.at <= start.at ? full.at : null;
}

export function normalizeJsonLdEvent(e: Json, pageUrl: string, tz: string, sourceKey: string): NormalizedEvent | null {
  const name = str(e.name);
  const start = str(e.startDate);
  if (!name || !start) return null;
  const s = parseSchemaDate(start, tz);
  if (!s) return null;
  const en = str(e.endDate) ? parseSchemaDate(str(e.endDate)!, tz) : null;
  const loc = (Array.isArray(e.location) ? e.location[0] : e.location) as Json | undefined;
  const addr = loc?.address;
  const address = typeof addr === 'string' ? addr : addr && typeof addr === 'object' ? [str((addr as Json).streetAddress), str((addr as Json).addressLocality)].filter(Boolean).join(', ') || null : null;
  const city = addr && typeof addr === 'object' ? str((addr as Json).addressLocality) : null;
  const geo = loc?.geo as Json | undefined;
  const lat = Number(geo?.latitude);
  const lng = Number(geo?.longitude);
  const statusUrl = str(e.eventStatus) ?? '';
  const title = cleanTitle(name);
  const status: NormalizedEvent['status'] = /Cancelled/i.test(statusUrl) ? 'cancelled' : /Postponed/i.test(statusUrl) ? 'postponed' : /Rescheduled/i.test(statusUrl) ? 'rescheduled' : detectStatus(title) ?? 'scheduled';
  if (/MovedOnline/i.test(statusUrl) || str((e as Json).eventAttendanceMode)?.includes('OnlineEventAttendanceMode')) return null;
  const organizer = (Array.isArray(e.organizer) ? e.organizer[0] : e.organizer) as Json | undefined;
  const offers = (Array.isArray(e.offers) ? e.offers[0] : e.offers) as Json | undefined;
  const url = str(e.url) ?? pageUrl;
  const img = firstImage(e.image);
  const images: ImageDTO[] = img ? [{ url: new URL(img, pageUrl).toString(), source: new URL(pageUrl).hostname, attribution: new URL(pageUrl).hostname }] : [];
  const dateOnly = s.precision === 'date_only';
  return {
    kind: 'event',
    externalId: str(e['@id']) ?? `${url}#${s.at.toISOString()}`,
    title,
    description: str(e.description) ? excerpt(htmlToText(str(e.description)!), 600) : null,
    categories: [],
    sourceLabels: ([] as unknown[]).concat(e['@type'] ?? []).map(String),
    venueName: str(loc?.name),
    address,
    cityHint: city,
    location: Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 ? { lat, lng } : null,
    timezone: tz,
    startsAt: s.at,
    endsAt: en && en.at > s.at && !dateOnly ? en.at : null,
    doorsAt: doorsOf(str(e.doorTime), s, tz),
    timePrecision: s.precision,
    localStartDate: s.localDate,
    localEndDate: en ? en.localDate : null,
    price: offersPrice(e.offers) ?? (str(e.isAccessibleForFree) === 'true' || e.isAccessibleForFree === true ? { isFree: true, min: 0, max: 0, currency: null, confident: true, text: '' } : null),
    ticketUrl: str(offers?.url),
    website: url,
    organizerName: str(organizer?.name),
    organizerUrl: str(organizer?.url),
    ageMin: Number(e.typicalAgeRange && String(e.typicalAgeRange).match(/^(\d+)\+/)?.[1]) || null,
    images,
    status,
    sourceUrl: pageUrl,
    externalIds: { [`web:${sourceKey}`]: str(e['@id']) ?? url },
  };
}

export const jsonLdConnector: Connector = {
  id: 'jsonld_events',
  entityType: 'event',
  fullSnapshot: false, // pages may paginate; absence is not a reliable signal
  async *fetch(ctx: ConnectorContext): AsyncIterable<RawRecord> {
    const cfg = ctx.source.config as { urls: string[]; linkPattern?: string; maxPages?: number };
    const seen = new Set<string>();
    const queue = [...(cfg.urls ?? [])];
    const linkRe = cfg.linkPattern ? new RegExp(cfg.linkPattern) : null;
    let pages = 0;
    while (queue.length && pages < (cfg.maxPages ?? 40)) {
      const url = queue.shift()!;
      if (seen.has(url)) continue;
      seen.add(url);
      pages++;
      const res = await ctx.http.request(url, { respectRobots: true, headers: { accept: 'text/html' } });
      const html = res.data ?? '';
      for (const ev of extractJsonLdEvents(html)) {
        const id = str(ev['@id']) ?? `${str(ev.url) ?? url}#${str(ev.startDate)}`;
        yield { externalId: id, url, payload: { event: ev, pageUrl: url } };
      }
      if (linkRe) {
        const origin = new URL(url).origin;
        for (const m of html.matchAll(/href=["']([^"'#]+)["']/g)) {
          try {
            const abs = new URL(m[1]!, url).toString();
            if (abs.startsWith(origin) && linkRe.test(abs) && !seen.has(abs)) queue.push(abs);
          } catch {
            /* ignore malformed links */
          }
        }
      }
    }
  },
  normalize(raw, ctx) {
    const { event, pageUrl } = raw.payload as { event: Json; pageUrl: string };
    const tz = normalizeZone((ctx.source.config.timezone as string) ?? 'Europe/Nicosia');
    return normalizeJsonLdEvent(event, pageUrl, tz, ctx.source.key);
  },
};

// ── iCalendar ──────────────────────────────────────────────────────────────

export interface IcsEvent {
  uid: string;
  props: Record<string, { value: string; params: Record<string, string> }>;
}

export function parseIcs(text: string): IcsEvent[] {
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const out: IcsEvent[] = [];
  let cur: IcsEvent | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') cur = { uid: '', props: {} };
    else if (line === 'END:VEVENT' && cur) {
      if (cur.uid) out.push(cur);
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(':');
      if (idx < 0) continue;
      const [nameAndParams, value] = [line.slice(0, idx), line.slice(idx + 1)];
      const [name, ...paramParts] = nameAndParams.split(';');
      const params: Record<string, string> = {};
      for (const p of paramParts) {
        const [k, v] = p.split('=');
        if (k && v) params[k.toUpperCase()] = v.replace(/^"|"$/g, '');
      }
      const unescaped = value.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
      cur.props[name!.toUpperCase()] = { value: unescaped, params };
      if (name!.toUpperCase() === 'UID') cur.uid = unescaped;
    }
  }
  return out;
}

function icsDate(p: { value: string; params: Record<string, string> } | undefined, fallbackTz: string): { at: Date; precision: 'exact' | 'date_only'; localDate: string; tz: string } | null {
  if (!p) return null;
  const v = p.value.trim();
  const tz = normalizeZone(p.params.TZID, fallbackTz);
  if (p.params.VALUE === 'DATE' || /^\d{8}$/.test(v)) {
    const d = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
    return { at: localToUtc(`${d} 00:00`, tz).utc, precision: 'date_only', localDate: d, tz };
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z?)$/);
  if (!m) return null;
  const local = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
  const at = m[7] === 'Z' ? new Date(`${local}:00Z`) : localToUtc(local, tz).utc;
  return { at, precision: 'exact', localDate: localDate(at, tz), tz };
}

export const icalConnector: Connector = {
  id: 'ical_feed',
  entityType: 'event',
  fullSnapshot: true,
  async *fetch(ctx): AsyncIterable<RawRecord> {
    for (const url of (ctx.source.config.urls as string[]) ?? []) {
      const res = await ctx.http.request(url, { respectRobots: true, headers: { accept: 'text/calendar' } });
      for (const ev of parseIcs(res.data ?? '')) yield { externalId: ev.uid, url, payload: ev };
    }
  },
  normalize(raw, ctx): NormalizedEvent | null {
    const ev = raw.payload as IcsEvent;
    if (ev.props.RRULE) return null; // recurring series are not expanded (avoid inventing occurrences)
    const fallbackTz = normalizeZone((ctx.source.config.timezone as string) ?? 'Europe/Nicosia');
    const s = icsDate(ev.props.DTSTART, fallbackTz);
    const title = ev.props.SUMMARY?.value ? cleanTitle(ev.props.SUMMARY.value) : null;
    if (!s || !title) return null;
    const e = icsDate(ev.props.DTEND, fallbackTz);
    const geo = ev.props.GEO?.value.split(/[;,]/).map(Number);
    const dateOnly = s.precision === 'date_only';
    // DTEND for all-day events is exclusive.
    const endDate = e && dateOnly ? new Date(Date.parse(`${e.localDate}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10) : e?.localDate ?? null;
    const status = ev.props.STATUS?.value === 'CANCELLED' ? 'cancelled' : detectStatus(title) ?? 'scheduled';
    return {
      kind: 'event',
      externalId: raw.externalId,
      title,
      description: ev.props.DESCRIPTION?.value ? excerpt(htmlToText(ev.props.DESCRIPTION.value), 600) : null,
      categories: [],
      sourceLabels: (ev.props.CATEGORIES?.value ?? '').split(',').filter(Boolean),
      venueName: ev.props.LOCATION?.value ?? null,
      address: null,
      cityHint: null,
      location: geo && geo.length === 2 && geo.every(Number.isFinite) ? { lat: geo[0]!, lng: geo[1]! } : null,
      timezone: s.tz,
      startsAt: s.at,
      endsAt: e && !dateOnly && e.at > s.at ? e.at : null,
      timePrecision: s.precision,
      localStartDate: s.localDate,
      localEndDate: endDate && endDate > s.localDate ? endDate : null,
      price: null,
      ticketUrl: null,
      website: ev.props.URL?.value ?? null,
      organizerName: ev.props.ORGANIZER?.params.CN ?? null,
      organizerUrl: null,
      ageMin: null,
      images: [],
      status,
      sourceUrl: raw.url ?? null,
      externalIds: { [`ics:${ctx.source.key}`]: raw.externalId },
    };
  },
};

export { parsePrice };
