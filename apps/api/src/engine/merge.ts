import { createHash } from 'node:crypto';
import {
  CATEGORY_BY_SLUG, CITIES, CRITICAL_EVENT_FIELDS, EVENT_AUTO_MERGE, EVENT_REVIEW, PLACE_AUTO_MERGE, PLACE_REVIEW,
  canonicalKey, cityBySlug, computeConfidence, countryByCode, eventMatchScore, getCategory, haversineKm, isInsideBbox,
  localDate, localToUtc, nameSimilarity, placeMatchScore, resolveField, searchDocument, type FieldObservation, type FieldResolution, type ImageDTO,
} from '@passtra/core';
import type pg from 'pg';
import type { Geocoder } from '../lib/geocode';
import { cityFromHint, cityFromLocation, classifyEvent, primaryPlaceCategory } from './classify';
import type { Logger, NormalizedEvent, NormalizedPlace, SourceRow } from './types';

export type EntityType = 'event' | 'place';
export type IngestOutcome = 'created' | 'updated' | 'unchanged' | 'merged' | 'skipped';

export interface MergeDeps {
  client: pg.PoolClient;
  source: SourceRow;
  geocoder: Geocoder;
  log: Logger;
  now: Date;
}

const stable = (v: unknown): string =>
  JSON.stringify(v, (_k, val) => (val instanceof Date ? val.toISOString() : val && typeof val === 'object' && !Array.isArray(val) ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b))) : val));

export const contentHash = (v: unknown) => createHash('sha256').update(stable(v)).digest('hex');

const cityIdCache = new Map<string, number>();
async function cityId(client: pg.PoolClient, slug: string | null | undefined): Promise<number | null> {
  if (!slug) return null;
  if (cityIdCache.has(slug)) return cityIdCache.get(slug)!;
  const r = await client.query<{ id: number }>('SELECT id FROM cities WHERE slug = $1', [slug]);
  if (r.rows[0]) cityIdCache.set(slug, r.rows[0].id);
  return r.rows[0]?.id ?? null;
}

// ── Enrichment ──────────────────────────────────────────────────────────────

interface EventEnrichment {
  primary: string;
  categories: string[];
  location: { lat: number; lng: number } | null;
  precision: 'exact' | 'approximate' | 'city' | 'unknown';
  citySlug: string | null;
  placeId: string | null;
  notes: string[];
  geocodeConflict: { hint: string; found: { lat: number; lng: number }; label: string } | null;
}

async function matchVenue(client: pg.PoolClient, venue: string, citySlug: string | null): Promise<{ id: string; lat: number; lng: number } | null> {
  const city = citySlug ? cityBySlug(citySlug) : null;
  const r = await client.query<{ id: string; name: string; lat: number; lng: number }>(
    `SELECT id, name, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
       FROM places
      WHERE merged_into IS NULL AND status <> 'hidden'
        AND word_similarity($1, search_doc) > 0.5
        AND ($2::float8 IS NULL OR ST_DWithin(location, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography, $4))
      ORDER BY word_similarity($1, search_doc) DESC
      LIMIT 8`,
    [canonicalKey(venue), city?.lat ?? null, city?.lng ?? null, (city?.radiusKm ?? 10) * 2000],
  );
  const best = r.rows.map((p) => ({ p, s: nameSimilarity(venue, p.name) })).sort((a, b) => b.s - a.s)[0];
  return best && best.s >= 0.75 ? best.p : null;
}

async function enrichEvent(d: MergeDeps, n: NormalizedEvent): Promise<EventEnrichment> {
  const { primary, categories } = classifyEvent(n.title, n.sourceLabels, n.categories);
  const notes: string[] = [];
  const hintCity = cityFromHint(n.cityHint) ?? cityFromHint(n.address) ?? cityFromHint(n.venueName);
  const country = countryByCode(d.source.country_code ?? 'CY');
  let location = n.location;
  let precision: EventEnrichment['precision'] = location ? 'exact' : 'unknown';
  let placeId: string | null = null;
  let geocodeConflict: EventEnrichment['geocodeConflict'] = null;

  if (n.venueName) {
    const venue = await matchVenue(d.client, n.venueName, hintCity?.slug ?? null);
    if (venue) {
      placeId = venue.id;
      if (!location) {
        location = { lat: venue.lat, lng: venue.lng };
        precision = 'exact';
      }
    }
  }
  if (!location && (n.venueName || n.address)) {
    const queries = [
      n.venueName && hintCity ? `${n.venueName}, ${hintCity.name.en}` : null,
      n.venueName,
      n.address && hintCity ? `${n.address}, ${hintCity.name.en}` : null,
    ].filter((q): q is string => !!q);
    for (const q of [...new Set(queries)]) {
      const g = await d.geocoder.geocode(q, country?.code ?? 'CY');
      if (g && (!country || isInsideBbox(country, g.lat, g.lng))) {
        // A geocode far from the city the source states is contradictory evidence (e.g. a club named after
        // another town). Never pick one side automatically: keep the source's city and flag it for review.
        if (hintCity && haversineKm(g, hintCity) > Math.max(15, hintCity.radiusKm * 2)) {
          geocodeConflict = { hint: hintCity.slug, found: { lat: g.lat, lng: g.lng }, label: g.label };
          break;
        }
        location = { lat: g.lat, lng: g.lng };
        precision = 'approximate';
        notes.push(`geocoded:${q}`);
        break;
      }
    }
  }
  const locCity = location ? cityFromLocation(location.lat, location.lng) : null;
  if (location && hintCity && haversineKm(location, hintCity) > Math.max(15, hintCity.radiusKm * 2)) {
    notes.push(`city_hint_mismatch:${hintCity.slug}->${locCity?.slug ?? 'unknown'}`);
  }
  if (!location && hintCity) {
    location = { lat: hintCity.lat, lng: hintCity.lng };
    precision = 'city';
  }
  return { primary, categories, location, precision, citySlug: (precision === 'city' ? hintCity?.slug : locCity?.slug ?? hintCity?.slug) ?? null, placeId, notes, geocodeConflict };
}

