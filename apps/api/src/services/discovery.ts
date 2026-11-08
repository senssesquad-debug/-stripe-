import {
  CATEGORIES, CITIES, GROUP_LABELS, buildAffinity, expandCategories, canonicalKey, categoriesInGroup, cityBySlug, explain, getCategory, haversineKm,
  isValidLatLng, localDate, pickText, planDay, rank, scoreCandidate, surprise, timeWindow, type AgeRange, type Budget, type Candidate, type CityDef,
  type EntityDTO, type EventDTO, type FeedResponse, type FeedSectionDTO, type FeedSectionKey, type InteractionKind, type InterestGroup,
  type Locale, type PlaceDTO, type PlanCandidate, type PlanDayResponse, type RecommendationDTO, type SearchFilters, type SearchResponse, type UserProfile,
} from '@passtra/core';
import { DateTime } from 'luxon';
import type pg from 'pg';
import { cityFromLocation } from '../engine/classify';
import type { HttpClient } from '../lib/http';
import { openIntervals } from '../lib/hours';
import { getWeather } from '../lib/weather';
import {
  Sql, categoriesWhere, distanceExpr, eventToDTO, geoWhere, keywordsWhere, placeToDTO, queryEvents, queryPlaces, upcomingWhere, windowWhere,
  type EventRow, type PlaceRow,
} from '../repo/entities';
import type { QueryInterpreter } from './ai';

// ── Context ────────────────────────────────────────────────────────────────

export interface DiscoveryContext {
  locale: Locale;
  now: Date;
  geo: { lat: number; lng: number } | null;
  radiusKm: number;
  city: CityDef | null;
  tz: string;
  usedLocation: boolean;
}

export function resolveContext(p: { lat?: number; lng?: number; city?: string; radiusKm?: number; locale: Locale }, now: Date): DiscoveryContext {
  if (p.lat !== undefined && p.lng !== undefined && isValidLatLng(p.lat, p.lng)) {
    const city = (p.city ? cityBySlug(p.city) : null) ?? cityFromLocation(p.lat, p.lng);
    return { locale: p.locale, now, geo: { lat: p.lat, lng: p.lng }, radiusKm: p.radiusKm ?? 10, city, tz: city?.timezone ?? 'Europe/Nicosia', usedLocation: true };
  }
  const city = p.city ? cityBySlug(p.city) ?? null : null;
  if (city) return { locale: p.locale, now, geo: { lat: city.lat, lng: city.lng }, radiusKm: p.radiusKm ?? city.radiusKm, city, tz: city.timezone, usedLocation: false };
  return { locale: p.locale, now, geo: null, radiusKm: p.radiusKm ?? 50, city: null, tz: 'Europe/Nicosia', usedLocation: false };
}

const geoFilter = (ctx: DiscoveryContext, radiusKm = ctx.radiusKm) => (ctx.geo ? { ...ctx.geo, radiusKm } : null);

// ── Profile ────────────────────────────────────────────────────────────────

export interface Profile extends UserProfile {
  personalization: boolean;
}

export async function loadProfile(db: pg.Pool, userId: string | null, overrides: { interests?: InterestGroup[]; budget?: Budget; ageRange?: AgeRange }): Promise<Profile> {
  const base: Profile = { interests: overrides.interests ?? [], affinity: {}, budget: overrides.budget ?? null, ageRange: overrides.ageRange ?? null, personalization: !!overrides.interests?.length, dismissed: new Set(), saved: new Set() };
  if (!userId) return base;
  const u = await db.query<{ interests: string[]; budget: Budget | null; age_range: AgeRange | null; personalization_enabled: boolean }>('SELECT interests, budget, age_range, personalization_enabled FROM users WHERE id = $1', [userId]);
  const row = u.rows[0];
  if (!row) return base;
  const profile: Profile = {
    ...base,
    interests: overrides.interests ?? (row.interests as InterestGroup[]),
    budget: overrides.budget ?? row.budget,
    ageRange: row.age_range,
    personalization: row.personalization_enabled,
  };
  const saved = await db.query<{ entity_id: string }>('SELECT entity_id FROM saved_items WHERE user_id = $1', [userId]);
  profile.saved = new Set(saved.rows.map((r) => r.entity_id));
  if (!row.personalization_enabled) return profile;
  const ints = await db.query<{ kind: InteractionKind; created_at: Date; entity_id: string; cats: string[] | null }>(
    `SELECT i.kind, i.created_at, i.entity_id, COALESCE(e.categories, p.categories) AS cats
       FROM user_interactions i
       LEFT JOIN events e ON i.entity_type = 'event' AND e.id = i.entity_id
       LEFT JOIN places p ON i.entity_type = 'place' AND p.id = i.entity_id
      WHERE i.user_id = $1 AND i.created_at > now() - interval '180 days' ORDER BY i.created_at DESC LIMIT 2000`,
    [userId],
  );
  profile.affinity = buildAffinity(ints.rows.filter((r) => r.cats).map((r) => ({ kind: r.kind, categories: r.cats!, at: r.created_at })), new Date());
  profile.dismissed = new Set(ints.rows.filter((r) => r.kind === 'dismiss' || r.kind === 'hide').map((r) => r.entity_id));
  return profile;
}

