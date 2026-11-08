import { cleanTitle, excerpt, localDate, localToUtc, normalizeZone, type ImageDTO } from '@passtra/core';
import { detectStatus } from '../classify';
import type { Connector, NormalizedEvent, RawRecord } from '../types';

/**
 * Ticketmaster Discovery API v2 (free key; 5000 calls/day, 5 rps, deep paging ≤ 1000 items).
 * Cyprus is not a Ticketmaster market, so coverage is expected to be small — verify after adding a key.
 * Config: { countryCode: "CY", size?: 200 }
 */
interface TmEvent {
  id: string;
  name: string;
  url?: string;
  info?: string;
  pleaseNote?: string;
  images?: Array<{ url: string; ratio?: string; width: number }>;
  dates?: { start?: { localDate?: string; localTime?: string; dateTime?: string; dateTBD?: boolean; timeTBA?: boolean; noSpecificTime?: boolean }; end?: { dateTime?: string }; timezone?: string; status?: { code?: string } };
  classifications?: Array<{ segment?: { name?: string }; genre?: { name?: string }; subGenre?: { name?: string } }>;
  priceRanges?: Array<{ min?: number; max?: number; currency?: string }>;
  ageRestrictions?: { legalAgeEnforced?: boolean };
  promoter?: { name?: string };
  _embedded?: { venues?: Array<{ name?: string; address?: { line1?: string }; city?: { name?: string }; location?: { latitude?: string; longitude?: string } }> };
}

const STATUS: Record<string, NormalizedEvent['status']> = { cancelled: 'cancelled', canceled: 'cancelled', postponed: 'postponed', rescheduled: 'rescheduled' };

export const ticketmasterConnector: Connector = {
  id: 'ticketmaster',
  entityType: 'event',
  fullSnapshot: true,
  requiresKey: 'TICKETMASTER_API_KEY',

  async *fetch(ctx): AsyncIterable<RawRecord> {
    const cc = (ctx.source.config.countryCode as string) ?? ctx.source.country_code ?? 'CY';
    const size = 200;
    const start = ctx.now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    for (let page = 0; page * size < 1000; page++) {
      const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${encodeURIComponent(ctx.config.TICKETMASTER_API_KEY!)}&countryCode=${cc}&size=${size}&page=${page}&sort=date,asc&startDateTime=${start}`;
      const res = await ctx.http.json<{ _embedded?: { events: TmEvent[] }; page?: { totalPages: number } }>(url, { timeoutMs: 30_000 });
      for (const e of res.data?._embedded?.events ?? []) yield { externalId: e.id, url: e.url ?? null, payload: e };
      if (page + 1 >= (res.data?.page?.totalPages ?? 0)) break;
    }
  },

  normalize(raw): NormalizedEvent | null {
    const e = raw.payload as TmEvent;
    const s = e.dates?.start;
    if (!e.name || !s?.localDate || s.dateTBD) return null;
    const tz = normalizeZone(e.dates?.timezone);
    const exact = !!s.localTime && !s.timeTBA && !s.noSpecificTime;
    const startsAt = exact ? (s.dateTime ? new Date(s.dateTime) : localToUtc(`${s.localDate} ${s.localTime}`, tz).utc) : localToUtc(`${s.localDate} 00:00`, tz).utc;
    const endsAt = exact && e.dates?.end?.dateTime ? new Date(e.dates.end.dateTime) : null;
    const v = e._embedded?.venues?.[0];
    const lat = Number(v?.location?.latitude);
    const lng = Number(v?.location?.longitude);
    const pr = e.priceRanges?.[0];
    const img = [...(e.images ?? [])].filter((i) => i.ratio === '16_9').sort((a, b) => b.width - a.width)[0];
    const images: ImageDTO[] = img ? [{ url: img.url, source: 'ticketmaster', attribution: 'Ticketmaster' }] : [];
    const labels = (e.classifications ?? []).flatMap((c) => [c.segment?.name, c.genre?.name, c.subGenre?.name]).filter((x): x is string => !!x && x !== 'Undefined');
    const title = cleanTitle(e.name);
    return {
      kind: 'event',
      externalId: raw.externalId,
      title,
      description: e.info ? excerpt(e.info, 600) : null,
      categories: [],
      sourceLabels: labels,
      venueName: v?.name ?? null,
      address: v?.address?.line1 ?? null,
      cityHint: v?.city?.name ?? null,
      location: Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 ? { lat, lng } : null,
      timezone: tz,
      startsAt,
      endsAt: endsAt && endsAt > startsAt ? endsAt : null,
      timePrecision: exact ? 'exact' : 'date_only',
      localStartDate: exact ? localDate(startsAt, tz) : s.localDate,
      localEndDate: endsAt ? localDate(endsAt, tz) : null,
      price: pr && (pr.min !== undefined || pr.max !== undefined)
        ? { isFree: pr.max === 0 ? true : false, min: pr.min ?? null, max: pr.max ?? null, currency: pr.currency ?? null, confident: true, text: '' }
        : null,
      ticketUrl: e.url ?? null,
      website: null,
      organizerName: e.promoter?.name ?? null,
      organizerUrl: null,
      ageMin: e.ageRestrictions?.legalAgeEnforced ? 18 : null,
      images,
      status: STATUS[e.dates?.status?.code ?? ''] ?? detectStatus(title) ?? 'scheduled',
      sourceUrl: e.url ?? null,
      externalIds: { ticketmaster: raw.externalId },
    };
  },
};
