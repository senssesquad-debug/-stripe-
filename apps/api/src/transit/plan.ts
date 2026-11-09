import { haversineKm } from '@passtra/core';
import { DateTime } from 'luxon';
import type pg from 'pg';
import { GTFS_ATTRIBUTION } from './gtfs';

/**
 * Public-transport itineraries from the imported GTFS timetables (scheduled times — no live positions):
 * walk → bus → (walk to another stop, wait) → bus → walk, with at most one change.
 * Nothing is invented: if no stop is near, no bus runs, or the timetable has expired, the reason is returned.
 */
const ZONE = 'Europe/Nicosia';
const WALK_KMH = 4.8;
const WALK_FACTOR = 1.25; // streets are longer than straight lines
const MAX_ACCESS_KM = 0.9;
const TRANSFER_RADIUS_KM = 0.3;
const MIN_TRANSFER_S = 120;
const HORIZON_S = 3 * 3600;
const BOARD_MARGIN_S = 120; // be at the stop 2 minutes before the bus

export interface StopRef { feed: string; id: string; name: string; lat: number; lng: number }
export type TransitLeg =
  | { type: 'walk'; from: string; to: string; distanceM: number; durationMin: number; fromPoint: [number, number]; toPoint: [number, number] }
  | { type: 'bus'; operator: string; route: string | null; routeName: string | null; color: string | null; headsign: string | null; from: string; to: string;
      departure: string; arrival: string; stops: number; waitMin: number; fareEur: number | null; fromPoint: [number, number]; toPoint: [number, number];
      /** Every stop the bus calls at on this leg, boarding and alighting stops included, with scheduled times. */
      stopList: Array<{ name: string; at: string; point: [number, number] }> };
export interface TransitOption { departAt: string; arriveAt: string; durationMin: number; transfers: number; walkMin: number; fareEur: number | null; fareComplete: boolean; legs: TransitLeg[] }
export interface TransitResult {
  status: 'ok' | 'no_stops_nearby' | 'no_service' | 'no_timetable';
  options: TransitOption[];
  scheduledOnly: true;
  validUntil: string | null;
  attribution: string;
}

const walkMin = (km: number) => Math.max(1, Math.round(((km * WALK_FACTOR) / WALK_KMH) * 60));
const walkSec = (km: number) => Math.round(((km * WALK_FACTOR) / WALK_KMH) * 3600);
const key = (feed: string, stop: string) => `${feed}:${stop}`;

async function stopsNear(db: pg.Pool, p: { lat: number; lng: number }, km: number, limit: number): Promise<Array<StopRef & { km: number }>> {
  const r = await db.query<{ feed_key: string; stop_id: string; name: string; lat: number; lng: number; m: number }>(
    `SELECT feed_key, stop_id, name, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng,
            ST_Distance(location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) AS m
       FROM gtfs_stops WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)
      ORDER BY m LIMIT $4`, [p.lat, p.lng, km * 1000, limit]);
  return r.rows.map((s) => ({ feed: s.feed_key, id: s.stop_id, name: s.name, lat: s.lat, lng: s.lng, km: s.m / 1000 }));
}