// ── Candidates ─────────────────────────────────────────────────────────────

export function eventCandidate(r: EventRow): Candidate {
  return {
    id: r.id, type: 'event', categories: r.categories.length ? r.categories : [r.primary_category], distanceKm: r.distance_km, popularity: r.popularity,
    isFree: r.is_free, priceMin: r.price_min, startsAt: r.starts_at, timePrecision: r.time_precision, timezone: r.timezone, ageMin: r.age_min,
    verificationStatus: r.verification_status,
  };
}

export function placeCandidate(r: PlaceRow, dto: PlaceDTO): Candidate {
  return {
    id: r.id, type: 'place', categories: r.categories.length ? r.categories : [r.primary_category], distanceKm: r.distance_km, popularity: r.popularity,
    rating: r.user_rating_avg, ratingCount: r.user_rating_count, isFree: r.is_free, priceLevel: r.price_level, openNow: dto.hours.openNow,
    ageMin: r.age_min, verificationStatus: r.verification_status,
  };
}

const PRACTICAL = CATEGORIES.filter((c) => c.group === 'practical').map((c) => c.slug);
/** Errands are searchable but don't belong in "things to do" sections of the Today feed. */
const ERRANDS = new Set(['supermarket', 'clothing-store', 'sports-store', 'electronics-store', 'beauty-salon', 'barbershop', 'gym', 'coworking', 'cycling']);
const LEISURE_PLACE_CATS = CATEGORIES.filter((c) => c.kind !== 'event' && c.group !== 'practical').map((c) => c.slug);
const FEED_PLACE_CATS = LEISURE_PLACE_CATS.filter((s) => !ERRANDS.has(s));

async function upcomingEvents(db: pg.Pool, ctx: DiscoveryContext, opts: { window?: ReturnType<typeof timeWindow>; excludeMultiDay?: boolean; categories?: string[]; free?: boolean; keywords?: string[]; radiusKm?: number; limit?: number; order?: string }): Promise<EventRow[]> {
  const q = new Sql();
  const dist = distanceExpr(q, 'e', ctx.geo);
  upcomingWhere(q, ctx.now);
  if (opts.window) windowWhere(q, opts.window, { excludeMultiDay: opts.excludeMultiDay });
  geoWhere(q, 'e', geoFilter(ctx, opts.radiusKm));
  categoriesWhere(q, 'e', opts.categories ?? []);
  if (opts.free) q.where.push('e.is_free = true');
  keywordsWhere(q, 'e', opts.keywords ?? [], canonicalKey);
  return queryEvents(db, q, dist, opts.order ?? (ctx.geo ? `e.starts_at, ${dist}` : 'e.starts_at'), opts.limit ?? 40);
}

async function nearbyPlaces(db: pg.Pool, ctx: DiscoveryContext, opts: { categories?: string[]; exclude?: string[]; radiusKm?: number; limit?: number; keywords?: string[]; free?: boolean; requireHours?: boolean; order?: string; extraWhere?: string[] }): Promise<PlaceRow[]> {
  const q = new Sql();
  const dist = distanceExpr(q, 'p', ctx.geo);
  q.where.push(`p.merged_into IS NULL AND p.status = 'active'`);
  geoWhere(q, 'p', geoFilter(ctx, opts.radiusKm));
  categoriesWhere(q, 'p', opts.categories ?? []);
  if (opts.exclude?.length) q.where.push(`NOT (p.primary_category = ANY(${q.add(opts.exclude)}::text[]))`);
  if (opts.free) q.where.push(`(p.is_free = true OR (p.is_free IS NULL AND p.primary_category = ANY(${q.add(CATEGORIES.filter((c) => c.usuallyFree).map((c) => c.slug))}::text[])))`);
  if (opts.requireHours) q.where.push('p.opening_hours IS NOT NULL');
  keywordsWhere(q, 'p', opts.keywords ?? [], canonicalKey);
  for (const w of opts.extraWhere ?? []) q.where.push(w);
  return queryPlaces(db, q, dist, opts.order ?? (ctx.geo ? dist : 'p.confidence DESC, p.name'), opts.limit ?? 200);
}

