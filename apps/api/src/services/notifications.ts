import { CITIES, categoriesInGroup, formatEventTime, resolveLocale, type InterestGroup, type Locale } from '@passtra/core';
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { DateTime } from 'luxon';
import type pg from 'pg';
import type { AppConfig } from '../config';
import type { Logger } from '../engine/types';

export interface NotificationPrefs {
  enabled: boolean;
  maxPerDay: number;
  maxPerWeek: number;
  quietStart: string;
  quietEnd: string;
  categories: string[];
  newInCity: boolean;
  favoritesUpdates: boolean;
}

/** Is `local` (HH:mm) inside the quiet window (which may wrap midnight)? */
export function inQuietHours(localHHmm: string, start: string, end: string): boolean {
  if (start === end) return false;
  return start < end ? localHHmm >= start && localHHmm < end : localHHmm >= start || localHHmm < end;
}

const KIND_TITLE: Record<string, Record<Locale, string>> = {
  nearby_today: { en: 'Happening near you', el: 'Κοντά σας σήμερα', ru: 'Рядом с вами сегодня' },
  new_in_city: { en: 'New in your city', el: 'Νέο στην πόλη σας', ru: 'Новое в вашем городе' },
  favorite_event: { en: 'From a place you saved', el: 'Από μέρος που αποθηκεύσατε', ru: 'В месте из избранного' },
};

interface Candidate {
  id: string;
  title: string;
  venue_name: string | null;
  starts_at: Date;
  ends_at: Date | null;
  time_precision: 'exact' | 'date_only';
  timezone: string;
  local_start_date: string;
  local_end_date: string | null;
  kind: 'favorite_event' | 'nearby_today' | 'new_in_city';
}

/**
 * Runs every ~30 min in the worker. Per user: at most one notification per run, never during quiet hours,
 * within daily/weekly caps, only for confirmed/likely upcoming events, never the same event twice.
 */
