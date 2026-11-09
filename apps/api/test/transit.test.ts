import { strToU8, zipSync } from 'fflate';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { HttpClient } from '../src/lib/http';
import { csvRows, importGtfsFeed } from '../src/transit/gtfs';
import { planTransit } from '../src/transit/plan';
import { fakeFetch, freshDb } from './helpers';

/**
 * A small GTFS feed in the official format: line A runs along a street, line B crosses it.
 * Stops: S1 (origin side) → S2 → S3 (change) on A; S3b (60 m from S3) → S4 (destination side) on B.
 */
const csv = (rows: string[][]) => rows.map((r) => r.join(',')).join('\n') + '\n';
function feed(version: string) {
  return zipSync({
    'agency.txt': strToU8(csv([['agency_id', 'agency_name', 'agency_url', 'agency_timezone'], ['1', 'Test Bus', 'https://x', 'Asia/Nicosia']])),
    'feed_info.txt': strToU8(csv([['feed_publisher_name', 'feed_publisher_url', 'feed_lang', 'feed_start_date', 'feed_end_date', 'feed_version'], ['M', 'https://x', 'en', '20261101', '20270201', version]])),
    'stops.txt': strToU8(csv([['stop_id', 'stop_name', 'stop_lat', 'stop_lon'],
      ['S1', '"Origin Sq, North"', '34.6800', '33.0400'], ['S2', 'Middle', '34.6800', '33.0500'], ['S3', 'Change Point', '34.6800', '33.0600'],
      ['S3b', 'Change Point B', '34.6805', '33.0603'], ['S4', 'Destination Rd', '34.7000', '33.0603']])),
    'routes.txt': strToU8(csv([['route_id', 'agency_id', 'route_short_name', 'route_long_name', 'route_type', 'route_color'], ['A', '1', '10', 'Line A', '3', '0000FF'], ['B', '1', '20', 'Line B', '3', 'FF0000']])),
    'trips.txt': strToU8(csv([['route_id', 'service_id', 'trip_id', 'trip_headsign'], ['A', 'WK', 'A1', 'East'], ['A', 'WK', 'A2', 'East'], ['B', 'WK', 'B1', 'North'], ['B', 'SUN', 'B9', 'North']])),
    'calendar_dates.txt': strToU8(csv([['service_id', 'date', 'exception_type'], ['WK', '20261109', '1'], ['SUN', '20261108', '1']])),
    'stop_times.txt': strToU8(csv([['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence'],
      ['A1', '10:00:00', '10:00:00', 'S1', '1'], ['A1', '10:05:00', '10:05:00', 'S2', '2'], ['A1', '10:10:00', '10:10:00', 'S3', '3'],
      ['A2', '11:00:00', '11:00:00', 'S1', '1'], ['A2', '11:10:00', '11:10:00', 'S3', '2'],
      ['B1', '10:20:00', '10:20:00', 'S3b', '1'], ['B1', '10:35:00', '10:35:00', 'S4', '2'],
      ['B9', '10:20:00', '10:20:00', 'S3b', '1'], ['B9', '10:30:00', '10:30:00', 'S4', '2']])),
    'fare_attributes.txt': strToU8(csv([['fare_id', 'price', 'currency_type', 'payment_method', 'transfers'], ['F', '2.5', 'EUR', '0', '0']])),
    'fare_rules.txt': strToU8(csv([['fare_id', 'route_id'], ['F', 'A'], ['F', 'B']])),
  });
}

let pool: pg.Pool;
const log = { info() {}, warn() {}, error() {}, debug() {} };
const zipFetch = (v: string) => (async () => new Response(feed(v))) as unknown as typeof fetch;
const ORIGIN = { lat: 34.6795, lng: 33.0395 };
const DEST = { lat: 34.7004, lng: 33.0606 };

beforeAll(async () => {
  pool = (await freshDb('transit')).pool;
});
afterAll(async () => pool.end());

describe('GTFS import', () => {
  it('parses quoted CSV fields', () => {
    expect([...csvRows('a,b\n"x, y",2\n')]).toEqual([{ a: 'x, y', b: '2' }]);
  });
  it('imports a feed and skips an unchanged version', async () => {
    expect(await importGtfsFeed(pool, { key: 'test', file: 0, name: 'Test' }, log, zipFetch('v1'))).toBe('imported');
    expect(await importGtfsFeed(pool, { key: 'test', file: 0, name: 'Test' }, log, zipFetch('v1'))).toBe('unchanged');
    expect((await pool.query(`SELECT count(*)::int AS n FROM gtfs_stop_times WHERE feed_key = 'test'`)).rows[0].n).toBe(9);
    expect((await pool.query(`SELECT fare_eur FROM gtfs_routes WHERE route_id = 'A'`)).rows[0].fare_eur).toBe(2.5);
  });
});