// ── Today feed ─────────────────────────────────────────────────────────────

const SECTION_TEXT: Record<FeedSectionKey, { title: Record<Locale, string>; subtitle?: Record<Locale, string> }> = {
  for_you: { title: { en: 'For you', el: 'Για εσάς', ru: 'Для вас' }, subtitle: { en: 'Picked from your interests', el: 'Με βάση τα ενδιαφέροντά σας', ru: 'По вашим интересам' } },
  happening_today: { title: { en: 'Happening today', el: 'Σήμερα', ru: 'Сегодня' } },
  right_now: { title: { en: 'Right now', el: 'Αυτή τη στιγμή', ru: 'Прямо сейчас' }, subtitle: { en: 'Open or on now', el: 'Ανοιχτά ή σε εξέλιξη', ru: 'Открыто или идёт сейчас' } },
  tonight: { title: { en: 'Tonight', el: 'Απόψε', ru: 'Сегодня вечером' } },
  this_weekend: { title: { en: 'This weekend', el: 'Αυτό το Σαββατοκύριακο', ru: 'На выходных' } },
  near_you: { title: { en: 'Near you', el: 'Κοντά σας', ru: 'Рядом с вами' } },
  free: { title: { en: 'Free things to do', el: 'Δωρεάν δραστηριότητες', ru: 'Бесплатно' } },
  hidden_gems: { title: { en: 'Hidden gems', el: 'Κρυμμένα διαμάντια', ru: 'Скрытые жемчужины' }, subtitle: { en: 'Notable spots away from the busiest areas', el: 'Αξιόλογα μέρη μακριά από τον συνωστισμό', ru: 'Интересные места вдали от толп' } },
  popular: { title: { en: 'Popular right now', el: 'Δημοφιλή τώρα', ru: 'Популярно сейчас' }, subtitle: { en: 'Based on what passtra users save and open', el: 'Με βάση τις αποθηκεύσεις χρηστών', ru: 'По сохранениям пользователей passtra' } },
};

const HUBS = CITIES.filter((c) => ['limassol', 'nicosia', 'larnaca', 'paphos', 'ayia-napa', 'protaras'].includes(c.slug));

function section(key: FeedSectionKey, locale: Locale, items: EntityDTO[]): FeedSectionDTO {
  const t = SECTION_TEXT[key];
  return { key, title: t.title[locale], subtitle: t.subtitle?.[locale] ?? null, items };
}

export interface FeedDeps {
  db: pg.Pool;
  http: HttpClient;
}