export async function runNotifications(pool: pg.Pool, config: AppConfig, log: Logger, now = new Date(), expo = new Expo({ accessToken: config.EXPO_ACCESS_TOKEN })): Promise<{ considered: number; sent: number; skipped: number }> {
  const users = await pool.query<{ id: string; locale: string; interests: string[]; notification_prefs: NotificationPrefs; home_city: string | null }>(
    `SELECT u.id, u.locale, u.interests, u.notification_prefs, c.slug AS home_city
       FROM users u LEFT JOIN cities c ON c.id = u.home_city_id
      WHERE (u.notification_prefs->>'enabled')::boolean = true
        AND EXISTS (SELECT 1 FROM push_tokens t WHERE t.user_id = u.id AND t.disabled_at IS NULL)
      LIMIT 5000`,
  );
  let sent = 0;
  let skipped = 0;
  for (const u of users.rows) {
    const prefs = u.notification_prefs;
    const city = CITIES.find((c) => c.slug === u.home_city) ?? null;
    const tz = city?.timezone ?? 'Europe/Nicosia';
    const local = DateTime.fromJSDate(now, { zone: tz });
    if (inQuietHours(local.toFormat('HH:mm'), prefs.quietStart ?? '22:00', prefs.quietEnd ?? '09:00')) {
      skipped++;
      continue;
    }
    const counts = await pool.query<{ day: number; week: number }>(
      `SELECT COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS day, COUNT(*)::int AS week
         FROM notification_log WHERE user_id = $1 AND status = 'sent' AND created_at > now() - interval '7 days'`, [u.id]);
    if ((counts.rows[0]?.day ?? 0) >= (prefs.maxPerDay ?? 1) || (counts.rows[0]?.week ?? 0) >= (prefs.maxPerWeek ?? 4)) {
      skipped++;
      continue;
    }
    const cats = [...new Set([...(prefs.categories ?? []), ...u.interests.flatMap((g) => categoriesInGroup(g as InterestGroup).map((c) => c.slug))])];
    const c = await pool.query<Candidate>(
      `WITH base AS (
         SELECT e.*, (e.place_id IS NOT NULL AND EXISTS (SELECT 1 FROM saved_items s WHERE s.user_id = $1 AND s.entity_type = 'place' AND s.entity_id = e.place_id)) AS fav
           FROM events e
          WHERE e.merged_into IS NULL AND e.status = 'scheduled' AND e.verification_status IN ('confirmed','likely') AND NOT e.is_demo
            AND e.starts_at > $2 AND e.starts_at < $2::timestamptz + interval '7 days'
            AND NOT EXISTS (SELECT 1 FROM notification_log n WHERE n.user_id = $1 AND n.entity_type = 'event' AND n.entity_id = e.id)
            AND ($3::float8 IS NULL OR (e.location IS NOT NULL AND ST_DWithin(e.location, ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography, $5)))
       )
       SELECT id, title, venue_name, starts_at, ends_at, time_precision, timezone, local_start_date::text, local_end_date::text,
              CASE WHEN fav THEN 'favorite_event' WHEN starts_at < $2::timestamptz + interval '18 hours' THEN 'nearby_today' ELSE 'new_in_city' END AS kind
         FROM base
        WHERE (fav AND $7) OR (categories && $6::text[] AND (starts_at < $2::timestamptz + interval '18 hours' OR ($8 AND created_at > $2::timestamptz - interval '24 hours')))
        ORDER BY fav DESC, starts_at LIMIT 1`,
      [u.id, now, city?.lat ?? null, city?.lng ?? null, (city?.radiusKm ?? 15) * 1500, cats, prefs.favoritesUpdates !== false, prefs.newInCity !== false],
    );
    const ev = c.rows[0];
    if (!ev) continue;
    const locale = resolveLocale(u.locale);
    const when = formatEventTime({ startsAt: ev.starts_at, endsAt: ev.ends_at, timePrecision: ev.time_precision, timezone: ev.timezone, localStartDate: ev.local_start_date, localEndDate: ev.local_end_date }, locale, now);
    const title = `${KIND_TITLE[ev.kind]![locale]}: ${ev.title}`.slice(0, 120);
    const body = [when, ev.venue_name].filter(Boolean).join(' · ').slice(0, 180);
    const ins = await pool.query<{ id: number }>(
      `INSERT INTO notification_log (user_id, entity_type, entity_id, kind, title, body) VALUES ($1,'event',$2,$3,$4,$5)
       ON CONFLICT (user_id, entity_type, entity_id, kind) DO NOTHING RETURNING id`,
      [u.id, ev.id, ev.kind, title, body],
    );
    if (!ins.rows[0]) continue;
    const tokens = await pool.query<{ token: string }>('SELECT token FROM push_tokens WHERE user_id = $1 AND disabled_at IS NULL', [u.id]);
    const messages: ExpoPushMessage[] = tokens.rows.filter((t) => Expo.isExpoPushToken(t.token)).map((t) => ({ to: t.token, title, body, sound: 'default', data: { type: 'event', id: ev.id } }));
    let ok = false;
    let error: string | null = null;
    for (const chunk of expo.chunkPushNotifications(messages)) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        tickets.forEach((t, i) => {
          if (t.status === 'ok') ok = true;
          else {
            error = t.message;
            const token = (chunk[i]!.to as string) ?? null;
            if (t.details?.error === 'DeviceNotRegistered' && token) void pool.query('UPDATE push_tokens SET disabled_at = now() WHERE token = $1', [token]);
          }
        });
      } catch (e) {
        error = (e as Error).message;
      }
    }
    await pool.query('UPDATE notification_log SET status = $2, error = $3 WHERE id = $1', [ins.rows[0].id, ok ? 'sent' : 'failed', error]);
    if (ok) sent++;
  }
  log.info({ considered: users.rowCount, sent, skipped }, 'notifications run');
  return { considered: users.rowCount ?? 0, sent, skipped };
}