// ── Observations ────────────────────────────────────────────────────────────

async function writeObservations(client: pg.PoolClient, type: EntityType, entityId: string, sourceId: number, recordId: number | null, fields: Record<string, unknown>): Promise<void> {
  const names = Object.keys(fields);
  const values = names.map((k) => JSON.stringify(fields[k] === undefined ? null : fields[k]));
  await client.query(
    `INSERT INTO field_observations (entity_type, entity_id, field, source_id, source_record_id, value)
     SELECT $1, $2, f, $3, $4, v::jsonb FROM unnest($5::text[], $6::text[]) AS t(f, v)
     ON CONFLICT (entity_type, entity_id, field, source_id) DO UPDATE SET
       observed_at = CASE WHEN field_observations.value IS DISTINCT FROM EXCLUDED.value THEN now() ELSE field_observations.observed_at END,
       value = EXCLUDED.value, last_seen_at = now(), source_record_id = EXCLUDED.source_record_id`,
    [type, entityId, sourceId, recordId, names, values],
  );
}

interface ObsRow {
  field: string;
  value: unknown;
  source_id: number;
  source_key: string;
  source_name: string;
  authority: number;
  is_official: boolean;
  last_seen_at: Date;
}

async function loadObservations(client: pg.PoolClient, type: EntityType, id: string): Promise<Map<string, FieldObservation[]> & { rows: ObsRow[] }> {
  const r = await client.query<ObsRow>(
    `SELECT o.field, o.value, o.source_id, s.key AS source_key, s.name AS source_name, s.authority::float8 AS authority, s.is_official, o.last_seen_at
       FROM field_observations o JOIN sources s ON s.id = o.source_id
      WHERE o.entity_type = $1 AND o.entity_id = $2`,
    [type, id],
  );
  const map = new Map<string, FieldObservation[]>() as Map<string, FieldObservation[]> & { rows: ObsRow[] };
  map.rows = r.rows;
  for (const row of r.rows) {
    const list = map.get(row.field) ?? [];
    list.push({ sourceId: row.source_id, sourceKey: row.source_key, authority: row.authority, value: row.value, lastSeenAt: row.last_seen_at });
    map.set(row.field, list);
  }
  return map;
}

function display(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object' && v && 'lat' in v && 'lng' in v) {
    const p = v as { lat: number; lng: number };
    return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
  }
  return typeof v === 'string' ? v : JSON.stringify(v);
}

async function syncConflicts(client: pg.PoolClient, type: EntityType, id: string, resolutions: Map<string, FieldResolution>, sourceKeys: Map<number, string>, critical: readonly string[]): Promise<Array<{ field: string; critical: boolean }>> {
  const open: Array<{ field: string; critical: boolean }> = [];
  const tracked = type === 'event' ? EVENT_CONFLICT_FIELDS : PLACE_CONFLICT_FIELDS;
  for (const [field, res] of resolutions) {
    if (tracked.has(field) && (res.decision === 'conflict' || res.decision === 'authority')) {
      const status = res.decision === 'conflict' ? 'open' : 'auto_resolved';
      const isCritical = critical.includes(field);
      const candidates = res.candidates.map((c) => ({ value: c.value, display: display(c.value), sourceIds: c.sourceIds, sources: c.sourceIds.map((s) => sourceKeys.get(s) ?? String(s)), authority: c.authority }));
      await client.query(
        `INSERT INTO data_conflicts (entity_type, entity_id, field, critical, candidates, status)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (entity_type, entity_id, field) WHERE status IN ('open','auto_resolved')
         DO UPDATE SET candidates = EXCLUDED.candidates, status = EXCLUDED.status, critical = EXCLUDED.critical, updated_at = now()`,
        [type, id, field, isCritical, JSON.stringify(candidates), status],
      );
      if (status === 'open') open.push({ field, critical: isCritical });
    } else {
      await client.query(
        `UPDATE data_conflicts SET status = 'resolved', resolution = '{"reason":"sources_agree"}', resolved_at = now(), updated_at = now()
          WHERE entity_type = $1 AND entity_id = $2 AND field = $3 AND status IN ('open','auto_resolved')`,
        [type, id, field],
      );
    }
  }
  return open;
}

function unionArrays(obs: FieldObservation[] | undefined, byAuthority = true): unknown[] {
  const sorted = [...(obs ?? [])].sort((a, b) => (byAuthority ? b.authority - a.authority : 0) || a.sourceId - b.sourceId);
  const out: unknown[] = [];
  const seen = new Set<string>();
  for (const o of sorted) for (const v of (Array.isArray(o.value) ? o.value : [])) {
    const k = JSON.stringify(v);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(v);
    }
  }
  return out;
}

function unionObjects(obs: FieldObservation[] | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const o of [...(obs ?? [])].sort((a, b) => a.authority - b.authority)) Object.assign(out, (o.value as object) ?? {});
  return out;
}

/** Fields where a disagreement between sources is meaningful and must be surfaced. Others (titles, descriptions,
 *  URLs, venue spellings) legitimately differ between sources and are resolved by authority silently. */
const EVENT_CONFLICT_FIELDS = new Set(['starts_at', 'ends_at', 'local_start_date', 'local_end_date', 'location', 'status', 'is_free', 'price_min', 'price_max']);
const PLACE_CONFLICT_FIELDS = new Set(['location', 'status', 'is_free']);