export async function buildFeed(deps: FeedDeps, ctx: DiscoveryContext, profile: Profile): Promise<FeedResponse> {
  const { db } = deps;
  const L = ctx.locale;
  const toE = (r: EventRow) => eventToDTO(r, L, ctx.now);
  const used = new Set<string>();
  const take = <T extends EntityDTO>(items: T[], n: number) => {
    const out: T[] = [];
    for (const it of items) {
      if (out.length >= n) break;
      if (used.has(it.id)) continue;
      out.push(it);
    }
    for (const it of out) used.add(it.id);
    return out;
  };
  const rankCtx = { now: ctx.now, tz: ctx.tz, radiusKm: ctx.radiusKm };

  const [today, tonight, weekend, freeEvents, places, weather] = await Promise.all([
    upcomingEvents(db, ctx, { window: timeWindow('today', ctx.now, ctx.tz), limit: 40 }),
    upcomingEvents(db, ctx, { window: timeWindow('tonight', ctx.now, ctx.tz), excludeMultiDay: true, limit: 30 }),
    upcomingEvents(db, ctx, { window: timeWindow('weekend', ctx.now, ctx.tz), limit: 40 }),
    upcomingEvents(db, ctx, { window: timeWindow('next_7_days', ctx.now, ctx.tz), free: true, limit: 30 }),
    nearbyPlaces(db, ctx, { categories: FEED_PLACE_CATS, limit: 600 }),
    ctx.geo ? getWeather(db, deps.http, ctx.geo.lat, ctx.geo.lng, L, ctx.now).catch(() => null) : Promise.resolve(null),
  ]);
  const placeDTOs = new Map(places.map((r) => [r.id, placeToDTO(r, L, ctx.now)]));
  const placeCands = places.map((r) => placeCandidate(r, placeDTOs.get(r.id)!));
  const sections: FeedSectionDTO[] = [];

  if (profile.interests.length || Object.keys(profile.affinity).length) {
    const evRows = [...today, ...weekend];
    const evMap = new Map(evRows.map((r) => [r.id, r]));
    const ranked = rank([...[...evMap.values()].map(eventCandidate), ...placeCands], profile, rankCtx, 10);
    const items = ranked.map((s) => (s.item.type === 'event' ? toE(evMap.get(s.item.id)!) : placeDTOs.get(s.item.id)!));
    if (items.length) sections.push(section('for_you', L, take(items, 10)));
  }

  // "Happening today": everything on today (incl. ongoing multi-day events).
  // "Right now": timed events in progress + places open now.
  const inProgress = today.filter((r) => r.time_precision === 'exact' && r.starts_at <= ctx.now);
  const openPlaces = rank(placeCands.filter((c) => c.openNow === true), profile, rankCtx, 48).map((s) => placeDTOs.get(s.item.id)!);
  sections.push(section('happening_today', L, take(today.filter((r) => !inProgress.includes(r)).map(toE), 12)));
  sections.push(section('right_now', L, take([...inProgress.map(toE), ...openPlaces], 12)));

  const nightPlaces = places.filter((r) => ['bar', 'pub', 'nightclub', 'live-music-venue', 'restaurant'].includes(r.primary_category));
  const tz = ctx.tz;
  const evening = DateTime.fromJSDate(ctx.now, { zone: tz }).set({ hour: 21, minute: 0 }).toJSDate();
  const openTonight = nightPlaces.filter((r) => {
    const ivs = openIntervals(r.opening_hours?.value, ctx.now > evening ? ctx.now : evening, new Date((ctx.now > evening ? ctx.now : evening).getTime() + 3 * 3_600_000), tz, r.lat, r.lng);
    return !!ivs?.length;
  });
  sections.push(section('tonight', L, take([...tonight.map(toE), ...rank(openTonight.map((r) => placeCandidate(r, placeDTOs.get(r.id)!)), profile, rankCtx, 40).map((s) => placeDTOs.get(s.item.id)!)].slice(0, 40), 12)));
  sections.push(section('this_weekend', L, take(weekend.map(toE), 12)));

  if (ctx.geo) {
    const near = places.filter((r) => (r.distance_km ?? 99) <= Math.min(ctx.radiusKm, 3) && !PRACTICAL.includes(r.primary_category));
    sections.push(section('near_you', L, take(rank(near.map((r) => placeCandidate(r, placeDTOs.get(r.id)!)), profile, { ...rankCtx, radiusKm: 3 }, 48).map((s) => placeDTOs.get(s.item.id)!), 12)));
  }

  const freePlaces = [...placeDTOs.values()].filter((p) => p.free.isFree === true && ['beach', 'park', 'viewpoint', 'hiking', 'historic-site', 'playground', 'marina'].includes(p.category.slug));
  sections.push(section('free', L, take([...freeEvents.map(toE), ...freePlaces], 12)));

  const gems = places.filter((r) => {
    const cat = r.primary_category;
    if (!['historic-site', 'viewpoint', 'hiking', 'winery', 'museum', 'art-gallery', 'beach', 'park', 'religious-site'].includes(cat)) return false;
    if (!(r.external_ids?.wikidata || r.images?.length || r.description)) return false;
    if (r.popularity > 0.3) return false;
    return !HUBS.some((h) => haversineKm({ lat: r.lat, lng: r.lng }, h) < 4);
  });
  sections.push(section('hidden_gems', L, take(gems.map((r) => placeDTOs.get(r.id)!), 10)));

  // Popularity only exists once real users interact — never faked.
  const popPlaces = places.filter((r) => r.popularity > 0.05).sort((a, b) => b.popularity - a.popularity);
  const popEvents = [...today, ...weekend].filter((r) => r.popularity > 0.05).sort((a, b) => b.popularity - a.popularity);
  sections.push(section('popular', L, take([...popEvents.map(toE), ...popPlaces.map((r) => placeDTOs.get(r.id)!)], 10)));

  const anyEvents = today.length + weekend.length > 0;
  return {
    generatedAt: ctx.now.toISOString(),
    timezone: ctx.tz,
    context: { city: ctx.city ? { slug: ctx.city.slug, name: pickText(ctx.city.name, L) } : null, lat: ctx.geo?.lat ?? null, lng: ctx.geo?.lng ?? null, radiusKm: ctx.radiusKm, usedLocation: ctx.usedLocation },
    weather,
    sections: sections.filter((s) => s.items.length > 0),
    dataNotice: anyEvents ? null : {
      en: 'Few events are listed in this area yet. passtra only shows events from verified sources — coverage grows as more organisers and sources join.',
      el: 'Λίγες εκδηλώσεις έχουν καταχωριστεί ακόμα σε αυτή την περιοχή. Το passtra δείχνει μόνο εκδηλώσεις από επαληθευμένες πηγές.',
      ru: 'В этом районе пока мало событий. passtra показывает только события из проверенных источников — покрытие растёт по мере подключения организаторов.',
    }[L],
  };
}

