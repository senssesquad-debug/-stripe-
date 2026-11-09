import type pg from 'pg';
import type { AppConfig } from '../config';
import { tx } from '../db';
import type { Geocoder } from '../lib/geocode';
import type { HttpClient } from '../lib/http';
import { getConnector } from './connectors';
import { ingestEvent, ingestPlace, recomputeEvent, type IngestOutcome } from './merge';
import type { ConnectorContext, Logger, SourceRow } from './types';

export interface EngineDeps {
  pool: pg.Pool;
  config: AppConfig;
  http: HttpClient;
  geocoder: Geocoder;
  log: Logger;
  now?: () => Date;
}

export interface RunSummary {
  runId: number;
  status: 'success' | 'partial' | 'failed' | 'skipped';
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  merged: number;
  skipped: number;
  errors: number;
  missing: number;
  changes: number;
  error?: string;
  /** The connector stopped early on purpose and wants to continue soon. */
  resume?: boolean;
}

const MAX_LOGGED_ERRORS = 200;
/** One run works at most this long; resumable connectors continue in the next run (small hosts sleep or restart). */
const RUN_BUDGET_MS = 8 * 60_000;

/** Run one source end-to-end. Each record is ingested in its own transaction so one bad record never blocks the rest. */
export async function runSource(deps: EngineDeps, source: SourceRow, trigger: 'schedule' | 'manual' | 'test' = 'schedule'): Promise<RunSummary> {
  const now = deps.now?.() ?? new Date();
  const run = await deps.pool.query<{ id: number; started_at: Date }>('INSERT INTO ingestion_runs (source_id, trigger) VALUES ($1, $2) RETURNING id, started_at', [source.id, trigger]);
  const runId = run.rows[0]!.id;
  const startedAt = run.rows[0]!.started_at;
  const s: RunSummary = { runId, status: 'success', fetched: 0, created: 0, updated: 0, unchanged: 0, merged: 0, skipped: 0, errors: 0, missing: 0, changes: 0 };
  const log = deps.log;

  const finish = async () => {
    s.changes = s.created + s.updated + s.merged + s.missing;
    await deps.pool.query(
      `UPDATE ingestion_runs SET status=$2, finished_at=now(), fetched=$3, created=$4, updated=$5, unchanged=$6, merged=$7, skipped=$8, errors=$9, missing=$10, error_message=$11 WHERE id=$1`,
      [runId, s.status, s.fetched, s.created, s.updated, s.unchanged, s.merged, s.skipped, s.errors, s.missing, s.error ?? null],
    );
    return s;
  };

  const connector = getConnector(source.connector);
  if (!connector) {
    s.status = 'failed';
    s.error = `Unknown connector "${source.connector}"`;
    return finish();
  }
  if (connector.requiresKey && !deps.config[connector.requiresKey]) {
    s.status = 'skipped';
    s.error = `Missing configuration: ${String(connector.requiresKey)}`;
    return finish();
  }

  const ctx: ConnectorContext = {
    source, http: deps.http, config: deps.config, now, log, httpCache: source.http_cache ?? {},
    state: {
      async get<T>(key: string) {
        const r = await deps.pool.query<{ value: T }>('SELECT value FROM connector_state WHERE source_id = $1 AND key = $2', [source.id, key]);
        return r.rows[0]?.value ?? null;
      },
      async set(key: string, value: unknown) {
        await deps.pool.query(`INSERT INTO connector_state (source_id, key, value) VALUES ($1,$2,$3)
          ON CONFLICT (source_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [source.id, key, JSON.stringify(value)]);
      },
    },
    snapshot: { complete: true, since: null },
    deadline: Date.now() + RUN_BUDGET_MS,
  };
  // Live progress for /v1/status while a long import runs.
  let lastProgress = Date.now();
  const progress = async () => {
    if (Date.now() - lastProgress < 15_000) return;
    lastProgress = Date.now();
    await deps.pool.query('UPDATE ingestion_runs SET fetched=$2, created=$3, updated=$4, merged=$5 WHERE id=$1', [runId, s.fetched, s.created, s.updated, s.merged]).catch(() => undefined);
  };
  const logError = async (stage: string, message: string, externalId?: string, sample?: unknown) => {
    s.errors++;
    if (s.errors <= MAX_LOGGED_ERRORS) {
      await deps.pool.query('INSERT INTO ingestion_errors (run_id, source_id, external_id, stage, message, sample) VALUES ($1,$2,$3,$4,$5,$6)', [runId, source.id, externalId ?? null, stage, message.slice(0, 2000), sample ? JSON.stringify(sample).slice(0, 4000) : null]);
    }
  };

  let fetchFailed = false;
  try {
    for await (const raw of connector.fetch(ctx)) {
      s.fetched++;
      let normalized;
      try {
        normalized = connector.normalize(raw, ctx);
      } catch (e) {
        await logError('normalize', (e as Error).message, raw.externalId);
        continue;
      }
      if (!normalized) {
        s.skipped++;
        continue;
      }
      try {
        const outcome: IngestOutcome = await tx(deps.pool, (client) => {
          const d = { client, source, geocoder: deps.geocoder, log, now };
          return normalized.kind === 'event' ? ingestEvent(d, raw, normalized) : ingestPlace(d, raw, normalized);
        });
        s[outcome]++;
        await progress();
      } catch (e) {
        await logError('merge', (e as Error).message, raw.externalId);
        log.warn({ err: (e as Error).message, externalId: raw.externalId, source: source.key }, 'record failed');
      }
    }
  } catch (e) {
    fetchFailed = true;
    s.error = (e as Error).message;
    await logError('fetch', s.error);
  }

  if (!fetchFailed && connector.fullSnapshot && ctx.snapshot.complete && !ctx.snapshot.unchanged) s.missing = await markMissing(deps.pool, source, ctx.snapshot.since ?? startedAt, now);

  s.status = fetchFailed ? (s.fetched > 0 ? 'partial' : 'failed') : s.errors > 0 || !ctx.snapshot.complete ? 'partial' : 'success';
  if (!fetchFailed && !ctx.snapshot.complete) {
    s.resume = true;
    s.error ??= 'Import continues in the next run';
  }
  log.info({ source: source.key, ...s }, 'ingestion run finished');
  return finish();
}

/**
 * Records absent from a complete snapshot get missing_runs++. Absence is NOT treated as cancellation:
 * a future event is only hidden ("unlisted") once every source has dropped it for 2+ successful runs.
 */
async function markMissing(pool: pg.Pool, source: SourceRow, runStartedAt: Date, now: Date): Promise<number> {
  const r = await pool.query<{ entity_id: string | null }>(
    `UPDATE source_records SET missing_runs = missing_runs + 1, missing_since = COALESCE(missing_since, now())
      WHERE source_id = $1 AND last_seen_at < $2 RETURNING entity_id`,
    [source.id, runStartedAt],
  );
  const ids = [...new Set(r.rows.map((x) => x.entity_id).filter((x): x is string => !!x))];
  if (!ids.length) return 0;
  if (source.entity_type === 'event') {
    const hidden = await pool.query(
      `UPDATE events e SET status = 'unlisted', updated_at = now()
        WHERE e.id = ANY($1::uuid[]) AND e.status IN ('scheduled','rescheduled') AND e.starts_at > $2
          AND NOT EXISTS (SELECT 1 FROM source_records sr WHERE sr.entity_type = 'event' AND sr.entity_id = e.id AND sr.missing_runs < 2)`,
      [ids, now],
    );
    return hidden.rowCount ?? 0;
  }
  const hidden = await pool.query(
    `UPDATE places p SET status = 'hidden', updated_at = now()
      WHERE p.id = ANY($1::uuid[]) AND p.status = 'active'
        AND NOT EXISTS (SELECT 1 FROM source_records sr WHERE sr.entity_type = 'place' AND sr.entity_id = p.id AND sr.missing_runs < 3)`,
    [ids],
  );
  return hidden.rowCount ?? 0;
}

export { recomputeEvent };