/** Keys of the internal sources used for moderator edits. Their values are manual locks that override sources. */
export const ADMIN_SOURCE_KEYS = { event: 'passtra_admin_events', place: 'passtra_admin_places' } as const;

/** Like resolveField, but a moderator's value (admin source) always wins and closes the conflict. */
function resolveWithOverride(field: string, list: FieldObservation[]): FieldResolution {
  const manual = list.filter((o) => o.sourceKey.startsWith('passtra_admin') && o.value !== null);
  if (manual.length) {
    const m = manual[0]!;
    return { value: m.value, sourceId: m.sourceId, decision: 'single', agreeingSources: list.filter((o) => JSON.stringify(o.value) === JSON.stringify(m.value)).length, candidates: [] };
  }
  return resolveField(field, list);
}

// ── Event recompute ─────────────────────────────────────────────────────────

const EVENT_RESOLVED_FIELDS = ['title', 'description', 'venue_name', 'address', 'location', 'timezone', 'starts_at', 'ends_at', 'local_start_date', 'local_end_date',
  'is_free', 'price_min', 'price_max', 'currency', 'price_text', 'ticket_url', 'website', 'organizer_name', 'organizer_url', 'age_min', 'place_id'] as const;

export async function recomputeEvent(client: pg.PoolClient, id: string, now: Date): Promise<void> {
  const obs = await loadObservations(client, 'event', id);
  if (!obs.rows.length) return;
  const sourceKeys = new Map(obs.rows.map((r) => [r.source_id, r.source_key]));
  const res = new Map<string, FieldResolution>();
  for (const f of EVENT_RESOLVED_FIELDS) if (obs.get(f) && f !== 'location') res.set(f, resolveWithOverride(f, obs.get(f)!));
  // Exact coordinates outrank geocoded ones; a geocode never "conflicts" with a venue's real position.
  const precisionBySource = new Map((obs.get('location_precision') ?? []).map((o) => [o.sourceId, o.value as string]));
  const locObs = (obs.get('location') ?? []).filter((o) => o.value !== null);
  const exactLoc = locObs.filter((o) => precisionBySource.get(o.sourceId) === 'exact' || o.sourceKey.startsWith('passtra_admin'));
  if (locObs.length) res.set('location', resolveWithOverride('location', exactLoc.length ? exactLoc : locObs));
  const v = (f: string) => res.get(f)?.value ?? null;

  // Status: an authoritative cancellation/postponement wins; otherwise normal resolution.
  const statusObs = obs.get('status') ?? [];
  const manualStatus = statusObs.find((o) => o.sourceKey.startsWith('passtra_admin') && o.value !== null);
  const strongStop = manualStatus ?? statusObs.filter((o) => (o.value === 'cancelled' || o.value === 'postponed') && o.authority >= 0.85).sort((a, b) => b.authority - a.authority)[0];
  const statusRes = resolveWithOverride('status', statusObs);
  if (!strongStop) res.set('status', statusRes);
  const status = (strongStop?.value as string) ?? (statusRes.value as string) ?? 'scheduled';

  const tz = (v('timezone') as string) ?? 'Europe/Nicosia';
  const exactStart = v('starts_at') as string | null;
  const timePrecision: 'exact' | 'date_only' = exactStart ? 'exact' : 'date_only';
  const localStart = exactStart ? localDate(new Date(exactStart), tz) : (v('local_start_date') as string);
  const startsAt = exactStart ? new Date(exactStart) : localToUtc(`${localStart} 00:00`, tz).utc;
  let endsAt = v('ends_at') ? new Date(v('ends_at') as string) : null;
  if (endsAt && endsAt <= startsAt) endsAt = null;
  let localEnd = (v('local_end_date') as string | null) ?? (endsAt ? localDate(endsAt, tz) : null);
  if (localEnd && localEnd < localStart) localEnd = null;

  // Location precision and city follow the source whose location won.
  const locWinner = res.get('location')?.sourceId;
  const precisionObs = (obs.get('location_precision') ?? []).find((o) => o.sourceId === locWinner);
  const cityObs = (obs.get('city_slug') ?? []).find((o) => o.sourceId === locWinner && o.value) ?? resolveField('city_slug', obs.get('city_slug') ?? []);
  const citySlug = ((cityObs as { value: unknown }).value as string | null) ?? null;
  let loc = v('location') as { lat: number; lng: number } | null;
  let locPrecision: string = loc ? (precisionObs?.value as string) ?? 'approximate' : 'unknown';
  if (!loc && citySlug && cityBySlug(citySlug)) {
    const c = cityBySlug(citySlug)!;
    loc = { lat: c.lat, lng: c.lng };
    locPrecision = 'city';
  }
  // With real coordinates the city follows the coordinates, not a source's free-text city.
  const finalCity = (loc && locPrecision !== 'city' ? cityFromLocation(loc.lat, loc.lng)?.slug : null) ?? citySlug;

  const categories = unionArrays(obs.get('categories')) as string[];
  const primaryObs = resolveWithOverride('primary_category', obs.get('primary_category') ?? []);
  const primary = (primaryObs.value as string) ?? categories[0] ?? 'community-event';
  const images = unionArrays(obs.get('images')).slice(0, 6);
  const externalIds = unionObjects(obs.get('external_ids'));

  const openConflicts = await syncConflicts(client, 'event', id, res, sourceKeys, CRITICAL_EVENT_FIELDS);
  const external = await client.query<{ field: string; critical: boolean }>(
    `SELECT field, critical FROM data_conflicts WHERE entity_type = 'event' AND entity_id = $1 AND status = 'open' AND NOT (field = ANY($2::text[]))`,
    [id, [...EVENT_CONFLICT_FIELDS]],
  );
  openConflicts.push(...external.rows);
  const ev = await client.query<{ organizer_confirmed: boolean }>('SELECT organizer_confirmed FROM events WHERE id = $1', [id]);
  const bySource = new Map<number, { authority: number; isOfficial: boolean; lastSeenAt: Date }>();
  for (const r of obs.rows) {
    const prev = bySource.get(r.source_id);
    if (!prev || r.last_seen_at > prev.lastSeenAt) bySource.set(r.source_id, { authority: r.authority, isOfficial: r.is_official, lastSeenAt: r.last_seen_at });
  }
  const conf = computeConfidence({
    sources: [...bySource].map(([sourceId, s]) => ({ sourceId, ...s })),
    agreementCount: Math.max(res.get('local_start_date')?.agreeingSources ?? 1, res.get('starts_at')?.agreeingSources ?? 0),
    hasOfficialPage: !!(v('website') || v('ticket_url')),
    organizerConfirmed: ev.rows[0]?.organizer_confirmed ?? false,
    openConflicts,
    startsAt,
    now,
  });
  const fieldSources: Record<string, unknown> = {};
  for (const [f, r] of res) fieldSources[f] = { source: r.sourceId !== null ? sourceKeys.get(r.sourceId) : null, decision: r.decision, agreeing: r.agreeingSources };
  const lastVerified = new Date(Math.max(...obs.rows.map((r) => r.last_seen_at.getTime())));
  const catLabels = categories.flatMap((s) => Object.values(getCategory(s)?.label ?? {}));
  const city = finalCity ? cityBySlug(finalCity) : null;

  await client.query(
    `UPDATE events SET
       title=$2, description=$3, primary_category=$4, categories=$5, place_id=$6, venue_name=$7, address=$8,
       city_id=(SELECT id FROM cities WHERE slug=$9),
       location = CASE WHEN $10::float8 IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint($11, $10), 4326)::geography END,
       location_precision=$12, timezone=$13, starts_at=$14, ends_at=$15, time_precision=$16, time_unconfirmed=$17,
       local_start_date=$18, local_end_date=$19, is_free=$20, price_min=$21, price_max=$22, currency=$23, price_text=$24,
       ticket_url=$25, website=$26, organizer_name=$27, organizer_url=$28, age_min=$29, images=$30, status=$31,
       verification_status=$32, confidence=$33, field_sources=$34, source_count=$35, external_ids=$36,
       last_verified_at=$37, search_doc=$38, updated_at=now()
     WHERE id=$1`,
    [
      id, v('title'), v('description'), CATEGORY_BY_SLUG.has(primary) ? primary : 'community-event', categories.filter((s) => CATEGORY_BY_SLUG.has(s)),
      v('place_id'), v('venue_name'), v('address'), finalCity, loc?.lat ?? null, loc?.lng ?? null,
      locPrecision, tz, startsAt, endsAt, timePrecision,
      res.get('starts_at')?.decision === 'conflict' || res.get('local_start_date')?.decision === 'conflict',
      localStart, localEnd, v('is_free'), v('price_min'), v('price_max'), v('currency'), v('price_text'),
      v('ticket_url'), v('website'), v('organizer_name'), v('organizer_url'), v('age_min') ?? getCategory(primary)?.ageMin ?? null,
      JSON.stringify(images), status, conf.status, conf.score, JSON.stringify(fieldSources), bySource.size, JSON.stringify(externalIds),
      lastVerified, searchDocument(v('title') as string, v('venue_name') as string, v('organizer_name') as string, city?.name.en, city?.name.el, city?.name.ru, ...catLabels),
    ],
  );
}

