import type { ApiErrorBody, EntityDTO, EventDTO, FeedResponse, PlaceDTO, PlanDayResponse, RecommendationDTO, SearchResponse } from '@passtra/core';
import { Platform } from 'react-native';
import i18n from '@/i18n';
import { getAccessToken } from './auth';

/** API base: EXPO_PUBLIC_API_URL; Android emulator maps the host's localhost to 10.0.2.2. */
const fromEnv = process.env.EXPO_PUBLIC_API_URL;
export const API_URL = (fromEnv && fromEnv.length ? fromEnv : Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
  get isNetwork() {
    return this.status === 0;
  }
}

async function request<T>(path: string, init: { method?: string; body?: unknown; query?: Record<string, unknown>; timeoutMs?: number; auth?: boolean } = {}): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries({ locale: i18n.language, ...init.query })) {
    if (v === undefined || v === null || v === '') continue;
    qs.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const headers: Record<string, string> = { accept: 'application/json', 'accept-language': i18n.language };
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  const token = await getAccessToken();
  if (token) headers.authorization = `Bearer ${token}`;
  else if (init.auth) throw new ApiError(401, 'auth_required', 'Sign in required');
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}${qs.toString() ? `?${qs}` : ''}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(init.timeoutMs ?? 15_000),
    });
  } catch (e) {
    throw new ApiError(0, 'network', (e as Error).message);
  }
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => null)) as T | ApiErrorBody | null;
  if (!res.ok) {
    const err = (json as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, err?.code ?? 'error', err?.message ?? `HTTP ${res.status}`);
  }
  return json as T;
}

export interface LocationParams {
  lat?: number;
  lng?: number;
  city?: string;
  radius?: number;
}

export interface MetaResponse {
  cities: Array<{ slug: string; name: string; lat: number; lng: number; radiusKm: number; featured: boolean }>;
  interests: Array<{ key: string; label: string }>;
  categories: Array<{ slug: string; kind: string; group: string; icon: string; label: string }>;
  groups: Array<{ key: string; label: string; categories: string[] }>;
  features: { aiSearch: boolean; googleLive: boolean; demoMode: boolean };
  attributions: Array<{ name: string; license: string; url: string }>;
}

export interface MapMarker { id: string; type: 'event' | 'place'; lat: number; lng: number; title: string; category: string; icon: string; subtitle: string | null; openNow?: boolean | null; isFree?: boolean | null }

export const api = {
  meta: () => request<MetaResponse>('/v1/meta'),
  feed: (p: LocationParams & { interests?: string[]; budget?: string | null }) => request<FeedResponse>('/v1/feed/today', { query: { ...p } }),
  events: (p: LocationParams & { category?: string; group?: string; when?: string; free?: boolean; q?: string; limit?: number }) => request<{ items: EventDTO[] }>('/v1/events', { query: { ...p } }),
  places: (p: LocationParams & { category?: string; group?: string; open_now?: boolean; free?: boolean; q?: string; limit?: number }) => request<{ items: PlaceDTO[] }>('/v1/places', { query: { ...p } }),
  event: (id: string, p: LocationParams = {}) => request<{ event: EventDTO; navigation: { google: string; apple: string } | null }>(`/v1/events/${id}`, { query: { ...p } }),
  place: (id: string, p: LocationParams = {}) => request<{ place: PlaceDTO; upcomingEvents: EventDTO[]; navigation: { google: string; apple: string } }>(`/v1/places/${id}`, { query: { ...p } }),
  placeLive: (id: string) => request<{ google: { rating: number | null; ratingCount: number | null; openNow: boolean | null; weekdayText: string[] | null; mapsUrl: string | null; fetchedAt: string } | null; reason?: string }>(`/v1/places/${id}/live`),
  map: (bbox: [number, number, number, number], p: { layers?: string; category?: string; open_now?: boolean; free?: boolean }) => request<{ markers: MapMarker[]; truncated: boolean }>('/v1/map', { query: { bbox: bbox.join(','), ...p } }),
  search: (q: string, p: LocationParams & { interests?: string[] }) => request<SearchResponse>('/v1/search', { method: 'POST', body: { q, ...p, locale: i18n.language }, timeoutMs: 20_000 }),
  recommendations: (p: LocationParams & { interests?: string[] }) => request<{ items: RecommendationDTO[] }>('/v1/recommendations', { query: { ...p } }),
  surprise: (p: LocationParams & { interests?: string[] }) => request<{ items: RecommendationDTO[] }>('/v1/surprise', { method: 'POST', body: { ...p, locale: i18n.language } }),
  planDay: (b: LocationParams & { start: string; end: string; date?: string; budget?: number | null; interests?: string[]; mode?: 'walk' | 'drive' | 'auto' }) => request<PlanDayResponse>('/v1/plan-day', { method: 'POST', body: { ...b, locale: i18n.language }, timeoutMs: 25_000 }),
  report: (b: { entityType: 'event' | 'place'; entityId: string; kind: string; message?: string }) => request<{ id: string }>('/v1/reports', { method: 'POST', body: b }),
  status: () => request<{ integrations: Record<string, boolean>; sources: Array<{ key: string; name: string; lastSuccessAt: string | null }> }>('/v1/status'),
  // Signed-in
  me: () => request<Record<string, unknown>>('/v1/me', { auth: true }),
  updateMe: (b: Record<string, unknown>) => request<Record<string, unknown>>('/v1/me', { method: 'PATCH', body: b, auth: true }),
  deleteMe: () => request<void>('/v1/me', { method: 'DELETE', auth: true }),
  exportMe: () => request<unknown>('/v1/me/export', { auth: true }),
  saved: () => request<{ items: Array<{ entity: EntityDTO; savedAt: string }> }>('/v1/me/saved', { auth: true }),
  save: (type: 'event' | 'place', id: string) => request<unknown>(`/v1/me/saved/${type}/${id}`, { method: 'PUT', body: {}, auth: true }),
  unsave: (type: 'event' | 'place', id: string) => request<unknown>(`/v1/me/saved/${type}/${id}`, { method: 'DELETE', auth: true }),
  interactions: (items: Array<{ entityType: 'event' | 'place'; entityId: string; kind: string }>) => request<unknown>('/v1/me/interactions', { method: 'POST', body: { items }, auth: true }),
  registerPush: (token: string, platform: 'ios' | 'android') => request<unknown>('/v1/me/push-tokens', { method: 'POST', body: { token, platform }, auth: true }),
  submitEvent: (b: Record<string, unknown>) => request<{ id: string }>('/v1/submissions/events', { method: 'POST', body: b, auth: true }),
};
