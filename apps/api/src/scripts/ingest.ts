process.env.TZ = 'UTC';
/**
 * Run one source now (bypassing the schedule): `pnpm ingest <source_key> [--config '{"mode":"osm_api_tiles",...}']`
 * The optional config override is merged for this run only and never saved.
 */
import pino from 'pino';
import { loadConfig } from '../config';
import { createPool } from '../db';
import { runMaintenance } from '../engine/maintenance';
import { runSource } from '../engine/pipeline';
import { completeSchedule, loadSource } from '../engine/scheduler';
import { Geocoder } from '../lib/geocode';
import { HttpClient } from '../lib/http';

const [key, flag, json] = process.argv.slice(2);
if (!key) {
  console.error('usage: ingest <source_key> [--config <json>]');
  process.exit(1);
}
const config = loadConfig();
const log = pino({ level: 'info', name: 'ingest' });
const pool = createPool(config.DATABASE_URL, 4);
const source = await loadSource(pool, key);
if (!source) {
  console.error(`unknown source ${key}`);
  process.exit(1);
}
if (flag === '--config' && json) source.config = { ...source.config, ...JSON.parse(json) };
const http = new HttpClient(config.BOT_USER_AGENT, 1100);
const summary = await runSource({ pool, config, http, geocoder: new Geocoder(pool, http, config.NOMINATIM_URL, config.GEOCODING_ENABLED), log }, source, 'manual');
await completeSchedule(pool, source, summary);
await runMaintenance(pool, log);
console.log(JSON.stringify(summary, null, 2));
await pool.end();
