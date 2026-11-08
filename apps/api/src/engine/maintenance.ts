import type pg from 'pg';
import { tx } from '../db';
import { cityBySlug, getCategory, searchDocument } from '@passtra/core';
import { excerpt, placeSearchDocument, recomputeEvent } from './merge';
import type { Logger } from './types';

/**
 * Periodic housekeeping:
 *  - finished events → status "completed"; archived 30 days after they end
 *  - raw payloads purged after 90 days without change (retention / licence hygiene)
 *  - personalisation history older than 180 days deleted (GDPR minimisation)
 *  - confidence refreshed for events in the next 14 days (freshness decays over time)
 *  - popularity recomputed from anonymous aggregate interactions
 */
export async function runMaintenance(pool: pg.Pool, log: Logger, now = new Date()): Promise<Record<string, number>> {
  const stats: Record<string, number> = {};
  // Runs cut off by a host restart/sleep never finish on their own.
  stats.interruptedRuns = (await pool.query(
    `UPDATE ingestion_runs SET status = 'failed', finished_at = now(), error_message = 'Interrupted (the server restarted or went to sleep); the import resumes in the next run'
      WHERE status = 'running' AND started_at < $1::timestamptz - interval '40 minutes'`, [now])).rowCount ?? 0;
  const completed = await pool.query(
    `UPDATE events SET status = 'completed', updated_at = now()
      WHERE status IN ('scheduled','rescheduled','unlisted') AND merged_into IS NULL AND (
        (time_precision = 'exact' AND COALESCE(ends_at, starts_at + interval '3 hours') < $1) OR
        (time_precision = 'date_only' AND ((COALESCE(local_end_date, local_start_date) + 1)::timestamp AT TIME ZONE timezone) < $1))`,
    [now],
  );
  stats.completed = completed.rowCount ?? 0;
  stats.archived = (await pool.query(`UPDATE events SET archived_at = now() WHERE archived_at IS NULL AND status IN ('completed','cancelled') AND COALESCE(ends_at, starts_at) < $1::timestamptz - interval '30 days'`, [now])).rowCount ?? 0;
  stats.payloadsPurged = (await pool.query(`UPDATE source_records SET payload = NULL WHERE payload IS NOT NULL AND last_changed_at < now() - interval '90 days'`)).rowCount ?? 0;
  stats.interactionsDeleted = (await pool.query(`DELETE FROM user_interactions WHERE created_at < now() - interval '180 days'`)).rowCount ?? 0;
  stats.geocodeExpired = (await pool.query(`DELETE FROM geocode_cache WHERE expires_at < now()`)).rowCount ?? 0;

  const upcoming = await pool.query<{ id: string }>(
    `SELECT id FROM events WHERE merged_into IS NULL AND archived_at IS NULL AND status <> 'completed' AND starts_at BETWEEN $1::timestamptz - interval '1 day' AND $1::timestamptz + interval '14 days' ORDER BY starts_at LIMIT 2000`,
    [now],
  );
  for (const { id } of upcoming.rows) await tx(pool, (c) => recomputeEvent(c, id, now));
  stats.confidenceRefreshed = upcoming.rowCount ?? 0;

  for (const [type, table] of [['place', 'places'], ['event', 'events']] as const) {
    await pool.query(`UPDATE ${table} SET popularity = popularity * 0.85 WHERE popularity > 0`);
    await pool.query(
      `WITH s AS (
         SELECT entity_id, SUM(CASE kind WHEN 'save' THEN 3 WHEN 'click_ticket' THEN 3 WHEN 'share' THEN 2 WHEN 'navigate' THEN 2 WHEN 'open' THEN 1 ELSE 0 END) AS w
           FROM user_interactions WHERE entity_type = $1 AND created_at > now() - interval '14 days' GROUP BY entity_id)
       UPDATE ${table} t SET popularity = LEAST(1, ln(1 + s.w) / ln(101)) FROM s WHERE s.entity_id = t.id`,
      [type],
    );
  }
  log.info(stats, 'maintenance finished');
  return stats;
}

/** Bump when the content of search documents changes; existing rows are rebuilt once at start-up. */
export const SEARCH_DOC_VERSION = 2;

/** Rebuild places/events search documents in batches (after the indexed content changed). */
export async function reindexSearch(pool: pg.Pool, log: Logger): Promise<number> {
  const v = await pool.query<{ value: unknown }>(`SELECT value FROM app_settings WHERE key = 'search_doc_version'`);
  if (Number(v.rows[0]?.value ?? 0) >= SEARCH_DOC_VERSION) return 0;
  let n = 0;
  const places = await pool.query<{ id: string; name: string; name_i18n: Record<string, string>; address: string | null; city: string | null; categories: string[]; tags: string[]; description: string | null }>(
    `SELECT p.id, p.name, p.name_i18n, p.address, c.slug AS city, p.categories, p.tags, p.description FROM places p LEFT JOIN cities c ON c.id = p.city_id WHERE p.merged_into IS NULL`);
  for (const r of places.rows) {
    const doc = placeSearchDocument({ name: r.name, names: Object.values(r.name_i18n ?? {}), address: r.address, city: r.city ? cityBySlug(r.city) : null,
      catLabels: r.categories.flatMap((s) => Object.values(getCategory(s)?.label ?? {})), tags: r.tags ?? [], description: r.description });
    await pool.query('UPDATE places SET search_doc = $2 WHERE id = $1', [r.id, doc]);
    n++;
  }
  const events = await pool.query<{ id: string; title: string; venue_name: string | null; organizer_name: string | null; city: string | null; categories: string[]; description: string | null }>(
    `SELECT e.id, e.title, e.venue_name, e.organizer_name, c.slug AS city, e.categories, e.description FROM events e LEFT JOIN cities c ON c.id = e.city_id WHERE e.merged_into IS NULL`);
  for (const r of events.rows) {
    const city = r.city ? cityBySlug(r.city) : null;
    const doc = searchDocument(r.title, r.venue_name, r.organizer_name, city?.name.en, city?.name.el, city?.name.ru, ...r.categories.flatMap((s) => Object.values(getCategory(s)?.label ?? {})), excerpt(r.description));
    await pool.query('UPDATE events SET search_doc = $2 WHERE id = $1', [r.id, doc]);
    n++;
  }
  await pool.query(`INSERT INTO app_settings (key, value) VALUES ('search_doc_version', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(SEARCH_DOC_VERSION)]);
  log.info({ rows: n }, 'search documents rebuilt');
  return n;
}
