import { CITIES, INTEREST_GROUPS, LOCALES } from '@passtra/core';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app';
import { tx } from '../db';
import { ApiError, localeOf, parse, requireUser } from '../http';
import { eventToDTO, getEventRow, getPlaceRow, placeToDTO } from '../repo/entities';
import { profileOf } from './auth';

const Uuid = z.string().uuid();
const EntityType = z.enum(['event', 'place']);

const NotificationPrefs = z.object({
  enabled: z.boolean(),
  maxPerDay: z.number().int().min(0).max(5),
  maxPerWeek: z.number().int().min(0).max(20),
  quietStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  quietEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  categories: z.array(z.string()).max(80),
  newInCity: z.boolean(),
  favoritesUpdates: z.boolean(),
});

export async function meRoutes(app: FastifyInstance, deps: AppDeps) {
  const { db } = deps;

  const profile = (userId: string) => profileOf(db, userId);

  app.get('/v1/me', async (req) => profile(requireUser(req).id));

  app.patch('/v1/me', async (req) => {
    const user = requireUser(req);
    const b = parse(z.object({
      name: z.string().trim().max(80).nullable().optional(),
      locale: z.enum(LOCALES).optional(),
      interests: z.array(z.enum([...INTEREST_GROUPS, 'other'] as [string, ...string[]])).max(13).optional(),
      ageRange: z.enum(['under_18', '18_24', '25_34', '35_44', '45_54', '55_plus']).nullable().optional(),
      budget: z.enum(['free', 'low', 'medium', 'high']).nullable().optional(),
      homeCity: z.string().refine((s) => CITIES.some((c) => c.slug === s)).nullable().optional(),
      personalizationEnabled: z.boolean().optional(),
      notificationPrefs: NotificationPrefs.partial().optional(),
    }), req.body);
    const sets: string[] = [];
    const params: unknown[] = [user.id];
    const set = (col: string, v: unknown, cast = '') => {
      params.push(v);
      sets.push(`${col} = $${params.length}${cast}`);
    };
    if (b.name !== undefined) set('name', b.name || null);
    if (b.locale) set('locale', b.locale);
    if (b.interests) set('interests', b.interests.flatMap((i) => (i === 'other' ? ['wellness', 'practical'] : [i])));
    if (b.ageRange !== undefined) set('age_range', b.ageRange);
    if (b.budget !== undefined) set('budget', b.budget);
    if (b.homeCity !== undefined) {
      params.push(b.homeCity);
      sets.push(`home_city_id = (SELECT id FROM cities WHERE slug = $${params.length})`);
    }
    if (b.personalizationEnabled !== undefined) set('personalization_enabled', b.personalizationEnabled);
    if (b.notificationPrefs) {
      params.push(JSON.stringify(b.notificationPrefs));
      sets.push(`notification_prefs = notification_prefs || $${params.length}::jsonb`);
    }
    if (sets.length) await db.query(`UPDATE users SET ${sets.join(', ')}, updated_at = now() WHERE id = $1`, params);
    // Turning personalisation off deletes the interaction history it was built from.
    if (b.personalizationEnabled === false) await db.query('DELETE FROM user_interactions WHERE user_id = $1', [user.id]);
    return profile(user.id);
  });

  // GDPR: export everything we hold about the user.
  app.get('/v1/me/export', async (req) => {
    const user = requireUser(req);
    const [p, saved, lists, interactions, reviews, reports, tokens, notifications, submissions] = await Promise.all([
      profile(user.id),
      db.query('SELECT entity_type, entity_id, list_id, note, created_at FROM saved_items WHERE user_id = $1', [user.id]),
      db.query('SELECT id, title, is_public, created_at FROM user_lists WHERE user_id = $1', [user.id]),
      db.query('SELECT entity_type, entity_id, kind, created_at FROM user_interactions WHERE user_id = $1 ORDER BY created_at DESC', [user.id]),
      db.query('SELECT entity_type, entity_id, rating, body, status, created_at FROM reviews WHERE user_id = $1', [user.id]),
      db.query('SELECT entity_type, entity_id, kind, message, status, created_at FROM reports WHERE user_id = $1', [user.id]),
      db.query('SELECT platform, created_at, last_used_at FROM push_tokens WHERE user_id = $1', [user.id]),
      db.query('SELECT entity_type, entity_id, kind, title, status, created_at FROM notification_log WHERE user_id = $1', [user.id]),
      db.query('SELECT payload, status, created_at FROM event_submissions WHERE user_id = $1', [user.id]),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      note: 'passtra does not store your location history. Location is used only to answer each request.',
      profile: p, savedItems: saved.rows, lists: lists.rows, interactions: interactions.rows, reviews: reviews.rows,
      reports: reports.rows, pushDevices: tokens.rows, notifications: notifications.rows, eventSubmissions: submissions.rows,
    };
  });

  // GDPR / App Store 5.1.1(v): in-app account deletion removes all personal data.
  app.delete('/v1/me', async (req, reply) => {
    const user = requireUser(req);
    await tx(db, async (c) => {
      await c.query('UPDATE reports SET user_id = NULL WHERE user_id = $1', [user.id]);
      await c.query('UPDATE event_submissions SET user_id = NULL, contact = NULL WHERE user_id = $1', [user.id]);
      await c.query('DELETE FROM users WHERE id = $1', [user.id]); // cascades: saved, lists, interactions, tokens, notifications, reviews
    });
    return reply.status(204).send();
  });

  // ── Saved ──
  app.get('/v1/me/saved', async (req) => {
    const user = requireUser(req);
    const locale = localeOf(req, (req.query as { locale?: string }).locale);
    const now = new Date();
    const r = await db.query<{ entity_type: 'event' | 'place'; entity_id: string; list_id: string | null; note: string | null; created_at: Date }>(
      'SELECT entity_type, entity_id, list_id, note, created_at FROM saved_items WHERE user_id = $1 ORDER BY created_at DESC LIMIT 500', [user.id]);
    const items = [];
    for (const s of r.rows) {
      const entity = s.entity_type === 'event'
        ? await getEventRow(db, s.entity_id, null).then((row) => (row ? eventToDTO(row, locale, now) : null))
        : await getPlaceRow(db, s.entity_id, null).then((row) => (row ? placeToDTO(row, locale, now) : null));
      if (entity) items.push({ entity, listId: s.list_id, note: s.note, savedAt: s.created_at.toISOString() });
    }
    return { items };
  });

  app.put('/v1/me/saved/:type/:id', async (req) => {
    const user = requireUser(req);
    const { type, id } = parse(z.object({ type: EntityType, id: Uuid }), req.params);
    const b = parse(z.object({ listId: Uuid.nullable().optional(), note: z.string().max(500).optional() }).default({}), req.body ?? {});
    const exists = await db.query(`SELECT 1 FROM ${type === 'event' ? 'events' : 'places'} WHERE id = $1`, [id]);
    if (!exists.rowCount) throw new ApiError(404, 'not_found', 'Not found');
    if (b.listId) {
      const own = await db.query('SELECT 1 FROM user_lists WHERE id = $1 AND user_id = $2', [b.listId, user.id]);
      if (!own.rowCount) throw new ApiError(404, 'not_found', 'List not found');
    }
    await db.query(
      `INSERT INTO saved_items (user_id, entity_type, entity_id, list_id, note) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, entity_type, entity_id) DO UPDATE SET list_id = EXCLUDED.list_id, note = COALESCE(EXCLUDED.note, saved_items.note)`,
      [user.id, type, id, b.listId ?? null, b.note ?? null],
    );
    const personal = await db.query<{ p: boolean }>('SELECT personalization_enabled AS p FROM users WHERE id = $1', [user.id]);
    if (personal.rows[0]?.p) await db.query(`INSERT INTO user_interactions (user_id, entity_type, entity_id, kind) VALUES ($1,$2,$3,'save')`, [user.id, type, id]);
    return { saved: true };
  });

  app.delete('/v1/me/saved/:type/:id', async (req) => {
    const user = requireUser(req);
    const { type, id } = parse(z.object({ type: EntityType, id: Uuid }), req.params);
    await db.query('DELETE FROM saved_items WHERE user_id = $1 AND entity_type = $2 AND entity_id = $3', [user.id, type, id]);
    return { saved: false };
  });

  // ── Lists ──
  app.get('/v1/me/lists', async (req) => {
    const user = requireUser(req);
    const r = await db.query(
      `SELECT l.id, l.title, l.is_public, l.created_at, COUNT(s.entity_id)::int AS count
         FROM user_lists l LEFT JOIN saved_items s ON s.list_id = l.id WHERE l.user_id = $1 GROUP BY l.id ORDER BY l.created_at`, [user.id]);
    return { items: r.rows.map((x) => ({ id: x.id, title: x.title, isPublic: x.is_public, count: x.count, createdAt: x.created_at })) };
  });
  app.post('/v1/me/lists', async (req) => {
    const user = requireUser(req);
    const b = parse(z.object({ title: z.string().trim().min(1).max(80) }), req.body);
    const n = await db.query<{ n: number }>('SELECT COUNT(*)::int AS n FROM user_lists WHERE user_id = $1', [user.id]);
    if ((n.rows[0]?.n ?? 0) >= 50) throw new ApiError(400, 'limit', 'Too many lists');
    const r = await db.query<{ id: string }>('INSERT INTO user_lists (user_id, title) VALUES ($1,$2) RETURNING id', [user.id, b.title]);
    return { id: r.rows[0]!.id, title: b.title };
  });
  app.delete('/v1/me/lists/:id', async (req, reply) => {
    const user = requireUser(req);
    const { id } = parse(z.object({ id: Uuid }), req.params);
    await db.query('DELETE FROM user_lists WHERE id = $1 AND user_id = $2', [id, user.id]);
    return reply.status(204).send();
  });

  // ── Interactions (only stored when personalisation is on) ──
  app.post('/v1/me/interactions', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req) => {
    const user = requireUser(req);
    const b = parse(z.object({ items: z.array(z.object({ entityType: EntityType, entityId: Uuid, kind: z.enum(['view', 'open', 'share', 'dismiss', 'hide', 'click_ticket', 'navigate']) })).min(1).max(50) }), req.body);
    const u = await db.query<{ p: boolean }>('SELECT personalization_enabled AS p FROM users WHERE id = $1', [user.id]);
    if (!u.rows[0]?.p) return { stored: 0 };
    await db.query(
      `INSERT INTO user_interactions (user_id, entity_type, entity_id, kind) SELECT $1, t, i::uuid, k FROM unnest($2::text[], $3::text[], $4::text[]) AS x(t, i, k)`,
      [user.id, b.items.map((x) => x.entityType), b.items.map((x) => x.entityId), b.items.map((x) => x.kind)],
    );
    return { stored: b.items.length };
  });

  // ── Push tokens ──
  app.post('/v1/me/push-tokens', async (req) => {
    const user = requireUser(req);
    const b = parse(z.object({ token: z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/), platform: z.enum(['ios', 'android']) }), req.body);
    await db.query(
      `INSERT INTO push_tokens (token, user_id, platform) VALUES ($1,$2,$3)
       ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, disabled_at = NULL`,
      [b.token, user.id, b.platform],
    );
    return { registered: true };
  });
  app.delete('/v1/me/push-tokens', async (req, reply) => {
    const user = requireUser(req);
    const b = parse(z.object({ token: z.string() }), req.body);
    await db.query('DELETE FROM push_tokens WHERE token = $1 AND user_id = $2', [b.token, user.id]);
    return reply.status(204).send();
  });

  // ── Reviews ──
  app.post('/v1/:type/:id/reviews', { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (req) => {
    const user = requireUser(req);
    const p = parse(z.object({ type: z.enum(['events', 'places']), id: Uuid }), req.params);
    const b = parse(z.object({ rating: z.number().int().min(1).max(5), body: z.string().trim().max(2000).optional() }), req.body);
    const type = p.type === 'events' ? 'event' : 'place';
    const exists = await db.query(`SELECT 1 FROM ${p.type} WHERE id = $1`, [p.id]);
    if (!exists.rowCount) throw new ApiError(404, 'not_found', 'Not found');
    await tx(db, async (c) => {
      await c.query(
        `INSERT INTO reviews (user_id, entity_type, entity_id, rating, body) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (user_id, entity_type, entity_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body, updated_at = now()`,
        [user.id, type, p.id, b.rating, b.body ?? null],
      );
      if (type === 'place') {
        await c.query(
          `UPDATE places SET (user_rating_avg, user_rating_count) =
             (SELECT AVG(rating)::numeric(3,2), COUNT(*) FROM reviews WHERE entity_type = 'place' AND entity_id = $1 AND status = 'published') WHERE id = $1`,
          [p.id],
        );
      }
    });
    return { ok: true };
  });
}
