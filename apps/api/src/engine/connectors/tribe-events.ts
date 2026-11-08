import { cleanTitle, decodeHtmlEntities, excerpt, htmlToText, localDate, localToUtc, normalizeZone, parsePrice, stripTrailingDate } from '@passtra/core';
import { DateTime } from 'luxon';
import { detectStatus } from '../classify';
import type { Connector, ConnectorContext, NormalizedEvent, RawRecord } from '../types';

/**
 * The Events Calendar (WordPress plugin) public REST API: /wp-json/tribe/events/v1/events.
 * Verified live on visitcyprus.com (Deputy Ministry of Tourism) on 2026-11-08.
 * Config: { baseUrl, perPage?, daysAhead?, allowImages? }
 */
interface TribeVenue {
  venue?: string;
  address?: string;
  city?: string;
  country?: string;
  geo_lat?: number | string | null;
  geo_lng?: number | string | null;
  website?: string;
}
interface TribeEvent {
  id: number;
  url: string;
  title: string;
  description?: string;
  excerpt?: string;
  all_day: boolean;
  start_date: string; // local wall time "YYYY-MM-DD HH:mm:ss"
  end_date: string;
  utc_start_date?: string;
  utc_end_date?: string;
  timezone?: string;
  cost?: string;
  website?: string;
  image?: { url?: string } | false;
  categories?: Array<{ name: string }>;
  tags?: Array<{ name: string }>;
  venue?: TribeVenue | unknown[];
  organizer?: Array<{ organizer?: string; website?: string }>;
  status?: string;
}
interface TribeResponse {
  events: TribeEvent[];
  total: number;
  total_pages: number;
}

/**
 * Source labels that are ambiguous for keyword classification, mapped explicitly.
 * Extend per source via `config.labelMap` (reviewed in the admin panel).
 */
export const DEFAULT_LABEL_MAP: Record<string, string> = {
  'Musical/opera': 'classical',
  Sailing: 'sports-event',
  'Angling/Fishing': 'sports-event',
  Running: 'sports-event',
  Swimming: 'sports-event',
  Tennis: 'sports-event',
};

const num = (v: unknown) => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