// ── Search ─────────────────────────────────────────────────────────────────

function summarize(f: SearchFilters, locale: Locale): string {
  const parts: string[] = [];
  for (const c of f.categories.slice(0, 3)) parts.push(pickText(getCategory(c)!.label, locale));
  for (const g of f.groups.slice(0, 2)) parts.push(pickText(GROUP_LABELS[g], locale));
  if (f.city) parts.push(pickText(cityBySlug(f.city)!.name, locale));
  const time: Record<string, Record<Locale, string>> = {
    now: { en: 'Now', el: 'Τώρα', ru: 'Сейчас' }, today: { en: 'Today', el: 'Σήμερα', ru: 'Сегодня' }, tonight: { en: 'Tonight', el: 'Απόψε', ru: 'Сегодня вечером' },
    tomorrow: { en: 'Tomorrow', el: 'Αύριο', ru: 'Завтра' }, weekend: { en: 'This weekend', el: 'Σαββατοκύριακο', ru: 'Выходные' },
    this_week: { en: 'This week', el: 'Αυτή την εβδομάδα', ru: 'Эта неделя' }, next_7_days: { en: 'Next 7 days', el: 'Επόμενες 7 μέρες', ru: 'Ближайшие 7 дней' },
  };
  if (f.time) parts.push(time[f.time]![locale]);
  if (f.freeOnly) parts.push({ en: 'Free', el: 'Δωρεάν', ru: 'Бесплатно' }[locale]);
  if (f.openNow) parts.push({ en: 'Open now', el: 'Ανοιχτά τώρα', ru: 'Открыто сейчас' }[locale]);
  if (f.radiusKm) parts.push(`≤ ${f.radiusKm} km`);
  if (f.keywords.length) parts.push(`“${f.keywords.join(' ')}”`);
  return parts.join(' · ');
}