// ── Place recompute ─────────────────────────────────────────────────────────

const PLACE_RESOLVED_FIELDS = ['name', 'description', 'location', 'address', 'phone', 'website', 'opening_hours', 'is_free', 'wheelchair', 'status'] as const;

export async function recomputePlace(client: pg.PoolClient, id: string, now: Date): Promise<void> {
  const obs = await loadObservations(client, 'place', id);
  if (!obs.rows.length) return;
  const sourceKeys = new Map(obs.rows.map((r) => [r.source_id, r.source_key]));
  const res = new Map<string, FieldResolution>();
  for (const f of PLACE_RESOLVED_FIELDS) if (obs.get(f)) res.set(f, resolveWithOverride(f, obs.get(f)!));
  const v = (f: string) => res.get(f)?.value ?? null;
  const categories = (unionArrays(obs.get('categories')) as string[]).filter((s) => CATEGORY_BY_SLUG.has(s));
  const primary = primaryPlaceCategory(categories) ?? categories[0]!;
  const loc = v('location') as { lat: number; lng: number };
  const nameI18n = unionObjects(obs.get('name_i18n'));
  const images = orderPlaceImages(unionArrays(obs.get('images')) as ImageDTO[]);
  const externalIds = unionObjects(obs.get('external_ids'));
  const city = cityFromLocation(loc.lat, loc.lng);
  // Long-form text comes as one block from one source, so the language map and its attribution stay together.
  const aboutObs = [...(obs.get('description_i18n') ?? [])].filter((o) => o.value && typeof o.value === 'object').sort((a, b) => b.authority - a.authority)[0];
  const aboutSource = aboutObs ? (obs.get('about_source') ?? []).find((o) => o.sourceId === aboutObs.sourceId)?.value ?? null : null;
  const openConflicts = await syncConflicts(client, 'place', id, res, sourceKeys, ['location', 'status']);
  const bySource = new Map<number, { authority: number; isOfficial: boolean; lastSeenAt: Date }>();
  for (const r of obs.rows) {
    const prev = bySource.get(r.source_id);
    if (!prev || r.last_seen_at > prev.lastSeenAt) bySource.set(r.source_id, { authority: r.authority, isOfficial: r.is_official, lastSeenAt: r.last_seen_at });
  }
  const conf = computeConfidence({
    sources: [...bySource].map(([sourceId, s]) => ({ sourceId, ...s })),
    agreementCount: res.get('location')?.agreeingSources ?? 1,
    hasOfficialPage: !!v('website'),
    organizerConfirmed: false,
    openConflicts,
    now,
  });
  const fieldSources: Record<string, unknown> = {};
  for (const [f, r] of res) fieldSources[f] = { source: r.sourceId !== null ? sourceKeys.get(r.sourceId) : null, decision: r.decision, agreeing: r.agreeingSources };
  const catLabels = categories.flatMap((s) => Object.values(getCategory(s)?.label ?? {}));
  await client.query(
    `UPDATE places SET name=$2, name_i18n=$3, description=$4, primary_category=$5, categories=$6,
       location=ST_SetSRID(ST_MakePoint($8, $7), 4326)::geography, address=$9, city_id=(SELECT id FROM cities WHERE slug=$10),
       phone=$11, website=$12, opening_hours=$13, wheelchair=$14, status=$15, images=$16, external_ids=$17,
       confidence=$18, verification_status=$19, field_sources=$20, source_count=$21, last_verified_at=$22, search_doc=$23,
       age_min=$24, is_free=$25, description_i18n=$26, about_source=$27, updated_at=now()
     WHERE id=$1`,
    [
      id, v('name'), JSON.stringify(nameI18n), v('description'), primary, categories, loc.lat, loc.lng, v('address'), city?.slug ?? null,
      v('phone'), v('website'), v('opening_hours') ? JSON.stringify(v('opening_hours')) : null, v('wheelchair'), (v('status') as string) ?? 'active',
      JSON.stringify(images), JSON.stringify(externalIds), conf.score, conf.status, JSON.stringify(fieldSources), bySource.size,
      new Date(Math.max(...obs.rows.map((r) => r.last_seen_at.getTime()))),
      searchDocument(v('name') as string, ...Object.values(nameI18n).map(String), v('address') as string, city?.name.en, ...catLabels),
      Math.max(0, ...categories.map((s) => getCategory(s)?.ageMin ?? 0)) || null,
      v('is_free'),
      JSON.stringify(aboutObs?.value ?? {}), aboutSource ? JSON.stringify(aboutSource) : null,
    ],
  );
}

