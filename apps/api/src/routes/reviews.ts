import { createHash } from 'node:crypto';
import { normalizeText } from '@passtra/core';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import type { AppDeps } from '../app';
import { tx } from '../db';
import { ApiError, parse, requireRole, requireUser } from '../http';
import { Moderator, type Label } from '../services/moderation';

const Uuid = z.string().uuid();
const TYPE = z.enum(['events', 'places']);
const entityOf = (t: 'events' | 'places') => (t === 'events' ? 'event' : 'place') as 'event' | 'place';

/** Rating aggregates count only published reviews by passtra users (never mixed with Google or other ratings). */
export async function refreshRating(db: pg.Pool | pg.PoolClient, type: 'event' | 'place', id: string) {
  await db.query(
    `UPDATE ${type === 'event' ? 'events' : 'places'} SET (user_rating_avg, user_rating_count) =
       (SELECT AVG(rating)::numeric(3,2), COUNT(*) FROM reviews WHERE entity_type = $2 AND entity_id = $1 AND status = 'published') WHERE id = $1`,
    [id, type],
  );
}

export async function reviewRoutes(app: FastifyInstance, deps: AppDeps) {
  const { db, config } = deps;
  const moderator = new Moderator(config, app.log);
  const clientKey = (req: FastifyRequest) => createHash('sha256').update(`${config.REPORT_SALT}|${req.ip}`).digest('hex').slice(0, 32);

  const authorView = `COALESCE(NULLIF(u.name, ''), 'passtra user') AS author_name, u.avatar_url, u.avatar_preset`;
  const toItem = (r: Record<string, unknown>, viewer: string | null) => ({
    id: r.id, rating: r.rating, body: r.body, createdAt: (r.created_at as Date).toISOString(), editedAt: r.edited_at ? (r.edited_at as Date).toISOString() : null,
    helpfulCount: r.helpful_count, mine: viewer !== null && r.user_id === viewer, votedHelpful: !!r.voted,
    author: { name: r.author_name, avatarUrl: r.avatar_url ?? null, avatarPreset: r.avatar_preset ?? null },
    ...(viewer !== null && r.user_id === viewer ? { status: r.status } : {}),
  });

  app.get('/v1/:type/:id/reviews', async (req) => {
    const p = parse(z.object({ type: TYPE, id: Uuid }), req.params);
    const q = parse(z.object({ sort: z.enum(['recent', 'helpful']).default('recent'), limit: z.coerce.number().int().min(1).max(50).default(20), offset: z.coerce.number().int().min(0).max(1000).default(0) }), req.query);
    const type = entityOf(p.type);
    const viewer = req.user?.id ?? null;
    const dist = await db.query<{ rating: number; n: number }>(`SELECT rating, count(*)::int AS n FROM reviews WHERE entity_type = $1 AND entity_id = $2 AND status = 'published' GROUP BY rating`, [type, p.id]);
    const count = dist.rows.reduce((a, r) => a + r.n, 0);
    const avg = count ? dist.rows.reduce((a, r) => a + r.rating * r.n, 0) / count : null;
    const rows = await db.query(
      `SELECT r.*, ${authorView}, EXISTS (SELECT 1 FROM review_votes v WHERE v.review_id = r.id AND v.user_id = $3) AS voted
         FROM reviews r JOIN users u ON u.id = r.user_id
        WHERE r.entity_type = $1 AND r.entity_id = $2 AND (r.status = 'published' OR r.user_id = $3)
        ORDER BY (r.user_id = $3) DESC, ${q.sort === 'helpful' ? 'r.helpful_count DESC, ' : ''}r.created_at DESC LIMIT $4 OFFSET $5`,
      [type, p.id, viewer, q.limit, q.offset]);
    return {
      summary: { average: avg === null ? null : Math.round(avg * 10) / 10, count, distribution: Object.fromEntries([1, 2, 3, 4, 5].map((s) => [s, dist.rows.find((r) => r.rating === s)?.n ?? 0])) },
      items: rows.rows.map((r) => toItem(r, viewer)),
    };
  });

  /** Create or update the signed-in user's review (one per user per object). */
  app.post('/v1/:type/:id/reviews', { config: { rateLimit: { max: 20, timeWindow: '1 day' } } }, async (req) => {
    const user = requireUser(req);
    const p = parse(z.object({ type: TYPE, id: Uuid }), req.params);
    const b = parse(z.object({ rating: z.number().int().min(1).max(5), body: z.string().trim().max(2000).optional() }), req.body);
    const type = entityOf(p.type);
    const u = (await db.query<{ email_verified_at: Date | null; phone_verified_at: Date | null; created_at: Date }>('SELECT email_verified_at, phone_verified_at, created_at FROM users WHERE id = $1', [user.id])).rows[0];
    if (!u?.email_verified_at && !u?.phone_verified_at) throw new ApiError(403, 'verification_required', 'Confirm your email or phone number to post reviews.');
    const ent = await db.query<{ started: boolean }>(type === 'event' ? `SELECT starts_at <= now() AS started FROM events WHERE id = $1 AND merged_into IS NULL` : `SELECT true AS started FROM places WHERE id = $1 AND merged_into IS NULL`, [p.id]);
    if (!ent.rows[0]) throw new ApiError(404, 'not_found', 'Not found');
    if (!ent.rows[0].started) throw new ApiError(400, 'event_not_started', 'You can rate an event once it has started.');

    // Signals of fake reviews: the same text from another account; a burst of reviews from brand-new accounts.
    const extra: Label[] = [];
    const body = b.body ?? '';
    if (normalizeText(body).length >= 20) {
      const dup = await db.query(`SELECT 1 FROM reviews WHERE user_id <> $1 AND lower(body) = lower($2) AND created_at > now() - interval '30 days' LIMIT 1`, [user.id, body]);
      if (dup.rowCount) extra.push('duplicate');
    }
    const burst = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM reviews r JOIN users x ON x.id = r.user_id WHERE r.entity_type = $1 AND r.entity_id = $2 AND r.created_at > now() - interval '1 hour' AND x.created_at > now() - interval '1 day'`, [type, p.id]);
    if (burst.rows[0]!.n >= 4 && Date.now() - u.created_at.getTime() < 86_400_000) extra.push('suspicious_account');

    const m = body ? await moderator.moderate(body, extra) : { decision: extra.length ? 'pending' : 'publish', labels: extra, reasons: [], engine: 'rules' as const, text: '' };
    const status = m.decision === 'publish' ? 'published' : m.decision === 'pending' ? 'pending' : 'rejected';
    const saved = await tx(db, async (c) => {
      const r = await c.query<{ id: string; inserted: boolean }>(
        `INSERT INTO reviews (user_id, entity_type, entity_id, rating, body, status, moderation, moderated_at) VALUES ($1,$2,$3,$4,$5,$6,$7, now())
         ON CONFLICT (user_id, entity_type, entity_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body, status = EXCLUDED.status,
           moderation = EXCLUDED.moderation, moderated_at = now(), edited_at = now(), updated_at = now()
         RETURNING id, (xmax = 0) AS inserted`,
        [user.id, type, p.id, b.rating, m.text || null, status, JSON.stringify({ decision: m.decision, labels: m.labels, reasons: m.reasons, engine: m.engine })]);
      await refreshRating(c, type, p.id);
      return r.rows[0]!;
    });
    return { id: saved.id, status, created: saved.inserted, labels: m.labels, edited: m.text !== body };
  });

  app.delete('/v1/reviews/:id', async (req, reply) => {
    const user = requireUser(req);
    const { id } = parse(z.object({ id: Uuid }), req.params);
    const r = await db.query<{ entity_type: 'event' | 'place'; entity_id: string }>('DELETE FROM reviews WHERE id = $1 AND user_id = $2 RETURNING entity_type, entity_id', [id, user.id]);
    if (!r.rows[0]) throw new ApiError(404, 'not_found', 'Review not found'); // others' reviews can't be deleted
    await refreshRating(db, r.rows[0].entity_type, r.rows[0].entity_id);
    return reply.status(204).send();
  });

  app.post('/v1/reviews/:id/helpful', { config: { rateLimit: { max: 120, timeWindow: '1 hour' } } }, async (req) => {
    const user = requireUser(req);
    const { id } = parse(z.object({ id: Uuid }), req.params);
    const r = await db.query<{ user_id: string }>(`SELECT user_id FROM reviews WHERE id = $1 AND status = 'published'`, [id]);
    if (!r.rows[0]) throw new ApiError(404, 'not_found', 'Review not found');
    if (r.rows[0].user_id === user.id) throw new ApiError(400, 'own_review', 'You cannot vote for your own review.');
    await tx(db, async (c) => {
      const ins = await c.query('INSERT INTO review_votes (review_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, user.id]);
      if (ins.rowCount) await c.query('UPDATE reviews SET helpful_count = helpful_count + 1 WHERE id = $1', [id]);
    });
    return { ok: true };
  });
  app.delete('/v1/reviews/:id/helpful', async (req) => {
    const user = requireUser(req);
    const { id } = parse(z.object({ id: Uuid }), req.params);
    await tx(db, async (c) => {
      const del = await c.query('DELETE FROM review_votes WHERE review_id = $1 AND user_id = $2', [id, user.id]);
      if (del.rowCount) await c.query('UPDATE reviews SET helpful_count = GREATEST(0, helpful_count - 1) WHERE id = $1', [id]);
    });
    return { ok: true };
  });

  /** Anyone can report a review; three independent reports hide it until a moderator decides. */
  app.post('/v1/reviews/:id/report', { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (req) => {
    const { id } = parse(z.object({ id: Uuid }), req.params);
    const b = parse(z.object({ reason: z.enum(['offensive', 'spam', 'fake', 'personal_data', 'threat', 'other']), message: z.string().trim().max(1000).optional() }), req.body);
    const r = await db.query<{ entity_type: 'event' | 'place'; entity_id: string }>(`SELECT entity_type, entity_id FROM reviews WHERE id = $1 AND status = 'published'`, [id]);
    if (!r.rows[0]) throw new ApiError(404, 'not_found', 'Review not found');
    await tx(db, async (c) => {
      const ins = await c.query('INSERT INTO review_reports (review_id, user_id, client_key, reason, message) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (review_id, client_key) DO NOTHING',
        [id, req.user?.id ?? null, clientKey(req), b.reason, b.message ?? null]);
      if (ins.rowCount) {
        const u = await c.query<{ report_count: number }>('UPDATE reviews SET report_count = report_count + 1 WHERE id = $1 RETURNING report_count', [id]);
        if (u.rows[0]!.report_count >= 3 || b.reason === 'threat') {
          await c.query(`UPDATE reviews SET status = 'pending' WHERE id = $1`, [id]);
          await refreshRating(c, r.rows[0]!.entity_type, r.rows[0]!.entity_id);
        }
      }
    });
    return { status: 'received' };
  });

  // ── Moderation queue (admin) ──
  app.get('/v1/admin/reviews', async (req) => {
    requireRole(req, 'admin', 'moderator');
    const q = parse(z.object({ status: z.enum(['pending', 'rejected', 'published', 'reported']).default('pending') }), req.query);
    const where = q.status === 'reported' ? `r.report_count > 0 AND EXISTS (SELECT 1 FROM review_reports x WHERE x.review_id = r.id AND x.status = 'open')` : `r.status = '${q.status}'`;
    const r = await db.query(
      `SELECT r.id, r.entity_type, r.entity_id, r.rating, r.body, r.status, r.moderation, r.report_count, r.created_at, u.name AS author_name, u.email AS author_email,
              COALESCE(e.title, p.name) AS entity_title,
              (SELECT json_agg(json_build_object('reason', x.reason, 'message', x.message)) FROM review_reports x WHERE x.review_id = r.id AND x.status = 'open') AS reports
         FROM reviews r JOIN users u ON u.id = r.user_id
         LEFT JOIN events e ON r.entity_type = 'event' AND e.id = r.entity_id LEFT JOIN places p ON r.entity_type = 'place' AND p.id = r.entity_id
        WHERE ${where} ORDER BY r.created_at DESC LIMIT 200`);
    return { items: r.rows };
  });
  app.post('/v1/admin/reviews/:id', async (req) => {
    requireRole(req, 'admin', 'moderator');
    const { id } = parse(z.object({ id: Uuid }), req.params);
    const b = parse(z.object({ action: z.enum(['publish', 'reject', 'remove']), note: z.string().max(500).optional() }), req.body);
    const status = b.action === 'publish' ? 'published' : b.action === 'reject' ? 'rejected' : 'removed';
    const r = await db.query<{ entity_type: 'event' | 'place'; entity_id: string }>(
      `UPDATE reviews SET status = $2, moderated_at = now(), moderation = COALESCE(moderation, '{}'::jsonb) || jsonb_build_object('admin', $3::text, 'note', $4::text) WHERE id = $1 RETURNING entity_type, entity_id`,
      [id, status, req.user!.id, b.note ?? null]);
    if (!r.rows[0]) throw new ApiError(404, 'not_found', 'Review not found');
    await db.query(`UPDATE review_reports SET status = 'resolved' WHERE review_id = $1`, [id]);
    await refreshRating(db, r.rows[0].entity_type, r.rows[0].entity_id);
    return { status };
  });
}