export async function search(db: pg.Pool, interpreter: QueryInterpreter, query: string, baseCtx: DiscoveryContext, profile: Profile, limit = 40): Promise<SearchResponse> {
  const { filters, engine } = await interpreter.interpret(query, baseCtx.locale);
  let ctx = baseCtx;
  if (filters.city && (!baseCtx.usedLocation || filters.city !== baseCtx.city?.slug) && !(filters.nearMe && baseCtx.usedLocation)) {
    ctx = resolveContext({ city: filters.city, locale: baseCtx.locale, radiusKm: filters.radiusKm ?? undefined }, baseCtx.now);
  } else if (filters.radiusKm) ctx = { ...baseCtx, radiusKm: filters.radiusKm };
  else if (!filters.nearMe && !filters.city && baseCtx.usedLocation) ctx = { ...baseCtx, radiusKm: Math.max(baseCtx.radiusKm, 25) };

  const groupCats = filters.groups.flatMap((g) => categoriesInGroup(g).map((c) => c.slug));
  const cats = expandCategories([...new Set([...filters.categories, ...groupCats])]);
  const evCats = cats.filter((s) => getCategory(s)?.kind !== 'place');
  const plCats = cats.filter((s) => getCategory(s)?.kind !== 'event');
  const wantsEvents = filters.entityTypes.length ? filters.entityTypes.includes('event') : !cats.length || evCats.length > 0 || !!filters.time;
  const wantsPlaces = filters.entityTypes.length ? filters.entityTypes.includes('place') : !cats.length || plCats.length > 0 || filters.openNow;
  const window = filters.time ? timeWindow(filters.time, ctx.now, ctx.tz) : timeWindow('next_7_days', ctx.now, ctx.tz);
  const longWindow = filters.time ? window : { ...window, end: new Date(ctx.now.getTime() + 60 * 86_400_000), endDate: localDate(new Date(ctx.now.getTime() + 60 * 86_400_000), ctx.tz) };

  const [events, places] = await Promise.all([
    wantsEvents && !(filters.openNow && !filters.time)
      ? upcomingEvents(db, ctx, { window: longWindow, categories: evCats.length ? evCats : cats.length ? ['__none__'] : [], free: filters.freeOnly, keywords: filters.keywords, limit: 120, order: filters.sort === 'distance' && ctx.geo ? 'distance_km NULLS LAST, e.starts_at' : 'e.starts_at' })
      : Promise.resolve([]),
    wantsPlaces && !(filters.time && !filters.openNow && filters.time !== 'now' && filters.entityTypes[0] === 'event')
      ? nearbyPlaces(db, ctx, { categories: plCats.length ? plCats : cats.length ? ['__none__'] : LEISURE_PLACE_CATS, free: filters.freeOnly, keywords: filters.keywords, limit: 300 })
      : Promise.resolve([]),
  ]);

  const L = ctx.locale;
  const ageOk = (ageMin: number | null) => !(profile.ageRange === 'under_18' && (ageMin ?? 0) >= 18);
  let placeDTOs = places.filter((r) => ageOk(r.age_min)).map((r) => ({ r, dto: placeToDTO(r, L, ctx.now) }));
  if (filters.openNow || filters.time === 'now') placeDTOs = placeDTOs.filter((x) => x.dto.hours.openNow === true);
  const evDTOs = events.filter((r) => ageOk(r.age_min)).map((r) => ({ r, dto: eventToDTO(r, L, ctx.now) }));
  const rankCtx = { now: ctx.now, tz: ctx.tz, radiusKm: ctx.radiusKm };
  let ordered: EntityDTO[];
  if (filters.sort === 'distance' && ctx.geo) {
    ordered = [...evDTOs.map((x) => x.dto), ...placeDTOs.map((x) => x.dto)].sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  } else if (filters.sort === 'time') {
    ordered = [...evDTOs.map((x) => x.dto), ...placeDTOs.map((x) => x.dto)];
  } else {
    const byId = new Map<string, EntityDTO>([...evDTOs.map((x) => [x.r.id, x.dto] as const), ...placeDTOs.map((x) => [x.r.id, x.dto] as const)]);
    const cands = [...evDTOs.map((x) => eventCandidate(x.r)), ...placeDTOs.map((x) => placeCandidate(x.r, x.dto))];
    // Search shows everything that matches (including items with conflicting data, flagged in the UI); ranking only orders it.
    const scored = cands.map((c) => ({ c, s: scoreCandidate(c, { ...profile, dismissed: new Set() }, rankCtx).score }));
    if (filters.sort === 'rating') scored.sort((a, b) => (b.c.rating ?? 0) - (a.c.rating ?? 0) || b.s - a.s);
    else scored.sort((a, b) => b.s - a.s);
    ordered = scored.map((x) => byId.get(x.c.id)!);
  }
  return {
    query,
    interpretation: { ...filters, engine, summary: summarize(filters, L) },
    results: ordered.slice(0, limit),
    total: ordered.length,
  };
}

// ── Recommendations / Surprise ─────────────────────────────────────────────

