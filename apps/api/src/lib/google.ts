import { haversineKm, nameSimilarity } from '@passtra/core';
import type pg from 'pg';

/**
 * Google Places API (New) — live enrichment only.
 * Terms (see docs/01-research.md): only place IDs may be stored; other content (rating, hours, etc.)
 * is fetched on demand, shown with Google attribution and not persisted. For EEA projects created after
 * 8 Jul 2025, Places content must not be displayed together with a map — the app shows it on a
 * map-free detail section and links out to Google Maps.
 */
export interface GoogleLive {
  placeId: string;
  rating: number | null;
  ratingCount: number | null;
  openNow: boolean | null;
  weekdayText: string[] | null;
  businessStatus: string | null;
  mapsUrl: string | null;
  attribution: 'Google';
  fetchedAt: string;
}

const BASE = 'https://places.googleapis.com/v1';

async function g<T>(apiKey: string, path: string, init: { method?: string; body?: unknown; fieldMask: string; languageCode?: string }): Promise<T> {
  const res = await fetch(`${BASE}${path}${init.languageCode ? `${path.includes('?') ? '&' : '?'}languageCode=${init.languageCode}` : ''}`, {
    method: init.method ?? 'GET',
    headers: { 'x-goog-api-key': apiKey, ...(init.fieldMask ? { 'x-goog-fieldmask': init.fieldMask } : {}), 'content-type': 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Google Places HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Find (and store) the Google place ID for one of our places. Only the ID is stored — allowed by the terms. */
export async function resolveGooglePlaceId(db: pg.Pool, apiKey: string, place: { id: string; name: string; lat: number; lng: number; externalIds: Record<string, string> }): Promise<string | null> {
  if (place.externalIds.google) return place.externalIds.google;
  const r = await g<{ places?: Array<{ id: string; displayName?: { text: string }; location?: { latitude: number; longitude: number } }> }>(apiKey, '/places:searchText', {
    method: 'POST',
    fieldMask: 'places.id,places.displayName,places.location',
    body: { textQuery: place.name, maxResultCount: 3, locationBias: { circle: { center: { latitude: place.lat, longitude: place.lng }, radius: 150 } } },
  });
  const hit = (r.places ?? []).find((p) => p.location && haversineKm({ lat: p.location.latitude, lng: p.location.longitude }, place) <= 0.15 && nameSimilarity(p.displayName?.text ?? '', place.name) >= 0.7);
  if (!hit) return null;
  await db.query(`UPDATE places SET external_ids = external_ids || jsonb_build_object('google', $2::text) WHERE id = $1`, [place.id, hit.id]);
  return hit.id;
}

export async function googleLive(apiKey: string, placeId: string, languageCode: string): Promise<GoogleLive> {
  const p = await g<{ id: string; rating?: number; userRatingCount?: number; currentOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] }; businessStatus?: string; googleMapsUri?: string }>(
    apiKey, `/places/${encodeURIComponent(placeId)}`,
    { fieldMask: 'id,rating,userRatingCount,currentOpeningHours.openNow,currentOpeningHours.weekdayDescriptions,businessStatus,googleMapsUri', languageCode },
  );
  return {
    placeId: p.id,
    rating: p.rating ?? null,
    ratingCount: p.userRatingCount ?? null,
    openNow: p.currentOpeningHours?.openNow ?? null,
    weekdayText: p.currentOpeningHours?.weekdayDescriptions ?? null,
    businessStatus: p.businessStatus ?? null,
    mapsUrl: p.googleMapsUri ?? null,
    attribution: 'Google',
    fetchedAt: new Date().toISOString(),
  };
}

export interface GooglePhoto { url: string; width: number; height: number; authors: Array<{ name: string; uri: string | null }> }

/**
 * Place photos via the official Places API (New): the photo list from Place Details, then a short-lived
 * photoUri per photo from the Place Photos endpoint (skipHttpRedirect=true), so the API key never reaches the app.
 * Nothing is stored (terms: photos and photo names must not be cached); author attributions must be shown.
 */
export async function googlePhotos(apiKey: string, placeId: string, max = 6, maxWidthPx = 1200): Promise<GooglePhoto[]> {
  const p = await g<{ photos?: Array<{ name: string; widthPx: number; heightPx: number; authorAttributions?: Array<{ displayName?: string; uri?: string }> }> }>(
    apiKey, `/places/${encodeURIComponent(placeId)}`, { fieldMask: 'photos' });
  const list = (p.photos ?? []).slice(0, max);
  const out = await Promise.all(list.map(async (ph) => {
    try {
      const m = await g<{ photoUri?: string }>(apiKey, `/${ph.name}/media?maxWidthPx=${maxWidthPx}&skipHttpRedirect=true`, { fieldMask: '' });
      if (!m.photoUri) return null;
      const scale = Math.min(1, maxWidthPx / ph.widthPx);
      return {
        url: m.photoUri, width: Math.round(ph.widthPx * scale), height: Math.round(ph.heightPx * scale),
        authors: (ph.authorAttributions ?? []).map((a) => ({ name: a.displayName ?? 'Google user', uri: a.uri ?? null })),
      };
    } catch {
      return null;
    }
  }));
  return out.filter((x): x is GooglePhoto => !!x);
}
