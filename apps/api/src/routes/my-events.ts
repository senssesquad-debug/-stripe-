import { formatEventTime, localToUtc, normalizeZone, resolveLocale, type Locale } from '@passtra/core';
import type { FastifyInstance } from 'fastify';
import { DateTime } from 'luxon';
import type pg from 'pg';
import { z } from 'zod';
import type { AppDeps } from '../app';
import type { Queryable } from '../db';
import { ApiError, localeOf, parse, requireUser } from '../http';
import { ensureVapid, pushToUser } from '../services/push';

export const REMINDER_OPTIONS = [0, 5, 10, 15, 30, 60, 120, 180, 1440, 2880, 10080] as const;

const Uuid = z.string().uuid();
const EventInput = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.string().max(60).default('Europe/Nicosia'),
  location: z.object({
    name: z.string().trim().max(200).nullable().optional(),
    address: z.string().trim().max(300).nullable().optional(),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
  }).nullable().optional(),
  entityType: z.enum(['event', 'place']).nullable().optional(),
  entityId: Uuid.nullable().optional(),
  reminderMinutes: z.number().int().refine((n) => (REMINDER_OPTIONS as readonly number[]).includes(n), 'Unsupported reminder offset').nullable().optional(),
});

interface Row extends pg.QueryResultRow {
  id: string; title: string; description: string | null; timezone: string; starts_at: Date; ends_at: Date;
  location_name: string | null; address: string | null; lat: number | null; lng: number | null;
  entity_type: 'event' | 'place' | null; entity_id: string | null; reminder_minutes: number | null;
  reminder_due_at: Date | null; reminder_sent_at: Date | null; reminder_status: string | null;
}

const COLS = `id, title, description, timezone, starts_at, ends_at, location_name, address,
  ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng, entity_type, entity_id,
  reminder_minutes, reminder_due_at, reminder_sent_at, reminder_status`;

export function toDTO(r: Row, locale: Locale, now = new Date()) {
  const tz = r.timezone;
  const s = DateTime.fromJSDate(r.starts_at, { zone: tz });
  const e = DateTime.fromJSDate(r.ends_at, { zone: tz });
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    timezone: tz,
    startsAt: s.toISO(),
    endsAt: e.toISO(),
    date: s.toISODate(),
    startTime: s.toFormat('HH:mm'),
    endDate: e.toISODate(),
    endTime: e.toFormat('HH:mm'),
    label: formatEventTime({ startsAt: r.starts_at, endsAt: r.ends_at, timePrecision: 'exact', timezone: tz }, locale, now),
    past: r.ends_at.getTime() < now.getTime(),
    location: r.location_name || r.address || r.lat !== null ? { name: r.location_name, address: r.address, lat: r.lat, lng: r.lng } : null,
    entity: r.entity_type && r.entity_id ? { type: r.entity_type, id: r.entity_id } : null,
    reminder: r.reminder_minutes === null ? null : {
      minutes: r.reminder_minutes,
      at: r.reminder_due_at?.toISOString() ?? null,
      status: r.reminder_status ?? (r.reminder_sent_at ? 'sent' : 'scheduled'),
    },
  };
}

/** Wall-clock date/time in the event's zone → UTC instants. DST gaps are shifted and reported, never guessed silently. */
function resolveTimes(b: z.infer<typeof EventInput>) {
  const tz = normalizeZone(b.timezone);
  if (!DateTime.now().setZone(b.timezone).isValid) throw new ApiError(400, 'invalid_timezone', 'Unknown time zone');
  const start = localToUtc(`${b.date} ${b.startTime}`, tz);
  let endDate = b.endDate ?? b.date;
  let end = localToUtc(`${endDate} ${b.endTime}`, tz);
  if (!b.endDate && end.utc <= start.utc) {
    // "22:00–02:00" without an end date means the next day.
    endDate = DateTime.fromISO(b.date).plus({ days: 1 }).toISODate()!;
    end = localToUtc(`${endDate} ${b.endTime}`, tz);
  }
  if (end.utc <= start.utc) throw new ApiError(400, 'end_before_start', 'The end must be after the start.');
  const notes = [start.adjustment, end.adjustment].filter((a) => a !== 'none');
  return { tz, startsAt: start.utc, endsAt: end.utc, notes };
}

