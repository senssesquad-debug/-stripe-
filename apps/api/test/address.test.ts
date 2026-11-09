import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Geocoder } from '../src/lib/geocode';
import { HttpClient } from '../src/lib/http';
import { checkAddress } from '../src/services/address-check';
import { fakeFetch, freshDb } from './helpers';

let pool: pg.Pool;
let config: Awaited<ReturnType<typeof freshDb>>['config'];
beforeAll(async () => { const d = await freshDb('address'); pool = d.pool; config = { ...d.config, GEOCODING_ENABLED: true }; });
afterAll(async () => pool.end());

const deps = (search: (q: string) => unknown) => {
  const f = fakeFetch([[/nominatim|\/search\?/, (u) => search(decodeURIComponent(u))]]);
  const http = new HttpClient('passtra-bot/test', 0, f);
  return { config, http, geocoder: new Geocoder(pool, http, config.NOMINATIM_URL, true) };
};
const venue = { name: 'Rialto Theatre', address: 'Andrea Drousioti 19, Limassol', lat: 34.6764, lng: 33.0436 };

describe('address verification', () => {
  it('verified: the address is where the pin is, and a place with that name is there', async () => {
    const r = await checkAddress(deps((q) => q.includes('viewbox') ? [{ name: 'Rialto Theatre', display_name: 'Rialto Theatre, Limassol' }] : [{ lat: '34.6766', lon: '33.0439', display_name: 'Andrea Drousioti 19, Limassol', type: 'house' }]), venue);
    expect(r).toMatchObject({ status: 'verified', nameMatch: true, provider: 'nominatim' });
    expect(r.distanceM).toBeLessThan(50);
  });
  it('city mismatch: the address resolves to another town', async () => {
    const r = await checkAddress(deps((q) => q.includes('viewbox') ? [] : [{ lat: '35.1700', lon: '33.3600', display_name: 'Nicosia', type: 'house' }]), { ...venue, address: 'Main Street 1, Nicosia' });
    expect(r.status).toBe('city_mismatch');
    expect(r.nameMatch).toBe(false);
  });
  it('not found is reported, never assumed', async () => {
    expect((await checkAddress(deps(() => []), { ...venue, address: 'Nowhere Lane 999' })).status).toBe('not_found');
  });
});
