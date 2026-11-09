import { createHash, randomBytes } from 'node:crypto';
import {
  CATEGORIES, CITIES, VIBES, type Vibe, COUNTRIES, GROUP_LABELS, INTEREST_GROUPS, LOCALES, ONBOARDING_INTERESTS, canonicalKey, categoriesInGroup, expandCategories, getCategory,
  correctQuery, navigationLinks, normalizeText, pickText, timeWindow, type EntityDTO, type InterestGroup,
} from '@passtra/core';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { integrationStatus } from '../config';
import { googleLive, googlePhotos, resolveGooglePlaceId } from '../lib/google';
import { holidayRule, weeklySchedule } from '../lib/hours';
import { getWeather } from '../lib/weather';
import { Summarizer, eventFacts, placeFacts } from '../services/summaries';
import { ApiError, LocationQuery, csv, localeOf, parse, requireUser } from '../http';
import {
  Sql, categoriesWhere, distanceExpr, eventToDTO, geoWhere, getEventRow, getPlaceRow, keywordsWhere, placeToDTO, provenance, queryEvents,
  queryPlaces, resolveMergedId, upcomingWhere, windowWhere,
} from '../repo/entities';
import { buildFeed, evaluatePlanItems, loadProfile, planAlternatives, planMyDay, recommendations, resolveContext, search, surpriseMe, whatToDo } from '../services/discovery';
import type { AppDeps } from '../app';

const Uuid = z.string().uuid();
const InterestsParam = csv(INTEREST_GROUPS);
const Budget = z.enum(['free', 'low', 'medium', 'high']).optional();
const TimeParam = z.enum(['now', 'today', 'tonight', 'tomorrow', 'weekend', 'this_week', 'next_7_days']).optional();

