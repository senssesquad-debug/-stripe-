import {
  formatEventTime, formatPrice, getCategory, isHappeningNow, pickText, type CategoryRefDTO, type ConflictDTO, type EventDTO,
  type ImageDTO, type Locale, type LocalizedText, type LocationPrecision, type PlaceDTO, type SourceRefDTO, type TimeWindow,
} from '@passtra/core';
import { DateTime } from 'luxon';
import type pg from 'pg';
import type { Queryable } from '../db';
import { evaluateHours } from '../lib/hours';

// ── SQL building ───────────────────────────────────────────────────────────

export class Sql {
  params: unknown[] = [];
  where: string[] = [];
  add(v: unknown): string {
    this.params.push(v);
    return `$${this.params.length}`;
  }
}

export interface GeoFilter {
  lat: number;
  lng: number;
  radiusKm: number;
}

export const EVENT_COLUMNS = (dist: string) => `
  e.id, e.title, e.description, e.primary_category, e.categories, e.place_id, e.venue_name, e.address,
  c.slug AS city_slug, c.name AS city_name,
  ST_Y(e.location::geometry) AS lat, ST_X(e.location::geometry) AS lng, e.location_precision,
  e.user_rating_avg, e.user_rating_count, e.timezone, e.starts_at, e.ends_at, e.doors_at, e.time_precision, e.time_unconfirmed, e.local_start_date, e.local_end_date,
  e.is_free, e.price_min, e.price_max, e.currency, e.price_text, e.ticket_url, e.website, e.organizer_name, e.age_min,
  e.images, e.status, e.verification_status, e.confidence, e.last_verified_at, e.is_demo, e.popularity, e.source_count,
  ${dist} AS distance_km`;

export const PLACE_COLUMNS = (dist: string) => `
  p.id, p.name, p.name_i18n, p.description, p.primary_category, p.categories,
  ST_Y(p.location::geometry) AS lat, ST_X(p.location::geometry) AS lng, p.location_precision, p.address,
  c.slug AS city_slug, c.name AS city_name, c.timezone AS city_tz, p.phone, p.website, p.opening_hours, p.price_level, p.is_free,
  p.user_rating_avg, p.user_rating_count, p.age_min, p.status, p.images, p.verification_status, p.confidence,
  p.last_verified_at, p.external_ids, p.is_demo, p.popularity, p.source_count, p.description_i18n, p.about_source, p.tags, p.address_check,
  ${dist} AS distance_km`;

export function distanceExpr(q: Sql, alias: 'e' | 'p', geo: { lat: number; lng: number } | null): string {
  if (!geo) return 'NULL::float8';
  return `ST_Distance(${alias}.location, ST_SetSRID(ST_MakePoint(${q.add(geo.lng)}, ${q.add(geo.lat)}), 4326)::geography) / 1000.0`;
}

export function geoWhere(q: Sql, alias: 'e' | 'p', geo: GeoFilter | null): void {
  if (!geo) return;
  q.where.push(`${alias}.location IS NOT NULL AND ST_DWithin(${alias}.location, ST_SetSRID(ST_MakePoint(${q.add(geo.lng)}, ${q.add(geo.lat)}), 4326)::geography, ${q.add(geo.radiusKm * 1000)})`);
}

/** Upcoming = listed, not cancelled/postponed, not merged/archived, and not over yet. Past events never appear. */
export function upcomingWhere(q: Sql, now: Date): void {
  const n = q.add(now);
  q.where.push(`e.merged_into IS NULL AND e.archived_at IS NULL AND e.status IN ('scheduled','rescheduled')`);
  q.where.push(`(CASE WHEN e.time_precision = 'exact' THEN COALESCE(e.ends_at, e.starts_at + interval '3 hours') > ${n}
                ELSE ((COALESCE(e.local_end_date, e.local_start_date) + 1)::timestamp AT TIME ZONE e.timezone) > ${n} END)`);
}

export function windowWhere(q: Sql, w: TimeWindow, opts: { excludeMultiDay?: boolean } = {}): void {
  const s = q.add(w.start);
  const e = q.add(w.end);
  const sd = q.add(w.startDate);
  const ed = q.add(w.endDate);
  q.where.push(`(CASE WHEN e.time_precision = 'exact' THEN e.starts_at < ${e} AND COALESCE(e.ends_at, e.starts_at + interval '3 hours') > ${s}
                ELSE e.local_start_date <= ${ed}::date AND COALESCE(e.local_end_date, e.local_start_date) >= ${sd}::date END)`);
  if (opts.excludeMultiDay) q.where.push(`NOT (e.time_precision = 'date_only' AND COALESCE(e.local_end_date, e.local_start_date) > e.local_start_date)`);
}