async function recommendationPool(db: pg.Pool, ctx: DiscoveryContext): Promise<{ events: EventRow[]; places: PlaceRow[]; placeDTOs: Map<string, PlaceDTO> }> {
  const [events, places] = await Promise.all([
    upcomingEvents(db, ctx, { window: timeWindow('next_7_days', ctx.now, ctx.tz), limit: 200 }),
    nearbyPlaces(db, ctx, { categories: FEED_PLACE_CATS, limit: 500 }),
  ]);
  return { events, places, placeDTOs: new Map(places.map((r) => [r.id, placeToDTO(r, ctx.locale, ctx.now)])) };
}

export async function recommendations(db: pg.Pool, ctx: DiscoveryContext, profile: Profile, limit = 20): Promise<RecommendationDTO[]> {
  const pool = await recommendationPool(db, ctx);
  const evMap = new Map(pool.events.map((r) => [r.id, r]));
  const cands = [...pool.events.map(eventCandidate), ...pool.places.map((r) => placeCandidate(r, pool.placeDTOs.get(r.id)!))];
  const groupLabel = (g: string) => pickText(GROUP_LABELS[g as InterestGroup] ?? { en: g }, ctx.locale).toLowerCase();
  return rank(cands, profile, { now: ctx.now, tz: ctx.tz, radiusKm: ctx.radiusKm }, limit).map((s) => ({
    entity: s.item.type === 'event' ? eventToDTO(evMap.get(s.item.id)!, ctx.locale, ctx.now) : pool.placeDTOs.get(s.item.id)!,
    score: s.score,
    reason: explain(s.reasons, ctx.locale, groupLabel),
  }));
}

export async function surpriseMe(db: pg.Pool, ctx: DiscoveryContext, profile: Profile, count = 4): Promise<RecommendationDTO[]> {
  const pool = await recommendationPool(db, ctx);
  const evMap = new Map(pool.events.map((r) => [r.id, r]));
  // Only things you can actually do soon: events in the next 24 h or places open now (or without hours for outdoor spots).
  const soon = pool.events.filter((r) => r.starts_at.getTime() - ctx.now.getTime() < 24 * 3_600_000);
  const placeCands = pool.places
    .map((r) => placeCandidate(r, pool.placeDTOs.get(r.id)!))
    .filter((c) => c.openNow === true || (c.openNow === null && c.categories.some((s) => getCategory(s)?.outdoor)));
  const groupLabel = (g: string) => pickText(GROUP_LABELS[g as InterestGroup] ?? { en: g }, ctx.locale).toLowerCase();
  return surprise([...soon.map(eventCandidate), ...placeCands], profile, { now: ctx.now, tz: ctx.tz, radiusKm: ctx.radiusKm }, count).map((s) => ({
    entity: s.item.type === 'event' ? eventToDTO(evMap.get(s.item.id)!, ctx.locale, ctx.now) : pool.placeDTOs.get(s.item.id)!,
    score: s.score,
    reason: explain(s.reasons, ctx.locale, groupLabel),
  }));
}

// ── Plan my day ────────────────────────────────────────────────────────────

export interface PlanInput {
  date?: string; // YYYY-MM-DD (local); default today
  start: string; // HH:mm
  end: string; // HH:mm (may be after midnight → next day)
  budget?: number | null;
  interests?: InterestGroup[];
  mode?: 'walk' | 'drive' | 'auto';
}

const DISCLAIMER: Record<Locale, string> = {
  en: 'Travel times are estimates. Opening hours and event times come from the listed sources — check them before you go. Items marked "price unknown" are not counted in the total.',
  el: 'Οι χρόνοι μετακίνησης είναι εκτιμήσεις. Ωράρια και ώρες εκδηλώσεων προέρχονται από τις πηγές — ελέγξτε τα πριν πάτε. Όσα έχουν «άγνωστη τιμή» δεν υπολογίζονται στο σύνολο.',
  ru: 'Время в пути — оценка. Часы работы и время событий взяты из указанных источников — проверьте перед выходом. Позиции с неизвестной ценой не учтены в сумме.',
};

