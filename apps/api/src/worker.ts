process.env.TZ = 'UTC';

import pino from 'pino';
import { loadConfig } from './config';
import { createPool } from './db';
import { startBackground } from './engine/background';
import { migrate } from './migrate';
import { registerSources } from './sources';

/** Dedicated worker process. Several workers can run in parallel (sources are claimed with SKIP LOCKED). */
const config = loadConfig();
const log = pino({ level: config.LOG_LEVEL, name: 'worker' });
const pool = createPool(config.DATABASE_URL, 4);
await migrate(pool, (m) => log.info(m));
await registerSources(pool);
const bg = startBackground(pool, config, log);
log.info('worker started');

let stopping = false;
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    if (stopping) return;
    stopping = true;
    log.info({ sig }, 'worker stopping after the current run');
    setTimeout(() => process.exit(1), 120_000).unref();
    await bg.stop();
    await pool.end();
    log.info('worker stopped');
    process.exit(0);
  });
}