export function categoriesWhere(q: Sql, alias: 'e' | 'p', cats: string[]): void {
  if (cats.length) q.where.push(`${alias}.categories && ${q.add(cats)}::text[]`);
}

export function keywordsWhere(q: Sql, alias: 'e' | 'p', keywords: string[], canonical: (s: string) => string): void {
  for (const k of keywords.slice(0, 4)) {
    const p = q.add(canonical(k));
    q.where.push(`(word_similarity(${p}, ${alias}.search_doc) > 0.55 OR ${alias}.search_doc LIKE '%' || ${p} || '%')`);
  }
}

// ── Row types ──────────────────────────────────────────────────────────────

export interface EventRow extends pg.QueryResultRow {
  doors_at: Date | null;
  user_rating_avg: number | null;
  user_rating_count: number;
  id: string; title: string; description: string | null; primary_category: string; categories: string[]; place_id: string | null;
  venue_name: string | null; address: string | null; city_slug: string | null; city_name: LocalizedText | null;
  lat: number | null; lng: number | null; location_precision: LocationPrecision;
  timezone: string; starts_at: Date; ends_at: Date | null; time_precision: 'exact' | 'date_only'; time_unconfirmed: boolean;
  local_start_date: string; local_end_date: string | null; is_free: boolean | null; price_min: number | null; price_max: number | null;
  currency: string | null; price_text: string | null; ticket_url: string | null; website: string | null; organizer_name: string | null;
  age_min: number | null; images: ImageDTO[]; status: EventDTO['status']; verification_status: EventDTO['verification']['status'];
  confidence: number; last_verified_at: Date | null; is_demo: boolean; popularity: number; source_count: number; distance_km: number | null;
}

export interface PlaceRow extends pg.QueryResultRow {
  id: string; name: string; name_i18n: Record<string, string>; description: string | null; primary_category: string; categories: string[];
  lat: number; lng: number; location_precision: PlaceDTO['location']['precision']; address: string | null; city_slug: string | null;
  city_name: LocalizedText | null; city_tz: string | null; phone: string | null; website: string | null;
  opening_hours: { format: 'osm'; value: string } | null; price_level: number | null; is_free: boolean | null;
  user_rating_avg: number | null; user_rating_count: number; age_min: number | null; status: PlaceDTO['status']; images: ImageDTO[];
  verification_status: PlaceDTO['verification']['status']; confidence: number; last_verified_at: Date | null;
  external_ids: Record<string, string>; is_demo: boolean; popularity: number; source_count: number; distance_km: number | null;
  tags: string[];
  address_check: { status: string; checkedAt: string } | null;
  description_i18n: Record<string, string> | null; about_source: { name: string; url: string | null; license: string | null; urls?: Record<string, string> } | null;
}

// ── DTO mapping ────────────────────────────────────────────────────────────

export function categoryRef(slug: string, locale: Locale): CategoryRefDTO {
  const c = getCategory(slug);
  return { slug, label: c ? pickText(c.label, locale) : slug, group: c?.group ?? 'other', icon: c?.icon ?? 'pin' };
}

const round = (n: number | null) => (n === null || n === undefined ? null : Math.round(n * 10) / 10);

/** All dates of a multi-day event (capped at 31), or null for a single day. */
function eventDays(start: string, end: string | null): string[] | null {
  if (!end || end <= start) return null;
  const out: string[] = [];
  for (let d = DateTime.fromISO(start, { zone: 'utc' }); d.toISODate()! <= end && out.length < 31; d = d.plus({ days: 1 })) out.push(d.toISODate()!);
  return out;
}

