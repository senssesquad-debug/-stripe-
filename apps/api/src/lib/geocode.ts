import { createHash } from 'node:crypto';
import { canonicalKey } from '@passtra/core';
import type { Queryable } from '../db';
import type { HttpClient } from './http';

export interface GeocodeResult {
  lat: number;
  lng: number;
  label: string;
  kind: string;
}

/**
 * Nominatim geocoder (OpenStreetMap). Usage policy: ≤ 1 request/second, identifying User-Agent,
 * results cached, no bulk geocoding. Positive results cached 90 days, misses 14 days.
 */
export class Geocoder {
  constructor(
    private db: Queryable,
    private http: HttpClient,
    private baseUrl: string,
    private enabled: boolean,
  ) {}

  async geocode(query: string, countryCode: string): Promise<GeocodeResult | null> {
    if (!this.enabled || !query.trim()) return null;
    const key = createHash('sha256').update(`nominatim|${countryCode}|${canonicalKey(query)}`).digest('hex');
    const cached = await this.db.query<{ result: GeocodeResult | null }>('SELECT result FROM geocode_cache WHERE query_key = $1 AND expires_at > now()', [key]);
    if (cached.rows[0]) return cached.rows[0].result;

    let result: GeocodeResult | null = null;
    try {
      const url = `${this.baseUrl.replace(/\/$/, '')}/search?format=jsonv2&limit=1&accept-language=en&countrycodes=${countryCode.toLowerCase()}&q=${encodeURIComponent(query)}`;
      const res = await this.http.json<Array<{ lat: string; lon: string; display_name: string; type: string; category?: string }>>(url, { timeoutMs: 15_000 });
      const hit = res.data?.[0];
      if (hit) result = { lat: Number(hit.lat), lng: Number(hit.lon), label: hit.display_name, kind: `${hit.category ?? ''}:${hit.type}` };
    } catch {
      return null; // transient error: don't cache
    }
    await this.db.query(
      `INSERT INTO geocode_cache (query_key, query, provider, result, expires_at) VALUES ($1,$2,'nominatim',$3, now() + $4::interval)
       ON CONFLICT (query_key) DO UPDATE SET result = EXCLUDED.result, created_at = now(), expires_at = EXCLUDED.expires_at`,
      [key, query, result ? JSON.stringify(result) : null, result ? '90 days' : '14 days'],
    );
    return result;
  }
}