export const tribeEventsConnector: Connector = {
  id: 'tribe_events',
  entityType: 'event',
  fullSnapshot: true,

  async *fetch(ctx: ConnectorContext): AsyncIterable<RawRecord> {
    const cfg = ctx.source.config as { baseUrl: string; perPage?: number; daysAhead?: number };
    const tz = normalizeZone((ctx.source.config.timezone as string) ?? 'Europe/Nicosia');
    // Start yesterday so ongoing multi-day events stay in the snapshot.
    const start = DateTime.fromJSDate(ctx.now, { zone: tz }).minus({ days: 1 }).toISODate();
    const end = DateTime.fromJSDate(ctx.now, { zone: tz }).plus({ days: cfg.daysAhead ?? 180 }).toISODate();
    const perPage = Math.min(cfg.perPage ?? 50, 50);
    for (let page = 1; page <= 40; page++) {
      const url = `${cfg.baseUrl.replace(/\/$/, '')}/wp-json/tribe/events/v1/events?per_page=${perPage}&page=${page}&start_date=${start}&end_date=${end}`;
      const res = await ctx.http.json<TribeResponse>(url, { respectRobots: true });
      const data = res.data;
      if (!data?.events) break;
      for (const e of data.events) yield { externalId: String(e.id), url: e.url, payload: e };
      if (page >= (data.total_pages ?? 1)) break;
    }
  },

  normalize(raw, ctx): NormalizedEvent | null {
    const e = raw.payload as TribeEvent;
    if (!e?.title || !e.start_date) return null;
    const tz = normalizeZone(e.timezone ?? (ctx.source.config.timezone as string) ?? 'Europe/Nicosia');
    const title = stripTrailingDate(cleanTitle(e.title));
    const description = e.description ? excerpt(htmlToText(e.description), 600) : null;

    const startLocal = e.start_date.trim();
    const endLocal = e.end_date?.trim() ?? null;
    // "All day" flag, or 00:00 → 23:59:59 spans, mean the source gives dates only.
    const dateOnly = e.all_day || (/ 00:00:00$/.test(startLocal) && !!endLocal && / 23:59(:59)?$/.test(endLocal));
    const localStartDate = startLocal.slice(0, 10);
    const localEndDate = endLocal ? endLocal.slice(0, 10) : null;

    let startsAt: Date;
    let endsAt: Date | null = null;
    let timeAdjustment: NormalizedEvent['timeAdjustment'];
    if (dateOnly) {
      startsAt = localToUtc(`${localStartDate} 00:00`, tz).utc;
    } else {
      // Prefer the plugin's own UTC conversion; fall back to our DST-aware conversion.
      const conv = localToUtc(startLocal, tz);
      timeAdjustment = conv.adjustment;
      startsAt = e.utc_start_date ? new Date(`${e.utc_start_date.replace(' ', 'T')}Z`) : conv.utc;
      if (Number.isNaN(startsAt.getTime())) startsAt = conv.utc;
      if (endLocal) {
        const endUtc = e.utc_end_date ? new Date(`${e.utc_end_date.replace(' ', 'T')}Z`) : localToUtc(endLocal, tz).utc;
        if (!Number.isNaN(endUtc.getTime()) && endUtc.getTime() > startsAt.getTime()) endsAt = endUtc;
      }
    }

    const venue = Array.isArray(e.venue) ? null : (e.venue as TribeVenue | undefined) ?? null;
    const lat = num(venue?.geo_lat);
    const lng = num(venue?.geo_lng);
    const organizer = e.organizer?.[0];
    const cost = e.cost ? decodeHtmlEntities(e.cost) : null;
    const labels = [...(e.categories ?? []).map((c) => decodeHtmlEntities(c.name)), ...(e.tags ?? []).map((t) => decodeHtmlEntities(t.name))];
    const status = detectStatus(title) ?? 'scheduled';
    const labelMap = { ...DEFAULT_LABEL_MAP, ...((ctx.source.config.labelMap as Record<string, string>) ?? {}) };
    const mapped = [...new Set(labels.map((l) => labelMap[l]).filter((x): x is string => !!x))];
    const host = new URL(e.url).hostname.replace(/^www\./, '');
    const allowImages = ctx.source.config.allowImages === true;

    return {
      kind: 'event',
      externalId: raw.externalId,
      title,
      description,
      categories: mapped,
      sourceLabels: labels,
      venueName: venue?.venue ? cleanTitle(venue.venue) : null,
      address: venue?.address ? cleanTitle(venue.address) : null,
      cityHint: venue?.city ? cleanTitle(venue.city) : null,
      location: lat !== null && lng !== null ? { lat, lng } : null,
      timezone: tz,
      startsAt,
      endsAt,
      timePrecision: dateOnly ? 'date_only' : 'exact',
      localStartDate: dateOnly ? localStartDate : localDate(startsAt, tz),
      localEndDate: dateOnly ? (localEndDate && localEndDate !== localStartDate ? localEndDate : null) : endsAt ? localDate(endsAt, tz) : null,
      timeAdjustment,
      price: cost ? parsePrice(cost) : null,
      ticketUrl: null,
      website: e.website || null,
      organizerName: organizer?.organizer ? cleanTitle(organizer.organizer) : null,
      organizerUrl: organizer?.website || null,
      ageMin: null,
      images: allowImages && e.image && typeof e.image === 'object' && e.image.url ? [{ url: e.image.url, source: host, attribution: ctx.source.attribution ?? host }] : [],
      status,
      sourceUrl: e.url,
      externalIds: { [`tribe:${host}`]: raw.externalId },
    };
  },
};
