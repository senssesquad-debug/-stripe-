import { strFromU8, unzipSync } from 'fflate';
import type pg from 'pg';
import type { Logger } from '../engine/types';

/**
 * Official GTFS timetables of Cyprus bus operators, published by the Ministry of Transport on the Motion
 * open-data portal (CC BY 4.0). Feeds are re-checked twice a day and re-imported when their version changes;
 * each feed is replaced atomically, so routing never sees half-imported data.
 */
export const GTFS_FEEDS: Array<{ key: string; file: number; name: string }> = [
  { key: 'emel', file: 6, name: 'EMEL (Limassol)' },
  { key: 'npt', file: 9, name: 'NPT (Nicosia)' },
  { key: 'lpt', file: 10, name: 'LPT (Larnaca)' },
  { key: 'osypa', file: 2, name: 'OSYPA (Paphos)' },
  { key: 'osea', file: 4, name: 'OSEA (Famagusta)' },
  { key: 'intercity', file: 5, name: 'Intercity buses' },
  { key: 'pame', file: 11, name: 'Pame Express' },
];
export const gtfsUrl = (file: number) => `https://www.motionbuscard.org.cy/opendata/downloadfile?file=GTFS%5C${file}_google_transit.zip&rel=True`;
export const GTFS_ATTRIBUTION = 'Timetables: Ministry of Transport, Communications and Works of Cyprus (Motion), CC BY 4.0';

/** Minimal RFC 4180 CSV reader (quoted fields, escaped quotes, BOM). */
export function* csvRows(text: string): Generator<Record<string, string>> {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  let header: string[] | null = null;
  let field = '';
  let row: string[] = [];
  let quoted = false;
  const flush = function* () {
    row.push(field);
    field = '';
    if (!header) header = row.map((h) => h.trim());
    else if (row.length > 1 || row[0] !== '') yield Object.fromEntries(header.map((h, i) => [h, (row[i] ?? '').trim()]));
    row = [];
  };
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false; } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') yield* flush();
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) yield* flush();
}

const toSeconds = (t: string) => { const [h, m, s] = t.split(':').map(Number); return (h ?? 0) * 3600 + (m ?? 0) * 60 + (s ?? 0); };
const toDate = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;

async function insertMany(client: pg.PoolClient, sql: string, columns: unknown[][], batch = 5000) {
  const n = columns[0]?.length ?? 0;
  for (let i = 0; i < n; i += batch) await client.query(sql, columns.map((c) => c.slice(i, i + batch)));
}

