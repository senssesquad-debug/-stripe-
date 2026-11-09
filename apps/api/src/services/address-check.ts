import { haversineKm, nameSimilarity } from '@passtra/core';
import type pg from 'pg';
import type { AppConfig } from '../config';
import { cityFromLocation } from '../engine/classify';
import type { Logger } from '../engine/types';
import type { Geocoder } from '../lib/geocode';
import type { HttpClient } from '../lib/http';

/**
 * Does a venue's address exist, lie in the stated city, match the stored coordinates, and is there a place with
 * this name there? Google Geocoding API when GOOGLE_MAPS_API_KEY is set (key stays on the server), otherwise
 * OpenStreetMap Nominatim (≤ 1 request/second, cached). Only the verdict is stored, not the provider's data.
 */
export type AddressStatus = 'verified' | 'approximate' | 'mismatch' | 'city_mismatch' | 'not_found';
export interface AddressCheck { status: AddressStatus; distanceM: number | null; nameMatch: boolean | null; provider: 'google' | 'nominatim'; checkedAt: string }

interface Target { name: string; address: string; lat: number; lng: number }

async function googleGeocode(http: HttpClient, key: string, q: string): Promise<{ lat: number; lng: number } | null> {
  const r = await http.json<{ status: string; results: Array<{ geometry: { location: { lat: number; lng: number } } }> }>(
    `https://maps.googleapis.com/maps/api/geocode/json?region=cy&components=country:CY&address=${encodeURIComponent(q)}&key=${encodeURIComponent(key)}`, { timeoutMs: 10_000 });
  const hit = r.data?.status === 'OK' ? r.data.results[0] : undefined;
  return hit ? { lat: hit.geometry.location.lat, lng: hit.geometry.location.lng } : null;
}

/** Is there something called `name` within ~200 m of the point (Nominatim, bounded search)? */
async function nameNearby(http: HttpClient, baseUrl: string, t: Target): Promise<boolean | null> {
  const d = 0.002;
  try {
    const url = `${baseUrl.replace(/\/$/, '')}/search?format=jsonv2&limit=5&bounded=1&viewbox=${t.lng - d},${t.lat + d},${t.lng + d},${t.lat - d}&q=${encodeURIComponent(t.name)}`;
    const r = await http.json<Array<{ name?: string; display_name: string }>>(url, { timeoutMs: 12_000 });
    return (r.data ?? []).some((h) => nameSimilarity(h.name || h.display_name.split(',')[0]!, t.name) >= 0.6);
  } catch {
    return null;
  }
}

export async function checkAddress(deps: { config: AppConfig; http: HttpClient; geocoder: Geocoder }, t: Target): Promise<AddressCheck> {
  const provider = deps.config.GOOGLE_MAPS_API_KEY ? 'google' : 'nominatim';
  const q = /cyprus|κύπρος|кипр/i.test(t.address) ? t.address : `${t.address}, Cyprus`;
  const found = provider === 'google' ? await googleGeocode(deps.http, deps.config.GOOGLE_MAPS_API_KEY!, q).catch(() => null) : await deps.geocoder.geocode(q, 'CY');
  const checkedAt = new Date().toISOString();
  if (!found) return { status: 'not_found', distanceM: null, nameMatch: null, provider, checkedAt };
  const m = Math.round(haversineKm(found, t) * 1000);
  const sameCity = cityFromLocation(found.lat, found.lng)?.slug === cityFromLocation(t.lat, t.lng)?.slug;
  const nameMatch = provider === 'nominatim' ? await nameNearby(deps.http, deps.config.NOMINATIM_URL, t) : null;
  const status: AddressStatus = m <= 250 ? 'verified' : m <= 1500 ? 'approximate' : sameCity ? 'mismatch' : 'city_mismatch';
  return { status, distanceM: m, nameMatch, provider, checkedAt };
}

/** Background pass: a few unchecked (or 60-day-old) places and events per run, politely. */
export async function runAddressChecks(pool: pg.Pool, deps: { config: AppConfig; http: HttpClient; geocoder: Geocoder }, log: Logger, limit = 15): Promise<number> {
  if (!deps.config.GEOCODING_ENABLED && !deps.config.GOOGLE_MAPS_API_KEY) return 0;
  const rows = await pool.query<{ kind: 'place' | 'event'; id: string; name: string; address: string; lat: number; lng: number }>(
    `(SELECT 'place' AS kind, id, name, address, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng FROM places
       WHERE merged_into IS NULL AND status = 'active' AND address IS NOT NULL AND length(address) > 6
         AND (address_check IS NULL OR (address_check->>'checkedAt')::timestamptz < now() - interval '60 days') LIMIT $1)
     UNION ALL
     (SELECT 'event', id, COALESCE(venue_name, title), address, ST_Y(location::geometry), ST_X(location::geometry) FROM events
       WHERE merged_into IS NULL AND place_id IS NULL AND address IS NOT NULL AND location IS NOT NULL AND starts_at > now()
         AND address_check IS NULL LIMIT $1)`, [limit]);
  let n = 0;
  for (const r of rows.rows) {
    const c = await checkAddress(deps, r);
    await pool.query(`UPDATE ${r.kind === 'place' ? 'places' : 'events'} SET address_check = $2 WHERE id = $1`, [r.id, JSON.stringify(c)]);
    n++;
  }
  if (n) log.info({ checked: n }, 'address checks');
  return n;
}
