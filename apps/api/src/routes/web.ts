import { readFileSync, existsSync } from 'node:fs';
import { canonicalKey, haversineKm, isValidLatLng, type Locale } from '@passtra/core';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app';
import { ApiError, parse } from '../http';
import { Geocoder } from '../lib/geocode';
import { instruction } from '../transit/instructions';
import { planTransit } from '../transit/plan';

/**
 * Web-facing helpers:
 *  - /v1/route: in-app routing (OSRM-compatible service, FOSSGIS by default) with an honest straight-line fallback
 *  - /v1/geocode: manual start point search (our places first, then Nominatim)
 *  - deep links: index.html with per-object Open Graph tags for /event/:id and /place/:id
 *  - /.well-known files for iOS Universal Links and Android App Links
 */

const LatLng = z.string().regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/).transform((s) => {
  const [lat, lng] = s.split(',').map(Number) as [number, number];
  if (!isValidLatLng(lat, lng)) throw new Error('invalid');
  return { lat, lng };
});

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export type RouteMode = 'walk' | 'bike' | 'drive';
const PROFILE: Record<RouteMode, string> = { walk: 'routed-foot/route/v1/foot', bike: 'routed-bike/route/v1/bike', drive: 'routed-car/route/v1/driving' };

export interface StreetRoute {
  mode: RouteMode; estimate: boolean; distanceKm: number; durationMin: number; geometry: Array<[number, number]>; attribution: string | null;
  steps: Array<{ text: string; distanceM: number; durationMin: number; location: [number, number] }>;
}

/**
 * Street routing for one mode via an OSRM service (FOSSGIS by default: separate foot, bicycle and car profiles —
 * a bicycle route is never a car route). Cached 7 days per rounded endpoints. Fallback: straight-line estimate, flagged.
 */