describe('transit planning from timetables', () => {
  it('finds a one-change itinerary with real departure times, wait, fare and walking legs', async () => {
    const r = await planTransit(pool, ORIGIN, DEST, new Date('2026-11-09T09:50:00+02:00'));
    expect(r.status).toBe('ok');
    const o = r.options[0]!;
    expect(o.transfers).toBe(1);
    const buses = o.legs.filter((l) => l.type === 'bus');
    expect(buses.map((b) => b.type === 'bus' && b.route)).toEqual(['10', '20']);
    expect(buses[0]!.type === 'bus' && buses[0]!.departure).toBe('2026-11-09T08:00:00.000Z'); // 10:00 Cyprus time
    expect(buses[1]!.type === 'bus' && buses[1]!.waitMin).toBeGreaterThanOrEqual(8); // arrives 10:10, next bus 10:20
    // Each bus leg lists its stops with scheduled times, boarding first and alighting last.
    const b0 = buses[0]!;
    if (b0.type !== 'bus') throw new Error('bus expected');
    expect(b0.stopList.length).toBe(b0.stops + 1);
    expect(b0.stopList[0]!.name).toBe(b0.from);
    expect(b0.stopList.at(-1)!.name).toBe(b0.to);
    expect(b0.stopList[0]!.at).toBe(b0.departure);
    for (let i = 1; i < b0.stopList.length; i++) expect(Date.parse(b0.stopList[i]!.at)).toBeGreaterThanOrEqual(Date.parse(b0.stopList[i - 1]!.at));
    expect(o.fareEur).toBe(5);
    expect(o.legs[0]!.type).toBe('walk');
    expect(o.legs.at(-1)!.type).toBe('walk');
    expect(r.scheduledOnly).toBe(true);
  });
  it('does not show buses that do not run that day', async () => {
    const r = await planTransit(pool, ORIGIN, DEST, new Date('2026-11-10T09:50:00+02:00')); // no service on the 10th
    expect(r).toMatchObject({ status: 'no_service', options: [] });
  });
  it('after the last bus there is nothing — never an invented departure', async () => {
    const r = await planTransit(pool, ORIGIN, DEST, new Date('2026-11-09T11:30:00+02:00'));
    expect(r.status).toBe('no_service');
  });
  it('far from any stop', async () => {
    expect((await planTransit(pool, { lat: 34.95, lng: 32.86 }, DEST, new Date('2026-11-09T09:50:00+02:00'))).status).toBe('no_stops_nearby');
  });
  it('an expired timetable is reported as such', async () => {
    expect((await planTransit(pool, ORIGIN, DEST, new Date('2027-03-01T09:50:00+02:00'))).status).toBe('no_timetable');
  });
});

describe('GET /v1/directions', () => {
  it('returns walk, bike, car (separate OSRM profiles, localized steps, arrival time) and transit', async () => {
    const osrm = (profile: string, km: number, min: number) => ({
      code: 'Ok', routes: [{ distance: km * 1000, duration: min * 60, geometry: { coordinates: [[33.0395, 34.6795], [33.0606, 34.7004]] },
        legs: [{ steps: [
          { distance: 100, duration: 60, name: 'Makariou', maneuver: { type: 'depart', location: [33.0395, 34.6795] } },
          { distance: km * 1000 - 100, duration: min * 60 - 60, name: 'Anexartisias', maneuver: { type: 'turn', modifier: 'left', location: [33.04, 34.68] } },
          { distance: 0, duration: 0, name: '', maneuver: { type: 'arrive', location: [33.0606, 34.7004] } },
        ] }] }],
      profile,
    });
    const f = fakeFetch([
      [/routed-foot/, () => osrm('foot', 3.1, 38)], [/routed-bike/, () => osrm('bike', 2.9, 12)], [/routed-car/, () => osrm('car', 3.6, 7)],
    ]);
    const db = await freshDb('transit_api');
    await importGtfsFeed(db.pool, { key: 'test', file: 0, name: 'Test' }, log, zipFetch('v1'));
    const { app } = await buildApp(db.config, db.pool, { now: () => new Date('2026-11-09T07:50:00Z'), http: new HttpClient('passtra-bot/test', 0, f) });
    const r = (await app.inject(`/v1/directions?from=${ORIGIN.lat},${ORIGIN.lng}&to=${DEST.lat},${DEST.lng}&locale=ru`)).json();
    await app.close();
    await db.pool.end();
    expect(f.calls.some((u) => u.includes('routed-bike/route/v1/bike'))).toBe(true);
    expect(r.bike).toMatchObject({ mode: 'bike', distanceKm: 2.9, durationMin: 12, arriveAt: '2026-11-09T08:02:00.000Z', estimate: false });
    expect(r.drive.note).toBe('no_live_traffic');
    expect(r.walk.steps.map((s: { text: string }) => s.text)).toEqual(['Начните движение на Makariou', 'Поверните налево на Anexartisias', 'Вы на месте']);
    expect(r.transit.status).toBe('ok');
    expect(r.transit.options[0].legs.some((l: { type: string }) => l.type === 'bus')).toBe(true);
  });
});