export function eventToDTO(r: EventRow, locale: Locale, now: Date, extra?: { sources?: SourceRefDTO[]; conflicts?: ConflictDTO[] }): EventDTO {
  const timing = { startsAt: r.starts_at, endsAt: r.ends_at, timePrecision: r.time_precision, timezone: r.timezone, localStartDate: r.local_start_date, localEndDate: r.local_end_date };
  const iso = (d: Date) => DateTime.fromJSDate(d, { zone: r.timezone }).toISO()!;
  const price = { isFree: r.is_free, min: r.price_min, max: r.price_max, currency: r.currency, text: r.price_text };
  return {
    type: 'event',
    id: r.id,
    title: r.title,
    description: r.description,
    category: categoryRef(r.primary_category, locale),
    categories: r.categories,
    venue: { name: r.venue_name, address: r.address, placeId: r.place_id },
    location: r.lat !== null && r.lng !== null ? { lat: r.lat, lng: r.lng, precision: r.location_precision } : null,
    city: r.city_slug ? { slug: r.city_slug, name: pickText(r.city_name ?? { en: r.city_slug }, locale) } : null,
    time: {
      startsAt: iso(r.starts_at),
      endsAt: r.ends_at ? iso(r.ends_at) : null,
      timezone: r.timezone,
      precision: r.time_precision,
      localStartDate: r.local_start_date,
      localEndDate: r.local_end_date,
      label: formatEventTime(timing, locale, now),
      doorsAt: r.doors_at && r.time_precision === 'exact' ? iso(r.doors_at) : null,
      durationMin: r.time_precision === 'exact' && r.ends_at ? Math.round((r.ends_at.getTime() - r.starts_at.getTime()) / 60_000) : null,
      days: eventDays(r.local_start_date, r.local_end_date),
      happeningNow: isHappeningNow(timing, now),
      unconfirmed: r.time_unconfirmed,
    },
    price: { ...price, label: formatPrice(price, locale) },
    ticketUrl: r.ticket_url,
    website: r.website,
    organizer: r.organizer_name,
    ageMin: r.age_min,
    status: r.status,
    images: r.images ?? [],
    distanceKm: round(r.distance_km),
    rating: r.user_rating_count > 0 && r.user_rating_avg !== null ? { average: Math.round(r.user_rating_avg * 10) / 10, count: r.user_rating_count, source: 'passtra' } : null,
    verification: {
      status: r.verification_status,
      confidence: r.confidence,
      lastVerifiedAt: r.last_verified_at?.toISOString() ?? null,
      sources: extra?.sources ?? [],
      conflicts: extra?.conflicts ?? [],
    },
    sponsored: false,
    isDemo: r.is_demo,
  };
}

export function placeToDTO(r: PlaceRow, locale: Locale, now: Date, extra?: { sources?: SourceRefDTO[]; conflicts?: ConflictDTO[] }): PlaceDTO {
  const tz = r.city_tz ?? 'Europe/Nicosia';
  const hours = evaluateHours(r.opening_hours?.value, now, tz, r.lat, r.lng, locale);
  const typicalFree = r.is_free === null && r.categories.some((s) => getCategory(s)?.usuallyFree);
  return {
    type: 'place',
    id: r.id,
    name: r.name_i18n?.[locale] ?? r.name,
    description: r.description,
    category: categoryRef(r.primary_category, locale),
    categories: r.categories,
    location: { lat: r.lat, lng: r.lng, precision: r.location_precision },
    address: r.address,
    city: r.city_slug ? { slug: r.city_slug, name: pickText(r.city_name ?? { en: r.city_slug }, locale) } : null,
    phone: r.phone,
    website: r.website,
    hours: { openNow: hours?.openNow ?? null, label: hours?.label ?? null, raw: hours?.raw ?? null, weekText: hours?.weekText ?? null },
    priceLevel: r.price_level,
    free: { isFree: r.is_free ?? (typicalFree ? true : null), basis: r.is_free !== null ? 'source' : typicalFree ? 'typical' : null },
    rating: r.user_rating_count > 0 && r.user_rating_avg !== null ? { average: Math.round(r.user_rating_avg * 10) / 10, count: r.user_rating_count, source: 'passtra' } : null,
    ageMin: r.age_min,
    status: r.status,
    images: r.images ?? [],
    distanceKm: round(r.distance_km),
    verification: {
      status: r.verification_status,
      confidence: r.confidence,
      lastVerifiedAt: r.last_verified_at?.toISOString() ?? null,
      sources: extra?.sources ?? [],
      conflicts: extra?.conflicts ?? [],
    },
    externalIds: r.external_ids ?? {},
    sponsored: false,
    isDemo: r.is_demo,
    about: aboutOf(r, locale),
    addressCheck: r.address_check ? { status: r.address_check.status as NonNullable<PlaceDTO['addressCheck']>['status'], checkedAt: r.address_check.checkedAt } : null,
  };
}

/** Long-form text in the user's language when the source has it, else English — always with its source and licence. */
function aboutOf(r: PlaceRow, locale: Locale): PlaceDTO['about'] {
  const texts = r.description_i18n ?? {};
  const lang = texts[locale] ? locale : texts.en ? 'en' : Object.keys(texts)[0];
  if (!lang || !texts[lang]) return null;
  const src = r.about_source;
  const url = src?.urls?.[lang] ?? (lang === 'en' ? src?.url ?? null : null);
  return { text: texts[lang]!, source: src?.name ?? 'Wikipedia', url, license: src?.license ?? null };
}