/** Current photos first (the first one is the cover), historical photos after them in their own small group. */
export function orderPlaceImages(images: ImageDTO[]): ImageDTO[] {
  const current = images.filter((i) => i.kind !== 'historical').slice(0, 6);
  const historical = images.filter((i) => i.kind === 'historical').slice(0, 3);
  return [...current, ...historical];
}

// ── Matching ────────────────────────────────────────────────────────────────

async function followMerged(client: pg.PoolClient, type: EntityType, id: string): Promise<string> {
  const table = type === 'event' ? 'events' : 'places';
  let cur = id;
  for (let i = 0; i < 5; i++) {
    const r = await client.query<{ merged_into: string | null }>(`SELECT merged_into FROM ${table} WHERE id = $1`, [cur]);
    const next = r.rows[0]?.merged_into;
    if (!next) return cur;
    cur = next;
  }
  return cur;
}

async function recordDuplicateCandidate(client: pg.PoolClient, type: EntityType, a: string, b: string, score: number, reasons: string[]): Promise<void> {
  const [x, y] = a < b ? [a, b] : [b, a];
  await client.query(
    `INSERT INTO duplicate_candidates (entity_type, a_id, b_id, score, reasons) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (entity_type, a_id, b_id) DO UPDATE SET score = EXCLUDED.score, reasons = EXCLUDED.reasons`,
    [type, x, y, score, JSON.stringify(reasons)],
  );
}