/** Import one feed if its version changed. Returns what happened. */
export async function importGtfsFeed(pool: pg.Pool, feed: { key: string; file: number; name: string }, log: Logger, fetchImpl: typeof fetch = fetch, userAgent = 'passtra-bot/1.0'): Promise<'imported' | 'unchanged'> {
  const url = gtfsUrl(feed.file);
  const res = await fetchImpl(url, { headers: { 'user-agent': userAgent }, signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`GTFS ${feed.key}: HTTP ${res.status}`);
  const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
  const text = (name: string) => (files[name] ? strFromU8(files[name]!) : '');
  const info = [...csvRows(text('feed_info.txt'))][0] ?? {};
  const agency = [...csvRows(text('agency.txt'))][0]?.agency_name ?? feed.name;
  const version = info.feed_version ?? `${files['stop_times.txt']?.length ?? 0}`;
  const prev = await pool.query<{ version: string | null; imported_at: Date | null }>('SELECT version, imported_at FROM gtfs_feeds WHERE feed_key = $1', [feed.key]);
  if (prev.rows[0]?.version === version && prev.rows[0].imported_at) {
    await pool.query('UPDATE gtfs_feeds SET checked_at = now(), error = NULL WHERE feed_key = $1', [feed.key]);
    return 'unchanged';
  }

  // Fares: GTFS fare_rules map routes to fare_attributes (single-ride price in EUR).
  const farePrice = new Map([...csvRows(text('fare_attributes.txt'))].map((f) => [f.fare_id!, Number(f.price)]));
  const routeFare = new Map<string, number>();
  for (const r of csvRows(text('fare_rules.txt'))) if (r.route_id && farePrice.has(r.fare_id!)) routeFare.set(r.route_id, farePrice.get(r.fare_id!)!);

  // Service days: calendar.txt (weekly pattern) expanded within its dates, plus calendar_dates additions/removals.
  const days = new Map<string, Set<string>>();
  for (const c of csvRows(text('calendar.txt'))) {
    const wd = [c.sunday, c.monday, c.tuesday, c.wednesday, c.thursday, c.friday, c.saturday];
    for (let d = new Date(`${toDate(c.start_date!)}T00:00:00Z`); d <= new Date(`${toDate(c.end_date!)}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
      if (wd[d.getUTCDay()] === '1') { const k = d.toISOString().slice(0, 10); (days.get(k) ?? days.set(k, new Set()).get(k)!).add(c.service_id!); }
    }
  }
  for (const c of csvRows(text('calendar_dates.txt'))) {
    const k = toDate(c.date!);
    if (c.exception_type === '1') (days.get(k) ?? days.set(k, new Set()).get(k)!).add(c.service_id!);
    else days.get(k)?.delete(c.service_id!);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM gtfs_stop_times WHERE feed_key = $1', [feed.key]);
    await client.query('DELETE FROM gtfs_feeds WHERE feed_key = $1', [feed.key]);
    await client.query(`INSERT INTO gtfs_feeds (feed_key, agency_name, url, version, valid_from, valid_to, imported_at, checked_at) VALUES ($1,$2,$3,$4,$5,$6, now(), now())`,
      [feed.key, agency, url, version, info.feed_start_date ? toDate(info.feed_start_date) : null, info.feed_end_date ? toDate(info.feed_end_date) : null]);

    const stops = [...csvRows(text('stops.txt'))].filter((s) => s.stop_lat && s.stop_lon);
    await insertMany(client, `INSERT INTO gtfs_stops (feed_key, stop_id, name, location) SELECT '${feed.key}', id, name, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography FROM unnest($1::text[], $2::text[], $3::float8[], $4::float8[]) AS t(id, name, lat, lng)`,
      [stops.map((s) => s.stop_id), stops.map((s) => s.stop_name), stops.map((s) => Number(s.stop_lat)), stops.map((s) => Number(s.stop_lon))]);
    const routes = [...csvRows(text('routes.txt'))];
    await insertMany(client, `INSERT INTO gtfs_routes (feed_key, route_id, short_name, long_name, route_type, color, fare_eur) SELECT '${feed.key}', * FROM unnest($1::text[], $2::text[], $3::text[], $4::int[], $5::text[], $6::numeric[])`,
      [routes.map((r) => r.route_id), routes.map((r) => r.route_short_name || null), routes.map((r) => r.route_long_name || null), routes.map((r) => Number(r.route_type || 3)), routes.map((r) => r.route_color || null), routes.map((r) => routeFare.get(r.route_id!) ?? null)]);
    const trips = [...csvRows(text('trips.txt'))];
    await insertMany(client, `INSERT INTO gtfs_trips (feed_key, trip_id, route_id, service_id, headsign) SELECT '${feed.key}', * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[])`,
      [trips.map((t) => t.trip_id), trips.map((t) => t.route_id), trips.map((t) => t.service_id), trips.map((t) => t.trip_headsign || null)]);
    const sd: [string[], string[]] = [[], []];
    for (const [date, set] of days) for (const sid of set) { sd[0].push(sid); sd[1].push(date); }
    await insertMany(client, `INSERT INTO gtfs_service_dates (feed_key, service_id, date) SELECT '${feed.key}', * FROM unnest($1::text[], $2::date[]) ON CONFLICT DO NOTHING`, sd);
    const st: [string[], number[], string[], number[], number[]] = [[], [], [], [], []];
    for (const r of csvRows(text('stop_times.txt'))) {
      if (!r.arrival_time && !r.departure_time) continue; // untimed stops are not used for routing
      st[0].push(r.trip_id!); st[1].push(Number(r.stop_sequence)); st[2].push(r.stop_id!);
      st[3].push(toSeconds(r.arrival_time || r.departure_time!)); st[4].push(toSeconds(r.departure_time || r.arrival_time!));
    }
    await insertMany(client, `INSERT INTO gtfs_stop_times (feed_key, trip_id, seq, stop_id, arr, dep) SELECT '${feed.key}', * FROM unnest($1::text[], $2::int[], $3::text[], $4::int[], $5::int[])`, st);
    await client.query('COMMIT');
    log.info({ feed: feed.key, version, stops: stops.length, trips: trips.length, stopTimes: st[0].length }, 'gtfs feed imported');
    return 'imported';
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** Check one stale feed per call (keeps background slices short). */
export async function refreshGtfs(pool: pg.Pool, log: Logger, fetchImpl: typeof fetch = fetch): Promise<void> {
  const state = await pool.query<{ feed_key: string; checked_at: Date | null }>('SELECT feed_key, checked_at FROM gtfs_feeds');
  const checked = new Map(state.rows.map((r) => [r.feed_key, r.checked_at]));
  const due = GTFS_FEEDS.find((f) => { const c = checked.get(f.key); return !c || Date.now() - c.getTime() > 12 * 3600_000; });
  if (!due) return;
  try {
    await importGtfsFeed(pool, due, log, fetchImpl);
  } catch (e) {
    log.warn({ feed: due.key, err: (e as Error).message }, 'gtfs import failed');
    await pool.query(`INSERT INTO gtfs_feeds (feed_key, agency_name, url, checked_at, error) VALUES ($1,$2,$3, now(), $4)
      ON CONFLICT (feed_key) DO UPDATE SET checked_at = now(), error = EXCLUDED.error`, [due.key, due.name, gtfsUrl(due.file), (e as Error).message.slice(0, 300)]);
  }
}
