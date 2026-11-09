import type pg from 'pg';
import type { AppConfig } from '../config';
import { Geocoder } from '../lib/geocode';
import { HttpClient } from '../lib/http';
import { runNotifications } from '../services/notifications';
import { deliverDueReminders } from '../services/reminders';
import { runMaintenance } from './maintenance';
import { tick } from './scheduler';
import { refreshGtfs } from '../transit/gtfs';
import type { Logger } from './types';

/**
 * Background loop: adaptive ingestion scheduler + maintenance + notifications.
 * Runs in the worker process, or inside the API process when RUN_WORKER=true (single-instance hosting).
 * stop() lets the run in progress finish before resolving.
 */
const REMINDER_POLL_MS = 30_000;

export function startBackground(pool: pg.Pool, config: AppConfig, log: Logger): { stop: () => Promise<void> } {
  const http = new HttpClient(config.BOT_USER_AGENT, 1100);
  const deps = { pool, config, http, geocoder: new Geocoder(pool, http, config.NOMINATIM_URL, config.GEOCODING_ENABLED), log };
  let stopping = false;
  const wakers = new Set<() => void>();
  const sleep = (ms: number) => new Promise<void>((r) => {
    const w = () => { clearTimeout(t); wakers.delete(w); r(); };
    const t = setTimeout(w, ms);
    wakers.add(w);
  });
  // Reminders run on their own short loop so a long source import never delays them.
  const reminders = (async () => {
    while (!stopping) {
      try {
        await deliverDueReminders(pool, config, log);
      } catch (e) {
        log.error({ err: (e as Error).message }, 'reminder loop error');
      }
      if (!stopping) await sleep(REMINDER_POLL_MS);
    }
  })();
  let lastMaintenance = 0;
  let lastNotifications = 0;
  const done = (async () => {
    while (!stopping) {
      try {
        await tick(deps);
        await refreshGtfs(pool, log); // public transport timetables: one stale feed per pass
        if (Date.now() - lastMaintenance > 30 * 60_000) {
          lastMaintenance = Date.now();
          await runMaintenance(pool, log);
        }
        if (Date.now() - lastNotifications > 30 * 60_000) {
          lastNotifications = Date.now();
          await runNotifications(pool, config, log);
        }
      } catch (e) {
        log.error({ err: (e as Error).message }, 'background loop error');
      }
      if (!stopping) await sleep(config.WORKER_POLL_MS);
    }
  })();
  return { stop: async () => { stopping = true; wakers.forEach((w) => w()); await Promise.all([done, reminders]); } };
}
