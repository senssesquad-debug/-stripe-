import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SignJWT } from 'jose';
import pg from 'pg';
import { loadConfig, type AppConfig } from '../src/config';
import { createPool } from '../src/db';
import type { EngineDeps } from '../src/engine/pipeline';
import { loadSource } from '../src/engine/scheduler';
import { Geocoder } from '../src/lib/geocode';
import { HttpClient } from '../src/lib/http';
import { migrate } from '../src/migrate';
import { registerSources } from '../src/sources';

const here = path.dirname(fileURLToPath(import.meta.url));
export const fixture = <T = unknown>(name: string): T => JSON.parse(readFileSync(path.join(here, 'fixtures', name), 'utf8')) as T;

const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? 'postgres://passtra:passtra@localhost:5432/postgres';
export const JWT_SECRET = 'test-secret-test-secret-test-secret-123';

/** A fresh, migrated database per test file. */
export async function freshDb(name: string): Promise<{ pool: pg.Pool; config: AppConfig; url: string }> {
  const db = `passtra_test_${name}`;
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${db}`);
  await admin.end();
  const url = ADMIN_URL.replace(/\/[^/]+$/, `/${db}`);
  const config = loadConfig({ NODE_ENV: 'test', DATABASE_URL: url, LOG_LEVEL: 'silent', AUTH_JWT_SECRET: JWT_SECRET, GEOCODING_ENABLED: 'false', ADMIN_USER_IDS: ADMIN_ID });
  const pool = createPool(url, 5);
  await migrate(pool);
  await registerSources(pool);
  return { pool, config, url };
}

export const ADMIN_ID = '00000000-0000-4000-8000-00000000a001';

export async function token(sub: string, secret = JWT_SECRET): Promise<string> {
  return new SignJWT({ role: 'authenticated' }).setProtectedHeader({ alg: 'HS256' }).setSubject(sub).setAudience('authenticated').setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(secret));
}

type Route = [RegExp, (url: string, init?: RequestInit) => unknown];

/** A fetch stand-in that serves fixtures; unmatched URLs return 404 (so robots.txt = "allowed"). */
export function fakeFetch(routes: Route[]): typeof fetch & { calls: string[] } {
  const calls: string[] = [];
  const f = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    calls.push(url);
    for (const [re, handler] of routes) {
      if (re.test(url)) {
        const body = handler(url, init);
        if (body instanceof Response) return body;
        return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 200, headers: { 'content-type': typeof body === 'string' ? 'text/plain' : 'application/json' } });
      }
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch & { calls: string[] };
  f.calls = calls;
  return f;
}

export function engineDeps(pool: pg.Pool, config: AppConfig, fetchImpl: typeof fetch, now: Date): EngineDeps {
  const http = new HttpClient('passtra-bot/test', 0, fetchImpl);
  return { pool, config, http, geocoder: new Geocoder(pool, http, config.NOMINATIM_URL, false), log: { info() {}, warn() {}, error() {}, debug() {} }, now: () => now };
}

export async function source(pool: pg.Pool, key: string) {
  const s = await loadSource(pool, key);
  if (!s) throw new Error(`source ${key} missing`);
  return s;
}

/** Register an extra test source (e.g. a second feed reporting the same events). */
export async function addSource(pool: pg.Pool, key: string, connector: string, authority: number, config: Record<string, unknown>, entity: 'event' | 'place' = 'event') {
  await pool.query(
    `INSERT INTO sources (key, name, connector, entity_type, country_code, authority, config, enabled, terms_reviewed_at) VALUES ($1,$1,$2,$3,'CY',$4,$5,true, now())`,
    [key, connector, entity, authority, JSON.stringify(config)],
  );
  return source(pool, key);
}
