import { createHash } from 'node:crypto';
import {
  CATEGORIES, CITIES, COUNTRIES, GROUP_LABELS, INTEREST_GROUPS, LOCALES, ONBOARDING_INTERESTS, canonicalKey, categoriesInGroup, expandCategories, getCategory,
  navigationLinks, pickText, timeWindow, type EntityDTO, type InterestGroup,
} from '@passtra/core';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { integrationStatus } from '../config';
import { googleLive, resolveGooglePlaceId } from '../lib/google';
import { getWeather } from '../lib/weather';
import { ApiError, LocationQuery, csv, localeOf, parse } from '../http';
import {
  Sql, categoriesWhere, distanceExpr, eventToDTO, geoWhere, getEventRow, getPlaceRow, keywordsWhere, placeToDTO, provenance, queryEvents,
  queryPlaces, resolveMergedId, upcomingWhere, windowWhere,
} from '../repo/entities';
import { buildFeed, loadProfile, planMyDay, recommendations, resolveContext, search, surpriseMe } from '../services/discovery';
import type { AppDeps } from '../app';

const Uuid = z.string().uuid();
const InterestsParam = csv(INTEREST_GROUPS);
const Budget = z.enum(['free', 'low', 'medium', 'high']).optional();
const TimeParam = z.enum(['now', 'today', 'tonight', 'tomorrow', 'weekend', 'this_week', 'next_7_days']).optional();

export async function publicRoutes(app: FastifyInstance, deps: AppDeps) {
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
    return { place: dto, upcomingEvents: events, navigation: navigationLinks(dto.location, dto.name) };
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

  app.get('/v1/places/:id/reviews', async (req) => {
    const { id } = parse(z.object({ id: Uuid }), req.params);
    const r = await db.query<{ rating: number; body: string | null; created_at: Date }>(
      `SELECT rating, body, created_at FROM reviews WHERE entity_type = 'place' AND entity_id = $1 AND status = 'published' ORDER BY created_at DESC LIMIT 50`, [id]);
    return { items: r.rows.map((x) => ({ rating: x.rating, body: x.body, createdAt: x.created_at.toISOString() })) };
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
    sort: z.enum(['time', 'distance']).default('time'),
    limit: z.coerce.number().int().min(1).max(100).default(40),
    offset: z.coerce.number().int().min(0).max(2000).default(0),
  });
  app.get('/v1/events', async (req) => {
    const p = parse(EventsQuery, req.query);
    const locale = localeOf(req, p.locale);
    const ctx = resolveContext({ lat: p.lat, lng: p.lng, city: p.city, radiusKm: p.radius, locale }, now());
    const q = new Sql();
    const dist = distanceExpr(q, 'e', ctx.geo);
    upcomingWhere(q, ctx.now);
    if (p.when) windowWhere(q, timeWindow(p.when, ctx.now, ctx.tz));
    if (p.from) q.where.push(`COALESCE(e.local_end_date, e.local_start_date) >= ${q.add(p.from)}::date`);
    if (p.to) q.where.push(`e.local_start_date <= ${q.add(p.to)}::date`);
    geoWhere(q, 'e', ctx.geo ? { ...ctx.geo, radiusKm: ctx.radiusKm } : null);
    categoriesWhere(q, 'e', expandCategories([...(p.category?.split(',').filter((s) => getCategory(s)) ?? []), ...(p.group ? categoriesInGroup(p.group).map((c) => c.slug) : [])]));
    if (p.free) q.where.push('e.is_free = true');
    if (p.q) keywordsWhere(q, 'e', [p.q], canonicalKey);
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
    return { event: dto, navigation: dto.location ? navigationLinks(dto.location, dto.venue.name ?? dto.title) : null };
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
    const ctx = resolveContext({ lat: b.lat, lng: b.lng, city: b.city, radiusKm: b.radius, locale }, now());
    const profile = await loadProfile(db, req.user?.id ?? null, { interests: b.interests });
    return search(db, deps.interpreter, b.q, ctx, profile);
  });

  // ── Recommendations ──
  app.get('/v1/recommendations', async (req) => {
    const q = parse(LocationQuery.extend({ interests: InterestsParam, budget: Budget, limit: z.coerce.number().int().min(1).max(50).default(20) }), req.query);
    const locale = localeOf(req, q.locale);
    const ctx = resolveContext({ lat: q.lat, lng: q.lng, city: q.city, radiusKm: q.radius, locale }, now());
    const profile = await loadProfile(db, req.user?.id ?? null, { interests: q.interests as InterestGroup[] | undefined, budget: q.budget });
    return { items: await recommendations(db, ctx, profile, q.limit) };
  });

  app.post('/v1/surprise', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const b = parse(z.object({ lat: z.number().optional(), lng: z.number().optional(), city: z.string().optional(), radius: z.number().min(0.5).max(100).optional(), locale: z.string().optional(), interests: z.array(z.enum(INTEREST_GROUPS)).optional(), count: z.number().int().min(1).max(8).default(4) }), req.body ?? {});
    const locale = localeOf(req, b.locale);
    const ctx = resolveContext({ lat: b.lat, lng: b.lng, city: b.city, radiusKm: b.radius, locale }, now());
    const profile = await loadProfile(db, req.user?.id ?? null, { interests: b.interests });
    return { items: await surpriseMe(db, ctx, profile, b.count) };
  });

  app.post('/v1/plan-day', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req) => {
    const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
    const b = parse(z.object({
      lat: z.number().optional(), lng: z.number().optional(), city: z.string().optional(), radius: z.number().min(1).max(60).optional(), locale: z.string().optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), start: hhmm, end: hhmm, budget: z.number().min(0).max(10000).nullable().optional(),
      interests: z.array(z.enum(INTEREST_GROUPS)).optional(), mode: z.enum(['walk', 'drive', 'auto']).default('auto'),
    }), req.body);
    const locale = localeOf(req, b.locale);
    const ctx = resolveContext({ lat: b.lat, lng: b.lng, city: b.city, radiusKm: b.radius ?? 15, locale }, now());
    const profile = await loadProfile(db, req.user?.id ?? null, { interests: b.interests });
    return planMyDay(db, ctx, profile, { date: b.date, start: b.start, end: b.end, budget: b.budget ?? null, interests: b.interests, mode: b.mode });
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
  app.get('/v1/status', async () => {
    const r = await db.query<{ key: string; name: string; last_success_at: Date | null; enabled: boolean }>('SELECT key, name, last_success_at, enabled FROM sources WHERE enabled ORDER BY name');
    return { integrations: integrationStatus(config), sources: r.rows.map((x) => ({ key: x.key, name: x.name, lastSuccessAt: x.last_success_at?.toISOString() ?? null })) };
  });
}

export type { EntityDTO };