export async function publicRoutes(app: FastifyInstance, deps: AppDeps) {
  const summarizer = new Summarizer(deps.db, deps.config, app.log);
  const { db, config } = deps;
  const now = () => deps.now?.() ?? new Date();

  app.get('/v1/health', async () => ({ ok: true }));
  app.get('/v1/ready', async (_req, reply) => {
    try {
      await db.query('SELECT 1');
      return { ok: true };
    } catch {
      return reply.status(503).send({ ok: false });
    }
  });

  app.get('/v1/meta', async (req) => {
    const locale = localeOf(req, (req.query as { locale?: string }).locale);
    return {
      locales: LOCALES,
      countries: COUNTRIES.filter((c) => c.enabled).map((c) => ({ code: c.code, name: pickText(c.name, locale), timezone: c.timezone, currency: c.currency })),
      cities: CITIES.map((c) => ({ slug: c.slug, name: pickText(c.name, locale), country: c.country, lat: c.lat, lng: c.lng, radiusKm: c.radiusKm, featured: c.featured })),
      interests: ONBOARDING_INTERESTS.map((i) => ({ key: i, label: pickText(GROUP_LABELS[i], locale) })),
      groups: INTEREST_GROUPS.map((g) => ({ key: g, label: pickText(GROUP_LABELS[g], locale), categories: categoriesInGroup(g).map((c) => c.slug) })),
      categories: CATEGORIES.map((c) => ({ slug: c.slug, kind: c.kind, group: c.group, icon: c.icon, label: pickText(c.label, locale), ageMin: c.ageMin ?? null })),
      radiusOptionsKm: [1, 3, 5, 10, 25, 50],
      features: { aiSearch: !!config.ANTHROPIC_API_KEY, googleLive: !!config.GOOGLE_MAPS_API_KEY, demoMode: config.DEMO_MODE },
      attributions: [
        { name: 'OpenStreetMap contributors', license: 'ODbL', url: 'https://www.openstreetmap.org/copyright' },
        { name: 'Wikidata', license: 'CC0', url: 'https://www.wikidata.org' },
        { name: 'MET Norway', license: 'CC BY 4.0', url: 'https://api.met.no/doc/License' },
        { name: 'Deputy Ministry of Tourism — visitcyprus.com', license: 'Event listings, linked to source', url: 'https://www.visitcyprus.com' },
      ],
    };
  });

  // ── Today ──
  app.get('/v1/feed/today', async (req) => {
    const q = parse(LocationQuery.extend({ interests: InterestsParam, budget: Budget }), req.query);
    const locale = localeOf(req, q.locale);
    const ctx = resolveContext({ lat: q.lat, lng: q.lng, city: q.city, radiusKm: q.radius, locale }, now());
    const profile = await loadProfile(db, req.user?.id ?? null, { interests: q.interests as InterestGroup[] | undefined, budget: q.budget });
    return buildFeed({ db, http: deps.http }, ctx, profile);
  });

  // ── Places ──
  const PlacesQuery = LocationQuery.extend({
    category: z.string().max(400).optional(),
    group: z.enum(INTEREST_GROUPS).optional(),
    q: z.string().max(100).optional(),
    open_now: z.coerce.boolean().optional(),
    free: z.coerce.boolean().optional(),
    min_rating: z.coerce.number().min(1).max(5).optional(),
    sort: z.enum(['distance', 'rating', 'name']).default('distance'),
    limit: z.coerce.number().int().min(1).max(100).default(40),
    offset: z.coerce.number().int().min(0).max(2000).default(0),
  });
  app.get('/v1/places', async (req) => {
    const p = parse(PlacesQuery, req.query);
    const locale = localeOf(req, p.locale);
    const ctx = resolveContext({ lat: p.lat, lng: p.lng, city: p.city, radiusKm: p.radius, locale }, now());
    const q = new Sql();
    const dist = distanceExpr(q, 'p', ctx.geo);
    q.where.push(`p.merged_into IS NULL AND p.status = 'active'`);
    geoWhere(q, 'p', ctx.geo ? { ...ctx.geo, radiusKm: ctx.radiusKm } : null);
    const cats = [...(p.category?.split(',').filter((s) => getCategory(s)) ?? []), ...(p.group ? categoriesInGroup(p.group).map((c) => c.slug) : [])];
    categoriesWhere(q, 'p', cats);
    if (p.q) keywordsWhere(q, 'p', [p.q], canonicalKey);
    if (p.min_rating) q.where.push(`p.user_rating_avg >= ${q.add(p.min_rating)}`);
    if (p.free) q.where.push('p.is_free = true');
    const order = p.sort === 'rating' ? 'p.user_rating_avg DESC NULLS LAST, p.confidence DESC' : p.sort === 'name' || !ctx.geo ? 'p.name' : dist;
    const rows = await queryPlaces(db, q, dist, `${order} OFFSET ${p.offset}`, p.open_now ? 400 : p.limit);
    let items = rows.map((r) => placeToDTO(r, locale, ctx.now));
    if (p.open_now) items = items.filter((x) => x.hours.openNow === true).slice(0, p.limit);
    return { items, context: { radiusKm: ctx.radiusKm, city: ctx.city?.slug ?? null } };
  });

  app.get('/v1/places/:id', async (req, reply) => {
    const { id } = parse(z.object({ id: Uuid }), req.params);
    const loc = parse(LocationQuery, req.query);
    const locale = localeOf(req, loc.locale);
    const realId = await resolveMergedId(db, 'place', id);
    if (realId !== id) return reply.redirect(`/v1/places/${realId}`, 301);
    const row = await getPlaceRow(db, id, loc.lat !== undefined && loc.lng !== undefined ? { lat: loc.lat, lng: loc.lng } : null);
    if (!row) throw new ApiError(404, 'not_found', 'Place not found');
    const dto = placeToDTO(row, locale, now(), await provenance(db, 'place', id));
    const upcoming = await db.query<{ id: string }>(`SELECT id FROM events e WHERE e.place_id = $1 AND e.merged_into IS NULL AND e.status IN ('scheduled','rescheduled') AND e.starts_at > now() - interval '1 day' ORDER BY starts_at LIMIT 10`, [id]);
    const events = (await Promise.all(upcoming.rows.map((r) => getEventRow(db, r.id, null)))).filter((x) => !!x).map((r) => eventToDTO(r!, locale, now()));
    // Opening hours for the next 7 days (Cyprus time), with breaks, closed days and public holidays.
    const schedule = { week: weeklySchedule(row.opening_hours?.value, now(), row.city_tz ?? 'Europe/Nicosia', row.lat, row.lng, locale), holidayRule: holidayRule(row.opening_hours?.value) };
    // A summary only when there is something beyond the card's own fields (tags such as cuisine, or texts).
    const facts = placeFacts(dto, row.tags ?? []);
    const hasMore = (row.tags ?? []).length > 0 || (facts.sourceDescriptions as string[]).length > 0;
    const summary = !dto.about && (!dto.description || dto.description.length < 120) && hasMore ? await summarizer.get('place', id, facts, locale) : null;
    return { place: dto, schedule, summary, upcomingEvents: events, navigation: navigationLinks(dto.location, dto.name) };
  });

  // Google enrichment is fetched live and never stored (except the place id) — see lib/google.ts.
  app.get('/v1/places/:id/live', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const { id } = parse(z.object({ id: Uuid }), req.params);
    if (!config.GOOGLE_MAPS_API_KEY) return { google: null, reason: 'not_configured' };
    const row = await getPlaceRow(db, id, null);
    if (!row) throw new ApiError(404, 'not_found', 'Place not found');
    try {
      const placeId = await resolveGooglePlaceId(db, config.GOOGLE_MAPS_API_KEY, { id, name: row.name, lat: row.lat, lng: row.lng, externalIds: row.external_ids });
      if (!placeId) return { google: null, reason: 'no_match' };
      return { google: await googleLive(config.GOOGLE_MAPS_API_KEY, placeId, localeOf(req, (req.query as { locale?: string }).locale)) };
    } catch (e) {
      req.log.warn({ err: (e as Error).message }, 'google live failed');
      return { google: null, reason: 'unavailable' };
    }
  });

  // Photos of a place from Google (official Places Photos API), fetched on demand and never stored.
  app.get('/v1/places/:id/photos', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const { id } = parse(z.object({ id: Uuid }), req.params);
    if (!config.GOOGLE_MAPS_API_KEY) return { photos: [], source: null, reason: 'not_configured' };
    const row = await getPlaceRow(db, id, null);
    if (!row) throw new ApiError(404, 'not_found', 'Place not found');
    try {
      const placeId = await resolveGooglePlaceId(db, config.GOOGLE_MAPS_API_KEY, { id, name: row.name, lat: row.lat, lng: row.lng, externalIds: row.external_ids });
      if (!placeId) return { photos: [], source: null, reason: 'no_match' };
      return { photos: await googlePhotos(config.GOOGLE_MAPS_API_KEY, placeId), source: 'google', reason: null };
    } catch (e) {
      req.log.warn({ err: (e as Error).message }, 'google photos failed');
      return { photos: [], source: null, reason: 'unavailable' };
    }
  });


  // ── Events ──
  const EventsQuery = LocationQuery.extend({
    category: z.string().max(400).optional(),
    group: z.enum(INTEREST_GROUPS).optional(),
    q: z.string().max(100).optional(),
    when: TimeParam,
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    free: z.coerce.boolean().optional(),
    /** Only events whose known lowest price is at most this (unknown prices are excluded when set). */
    maxPrice: z.coerce.number().min(0).max(10000).optional(),
    /** 'family': no age limit; 'adults': 18+ only. */
    age: z.enum(['family', 'adults']).optional(),
    sort: z.enum(['time', 'distance']).default('time'),
    limit: z.coerce.number().int().min(1).max(100).default(40),
    offset: z.coerce.number().int().min(0).max(2000).default(0),
  });
  const eventFilters = (p: z.infer<typeof EventsQuery>, ctx: ReturnType<typeof resolveContext>, q: Sql) => {
    upcomingWhere(q, ctx.now);
    if (p.when) windowWhere(q, timeWindow(p.when, ctx.now, ctx.tz));
    if (p.from) q.where.push(`COALESCE(e.local_end_date, e.local_start_date) >= ${q.add(p.from)}::date`);
    if (p.to) q.where.push(`e.local_start_date <= ${q.add(p.to)}::date`);
    geoWhere(q, 'e', ctx.geo ? { ...ctx.geo, radiusKm: ctx.radiusKm } : null);
    categoriesWhere(q, 'e', expandCategories([...(p.category?.split(',').filter((s) => getCategory(s)) ?? []), ...(p.group ? categoriesInGroup(p.group).map((c) => c.slug) : [])]));
    if (p.free) q.where.push('e.is_free = true');
    if (p.maxPrice !== undefined) q.where.push(`(e.is_free = true OR (e.price_min IS NOT NULL AND e.price_min <= ${q.add(p.maxPrice)}))`);
    if (p.age === 'family') q.where.push('COALESCE(e.age_min, 0) < 18');
    if (p.age === 'adults') q.where.push('e.age_min >= 18');
    if (p.q) keywordsWhere(q, 'e', [p.q], canonicalKey);
  };
  // Calendar: how many events fall on each day of a month (multi-day events count on every one of their days).
  app.get('/v1/events/calendar', async (req) => {
    const p = parse(EventsQuery.extend({ month: z.string().regex(/^\d{4}-\d{2}$/) }), req.query);
    const ctx = resolveContext({ lat: p.lat, lng: p.lng, city: p.city, radiusKm: p.radius, locale: localeOf(req, p.locale) }, now());
    const first = `${p.month}-01`;
    const q = new Sql();
    eventFilters({ ...p, from: first, to: undefined, when: undefined }, ctx, q);
    const f = q.add(first);
    const r = await db.query<{ day: string; n: number }>(
      `SELECT to_char(d, 'YYYY-MM-DD') AS day, count(*)::int AS n
         FROM events e LEFT JOIN cities c ON c.id = e.city_id,
              generate_series(GREATEST(e.local_start_date, ${f}::date), LEAST(COALESCE(e.local_end_date, e.local_start_date), (${f}::date + interval '1 month' - interval '1 day')::date), interval '1 day') d
        WHERE ${q.where.join(' AND ')} AND e.local_start_date < ${f}::date + interval '1 month'
        GROUP BY 1 ORDER BY 1`, q.params);
    return { month: p.month, days: Object.fromEntries(r.rows.map((x) => [x.day, x.n])) };
  });
  app.get('/v1/events', async (req) => {
    const p = parse(EventsQuery, req.query);
    const locale = localeOf(req, p.locale);
    const ctx = resolveContext({ lat: p.lat, lng: p.lng, city: p.city, radiusKm: p.radius, locale }, now());
    const q = new Sql();
    const dist = distanceExpr(q, 'e', ctx.geo);
    eventFilters(p, ctx, q);
    const order = p.sort === 'distance' && ctx.geo ? `${dist}, e.starts_at` : 'e.starts_at, e.id';
    const rows = await queryEvents(db, q, dist, `${order} OFFSET ${p.offset}`, p.limit);
    return { items: rows.map((r) => eventToDTO(r, locale, ctx.now)) };
  });

  app.get('/v1/events/:id', async (req, reply) => {
    const { id } = parse(z.object({ id: Uuid }), req.params);
    const loc = parse(LocationQuery, req.query);
    const locale = localeOf(req, loc.locale);
    const realId = await resolveMergedId(db, 'event', id);
    if (realId !== id) return reply.redirect(`/v1/events/${realId}`, 301);
    const row = await getEventRow(db, id, loc.lat !== undefined && loc.lng !== undefined ? { lat: loc.lat, lng: loc.lng } : null);
    if (!row) throw new ApiError(404, 'not_found', 'Event not found');
    const dto = eventToDTO(row, locale, now(), await provenance(db, 'event', id));
    // No real description: a short one written only from verified facts (all sources' texts included).
    let summary = null;
    if (!dto.description || dto.description.length < 120) {
      const others = await db.query<{ v: string }>(`SELECT DISTINCT value #>> '{}' AS v FROM field_observations WHERE entity_type = 'event' AND entity_id = $1 AND field = 'description' AND value IS NOT NULL AND value <> 'null'::jsonb`, [id]);
      summary = await summarizer.get('event', id, eventFacts(dto, others.rows.map((r) => r.v).filter((v) => v && v !== dto.description)), locale);
    }
    return { event: dto, summary, navigation: dto.location ? navigationLinks(dto.location, dto.venue.name ?? dto.title) : null };
  });

  // ── Map ──
  app.get('/v1/map', async (req) => {
    const p = parse(z.object({
      bbox: z.string().regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/),
      layers: z.string().default('events,places'),
      category: z.string().max(400).optional(),
      when: TimeParam,
      open_now: z.coerce.boolean().optional(),
      free: z.coerce.boolean().optional(),
      locale: z.string().optional(),
      limit: z.coerce.number().int().min(10).max(800).default(400),
    }), req.query);
    const [w, s, e, n] = p.bbox.split(',').map(Number) as [number, number, number, number];
    if (e - w > 3 || n - s > 3) throw new ApiError(400, 'bbox_too_large', 'Zoom in to load map markers');
    const locale = localeOf(req, p.locale);
    const layers = new Set(p.layers.split(','));
    const cats = p.category?.split(',').filter((x) => getCategory(x)) ?? [];
    const t = now();
    const markers: Array<{ id: string; type: 'event' | 'place'; lat: number; lng: number; title: string; category: string; icon: string; subtitle: string | null; openNow?: boolean | null; isFree?: boolean | null }> = [];
    if (layers.has('events')) {
      const q = new Sql();
      upcomingWhere(q, t);
      q.where.push(`e.location IS NOT NULL AND e.location_precision IN ('exact','approximate') AND e.location::geometry && ST_MakeEnvelope(${q.add(w)}, ${q.add(s)}, ${q.add(e)}, ${q.add(n)}, 4326)`);
      if (p.when) windowWhere(q, timeWindow(p.when, t, 'Europe/Nicosia'));
      else q.where.push(`e.starts_at < ${q.add(new Date(t.getTime() + 14 * 86_400_000))}`);
      categoriesWhere(q, 'e', cats.filter((x) => getCategory(x)?.kind !== 'place'));
      if (p.free) q.where.push('e.is_free = true');
      for (const r of await queryEvents(db, q, 'NULL::float8', 'e.starts_at', Math.round(p.limit / 2))) {
        const d = eventToDTO(r, locale, t);
        markers.push({ id: r.id, type: 'event', lat: r.lat!, lng: r.lng!, title: r.title, category: r.primary_category, icon: d.category.icon, subtitle: d.time.label, isFree: r.is_free });
      }
    }
    if (layers.has('places')) {
      const q = new Sql();
      q.where.push(`p.merged_into IS NULL AND p.status = 'active' AND p.location::geometry && ST_MakeEnvelope(${q.add(w)}, ${q.add(s)}, ${q.add(e)}, ${q.add(n)}, 4326)`);
      categoriesWhere(q, 'p', cats.filter((x) => getCategory(x)?.kind !== 'event'));
      if (p.free) q.where.push('p.is_free = true');
      const rows = await queryPlaces(db, q, 'NULL::float8', 'p.confidence DESC, p.popularity DESC', p.open_now ? 1000 : p.limit - markers.length);
      for (const r of rows) {
        const d = placeToDTO(r, locale, t);
        if (p.open_now && d.hours.openNow !== true) continue;
        markers.push({ id: r.id, type: 'place', lat: r.lat, lng: r.lng, title: d.name, category: r.primary_category, icon: d.category.icon, subtitle: d.hours.label ?? d.category.label, openNow: d.hours.openNow, isFree: d.free.isFree });
        if (markers.length >= p.limit) break;
      }
    }
    return { markers, truncated: markers.length >= p.limit };
  });

  // ── Smart search ──
  app.post('/v1/search', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const b = parse(z.object({ q: z.string().trim().min(1).max(300), lat: z.number().optional(), lng: z.number().optional(), city: z.string().max(40).optional(), radius: z.number().min(0.5).max(100).optional(), locale: z.string().optional(), interests: z.array(z.enum(INTEREST_GROUPS)).max(13).optional() }), req.body);
    const locale = localeOf(req, b.locale);
    // The chosen radius is respected (25 km by default near the user); wider radii are offered with their counts.
    const ctx = resolveContext({ lat: b.lat, lng: b.lng, city: b.city, radiusKm: b.radius ?? (b.lat !== undefined ? 25 : undefined), locale }, now());
    const profile = await loadProfile(db, req.user?.id ?? null, { interests: b.interests });
    return search(db, deps.interpreter, b.q, ctx, profile);
  });

  // Autocomplete: categories, cities and real places/events matching what has been typed so far.
  app.get('/v1/search/suggest', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (req) => {
    const q = parse(z.object({ q: z.string().trim().min(1).max(80), locale: z.string().optional(), lat: z.coerce.number().optional(), lng: z.coerce.number().optional() }), req.query);
    const locale = localeOf(req, q.locale);
    const typed = normalizeText(q.q);
    // Word-prefix matches only ("res" → Restaurants), in every language the label or synonyms exist in.
    const hitWith = (probes: string[]) => (words: string[]) => words.some((w) => normalizeText(w).split(' ').some((_, i, all) => probes.some((p) => all.slice(i).join(' ').startsWith(p))));
    const find = (probes: string[]) => ({
      categories: CATEGORIES.filter((c) => hitWith(probes)([...Object.values(c.label), ...LOCALES.flatMap((l) => c.keywords[l] ?? [])]))
        .slice(0, 4).map((c) => ({ type: 'category' as const, slug: c.slug, label: pickText(c.label, locale), icon: c.icon })),
      cities: CITIES.filter((c) => hitWith(probes)([c.name.en, c.name.el ?? '', c.name.ru ?? '', ...c.aliases].filter(Boolean)))
        .slice(0, 2).map((c) => ({ type: 'city' as const, slug: c.slug, label: pickText(c.name, locale) })),
    });
    let { categories, cities } = find([typed]);
    // Typo correction only when what was typed matches nothing (a half-typed word is not a typo).
    let corrected: string | null = null;
    if (!categories.length && !cities.length && typed.length >= 5) {
      corrected = correctQuery(q.q);
      if (corrected) ({ categories, cities } = find([corrected]));
      if (!categories.length && !cities.length) corrected = null;
    }
    const near = q.lat !== undefined && q.lng !== undefined ? `ST_Distance(location, ST_SetSRID(ST_MakePoint(${Number(q.lng)}, ${Number(q.lat)}), 4326)::geography)` : 'NULL::float8';
    // Names (any language) starting with, or containing a word starting with, what was typed.
    const nameHit = (col: string) => `(${col} ILIKE $1 || '%' OR ${col} ILIKE '% ' || $1 || '%')`;
    const rows = q.q.length < 2 ? { rows: [] as Array<{ type: 'event' | 'place'; id: string; label: string; sub: string | null }> } : await db.query<{ type: 'event' | 'place'; id: string; label: string; sub: string | null }>(
      `(SELECT 'place' AS type, id, name AS label, address AS sub FROM places
          WHERE merged_into IS NULL AND status = 'active' AND (${nameHit('name')} OR EXISTS (SELECT 1 FROM jsonb_each_text(name_i18n) n WHERE ${nameHit('n.value')}))
          ORDER BY (name ILIKE $1 || '%') DESC, confidence DESC, ${near} LIMIT 5)
       UNION ALL
       (SELECT 'event' AS type, id, title AS label, venue_name AS sub FROM events
          WHERE merged_into IS NULL AND archived_at IS NULL AND status IN ('scheduled','rescheduled') AND COALESCE(ends_at, starts_at + interval '3 hours') > now()
            AND ${nameHit('title')}
          ORDER BY starts_at LIMIT 3)`, [q.q.replace(/[%_\\]/g, '')]);
    return { suggestions: [...categories, ...cities, ...rows.rows.map((r) => ({ type: r.type, id: r.id, label: r.label, sublabel: r.sub }))], didYouMean: corrected };
  });

  // ── Recommendations ──
  app.get('/v1/recommendations', async (req) => {
    const q = parse(LocationQuery.extend({ interests: InterestsParam, budget: Budget, limit: z.coerce.number().int().min(1).max(50).default(20) }), req.query);
    const locale = localeOf(req, q.locale);
    const ctx = resolveContext({ lat: q.lat, lng: q.lng, city: q.city, radiusKm: q.radius, locale }, now());
    const profile = await loadProfile(db, req.user?.id ?? null, { interests: q.interests as InterestGroup[] | undefined, budget: q.budget });
    return { items: await recommendations(db, ctx, profile, q.limit) };
  });

  // "What can I do?": concrete activities with real options nearby, for a time (now, today, evening, tomorrow,
  // weekend) and kind of outing. Places closed for the whole chosen time are left out; places without reliable
  // hours are listed as "hours not confirmed", never as available.
  app.get('/v1/activities', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req) => {
    const q = parse(LocationQuery.extend({
      when: z.enum(['now', 'today', 'evening', 'tomorrow', 'weekend']).default('today'),
      vibes: z.string().optional().transform((v) => (v ? v.split(',').filter((x): x is Vibe => (VIBES as string[]).includes(x)) : [])),
      cost: z.enum(['any', 'free', 'paid']).default('any'),
      idea: z.string().max(40).optional(),
      interests: InterestsParam,
    }), req.query);
    const locale = localeOf(req, q.locale);
    const ctx = resolveContext({ lat: q.lat, lng: q.lng, city: q.city, radiusKm: q.radius, locale }, now());
    const profile = await loadProfile(db, req.user?.id ?? null, { interests: q.interests as InterestGroup[] | undefined });
    return whatToDo(db, ctx, profile, { when: q.when, vibes: q.vibes, cost: q.cost, idea: q.idea, perIdea: q.idea ? 60 : 3 });
  });

  app.post('/v1/surprise', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const b = parse(z.object({ lat: z.number().optional(), lng: z.number().optional(), city: z.string().optional(), radius: z.number().min(0.5).max(100).optional(), locale: z.string().optional(), interests: z.array(z.enum(INTEREST_GROUPS)).optional(), count: z.number().int().min(1).max(8).default(4) }), req.body ?? {});
    const locale = localeOf(req, b.locale);
    const ctx = resolveContext({ lat: b.lat, lng: b.lng, city: b.city, radiusKm: b.radius, locale }, now());
    const profile = await loadProfile(db, req.user?.id ?? null, { interests: b.interests });
    return { items: await surpriseMe(db, ctx, profile, b.count) };
  });

  const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
  const PlanParams = z.object({
    lat: z.number().optional(), lng: z.number().optional(), city: z.string().optional(), locale: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), start: HHMM, end: HHMM, budget: z.number().min(0).max(10000).nullable().optional(),
    participants: z.number().int().min(1).max(20).default(1), mode: z.enum(['walk', 'drive', 'auto']).default('auto'),
  });
  const planCtx = (b: z.infer<typeof PlanParams> & { maxDistanceKm?: number | null; radius?: number }, req: FastifyRequest) =>
    resolveContext({ lat: b.lat, lng: b.lng, city: b.city, radiusKm: b.maxDistanceKm ?? b.radius ?? 15, locale: localeOf(req, b.locale) }, now());

  app.post('/v1/plan-day', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req) => {
    const b = parse(PlanParams.extend({
      radius: z.number().min(1).max(60).optional(), interests: z.array(z.enum(INTEREST_GROUPS)).optional(),
      tripType: z.enum(['balanced', 'relaxed', 'active', 'culture', 'family', 'nightlife', 'foodie']).default('balanced'),
      maxDistanceKm: z.number().min(1).max(60).nullable().optional(), variants: z.number().int().min(1).max(3).default(3),
    }), req.body);
    const ctx = planCtx(b, req);
    const profile = await loadProfile(db, req.user?.id ?? null, { interests: b.interests });
    return planMyDay(db, ctx, profile, b);
  });

  // Re-time a plan the user edited (reordered, removed, replaced, added own stops) and report problems per stop.
  const PlanItems = z.array(z.union([
    z.object({ kind: z.enum(['event', 'place']), id: Uuid, durationMin: z.number().int().min(10).max(600).optional() }),
    z.object({ kind: z.literal('custom'), title: z.string().trim().min(1).max(120), lat: z.number().nullable().optional(), lng: z.number().nullable().optional(), durationMin: z.number().int().min(5).max(600) }),
  ])).min(1).max(15);
  app.post('/v1/plan-day/evaluate', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req) => {
    const b = parse(PlanParams.extend({ items: PlanItems }), req.body);
    return evaluatePlanItems(db, planCtx(b, req), b);
  });

  app.post('/v1/plan-day/alternatives', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req) => {
    const b = parse(z.object({
      arrive: z.string().datetime({ offset: true }), durationMin: z.number().int().min(10).max(600), near: z.object({ lat: z.number(), lng: z.number() }),
      categories: z.array(z.string()).max(30).optional(), exclude: z.array(Uuid).max(30).optional(), locale: z.string().optional(),
    }), req.body);
    const ctx = resolveContext({ lat: b.near.lat, lng: b.near.lng, radiusKm: 3, locale: localeOf(req, b.locale) }, now());
    return { items: await planAlternatives(db, ctx, b) };
  });

  // Saved plans (account) and read-only shared plans (no sign-in needed).
  const SavedPlan = z.object({ title: z.string().trim().min(1).max(120), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), params: PlanParams.omit({ date: true }), items: PlanItems });
  const planView = async (row: { id: string; title: string; date: string; params: z.infer<typeof PlanParams>; items: z.infer<typeof PlanItems>; share_token: string | null }, req: FastifyRequest) => ({
    id: row.id, title: row.title, date: row.date, params: row.params, items: row.items, shareToken: row.share_token,
    plan: await evaluatePlanItems(db, planCtx({ ...row.params, date: row.date }, req), { ...row.params, date: row.date, items: row.items }).catch(() => null),
  });
  app.get('/v1/me/plans', async (req) => {
    const user = requireUser(req);
    const r = await db.query(`SELECT id, title, to_char(date, 'YYYY-MM-DD') AS date, jsonb_array_length(items) AS stops, share_token, updated_at FROM saved_plans WHERE user_id = $1 ORDER BY date DESC, updated_at DESC LIMIT 100`, [user.id]);
    return { items: r.rows.map((x) => ({ id: x.id, title: x.title, date: x.date, stops: x.stops, shared: !!x.share_token, updatedAt: x.updated_at })) };
  });
  app.get('/v1/me/plans/:id', async (req) => {
    const user = requireUser(req);
    const { id } = parse(z.object({ id: Uuid }), req.params);
    const r = await db.query(`SELECT id, title, to_char(date, 'YYYY-MM-DD') AS date, params, items, share_token FROM saved_plans WHERE id = $1 AND user_id = $2`, [id, user.id]);
    if (!r.rows[0]) throw new ApiError(404, 'not_found', 'Plan not found');
    return planView(r.rows[0], req);
  });
  app.post('/v1/me/plans', async (req) => {
    const user = requireUser(req);
    const b = parse(SavedPlan, req.body);
    const count = await db.query(`SELECT count(*)::int AS n FROM saved_plans WHERE user_id = $1`, [user.id]);
    if (count.rows[0].n >= 200) throw new ApiError(400, 'limit', 'Too many saved plans');
    const r = await db.query(`INSERT INTO saved_plans (user_id, title, date, params, items) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [user.id, b.title, b.date, JSON.stringify(b.params), JSON.stringify(b.items)]);
    return { id: r.rows[0].id };
  });
  app.put('/v1/me/plans/:id', async (req) => {
    const user = requireUser(req);
    const { id } = parse(z.object({ id: Uuid }), req.params);
    const b = parse(SavedPlan, req.body);
    const r = await db.query(`UPDATE saved_plans SET title=$3, date=$4, params=$5, items=$6, updated_at=now() WHERE id = $1 AND user_id = $2`, [id, user.id, b.title, b.date, JSON.stringify(b.params), JSON.stringify(b.items)]);
    if (!r.rowCount) throw new ApiError(404, 'not_found', 'Plan not found');
    return { id };
  });
  app.delete('/v1/me/plans/:id', async (req, reply) => {
    const user = requireUser(req);
    const { id } = parse(z.object({ id: Uuid }), req.params);
    const r = await db.query(`DELETE FROM saved_plans WHERE id = $1 AND user_id = $2`, [id, user.id]);
    if (!r.rowCount) throw new ApiError(404, 'not_found', 'Plan not found');
    return reply.status(204).send();
  });
  app.post('/v1/me/plans/:id/share', async (req) => {
    const user = requireUser(req);
    const { id } = parse(z.object({ id: Uuid }), req.params);
    const r = await db.query<{ share_token: string }>(`UPDATE saved_plans SET share_token = COALESCE(share_token, $3) WHERE id = $1 AND user_id = $2 RETURNING share_token`, [id, user.id, randomBytes(12).toString('base64url')]);
    if (!r.rows[0]) throw new ApiError(404, 'not_found', 'Plan not found');
    return { token: r.rows[0].share_token };
  });
  app.get('/v1/plans/shared/:token', async (req) => {
    const { token } = parse(z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{8,40}$/) }), req.params);
    const r = await db.query(`SELECT id, title, to_char(date, 'YYYY-MM-DD') AS date, params, items, share_token FROM saved_plans WHERE share_token = $1`, [token]);
    if (!r.rows[0]) throw new ApiError(404, 'not_found', 'Plan not found');
    const v = await planView(r.rows[0], req);
    return { ...v, id: undefined, shareToken: undefined };
  });

  app.get('/v1/weather', async (req) => {
    const q = parse(z.object({ lat: z.coerce.number(), lng: z.coerce.number(), locale: z.string().optional() }), req.query);
    return { weather: await getWeather(db, deps.http, q.lat, q.lng, localeOf(req, q.locale), now()) };
  });

  // ── Reports & organiser submissions ──
  app.post('/v1/reports', { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, async (req) => {
    const b = parse(z.object({
      entityType: z.enum(['event', 'place']),
      entityId: Uuid,
      kind: z.enum(['cancelled', 'wrong_time', 'wrong_location', 'wrong_price', 'closed', 'duplicate', 'inappropriate', 'other']),
      message: z.string().max(2000).optional(),
      proposed: z.record(z.string(), z.unknown()).optional(),
    }), req.body);
    const table = b.entityType === 'event' ? 'events' : 'places';
    const exists = await db.query(`SELECT 1 FROM ${table} WHERE id = $1`, [b.entityId]);
    if (!exists.rowCount) throw new ApiError(404, 'not_found', 'Not found');
    const clientKey = createHash('sha256').update(`${config.REPORT_SALT}|${req.ip}`).digest('hex').slice(0, 32);
    const r = await db.query<{ id: string }>(
      `INSERT INTO reports (user_id, client_key, entity_type, entity_id, kind, message, proposed) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [req.user?.id ?? null, clientKey, b.entityType, b.entityId, b.kind, b.message ?? null, b.proposed ? JSON.stringify(b.proposed) : null],
    );
    return { id: r.rows[0]!.id, status: 'received' };
  });

  app.post('/v1/submissions/events', { config: { rateLimit: { max: 10, timeWindow: '1 day' } } }, async (req) => {
    if (!req.user) throw new ApiError(401, 'auth_required', 'Sign in to submit events');
    const b = parse(z.object({
      title: z.string().trim().min(3).max(200),
      description: z.string().max(4000).optional(),
      category: z.string().refine((s) => getCategory(s)?.kind !== 'place', 'invalid event category'),
      venueName: z.string().max(200),
      address: z.string().max(300).optional(),
      city: z.string().refine((s) => CITIES.some((c) => c.slug === s), 'unknown city'),
      lat: z.number().optional(),
      lng: z.number().optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
      isFree: z.boolean().optional(),
      priceMin: z.number().min(0).optional(),
      priceMax: z.number().min(0).optional(),
      ticketUrl: z.string().url().optional(),
      website: z.string().url().optional(),
      organizer: z.string().max(200),
      contact: z.string().max(200),
    }), req.body);
    const r = await db.query<{ id: string }>('INSERT INTO event_submissions (user_id, contact, payload) VALUES ($1,$2,$3) RETURNING id', [req.user.id, b.contact, JSON.stringify(b)]);
    return { id: r.rows[0]!.id, status: 'pending_review' };
  });

  // Integration status (no secrets) — useful for the app's "about data" screen.
  // Coverage: how many real places and upcoming events each category has (no demo data), with how many have photos,
  // a confirmed address and opening hours. Public so anyone can judge how complete the data is.
  app.get('/v1/coverage', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async () => {
    const places = await db.query<{ slug: string; total: number; photos: number; verified_address: number; hours: number; primary_count: number }>(
      `SELECT c AS slug, count(*)::int AS total,
              count(*) FILTER (WHERE jsonb_array_length(coalesce(p.images, '[]'::jsonb)) > 0)::int AS photos,
              count(*) FILTER (WHERE p.address_check->>'status' = 'verified')::int AS verified_address,
              count(*) FILTER (WHERE p.opening_hours IS NOT NULL)::int AS hours,
              count(*) FILTER (WHERE p.primary_category = c)::int AS primary_count
         FROM places p, unnest(p.categories) AS c
        WHERE p.merged_into IS NULL AND p.status = 'active' AND NOT p.is_demo
        GROUP BY c`);
    const events = await db.query<{ slug: string; total: number }>(
      `SELECT c AS slug, count(*)::int AS total FROM events e, unnest(e.categories) AS c
        WHERE e.merged_into IS NULL AND e.status NOT IN ('cancelled', 'unlisted') AND NOT e.is_demo AND coalesce(e.ends_at, e.starts_at) >= now()
        GROUP BY c`);
    const totals = await db.query<{ places: number; photos: number; verified_address: number; hours: number; events: number }>(
      `SELECT (SELECT count(*) FROM places WHERE merged_into IS NULL AND status = 'active' AND NOT is_demo)::int AS places,
              (SELECT count(*) FROM places WHERE merged_into IS NULL AND status = 'active' AND NOT is_demo AND jsonb_array_length(coalesce(images, '[]'::jsonb)) > 0)::int AS photos,
              (SELECT count(*) FROM places WHERE merged_into IS NULL AND status = 'active' AND NOT is_demo AND address_check->>'status' = 'verified')::int AS verified_address,
              (SELECT count(*) FROM places WHERE merged_into IS NULL AND status = 'active' AND NOT is_demo AND opening_hours IS NOT NULL)::int AS hours,
              (SELECT count(*) FROM events WHERE merged_into IS NULL AND status NOT IN ('cancelled', 'unlisted') AND NOT is_demo AND coalesce(ends_at, starts_at) >= now())::int AS events`);
    const byPlace = new Map(places.rows.map((r) => [r.slug, r]));
    const byEvent = new Map(events.rows.map((r) => [r.slug, r.total]));
    const categories = CATEGORIES.map((c) => {
      const p = byPlace.get(c.slug);
      return { slug: c.slug, label: c.label.en, group: c.group, bucket: c.bucket ?? null, places: p?.total ?? 0, primary: p?.primary_count ?? 0, withPhotos: p?.photos ?? 0, verifiedAddress: p?.verified_address ?? 0, withHours: p?.hours ?? 0, upcomingEvents: byEvent.get(c.slug) ?? 0 };
    });
    const buckets: Record<string, { places: number; events: number }> = {};
    for (const c of categories) {
      if (!c.bucket) continue;
      buckets[c.bucket] ??= { places: 0, events: 0 };
      buckets[c.bucket]!.places += c.primary;
      buckets[c.bucket]!.events += c.upcomingEvents;
    }
    return { generatedAt: new Date().toISOString(), totals: totals.rows[0], buckets, categories };
  });

  app.get('/v1/status', async () => {
    // Public sources only: the last run's outcome lets anyone see whether data is fresh and why an import failed.
    const r = await db.query<{ key: string; name: string; last_success_at: Date | null; next_run_at: Date | null; run_status: string | null; run_started: Date | null; run_finished: Date | null; fetched: number | null; created: number | null; error_message: string | null; places: number }>(
      `SELECT s.key, s.name, s.last_success_at, s.next_run_at, r.status AS run_status, r.started_at AS run_started, r.finished_at AS run_finished,
              r.fetched, r.created, r.error_message,
              (SELECT count(*)::int FROM source_records sr WHERE sr.source_id = s.id) AS places
         FROM sources s
         LEFT JOIN LATERAL (SELECT * FROM ingestion_runs ir WHERE ir.source_id = s.id ORDER BY ir.started_at DESC LIMIT 1) r ON true
        WHERE s.enabled ORDER BY s.name`);
    return {
      integrations: integrationStatus(config),
      sources: r.rows.map((x) => ({
        key: x.key, name: x.name, lastSuccessAt: x.last_success_at?.toISOString() ?? null, nextRunAt: x.next_run_at?.toISOString() ?? null, records: x.places,
        lastRun: x.run_status ? { status: x.run_status, startedAt: x.run_started?.toISOString() ?? null, finishedAt: x.run_finished?.toISOString() ?? null, fetched: x.fetched, created: x.created, error: x.error_message?.slice(0, 300) ?? null } : null,
      })),
    };
  });
}

export type { EntityDTO };