export async function planMyDay(db: pg.Pool, ctx: DiscoveryContext, profile: Profile, input: PlanInput): Promise<PlanDayResponse> {
  const zone = ctx.tz;
  const day = input.date ? DateTime.fromISO(input.date, { zone }) : DateTime.fromJSDate(ctx.now, { zone }).startOf('day');
  const [sh, sm] = input.start.split(':').map(Number);
  const [eh, em] = input.end.split(':').map(Number);
  let start = day.set({ hour: sh!, minute: sm! });
  let end = day.set({ hour: eh!, minute: em! });
  if (end <= start) end = end.plus({ days: 1 });
  const nowLocal = DateTime.fromJSDate(ctx.now, { zone });
  if (start < nowLocal) start = nowLocal.plus({ minutes: 5 - (nowLocal.minute % 5) }).set({ second: 0, millisecond: 0 });
  if (end <= start) return { stops: [], totalKnownCost: 0, stopsWithUnknownPrice: 0, totalTravelMin: 0, freeMinutes: 0, disclaimer: DISCLAIMER[ctx.locale] };

  const interests = input.interests?.length ? input.interests : profile.interests;
  const interestCats = interests.flatMap((g) => categoriesInGroup(g).map((c) => c.slug));
  const placeCats = [...new Set([...interestCats.filter((s) => getCategory(s)?.kind !== 'event'), 'restaurant', 'cafe', 'bakery', ...(interestCats.length ? [] : LEISURE_PLACE_CATS)])].filter((s) => !PRACTICAL.includes(s));
  const window = { kind: 'custom' as const, start: start.toJSDate(), end: end.toJSDate(), startDate: start.toISODate()!, endDate: end.minus({ milliseconds: 1 }).toISODate()! };
  const [events, places] = await Promise.all([
    upcomingEvents(db, ctx, { window, excludeMultiDay: true, categories: interestCats.filter((s) => getCategory(s)?.kind !== 'place'), limit: 60 }),
    nearbyPlaces(db, ctx, { categories: placeCats, limit: 400 }),
  ]);
  const placeDTOs = new Map(places.map((r) => [r.id, placeToDTO(r, ctx.locale, ctx.now)]));
  const p2: Profile = { ...profile, interests };
  const scores = new Map(rank([...events.map(eventCandidate), ...places.map((r) => placeCandidate(r, placeDTOs.get(r.id)!))], p2, { now: start.toJSDate(), tz: zone, radiusKm: ctx.radiusKm }, 400).map((s) => [s.item.id, s.score]));
  const evMap = new Map(events.map((r) => [r.id, r]));

  const candidates: PlanCandidate[] = [
    ...events.filter((r) => r.time_precision === 'exact' && r.lat !== null).map((r) => ({
      id: r.id, type: 'event' as const, title: r.title, category: r.primary_category, location: { lat: r.lat!, lng: r.lng! }, score: scores.get(r.id) ?? 0,
      startsAt: r.starts_at, endsAt: r.ends_at, price: r.is_free ? 0 : r.price_min, durationMin: getCategory(r.primary_category)?.visitMinutes,
    })),
    ...places.map((r) => ({
      id: r.id, type: 'place' as const, title: r.name, category: r.primary_category, location: { lat: r.lat, lng: r.lng }, score: scores.get(r.id) ?? 0,
      openIntervals: openIntervals(r.opening_hours?.value, start.startOf('day').toJSDate(), end.endOf('day').toJSDate(), zone, r.lat, r.lng),
      price: r.is_free === true ? 0 : null,
    })),
  ];
  const origin = ctx.geo ?? (ctx.city ? { lat: ctx.city.lat, lng: ctx.city.lng } : { lat: 34.6786, lng: 33.0413 });
  const plan = planDay({ start: start.toJSDate(), end: end.toJSDate(), tz: zone, origin, budget: input.budget ?? null, mode: input.mode ?? 'auto', candidates });
  const fmt = (d: Date) => DateTime.fromJSDate(d, { zone }).toFormat('HH:mm');
  return {
    stops: plan.stops.map((s) => ({
      entity: s.candidateId && evMap.has(s.candidateId) ? eventToDTO(evMap.get(s.candidateId)!, ctx.locale, ctx.now) : (placeDTOs.get(s.candidateId) as EntityDTO),
      arrive: s.arrive.toISOString(), depart: s.depart.toISOString(), arriveLabel: fmt(s.arrive), departLabel: fmt(s.depart),
      travelMinFromPrev: s.travelMinFromPrev, travelMode: s.travelMode, notes: s.notes,
    })),
    totalKnownCost: plan.totalKnownCost,
    stopsWithUnknownPrice: plan.stopsWithUnknownPrice,
    totalTravelMin: plan.totalTravelMin,
    freeMinutes: plan.freeMinutes,
    disclaimer: DISCLAIMER[ctx.locale],
  };
}

export type { EventDTO };