async function findEventMatch(d: MergeDeps, n: NormalizedEvent, e: EventEnrichment): Promise<{ id: string | null; review: Array<{ id: string; score: number; reasons: string[] }> }> {
  for (const [k, val] of Object.entries(n.externalIds)) {
    const r = await d.client.query<{ id: string }>(`SELECT id FROM events WHERE merged_into IS NULL AND external_ids @> $1::jsonb LIMIT 1`, [JSON.stringify({ [k]: val })]);
    if (r.rows[0]) return { id: r.rows[0].id, review: [] };
  }
  const cityRow = await cityId(d.client, e.citySlug);
  const r = await d.client.query<{ id: string; title: string; starts_at: Date; time_precision: 'exact' | 'date_only'; local_start_date: string; venue_name: string | null; lat: number | null; lng: number | null; location_precision: string; city_slug: string | null; same_source: boolean }>(
    `SELECT e.id, e.title, e.starts_at, e.time_precision, e.local_start_date, e.venue_name,
            ST_Y(e.location::geometry) AS lat, ST_X(e.location::geometry) AS lng, e.location_precision, c.slug AS city_slug,
            EXISTS (SELECT 1 FROM source_records sr WHERE sr.entity_type='event' AND sr.entity_id=e.id AND sr.source_id=$6) AS same_source
       FROM events e LEFT JOIN cities c ON c.id = e.city_id
      WHERE e.merged_into IS NULL AND e.archived_at IS NULL
        AND e.local_start_date BETWEEN $1::date - 1 AND $1::date + 1
        AND ( ($2::float8 IS NOT NULL AND e.location IS NOT NULL AND ST_DWithin(e.location, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography, 5000))
              OR ($4::int IS NOT NULL AND e.city_id = $4) OR word_similarity($5, e.search_doc) > 0.45 )
      LIMIT 60`,
    [n.localStartDate, e.location?.lat ?? null, e.location?.lng ?? null, cityRow, canonicalKey(n.title), d.source.id],
  );
  let best: { id: string; score: number; reasons: string[]; sameSource: boolean } | null = null;
  const review: Array<{ id: string; score: number; reasons: string[] }> = [];
  for (const c of r.rows) {
    const m = eventMatchScore(
      { title: n.title, startsAt: n.startsAt, timePrecision: n.timePrecision, localStartDate: n.localStartDate, location: e.location, locationPrecision: e.precision, venueName: n.venueName, citySlug: e.citySlug },
      { title: c.title, startsAt: c.starts_at, timePrecision: c.time_precision, localStartDate: c.local_start_date, location: c.lat !== null && c.lng !== null ? { lat: c.lat, lng: c.lng } : null, locationPrecision: c.location_precision as 'exact', venueName: c.venue_name, citySlug: c.city_slug },
    );
    if (m.score >= EVENT_REVIEW) review.push({ id: c.id, score: m.score, reasons: m.reasons });
    if (!best || m.score > best.score) best = { id: c.id, ...m, sameSource: c.same_source };
  }
  // A source never duplicates itself: separate listings from one source are separate events (e.g. two performances).
  if (best && best.score >= EVENT_AUTO_MERGE && !best.sameSource) return { id: best.id, review: review.filter((x) => x.id !== best!.id) };
  return { id: null, review };
}

async function findPlaceMatch(d: MergeDeps, n: NormalizedPlace, primary: string): Promise<{ id: string | null; review: Array<{ id: string; score: number; reasons: string[] }> }> {
  for (const [k, val] of Object.entries(n.externalIds)) {
    const r = await d.client.query<{ id: string }>(`SELECT id FROM places WHERE merged_into IS NULL AND external_ids @> $1::jsonb LIMIT 1`, [JSON.stringify({ [k]: val })]);
    if (r.rows[0]) return { id: r.rows[0].id, review: [] };
  }
  const r = await d.client.query<{ id: string; name: string; lat: number; lng: number; website: string | null; phone: string | null; primary_category: string; external_ids: Record<string, string>; same_source: boolean }>(
    `SELECT p.id, p.name, ST_Y(p.location::geometry) AS lat, ST_X(p.location::geometry) AS lng, p.website, p.phone, p.primary_category, p.external_ids,
            EXISTS (SELECT 1 FROM source_records sr WHERE sr.entity_type='place' AND sr.entity_id=p.id AND sr.source_id=$4) AS same_source
       FROM places p
      WHERE p.merged_into IS NULL AND ST_DWithin(p.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, 300)
        AND (word_similarity($3, p.search_doc) > 0.3 OR ST_DWithin(p.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, 30))
      LIMIT 40`,
    [n.location.lat, n.location.lng, canonicalKey(n.name), d.source.id],
  );
  let best: { id: string; score: number; sameSource: boolean } | null = null;
  const review: Array<{ id: string; score: number; reasons: string[] }> = [];
  for (const c of r.rows) {
    const m = placeMatchScore(
      { name: n.name, location: n.location, externalIds: n.externalIds, website: n.website, phone: n.phone, primaryCategory: primary },
      { name: c.name, location: { lat: c.lat, lng: c.lng }, externalIds: c.external_ids, website: c.website, phone: c.phone, primaryCategory: c.primary_category },
    );
    if (m.score >= PLACE_REVIEW && !c.same_source) review.push({ id: c.id, score: m.score, reasons: m.reasons });
    if (!c.same_source && (!best || m.score > best.score)) best = { id: c.id, score: m.score, sameSource: c.same_source };
  }
  if (best && best.score >= PLACE_AUTO_MERGE) return { id: best.id, review: review.filter((x) => x.id !== best!.id) };
  return { id: null, review };
}

// ── Ingest one record ───────────────────────────────────────────────────────

