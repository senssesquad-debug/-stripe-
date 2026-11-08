import type pg from 'pg';
import { runSource, type EngineDeps, type RunSummary } from './pipeline';
import type { SourceRow } from './types';

/**
 * Next interval after a run (seconds):
 *  - changes found → halve (not below min)       — busy sources are polled more often
 *  - no changes   → ×1.5 (not above max)         — quiet sources back off, saving API quota
 *  - failure      → exponential backoff up to 6 h
 *  - skipped (missing key) → 6 h
 */
export function nextInterval(source: Pick<SourceRow, 'min_interval_s' | 'max_interval_s' | 'current_interval_s' | 'consecutive_failures'>, summary: Pick<RunSummary, 'status' | 'changes'>): number {
  if (summary.status === 'skipped') return 6 * 3600;
  if (summary.status === 'failed') return Math.min(6 * 3600, Math.max(source.min_interval_s, source.current_interval_s) * 2 ** Math.min(5, source.consecutive_failures + 1));
  if (summary.changes > 0) return Math.max(source.min_interval_s, Math.round(source.current_interval_s / 2));
  return Math.min(source.max_interval_s, Math.round(source.current_interval_s * 1.5));
}

/** Atomically claim one due source (safe with several workers). */
export async function claimDueSource(pool: pg.Pool): Promise<SourceRow | null> {
  const r = await pool.query<SourceRow>(
    `UPDATE sources SET locked_until = now() + interval '30 minutes', last_run_at = now()
      WHERE id = (SELECT id FROM sources WHERE enabled AND next_run_at <= now() AND (locked_until IS NULL OR locked_until < now())
                  ORDER BY next_run_at FOR UPDATE SKIP LOCKED LIMIT 1)
      RETURNING id, key, name, connector, entity_type, country_code, homepage_url, attribution, authority::float8 AS authority, is_official,
                requires_key, config, enabled, min_interval_s, max_interval_s, current_interval_s, consecutive_failures, http_cache`,
  );
  return r.rows[0] ?? null;
}

export async function completeSchedule(pool: pg.Pool, source: SourceRow, summary: RunSummary): Promise<void> {
  const interval = nextInterval(source, summary);
  const failed = summary.status === 'failed';
  await pool.query(
    `UPDATE sources SET locked_until = NULL, current_interval_s = $2::int, next_run_at = now() + make_interval(secs => $2::int),
       consecutive_failures = CASE WHEN $3 THEN consecutive_failures + 1 ELSE 0 END,
       last_success_at = CASE WHEN $4 THEN now() ELSE last_success_at END, updated_at = now()
     WHERE id = $1`,
    [source.id, failed ? source.current_interval_s : interval, failed, summary.status === 'success' || summary.status === 'partial'],
  );
  if (failed) await pool.query(`UPDATE sources SET next_run_at = now() + make_interval(secs => $2::int) WHERE id = $1`, [source.id, interval]);
}

/** Process due sources until none are left. Returns the summaries. */
export async function tick(deps: EngineDeps): Promise<RunSummary[]> {
  const out: RunSummary[] = [];
  for (let i = 0; i < 20; i++) {
    const source = await claimDueSource(deps.pool);
    if (!source) break;
    let summary: RunSummary;
    try {
      summary = await runSource(deps, source, 'schedule');
    } catch (e) {
      deps.log.error({ err: (e as Error).message, source: source.key }, 'run crashed');
      summary = { runId: 0, status: 'failed', fetched: 0, created: 0, updated: 0, unchanged: 0, merged: 0, skipped: 0, errors: 1, missing: 0, changes: 0, error: (e as Error).message };
    }
    await completeSchedule(deps.pool, source, summary);
    out.push(summary);
  }
  return out;
}

export async function loadSource(pool: pg.Pool, key: string): Promise<SourceRow | null> {
  const r = await pool.query<SourceRow>(
    `SELECT id, key, name, connector, entity_type, country_code, homepage_url, attribution, authority::float8 AS authority, is_official,
            requires_key, config, enabled, min_interval_s, max_interval_s, current_interval_s, consecutive_failures, http_cache
       FROM sources WHERE key = $1`,
    [key],
  );
  return r.rows[0] ?? null;
}
