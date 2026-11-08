process.env.TZ = 'UTC';

import pino from 'pino';
import { loadConfig } from './config';
import { createPool } from './db';
import { runMaintenance } from './engine/maintenance';
import { tick } from './engine/scheduler';
import { Geocoder } from './lib/geocode';
import { HttpClient } from './lib/http';
import { migrate } from './migrate';
import { runNotifications } from './services/notifications';
import { registerSources } from './sources';

/**
 * Background worker: adaptive ingestion scheduler + maintenance + notifications.
 * Several workers can run in parallel; sources are claimed with FOR UPDATE SKIP LOCKED.
 */
const config = loadConfig();
const log = pino({ level: config.LOG_LEVEL, name: 'worker' });
const pool = createPool(config.DATABASE_URL, 4);
await migrate(pool, (m) => log.info(m));
await registerSources(pool);
const http = new HttpClient(config.BOT_USER_AGENT, 1100);
const deps = { pool, config, http, geocoder: new Geocoder(pool, http, config.NOMINATIM_URL, config.GEOCODING_ENABLED), log };

let stopping = false;
let lastMaintenance = 0;
let lastNotifications = 0;
const MAINTENANCE_EVERY = 30 * 60_000;
const NOTIFICATIONS_EVERY = 30 * 60_000;

async function loop() {
  while (!stopping) {
    try {
      await tick(deps);
      if (Date.now() - lastMaintenance > MAINTENANCE_EVERY) {
        lastMaintenance = Date.now();
        await runMaintenance(pool, log);
      }
      if (Date.now() - lastNotifications > NOTIFICATIONS_EVERY) {
        lastNotifications = Date.now();
        await runNotifications(pool, config, log);
      }
    } catch (e) {
      log.error({ err: (e as Error).message }, 'worker loop error');
    }
    await new Promise((r) => setTimeout(r, config.WORKER_POLL_MS));
  }
}

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    stopping = true;
    log.info({ sig }, 'worker stopping');
    setTimeout(() => process.exit(0), 5000).unref();
    await pool.end().catch(() => undefined);
  });
}
log.info('worker started');
await loop();