export async function planTransit(db: pg.Pool, from: { lat: number; lng: number }, to: { lat: number; lng: number }, departAt: Date): Promise<TransitResult> {
  const base = { scheduledOnly: true as const, attribution: GTFS_ATTRIBUTION };
  const local = DateTime.fromJSDate(departAt, { zone: ZONE });
  const day = local.startOf('day');
  const date = day.toISODate()!;
  const feeds = await db.query<{ feed_key: string; agency_name: string; valid_to: string | null }>(
    `SELECT feed_key, agency_name, to_char(valid_to, 'YYYY-MM-DD') AS valid_to FROM gtfs_feeds WHERE imported_at IS NOT NULL`);
  const valid = feeds.rows.filter((f) => !f.valid_to || f.valid_to >= date);
  const validUntil = valid.map((f) => f.valid_to).filter((x): x is string => !!x).sort()[0] ?? null;
  if (!valid.length) return { ...base, status: 'no_timetable', options: [], validUntil: null };
  const agency = new Map(feeds.rows.map((f) => [f.feed_key, f.agency_name]));

  let origins = await stopsNear(db, from, MAX_ACCESS_KM, 15);
  let dests = await stopsNear(db, to, MAX_ACCESS_KM, 15);
  if (!origins.length) origins = await stopsNear(db, from, 1.6, 6);
  if (!dests.length) dests = await stopsNear(db, to, 1.6, 6);
  if (!origins.length || !dests.length) return { ...base, status: 'no_stops_nearby', options: [], validUntil };

  const t0 = Math.round(local.diff(day, 'seconds').seconds);
  const services = await db.query<{ feed_key: string; service_id: string }>(`SELECT feed_key, service_id FROM gtfs_service_dates WHERE date = $1`, [date]);
  const active = services.rows.map((s) => key(s.feed_key, s.service_id));
  const originWalk = new Map(origins.map((s) => [key(s.feed, s.id), walkSec(s.km)]));
  const destWalk = new Map(dests.map((s) => [key(s.feed, s.id), walkSec(s.km)]));
  const streetM = (sec: number) => Math.round((sec / 3600) * WALK_KMH * 1000); // walking distance along streets

  // Leg A: trips leaving an origin stop soon, with every later stop they reach.
  const a = await db.query<{ feed_key: string; trip_id: string; o_stop: string; o_seq: number; dep: number; x_stop: string; x_seq: number; arr: number }>(
    `WITH dep AS (
       SELECT st.feed_key, st.trip_id, st.stop_id AS o_stop, st.seq AS o_seq, st.dep
         FROM gtfs_stop_times st JOIN gtfs_trips t ON t.feed_key = st.feed_key AND t.trip_id = st.trip_id
        WHERE st.feed_key || ':' || st.stop_id = ANY($1) AND st.dep BETWEEN $2 AND $3 AND t.feed_key || ':' || t.service_id = ANY($4))
     SELECT DISTINCT ON (dep.feed_key, dep.trip_id, x.stop_id) dep.feed_key, dep.trip_id, dep.o_stop, dep.o_seq, dep.dep, x.stop_id AS x_stop, x.seq AS x_seq, x.arr
       FROM dep JOIN gtfs_stop_times x ON x.feed_key = dep.feed_key AND x.trip_id = dep.trip_id AND x.seq > dep.o_seq
      ORDER BY dep.feed_key, dep.trip_id, x.stop_id, dep.dep DESC`,
    [[...originWalk.keys()], t0, t0 + 2 * 3600, active]);

  // Leg B: trips arriving at a destination stop within the horizon, with every earlier stop they pass.
  const b = await db.query<{ feed_key: string; trip_id: string; d_stop: string; d_seq: number; arr: number; y_stop: string; y_seq: number; dep: number }>(
    `WITH arr AS (
       SELECT st.feed_key, st.trip_id, st.stop_id AS d_stop, st.seq AS d_seq, st.arr
         FROM gtfs_stop_times st JOIN gtfs_trips t ON t.feed_key = st.feed_key AND t.trip_id = st.trip_id
        WHERE st.feed_key || ':' || st.stop_id = ANY($1) AND st.arr BETWEEN $2 AND $3 AND t.feed_key || ':' || t.service_id = ANY($4))
     SELECT arr.feed_key, arr.trip_id, arr.d_stop, arr.d_seq, arr.arr, y.stop_id AS y_stop, y.seq AS y_seq, y.dep
       FROM arr JOIN gtfs_stop_times y ON y.feed_key = arr.feed_key AND y.trip_id = arr.trip_id AND y.seq < arr.d_seq AND y.dep >= $2`,
    [[...destWalk.keys()], t0, t0 + HORIZON_S, active]);

  type Cand = { legs: Array<{ feed: string; trip: string; from: string; fromSeq: number; dep: number; to: string; toSeq: number; arr: number }>; accessS: number; egressS: number; transferWalkKm: number };
  const cands: Cand[] = [];

  // Direct: same trip from an origin stop to a destination stop.
  for (const r of a.rows) {
    const k = key(r.feed_key, r.x_stop);
    if (!destWalk.has(k)) continue;
    const access = originWalk.get(key(r.feed_key, r.o_stop))!;
    if (r.dep < t0 + access + BOARD_MARGIN_S) continue;
    cands.push({ legs: [{ feed: r.feed_key, trip: r.trip_id, from: r.o_stop, fromSeq: r.o_seq, dep: r.dep, to: r.x_stop, toSeq: r.x_seq, arr: r.arr }], accessS: access, egressS: destWalk.get(k)!, transferWalkKm: 0 });
  }

  // One change: leg A reaches stop X, leg B leaves stop Y near X after a minimal transfer time.
  const ids = new Set<string>([...a.rows.map((r) => key(r.feed_key, r.x_stop)), ...b.rows.map((r) => key(r.feed_key, r.y_stop))]);
  const coords = new Map<string, { lat: number; lng: number; name: string }>();
  if (ids.size) {
    const c = await db.query<{ k: string; lat: number; lng: number; name: string }>(
      `SELECT feed_key || ':' || stop_id AS k, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng, name FROM gtfs_stops WHERE feed_key || ':' || stop_id = ANY($1)`, [[...ids]]);
    for (const r of c.rows) coords.set(r.k, r);
  }
  // Index leg-B boarding points on a coarse grid for proximity lookups.
  const grid = new Map<string, typeof b.rows>();
  const cell = (lat: number, lng: number) => `${Math.floor(lat / 0.003)}:${Math.floor(lng / 0.003)}`;
  for (const r of b.rows) {
    const p = coords.get(key(r.feed_key, r.y_stop));
    if (!p) continue;
    const c = cell(p.lat, p.lng);
    (grid.get(c) ?? grid.set(c, []).get(c)!).push(r);
  }
  const tripRoutes = await db.query<{ k: string; route_id: string }>(
    `SELECT feed_key || ':' || trip_id AS k, route_id FROM gtfs_trips WHERE feed_key || ':' || trip_id = ANY($1)`,
    [[...new Set([...a.rows.map((r) => key(r.feed_key, r.trip_id)), ...b.rows.map((r) => key(r.feed_key, r.trip_id))])]]);
  const routeOf = new Map(tripRoutes.rows.map((r) => [r.k, `${r.k.split(':')[0]}:${r.route_id}`]));
  const bestA = new Map<string, (typeof a.rows)[number]>(); // earliest arrival at each stop by any first trip
  for (const r of a.rows) {
    const access = originWalk.get(key(r.feed_key, r.o_stop))!;
    if (r.dep < t0 + access + BOARD_MARGIN_S) continue;
    const k = key(r.feed_key, r.x_stop);
    const prev = bestA.get(k);
    if (!prev || r.arr < prev.arr) bestA.set(k, r);
  }
  for (const [xk, ra] of bestA) {
    const p = coords.get(xk);
    if (!p) continue;
    const [ci, cj] = cell(p.lat, p.lng).split(':').map(Number) as [number, number];
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      for (const rb of grid.get(`${ci + di}:${cj + dj}`) ?? []) {
        if (rb.trip_id === ra.trip_id && rb.feed_key === ra.feed_key) continue;
        if (routeOf.get(key(ra.feed_key, ra.trip_id)) === routeOf.get(key(rb.feed_key, rb.trip_id))) continue; // changing onto the same line is never useful
        const q = coords.get(key(rb.feed_key, rb.y_stop))!;
        const km = haversineKm(p, q);
        if (km > TRANSFER_RADIUS_KM) continue;
        if (rb.dep < ra.arr + MIN_TRANSFER_S + walkSec(km)) continue;
        cands.push({
          legs: [
            { feed: ra.feed_key, trip: ra.trip_id, from: ra.o_stop, fromSeq: ra.o_seq, dep: ra.dep, to: ra.x_stop, toSeq: ra.x_seq, arr: ra.arr },
            { feed: rb.feed_key, trip: rb.trip_id, from: rb.y_stop, fromSeq: rb.y_seq, dep: rb.dep, to: rb.d_stop, toSeq: rb.d_seq, arr: rb.arr },
          ],
          accessS: originWalk.get(key(ra.feed_key, ra.o_stop))!, egressS: destWalk.get(key(rb.feed_key, rb.d_stop))!, transferWalkKm: km,
        });
      }
    }
  }
  if (!cands.length) return { ...base, status: 'no_service', options: [], validUntil };

  // Rank by arrival, then fewer changes, then less walking; keep distinct route combinations.
  const arrival = (c: Cand) => c.legs[c.legs.length - 1]!.arr + c.egressS;
  // A change is only worth it if it gets there clearly earlier than the best direct bus.
  const bestDirect = Math.min(...cands.filter((c) => c.legs.length === 1).map(arrival));
  for (let i = cands.length - 1; i >= 0; i--) if (cands[i]!.legs.length > 1 && arrival(cands[i]!) > bestDirect - 5 * 60) cands.splice(i, 1);
  cands.sort((x, y) => arrival(x) - arrival(y) || x.legs.length - y.legs.length || x.accessS + x.egressS - (y.accessS + y.egressS));
  const tripInfo = new Map<string, { route_id: string; headsign: string | null; short_name: string | null; long_name: string | null; color: string | null; fare_eur: string | null }>();
  const tripKeys = [...new Set(cands.slice(0, 60).flatMap((c) => c.legs.map((l) => key(l.feed, l.trip))))];
  const ti = await db.query<{ k: string; route_id: string; headsign: string | null; short_name: string | null; long_name: string | null; color: string | null; fare_eur: string | null }>(
    `SELECT t.feed_key || ':' || t.trip_id AS k, t.route_id, t.headsign, r.short_name, r.long_name, r.color, r.fare_eur
       FROM gtfs_trips t JOIN gtfs_routes r ON r.feed_key = t.feed_key AND r.route_id = t.route_id WHERE t.feed_key || ':' || t.trip_id = ANY($1)`, [tripKeys]);
  for (const r of ti.rows) tripInfo.set(r.k, r);
  const missing = [...new Set(cands.slice(0, 60).flatMap((c) => c.legs.flatMap((l) => [key(l.feed, l.from), key(l.feed, l.to)])))].filter((k) => !coords.has(k));
  if (missing.length) {
    const c = await db.query<{ k: string; lat: number; lng: number; name: string }>(
      `SELECT feed_key || ':' || stop_id AS k, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng, name FROM gtfs_stops WHERE feed_key || ':' || stop_id = ANY($1)`, [missing]);
    for (const r of c.rows) coords.set(r.k, r);
  }

  const at = (s: number) => day.plus({ seconds: s }).toUTC().toISO()!;
  // Intermediate stops of the legs that can be shown (first options only), for stop lists and the bus line on the map.
  const shownLegs = cands.slice(0, 12).flatMap((c) => c.legs);
  const calls = new Map<string, Array<{ seq: number; name: string; arr: number; lat: number; lng: number }>>();
  if (shownLegs.length) {
    const r = await db.query<{ k: string; seq: number; name: string; arr: number; lat: number; lng: number }>(
      `SELECT st.feed_key || ':' || st.trip_id AS k, st.seq, s.name, st.arr, ST_Y(s.location::geometry) AS lat, ST_X(s.location::geometry) AS lng
         FROM gtfs_stop_times st JOIN gtfs_stops s ON s.feed_key = st.feed_key AND s.stop_id = st.stop_id
        WHERE st.feed_key || ':' || st.trip_id = ANY($1) ORDER BY st.feed_key, st.trip_id, st.seq`,
      [[...new Set(shownLegs.map((l) => key(l.feed, l.trip)))]]);
    for (const row of r.rows) { const list = calls.get(row.k) ?? []; list.push(row); calls.set(row.k, list); }
  }
  const seen = new Set<string>();
  const options: TransitOption[] = [];
  for (const c of cands) {
    const sig = c.legs.map((l) => tripInfo.get(key(l.feed, l.trip))?.route_id ?? l.trip).join('>');
    if (seen.has(sig)) continue;
    seen.add(sig);
    const legs: TransitLeg[] = [];
    const first = c.legs[0]!;
    const fs = coords.get(key(first.feed, first.from))!;
    legs.push({ type: 'walk', from: 'origin', to: fs.name, distanceM: streetM(c.accessS), durationMin: Math.max(1, Math.round(c.accessS / 60)), fromPoint: [from.lng, from.lat], toPoint: [fs.lng, fs.lat] });
    let prevArr = first.dep - BOARD_MARGIN_S; // leave so as to be at the stop shortly before the bus
    let fare = 0;
    let fareComplete = true;
    c.legs.forEach((l, i) => {
      const info = tripInfo.get(key(l.feed, l.trip));
      const s1 = coords.get(key(l.feed, l.from))!;
      const s2 = coords.get(key(l.feed, l.to))!;
      if (i > 0 && c.transferWalkKm > 0.02) {
        legs.push({ type: 'walk', from: legs[legs.length - 1]!.to, to: s1.name, distanceM: Math.round(c.transferWalkKm * WALK_FACTOR * 1000), durationMin: walkMin(c.transferWalkKm), fromPoint: (legs[legs.length - 1] as { toPoint: [number, number] }).toPoint, toPoint: [s1.lng, s1.lat] });
        prevArr += walkSec(c.transferWalkKm);
      }
      const f = info?.fare_eur !== null && info?.fare_eur !== undefined ? Number(info.fare_eur) : null;
      if (f === null) fareComplete = false; else fare += f;
      legs.push({
        type: 'bus', operator: agency.get(l.feed) ?? l.feed, route: info?.short_name ?? null, routeName: info?.long_name ?? null, color: info?.color ? `#${info.color}` : null,
        headsign: info?.headsign ?? null, from: s1.name, to: s2.name, departure: at(l.dep), arrival: at(l.arr), stops: l.toSeq - l.fromSeq,
        waitMin: Math.max(0, Math.round((l.dep - prevArr) / 60)), fareEur: f, fromPoint: [s1.lng, s1.lat], toPoint: [s2.lng, s2.lat],
        stopList: (calls.get(key(l.feed, l.trip)) ?? []).filter((x) => x.seq >= l.fromSeq && x.seq <= l.toSeq)
          .map((x) => ({ name: x.name, at: at(x.seq === l.fromSeq ? l.dep : x.arr), point: [x.lng, x.lat] as [number, number] })),
      });
      prevArr = l.arr;
    });
    const last = c.legs[c.legs.length - 1]!;
    const ls = coords.get(key(last.feed, last.to))!;
    legs.push({ type: 'walk', from: ls.name, to: 'destination', distanceM: streetM(c.egressS), durationMin: Math.max(1, Math.round(c.egressS / 60)), fromPoint: [ls.lng, ls.lat], toPoint: [to.lng, to.lat] });
    const leave = first.dep - BOARD_MARGIN_S - c.accessS;
    const end = arrival(c);
    options.push({
      departAt: at(leave), arriveAt: at(end), durationMin: Math.round((end - leave) / 60), transfers: c.legs.length - 1,
      walkMin: legs.filter((x) => x.type === 'walk').reduce((s, x) => s + x.durationMin, 0), fareEur: fareComplete ? Math.round(fare * 100) / 100 : null, fareComplete, legs,
    });
    if (options.length >= 3) break;
  }
  return { ...base, status: 'ok', options, validUntil };
}