async function getRow(db: Queryable, userId: string, id: string): Promise<Row> {
  const r = await db.query<Row>(`SELECT ${COLS} FROM personal_events WHERE id = $1 AND user_id = $2`, [id, userId]);
  if (!r.rows[0]) throw new ApiError(404, 'not_found', 'Event not found');
  return r.rows[0];
}

export async function myEventsRoutes(app: FastifyInstance, deps: AppDeps) {
  const { db, config } = deps;
  const now = () => deps.now?.() ?? new Date();

  app.get('/v1/me/events', async (req) => {
    const user = requireUser(req);
    const q = parse(z.object({ scope: z.enum(['upcoming', 'past', 'all']).default('upcoming'), locale: z.string().optional() }), req.query);
    const where = q.scope === 'upcoming' ? 'AND ends_at >= $2' : q.scope === 'past' ? 'AND ends_at < $2' : 'AND $2::timestamptz IS NOT NULL';
    const r = await db.query<Row>(`SELECT ${COLS} FROM personal_events WHERE user_id = $1 ${where} ORDER BY starts_at ${q.scope === 'past' ? 'DESC' : 'ASC'} LIMIT 500`, [user.id, now()]);
    return { items: r.rows.map((x) => toDTO(x, localeOf(req, q.locale), now())), reminderOptions: REMINDER_OPTIONS };
  });

  app.get('/v1/me/events/:id', async (req) => {
    const user = requireUser(req);
    const { id } = parse(z.object({ id: Uuid }), req.params);
    return toDTO(await getRow(db, user.id, id), localeOf(req), now());
  });

  const write = async (userId: string, b: z.infer<typeof EventInput>, id?: string) => {
    const t = resolveTimes(b);
    const due = b.reminderMinutes === null || b.reminderMinutes === undefined ? null : new Date(t.startsAt.getTime() - b.reminderMinutes * 60_000);
    if (b.entityType && b.entityId) {
      const exists = await db.query(`SELECT 1 FROM ${b.entityType === 'event' ? 'events' : 'places'} WHERE id = $1`, [b.entityId]);
      if (!exists.rowCount) throw new ApiError(400, 'invalid_entity', 'Linked place or event not found');
    }
    const lat = b.location?.lat ?? null;
    const lng = b.location?.lng ?? null;
    const params = [userId, b.title, b.description ?? null, t.tz, t.startsAt, t.endsAt, b.location?.name ?? null, b.location?.address ?? null, lat, lng,
      b.entityType ?? null, b.entityId ?? null, b.reminderMinutes ?? null, due];
    if (!id) {
      const r = await db.query<{ id: string }>(
        `INSERT INTO personal_events (user_id, title, description, timezone, starts_at, ends_at, location_name, address, location, entity_type, entity_id, reminder_minutes, reminder_due_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, CASE WHEN $9::float8 IS NULL OR $10::float8 IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint($10, $9), 4326)::geography END, $11,$12,$13,$14)
         RETURNING id`, params);
      return { id: r.rows[0]!.id, notes: t.notes };
    }
    // A changed reminder time re-arms delivery; an unchanged one keeps its "sent" state.
    const r = await db.query(
      `UPDATE personal_events SET title=$2, description=$3, timezone=$4, starts_at=$5, ends_at=$6, location_name=$7, address=$8,
         location = CASE WHEN $9::float8 IS NULL OR $10::float8 IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint($10, $9), 4326)::geography END,
         entity_type=$11, entity_id=$12, reminder_minutes=$13,
         reminder_sent_at = CASE WHEN reminder_due_at IS DISTINCT FROM $14 THEN NULL ELSE reminder_sent_at END,
         reminder_status = CASE WHEN reminder_due_at IS DISTINCT FROM $14 THEN NULL ELSE reminder_status END,
         reminder_due_at=$14, updated_at=now()
       WHERE user_id = $1 AND id = $15`, [...params, id]);
    if (!r.rowCount) throw new ApiError(404, 'not_found', 'Event not found');
    return { id, notes: t.notes };
  };

  app.post('/v1/me/events', async (req) => {
    const user = requireUser(req);
    const count = await db.query<{ n: number }>('SELECT COUNT(*)::int AS n FROM personal_events WHERE user_id = $1', [user.id]);
    if ((count.rows[0]?.n ?? 0) >= 2000) throw new ApiError(400, 'limit', 'Too many events');
    const r = await write(user.id, parse(EventInput, req.body));
    return { event: toDTO(await getRow(db, user.id, r.id), localeOf(req), now()), timeAdjusted: r.notes.length > 0 };
  });

  app.put('/v1/me/events/:id', async (req) => {
    const user = requireUser(req);
    const { id } = parse(z.object({ id: Uuid }), req.params);
    const r = await write(user.id, parse(EventInput, req.body), id);
    return { event: toDTO(await getRow(db, user.id, r.id), localeOf(req), now()), timeAdjusted: r.notes.length > 0 };
  });

  app.delete('/v1/me/events/:id', async (req, reply) => {
    const user = requireUser(req);
    const { id } = parse(z.object({ id: Uuid }), req.params);
    const r = await db.query('DELETE FROM personal_events WHERE id = $1 AND user_id = $2', [id, user.id]);
    if (!r.rowCount) throw new ApiError(404, 'not_found', 'Event not found');
    return reply.status(204).send();
  });

  // ── Notifications: channels, Web Push subscription, real test delivery ──
  app.get('/v1/push/vapid-public-key', async () => ({ publicKey: (await ensureVapid(db, config)).publicKey }));

  app.get('/v1/me/notifications', async (req) => {
    const user = requireUser(req);
    const [web, expo, prefs] = await Promise.all([
      db.query<{ n: number }>('SELECT COUNT(*)::int AS n FROM web_push_subscriptions WHERE user_id = $1 AND disabled_at IS NULL', [user.id]),
      db.query<{ n: number }>('SELECT COUNT(*)::int AS n FROM push_tokens WHERE user_id = $1 AND disabled_at IS NULL', [user.id]),
      db.query<{ notification_prefs: unknown }>('SELECT notification_prefs FROM users WHERE id = $1', [user.id]),
    ]);
    return { channels: { webPush: web.rows[0]!.n, nativePush: expo.rows[0]!.n }, prefs: prefs.rows[0]?.notification_prefs ?? null };
  });

  app.post('/v1/me/web-push', async (req) => {
    const user = requireUser(req);
    const b = parse(z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) }), req.body);
    await db.query(
      `INSERT INTO web_push_subscriptions (endpoint, user_id, p256dh, auth, user_agent) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, disabled_at = NULL`,
      [b.endpoint, user.id, b.keys.p256dh, b.keys.auth, String(req.headers['user-agent'] ?? '').slice(0, 300)],
    );
    return { subscribed: true };
  });

  app.delete('/v1/me/web-push', async (req, reply) => {
    const user = requireUser(req);
    const b = parse(z.object({ endpoint: z.string().max(1000) }), req.body);
    await db.query('DELETE FROM web_push_subscriptions WHERE endpoint = $1 AND user_id = $2', [b.endpoint, user.id]);
    return reply.status(204).send();
  });

  app.post('/v1/me/notifications/test', { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } }, async (req) => {
    const user = requireUser(req);
    const locale = resolveLocale(((await db.query<{ locale: string }>('SELECT locale FROM users WHERE id = $1', [user.id])).rows[0]?.locale));
    const text = { en: ['passtra test notification', 'Notifications work on this device.'], el: ['Δοκιμαστική ειδοποίηση passtra', 'Οι ειδοποιήσεις λειτουργούν σε αυτή τη συσκευή.'], ru: ['Тестовое уведомление passtra', 'Уведомления на этом устройстве работают.'] }[locale];
    const r = await pushToUser(db, config, user.id, { title: text[0]!, body: text[1]!, url: '/notifications', tag: 'test' });
    return { result: r };
  });
}