async function upsertSourceRecord(d: MergeDeps, type: EntityType, externalId: string, url: string | null, payload: unknown, normalized: unknown): Promise<{ id: number; entityId: string | null; changed: boolean; wasMissing: boolean }> {
  const hash = contentHash(normalized);
  const prev = await d.client.query<{ id: number; entity_id: string | null; content_hash: string; missing_runs: number }>(
    'SELECT id, entity_id, content_hash, missing_runs FROM source_records WHERE source_id = $1 AND external_id = $2 FOR UPDATE',
    [d.source.id, externalId],
  );
  const p = prev.rows[0];
  if (!p) {
    const ins = await d.client.query<{ id: number }>(
      `INSERT INTO source_records (source_id, external_id, entity_type, url, payload, normalized, content_hash) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [d.source.id, externalId, type, url, JSON.stringify(payload), stable(normalized), hash],
    );
    return { id: ins.rows[0]!.id, entityId: null, changed: true, wasMissing: false };
  }
  const changed = p.content_hash !== hash;
  await d.client.query(
    `UPDATE source_records SET last_seen_at = now(), missing_runs = 0, missing_since = NULL, url = $2,
       payload = CASE WHEN $3 THEN $4::jsonb ELSE payload END, normalized = CASE WHEN $3 THEN $5::jsonb ELSE normalized END,
       content_hash = $6, last_changed_at = CASE WHEN $3 THEN now() ELSE last_changed_at END
     WHERE id = $1`,
    [p.id, url, changed, JSON.stringify(payload), stable(normalized), hash],
  );
  return { id: p.id, entityId: p.entity_id, changed, wasMissing: p.missing_runs > 0 };
}

/** Write moderator values for an entity and recompute it. */
export async function applyManualFields(client: pg.PoolClient, type: EntityType, id: string, fields: Record<string, unknown>, now: Date): Promise<void> {
  const src = await client.query<{ id: number }>('SELECT id FROM sources WHERE key = $1', [ADMIN_SOURCE_KEYS[type]]);
  if (!src.rows[0]) throw new Error('Admin source missing — run db:sources');
  await writeObservations(client, type, id, src.rows[0].id, null, fields);
  if (type === 'event') await recomputeEvent(client, id, now);
  else await recomputePlace(client, id, now);
}

/** Merge duplicate `dropId` into `keepId`: provenance, saves, reviews and interactions move over; old ids redirect. */
export async function mergeEntities(client: pg.PoolClient, type: EntityType, keepId: string, dropId: string, now: Date): Promise<void> {
  const table = type === 'event' ? 'events' : 'places';
  await client.query('UPDATE source_records SET entity_id = $2 WHERE entity_type = $1 AND entity_id = $3', [type, keepId, dropId]);
  await client.query(
    `DELETE FROM field_observations d USING field_observations k
      WHERE d.entity_type = $1 AND d.entity_id = $3 AND k.entity_type = $1 AND k.entity_id = $2 AND k.field = d.field AND k.source_id = d.source_id AND k.last_seen_at >= d.last_seen_at`,
    [type, keepId, dropId],
  );
  await client.query(
    `DELETE FROM field_observations k USING field_observations d
      WHERE k.entity_type = $1 AND k.entity_id = $2 AND d.entity_type = $1 AND d.entity_id = $3 AND k.field = d.field AND k.source_id = d.source_id`,
    [type, keepId, dropId],
  );
  await client.query('UPDATE field_observations SET entity_id = $2 WHERE entity_type = $1 AND entity_id = $3', [type, keepId, dropId]);
  for (const t of ['saved_items', 'reviews']) {
    await client.query(`DELETE FROM ${t} d WHERE d.entity_type = $1 AND d.entity_id = $3 AND EXISTS (SELECT 1 FROM ${t} k WHERE k.user_id = d.user_id AND k.entity_type = $1 AND k.entity_id = $2)`, [type, keepId, dropId]);
    await client.query(`UPDATE ${t} SET entity_id = $2 WHERE entity_type = $1 AND entity_id = $3`, [type, keepId, dropId]);
  }
  await client.query('UPDATE user_interactions SET entity_id = $2 WHERE entity_type = $1 AND entity_id = $3', [type, keepId, dropId]);
  await client.query('UPDATE reports SET entity_id = $2 WHERE entity_type = $1 AND entity_id = $3', [type, keepId, dropId]);
  if (type === 'place') await client.query('UPDATE events SET place_id = $1 WHERE place_id = $2', [keepId, dropId]);
  await client.query(`UPDATE data_conflicts SET status = 'dismissed', updated_at = now() WHERE entity_type = $1 AND entity_id = $2 AND status IN ('open','auto_resolved')`, [type, dropId]);
  await client.query(`UPDATE ${table} SET merged_into = $1, updated_at = now() WHERE id = $2`, [keepId, dropId]);
  await client.query(`UPDATE duplicate_candidates SET status = 'merged', reviewed_at = now() WHERE entity_type = $1 AND ((a_id = $2 AND b_id = $3) OR (a_id = $3 AND b_id = $2))`, [type, keepId, dropId]);
  if (type === 'event') await recomputeEvent(client, keepId, now);
  else await recomputePlace(client, keepId, now);
}

export async function ingestEvent(d: MergeDeps, raw: { url?: string | null; payload: unknown }, n: NormalizedEvent): Promise<IngestOutcome> {
  const rec = await upsertSourceRecord(d, 'event', n.externalId, raw.url ?? null, raw.payload, n);
  let entityId = rec.entityId ? await followMerged(d.client, 'event', rec.entityId) : null;
  if (entityId && !rec.changed) {
    await d.client.query('UPDATE field_observations SET last_seen_at = now() WHERE source_record_id = $1', [rec.id]);
    if (rec.wasMissing) await recomputeEvent(d.client, entityId, d.now);
    else await d.client.query('UPDATE events SET last_verified_at = now() WHERE id = $1', [entityId]);
    return 'unchanged';
  }

  const e = await enrichEvent(d, n);
  let outcome: IngestOutcome = entityId ? 'updated' : 'created';
  if (!entityId) {
    const match = await findEventMatch(d, n, e);
    if (match.id) {
      entityId = match.id;
      outcome = 'merged';
    } else {
      const ins = await d.client.query<{ id: string }>(
        `INSERT INTO events (title, primary_category, categories, country_code, timezone, starts_at, time_precision, local_start_date, is_demo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false) RETURNING id`,
        [n.title, e.primary, e.categories, d.source.country_code ?? 'CY', n.timezone, n.startsAt, n.timePrecision, n.localStartDate],
      );
      entityId = ins.rows[0]!.id;
    }
    for (const r of match.review) await recordDuplicateCandidate(d.client, 'event', entityId, r.id, r.score, r.reasons);
    await d.client.query('UPDATE source_records SET entity_id = $2 WHERE id = $1', [rec.id, entityId]);
  }

  if (e.notes.some((x) => x.startsWith('city_hint_mismatch'))) {
    const note = e.notes.find((x) => x.startsWith('city_hint_mismatch'))!;
    const [, pair] = note.split(':');
    const [hint, actual] = pair!.split('->');
    await d.client.query(
      `INSERT INTO data_conflicts (entity_type, entity_id, field, critical, candidates, status) VALUES ('event', $1, 'city', false, $2, 'auto_resolved')
       ON CONFLICT (entity_type, entity_id, field) WHERE status IN ('open','auto_resolved') DO UPDATE SET candidates = EXCLUDED.candidates, updated_at = now()`,
      [entityId, JSON.stringify([
        { value: hint, display: `${cityBySlug(hint!)?.name.en ?? hint} (source text)`, sources: [d.source.key] },
        { value: actual, display: `${cityBySlug(actual!)?.name.en ?? actual} (venue location)`, sources: ['geocoder'] },
      ])],
    );
  }

  if (e.geocodeConflict) {
    const gc = e.geocodeConflict;
    await d.client.query(
      `INSERT INTO data_conflicts (entity_type, entity_id, field, critical, candidates, status) VALUES ('event', $1, 'city', true, $2, 'open')
       ON CONFLICT (entity_type, entity_id, field) WHERE status IN ('open','auto_resolved') DO UPDATE SET candidates = EXCLUDED.candidates, critical = true, status = 'open', updated_at = now()`,
      [entityId, JSON.stringify([
        { value: gc.hint, display: `${cityBySlug(gc.hint)?.name.en ?? gc.hint} (source)`, sources: [d.source.key] },
        { value: gc.found, display: `${gc.label.split(',').slice(0, 3).join(',')} (geocoded venue name)`, sources: ['geocoder'] },
      ])],
    );
  }

  const exact = n.timePrecision === 'exact';
  await writeObservations(d.client, 'event', entityId, d.source.id, rec.id, {
    title: n.title,
    description: n.description,
    primary_category: e.primary,
    categories: e.categories,
    venue_name: n.venueName,
    address: n.address,
    city_slug: e.citySlug,
    // City-centre placeholders are not facts: only real (exact) or geocoded (approximate) coordinates are observations.
    location: e.precision === 'exact' || e.precision === 'approximate' ? e.location : null,
    location_precision: e.precision === 'exact' || e.precision === 'approximate' ? e.precision : null,
    place_id: e.placeId,
    timezone: n.timezone,
    starts_at: exact ? n.startsAt.toISOString() : null,
    ends_at: exact && n.endsAt ? n.endsAt.toISOString() : null,
    local_start_date: n.localStartDate,
    local_end_date: n.localEndDate,
    is_free: n.price?.isFree ?? null,
    price_min: n.price?.confident ? n.price.min : null,
    price_max: n.price?.confident ? n.price.max : null,
    currency: n.price?.confident && (n.price.min ?? n.price.max) !== null ? n.price.currency ?? 'EUR' : null,
    price_text: n.price && !n.price.confident && n.price.text ? n.price.text : null,
    ticket_url: n.ticketUrl,
    website: n.website,
    organizer_name: n.organizerName,
    organizer_url: n.organizerUrl,
    age_min: n.ageMin,
    images: n.images,
    status: n.status,
    external_ids: n.externalIds,
    source_url: n.sourceUrl,
  });
  await recomputeEvent(d.client, entityId, d.now);
  return outcome;
}

export async function ingestPlace(d: MergeDeps, raw: { url?: string | null; payload: unknown }, n: NormalizedPlace): Promise<IngestOutcome> {
  const rec = await upsertSourceRecord(d, 'place', n.externalId, raw.url ?? null, raw.payload, n);
  let entityId = rec.entityId ? await followMerged(d.client, 'place', rec.entityId) : null;
  if (entityId && !rec.changed) {
    await d.client.query('UPDATE field_observations SET last_seen_at = now() WHERE source_record_id = $1', [rec.id]);
    if (rec.wasMissing) await recomputePlace(d.client, entityId, d.now);
    else await d.client.query('UPDATE places SET last_verified_at = now() WHERE id = $1', [entityId]);
    return 'unchanged';
  }
  const primary = primaryPlaceCategory(n.categories);
  if (!primary) return 'skipped';
  let outcome: IngestOutcome = entityId ? 'updated' : 'created';
  if (!entityId) {
    const match = await findPlaceMatch(d, n, primary);
    if (match.id) {
      entityId = match.id;
      outcome = 'merged';
    } else {
      const ins = await d.client.query<{ id: string }>(
        `INSERT INTO places (name, primary_category, categories, location, country_code) VALUES ($1,$2,$3, ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography, $6) RETURNING id`,
        [n.name, primary, n.categories, n.location.lat, n.location.lng, d.source.country_code ?? 'CY'],
      );
      entityId = ins.rows[0]!.id;
    }
    for (const r of match.review) await recordDuplicateCandidate(d.client, 'place', entityId, r.id, r.score, r.reasons);
    await d.client.query('UPDATE source_records SET entity_id = $2 WHERE id = $1', [rec.id, entityId]);
  }
  await writeObservations(d.client, 'place', entityId, d.source.id, rec.id, {
    name: n.name,
    name_i18n: n.nameI18n,
    description: n.description,
    description_i18n: n.descriptionI18n && Object.keys(n.descriptionI18n).length ? n.descriptionI18n : null,
    about_source: n.aboutSource ?? null,
    categories: n.categories,
    location: n.location,
    address: n.address,
    phone: n.phone,
    website: n.website,
    opening_hours: n.openingHours,
    is_free: n.isFree,
    wheelchair: n.wheelchair,
    status: n.status,
    images: n.images,
    external_ids: n.externalIds,
    source_url: n.sourceUrl,
  });
  await recomputePlace(d.client, entityId, d.now);
  return outcome;
}

export { CITIES };
