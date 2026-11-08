import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, CITIES, COUNTRIES } from '@passtra/core';
import type pg from 'pg';
import { tx } from './db';

const here = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR ?? path.resolve(here, '../migrations');

/** Apply pending SQL migrations in order, each in its own transaction. Safe to run concurrently (advisory lock). */
export async function migrate(pool: pg.Pool, log: (m: string) => void = () => undefined): Promise<string[]> {
  const applied: string[] = [];
  await tx(pool, async (c) => {
    await c.query('SELECT pg_advisory_xact_lock(72716001)');
    await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const done = new Set((await c.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
    for (const f of files) {
      if (done.has(f)) continue;
      const sql = await readFile(path.join(MIGRATIONS_DIR, f), 'utf8');
      await c.query(sql);
      await c.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
      applied.push(f);
      log(`applied ${f}`);
    }
  });
  await syncReferenceData(pool);
  return applied;
}

/** Countries, cities and categories are defined in @passtra/core and mirrored into the DB for FKs and admin. */
export async function syncReferenceData(pool: pg.Pool): Promise<void> {
  await tx(pool, async (c) => {
    for (const k of COUNTRIES) {
      const [minLng, minLat, maxLng, maxLat] = k.bbox;
      await c.query(
        `INSERT INTO countries (code, name, default_timezone, default_currency, default_locale, bbox, enabled)
         VALUES ($1,$2,$3,$4,$5, ST_MakeEnvelope($6,$7,$8,$9,4326), $10)
         ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, default_timezone=EXCLUDED.default_timezone,
           default_currency=EXCLUDED.default_currency, default_locale=EXCLUDED.default_locale, bbox=EXCLUDED.bbox, enabled=EXCLUDED.enabled`,
        [k.code, JSON.stringify(k.name), k.timezone, k.currency, k.defaultLocale, minLng, minLat, maxLng, maxLat, k.enabled],
      );
    }
    for (const city of CITIES) {
      await c.query(
        `INSERT INTO cities (slug, country_code, name, aliases, timezone, center, radius_km, featured)
         VALUES ($1,$2,$3,$4,$5, ST_SetSRID(ST_MakePoint($6,$7),4326)::geography, $8, $9)
         ON CONFLICT (slug) DO UPDATE SET country_code=EXCLUDED.country_code, name=EXCLUDED.name, aliases=EXCLUDED.aliases,
           timezone=EXCLUDED.timezone, center=EXCLUDED.center, radius_km=EXCLUDED.radius_km, featured=EXCLUDED.featured`,
        [city.slug, city.country, JSON.stringify(city.name), city.aliases, city.timezone, city.lng, city.lat, city.radiusKm, city.featured],
      );
    }
    let i = 0;
    for (const cat of CATEGORIES) {
      await c.query(
        `INSERT INTO categories (slug, kind, group_slug, icon, label, age_min, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (slug) DO UPDATE SET kind=EXCLUDED.kind, group_slug=EXCLUDED.group_slug, icon=EXCLUDED.icon,
           label=EXCLUDED.label, age_min=EXCLUDED.age_min, sort_order=EXCLUDED.sort_order`,
        [cat.slug, cat.kind, cat.group, cat.icon, JSON.stringify(cat.label), cat.ageMin ?? null, i++],
      );
    }
  });
}
