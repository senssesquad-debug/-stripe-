import { resolveLocale } from '@passtra/core';
import { DateTime } from 'luxon';
import type pg from 'pg';
import type { AppConfig } from '../config';
import type { Logger } from '../engine/types';
import { hasChannels, pushToUser, delivered } from './push';

const BODY = {
  en: (when: string, where: string | null) => `${when}${where ? ` · ${where}` : ''}`,
  el: (when: string, where: string | null) => `${when}${where ? ` · ${where}` : ''}`,
  ru: (when: string, where: string | null) => `${when}${where ? ` · ${where}` : ''}`,
};
const STARTS = { en: 'Starts', el: 'Ξεκινά', ru: 'Начало' };

/**
 * Delivers due reminders of personal events. Each reminder is claimed atomically (SKIP LOCKED),
 * delivered through every channel of the user, and its real outcome stored:
 * sent / failed / no_channel (user has notifications off) / skipped_stale (event already over, e.g. server was asleep).
 */
export async function deliverDueReminders(pool: pg.Pool, config: AppConfig, log: Logger, now = new Date()): Promise<{ sent: number; failed: number; noChannel: number; stale: number }> {
  const stats = { sent: 0, failed: 0, noChannel: 0, stale: 0 };
  const due = await pool.query<{ id: string; user_id: string; title: string; timezone: string; starts_at: Date; ends_at: Date; location_name: string | null; locale: string }>(
    `UPDATE personal_events pe SET reminder_sent_at = $1
      FROM users u
     WHERE u.id = pe.user_id AND pe.id IN (
       SELECT id FROM personal_events WHERE reminder_sent_at IS NULL AND reminder_due_at IS NOT NULL AND reminder_due_at <= $1
       ORDER BY reminder_due_at FOR UPDATE SKIP LOCKED LIMIT 200)
     RETURNING pe.id, pe.user_id, pe.title, pe.timezone, pe.starts_at, pe.ends_at, pe.location_name, u.locale`,
    [now],
  );
  for (const e of due.rows) {
    let status: 'sent' | 'failed' | 'no_channel' | 'skipped_stale';
    if (e.ends_at < now) {
      status = 'skipped_stale';
      stats.stale++;
    } else {
      const locale = resolveLocale(e.locale);
      const start = DateTime.fromJSDate(e.starts_at, { zone: e.timezone }).setLocale(locale);
      const sameDay = start.hasSame(DateTime.fromJSDate(now, { zone: e.timezone }), 'day');
      const when = `${STARTS[locale]} ${sameDay ? start.toFormat('HH:mm') : start.toFormat('ccc d LLL, HH:mm')}`;
      const r = await pushToUser(pool, config, e.user_id, { title: e.title, body: BODY[locale](when, e.location_name), url: `/my-events/${e.id}`, tag: `reminder-${e.id}` });
      status = !hasChannels(r) ? 'no_channel' : delivered(r) ? 'sent' : 'failed';
      if (status === 'sent') stats.sent++;
      else if (status === 'failed') stats.failed++;
      else stats.noChannel++;
    }
    await pool.query('UPDATE personal_events SET reminder_status = $2 WHERE id = $1', [e.id, status]);
  }
  if (due.rowCount) log.info(stats, 'reminders delivered');
  return stats;
}