// ── Queries ────────────────────────────────────────────────────────────────

export async function queryEvents(db: Queryable, q: Sql, dist: string, orderBy: string, limit: number): Promise<EventRow[]> {
  const sql = `SELECT ${EVENT_COLUMNS(dist)} FROM events e LEFT JOIN cities c ON c.id = e.city_id
               ${q.where.length ? `WHERE ${q.where.join(' AND ')}` : ''} ORDER BY ${orderBy} LIMIT ${Math.min(500, limit)}`;
  return (await db.query<EventRow>(sql, q.params)).rows;
}

export async function queryPlaces(db: Queryable, q: Sql, dist: string, orderBy: string, limit: number): Promise<PlaceRow[]> {
  const sql = `SELECT ${PLACE_COLUMNS(dist)} FROM places p LEFT JOIN cities c ON c.id = p.city_id
               ${q.where.length ? `WHERE ${q.where.join(' AND ')}` : ''} ORDER BY ${orderBy} LIMIT ${Math.min(1000, limit)}`;
  return (await db.query<PlaceRow>(sql, q.params)).rows;
}

/** Sources and conflicts for a detail view: shows the user where every fact came from and when it was checked. */
export async function provenance(db: Queryable, type: 'event' | 'place', id: string): Promise<{ sources: SourceRefDTO[]; conflicts: ConflictDTO[] }> {
  const s = await db.query<{ key: string; name: string; url: string | null; homepage_url: string | null; is_official: boolean; attribution: string | null; last_seen_at: Date }>(
    `SELECT s.key, s.name, sr.url, s.homepage_url, s.is_official, s.attribution, MAX(sr.last_seen_at) AS last_seen_at
       FROM source_records sr JOIN sources s ON s.id = sr.source_id
      WHERE sr.entity_type = $1 AND sr.entity_id = $2 AND sr.missing_runs < 2
      GROUP BY s.key, s.name, sr.url, s.homepage_url, s.is_official, s.attribution
      ORDER BY MAX(sr.last_seen_at) DESC`,
    [type, id],
  );
  const c = await db.query<{ field: string; status: 'open' | 'auto_resolved'; candidates: Array<{ value: unknown; display: string; sources: string[] }> }>(
    `SELECT field, status, candidates FROM data_conflicts WHERE entity_type = $1 AND entity_id = $2 AND status IN ('open','auto_resolved') ORDER BY critical DESC, field`,
    [type, id],
  );
  const names = new Map((await db.query<{ key: string; name: string }>('SELECT key, name FROM sources')).rows.map((r) => [r.key, r.name]));
  names.set('geocoder', 'OpenStreetMap Nominatim (geocoder)');
  return {
    sources: s.rows.map((r) => ({ key: r.key, name: r.name, url: r.url ?? r.homepage_url, isOfficial: r.is_official, attribution: r.attribution, lastSeenAt: r.last_seen_at.toISOString() })),
    conflicts: c.rows.map((r) => ({ field: r.field, status: r.status, candidates: r.candidates.map((x) => ({ value: x.value, display: x.display, sources: x.sources.map((k) => names.get(k) ?? k) })) })),
  };
}

export async function getEventRow(db: Queryable, id: string, geo: { lat: number; lng: number } | null): Promise<EventRow | null> {
  const q = new Sql();
  const dist = distanceExpr(q, 'e', geo);
  q.where.push(`e.id = ${q.add(id)}`);
  return (await queryEvents(db, q, dist, 'e.id', 1))[0] ?? null;
}

export async function getPlaceRow(db: Queryable, id: string, geo: { lat: number; lng: number } | null): Promise<PlaceRow | null> {
  const q = new Sql();
  const dist = distanceExpr(q, 'p', geo);
  q.where.push(`p.id = ${q.add(id)}`);
  return (await queryPlaces(db, q, dist, 'p.id', 1))[0] ?? null;
}

/** Resolve merged ids so old links keep working after deduplication. */
export async function resolveMergedId(db: Queryable, type: 'event' | 'place', id: string): Promise<string> {
  const table = type === 'event' ? 'events' : 'places';
  let cur = id;
  for (let i = 0; i < 5; i++) {
    const r = await db.query<{ merged_into: string | null }>(`SELECT merged_into FROM ${table} WHERE id = $1`, [cur]);
    if (!r.rows[0]?.merged_into) return cur;
    cur = r.rows[0].merged_into;
  }
  return cur;
}
