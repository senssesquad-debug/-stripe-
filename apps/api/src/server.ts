process.env.TZ = 'UTC'; // opening-hours evaluation relies on wall-clock Dates without DST gaps

import { buildApp } from './app';
import { startBackground } from './engine/background';
import { loadConfig } from './config';
import { createPool } from './db';
import { migrate } from './migrate';
import { registerSources } from './sources';

const config = loadConfig();
const pool = createPool(config.DATABASE_URL, config.DATABASE_POOL_MAX);
await migrate(pool, (m) => console.log(`[migrate] ${m}`));
await registerSources(pool);
const { app } = await buildApp(config, pool);
const bg = config.RUN_WORKER ? startBackground(pool, config, app.log) : null;

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await bg?.stop();
  await pool.end();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ host: config.HOST, port: config.PORT });