export async function streetRoute(deps: AppDeps, mode: RouteMode, from: { lat: number; lng: number }, to: { lat: number; lng: number }, locale: Locale): Promise<StreetRoute> {
  const { db, config } = deps;
  const km = haversineKm(from, to);
  const key = `route2:${mode}:${locale}:${from.lat.toFixed(5)},${from.lng.toFixed(5)}:${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
  const cached = await db.query<{ payload: StreetRoute }>('SELECT payload FROM http_cache WHERE key = $1 AND expires_at > now()', [key]);
  if (cached.rows[0]) return cached.rows[0].payload;
  try {
    const url = `${config.ROUTING_URL.replace(/\/$/, '')}/${PROFILE[mode]}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`;
    type Step = { distance: number; duration: number; name: string; maneuver: { type: string; modifier?: string; exit?: number; location: [number, number] } };
    const res = await deps.http.json<{ code: string; routes?: Array<{ distance: number; duration: number; geometry: { coordinates: Array<[number, number]> }; legs: Array<{ steps: Step[] }> }> }>(url, { timeoutMs: 12_000 });
    const route = res.data?.routes?.[0];
    if (res.data?.code !== 'Ok' || !route) throw new Error('no route');
    const steps = (route.legs[0]?.steps ?? []).map((st) => ({ text: instruction(st.maneuver, st.name, locale), distanceM: Math.round(st.distance), durationMin: Math.round(st.duration / 6) / 10, location: st.maneuver.location }))
      .filter((x): x is StreetRoute['steps'][number] & { text: string } => !!x.text);
    const payload: StreetRoute = {
      mode, estimate: false, distanceKm: Math.round(route.distance / 100) / 10, durationMin: Math.max(1, Math.round(route.duration / 60)),
      geometry: route.geometry.coordinates, attribution: 'Routing © OpenStreetMap contributors, OSRM (FOSSGIS)', steps,
    };
    await db.query(`INSERT INTO http_cache (key, payload, expires_at) VALUES ($1,$2, now() + interval '7 days') ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, expires_at = EXCLUDED.expires_at`, [key, JSON.stringify(payload)]);
    return payload;
  } catch {
    const speed = mode === 'walk' ? 4.5 : mode === 'bike' ? 15 : 35;
    return { mode, estimate: true, distanceKm: Math.round(km * 13) / 10, durationMin: Math.max(1, Math.round(((km * 1.3) / speed) * 60)), geometry: [[from.lng, from.lat], [to.lng, to.lat]], attribution: null, steps: [] };
  }
}

export async function webRoutes(app: FastifyInstance, deps: AppDeps) {
  const { db, config } = deps;

  // All four ways to get somewhere, each with distance, time and arrival; public transport from official timetables.
  app.get('/v1/directions', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const q = parse(z.object({ from: LatLng, to: LatLng, at: z.string().datetime({ offset: true }).optional(), locale: z.string().optional() }), req.query);
    const locale = (['en', 'el', 'ru'].includes(q.locale ?? '') ? q.locale : 'en') as Locale;
    if (haversineKm(q.from, q.to) > 250) throw new ApiError(400, 'too_far', 'Route is too long');
    const at = q.at ? new Date(q.at) : deps.now?.() ?? new Date();
    const eta = (min: number) => new Date(at.getTime() + min * 60_000).toISOString();
    const [walk, bike, drive, transit] = await Promise.all([
      streetRoute(deps, 'walk', q.from, q.to, locale), streetRoute(deps, 'bike', q.from, q.to, locale), streetRoute(deps, 'drive', q.from, q.to, locale),
      planTransit(db, q.from, q.to, at).catch((e) => { req.log.warn({ err: (e as Error).message }, 'transit planning failed'); return null; }),
    ]);
    return {
      departAt: at.toISOString(),
      walk: { ...walk, arriveAt: eta(walk.durationMin) },
      bike: { ...bike, arriveAt: eta(bike.durationMin), note: 'cycling_network' },
      drive: { ...drive, arriveAt: eta(drive.durationMin), note: 'no_live_traffic' },
      transit: transit ?? { status: 'unavailable', options: [], scheduledOnly: true, validUntil: null, attribution: null },
    };
  });

  app.get('/v1/route', { config: { rateLimit: { max: 40, timeWindow: '1 minute' } } }, async (req) => {
    const q = parse(z.object({ from: LatLng, to: LatLng, mode: z.enum(['walk', 'drive']).default('walk') }), req.query);
    const km = haversineKm(q.from, q.to);
    if (km > 250) throw new ApiError(400, 'too_far', 'Route is too long');
    const key = `route:${q.mode}:${q.from.lat.toFixed(5)},${q.from.lng.toFixed(5)}:${q.to.lat.toFixed(5)},${q.to.lng.toFixed(5)}`;
    const cached = await db.query<{ payload: unknown }>('SELECT payload FROM http_cache WHERE key = $1 AND expires_at > now()', [key]);
    if (cached.rows[0]) return cached.rows[0].payload;
    const profile = q.mode === 'walk' ? 'routed-foot/route/v1/foot' : 'routed-car/route/v1/driving';
    try {
      const url = `${config.ROUTING_URL.replace(/\/$/, '')}/${profile}/${q.from.lng},${q.from.lat};${q.to.lng},${q.to.lat}?overview=full&geometries=geojson&steps=false`;
      const res = await deps.http.json<{ code: string; routes?: Array<{ distance: number; duration: number; geometry: { coordinates: Array<[number, number]> } }> }>(url, { timeoutMs: 12_000 });
      const route = res.data?.routes?.[0];
      if (res.data?.code !== 'Ok' || !route) throw new Error('no route');
      const payload = {
        mode: q.mode, estimate: false, distanceKm: Math.round(route.distance / 100) / 10, durationMin: Math.max(1, Math.round(route.duration / 60)),
        geometry: route.geometry.coordinates, attribution: 'Routing © OpenStreetMap contributors, OSRM (FOSSGIS)',
      };
      await db.query(`INSERT INTO http_cache (key, payload, expires_at) VALUES ($1,$2, now() + interval '7 days') ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, expires_at = EXCLUDED.expires_at`, [key, JSON.stringify(payload)]);
      return payload;
    } catch {
      // Routing service unavailable: a straight line, clearly marked as an estimate.
      const speed = q.mode === 'walk' ? 4.5 : 35;
      return { mode: q.mode, estimate: true, distanceKm: Math.round(km * 13) / 10, durationMin: Math.max(1, Math.round(((km * 1.3) / speed) * 60)), geometry: [[q.from.lng, q.from.lat], [q.to.lng, q.to.lat]], attribution: null };
    }
  });

  app.get('/v1/geocode', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const q = parse(z.object({ q: z.string().trim().min(2).max(120) }), req.query);
    const places = await db.query<{ id: string; name: string; address: string | null; lat: number; lng: number }>(
      `SELECT id, name, address, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng FROM places
        WHERE merged_into IS NULL AND status = 'active' AND word_similarity($1, search_doc) > 0.5
        ORDER BY word_similarity($1, search_doc) DESC, confidence DESC LIMIT 5`, [canonicalKey(q.q)]);
    const items = places.rows.map((p) => ({ label: p.name, sublabel: p.address, lat: p.lat, lng: p.lng, source: 'passtra' as const }));
    const g = await new Geocoder(db, deps.http, config.NOMINATIM_URL, config.GEOCODING_ENABLED).geocode(q.q, 'CY');
    if (g) items.push({ label: g.label.split(',').slice(0, 2).join(','), sublabel: g.label.split(',').slice(2, 5).join(',').trim() || null, lat: g.lat, lng: g.lng, source: 'osm' as unknown as 'passtra' });
    return { items };
  });

  // ── Universal Links / App Links (open shared objects in the installed app) ──
  app.get('/.well-known/apple-app-site-association', async (_req, reply) => {
    if (!config.APPLE_TEAM_ID) return reply.status(404).send();
    return reply.type('application/json').send({
      applinks: { details: [{ appIDs: [`${config.APPLE_TEAM_ID}.app.passtra.ios`], components: [{ '/': '/event/*' }, { '/': '/place/*' }, { '/': '/my-events/*' }] }] },
    });
  });
  app.get('/.well-known/assetlinks.json', async (_req, reply) => {
    if (!config.ANDROID_CERT_SHA256) return reply.status(404).send();
    return reply.send([{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: 'app.passtra.android', sha256_cert_fingerprints: config.ANDROID_CERT_SHA256.split(',').map((s) => s.trim()) } }]);
  });
}

/** index.html for client-side routes, with PWA tags and per-object Open Graph tags for link previews. */
export function makeIndexHandler(deps: AppDeps, appDir: string) {
  const file = `${appDir}/index.html`;
  let base: string | null = existsSync(file) ? readFileSync(file, 'utf8') : null;
  const pwa = '<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#1769E8"><link rel="apple-touch-icon" href="/icons/icon-192.png"><meta name="apple-mobile-web-app-capable" content="yes">';
  return async (req: FastifyRequest, reply: FastifyReply) => {
    base ??= readFileSync(file, 'utf8');
    const origin = deps.config.PUBLIC_WEB_URL ?? `${req.protocol}://${req.headers.host}`;
    let title = 'passtra — what’s happening around you';
    let description = 'Events, places and things to do nearby — from verified sources.';
    let image = `${origin}/icons/icon-512.png`;
    const m = req.url.match(/^\/(event|place)\/([0-9a-f-]{36})/i);
    if (m) {
      const isEvent = m[1] === 'event';
      const r = await deps.db.query<{ t: string; d: string | null; img: string | null; city: string | null }>(
        isEvent
          ? `SELECT e.title AS t, e.description AS d, e.images->0->>'url' AS img, c.name->>'en' AS city FROM events e LEFT JOIN cities c ON c.id = e.city_id WHERE e.id = $1`
          : `SELECT p.name AS t, p.description AS d, p.images->0->>'url' AS img, c.name->>'en' AS city FROM places p LEFT JOIN cities c ON c.id = p.city_id WHERE p.id = $1`,
        [m[2]],
      ).catch(() => ({ rows: [] as Array<{ t: string; d: string | null; img: string | null; city: string | null }> }));
      const row = r.rows[0];
      if (row) {
        title = `${row.t}${row.city ? ` · ${row.city}` : ''} — passtra`;
        description = (row.d ?? description).slice(0, 200);
        if (row.img) image = row.img;
      }
    }
    const tags = `<title>${esc(title)}</title><meta name="description" content="${esc(description)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="passtra"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}"><meta property="og:image" content="${esc(image)}"><meta property="og:url" content="${esc(origin + req.url.split('?')[0])}">
<meta name="twitter:card" content="summary_large_image">${pwa}`;
    const html = base.replace(/<title>[^<]*<\/title>/, '').replace('</head>', `${tags}</head>`);
    return reply.type('text/html; charset=utf-8').header('cache-control', 'no-cache').send(html);
  };
}
