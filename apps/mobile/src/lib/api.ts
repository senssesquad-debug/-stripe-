import type { ApiErrorBody, EntityDTO, EventDTO, FeedResponse, PlaceDTO, PlanDayResponse, RecommendationDTO, SearchResponse } from '@passtra/core';
import { Platform } from 'react-native';
import i18n from '@/i18n';
import { loadToken, sessionExpired } from './token';

/**
 * API base: EXPO_PUBLIC_API_URL. "same-origin" (web only) calls the API on the page's own host,
 * e.g. behind scripts/preview-server.mjs. Android emulator maps the host's localhost to 10.0.2.2.
 */
const fromEnv = process.env.EXPO_PUBLIC_API_URL;
export const API_URL = fromEnv === 'same-origin'
  ? ''
  : (fromEnv && fromEnv.length ? fromEnv : Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080').replace(/\/$/, '');

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
  const token = await loadToken();
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
    // The session was revoked or expired: sign out locally so the UI doesn't pretend otherwise.
    if (res.status === 401 && token) sessionExpired();
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

export interface Profile {
  id: string; role: string; name: string | null;
  email: string | null; emailVerified: boolean; pendingEmail: string | null;
  phone: string | null; phoneVerified: boolean; pendingPhone: string | null;
  hasPassword: boolean; locale: string | null; interests: string[] | null; ageRange: string | null; budget: string | null;
  homeCity: string | null; personalizationEnabled: boolean; notificationPrefs: Record<string, unknown> | null; createdAt: string;
}

export interface AuthResponse { token: string; user: Profile; emailVerification?: { sent: boolean; devCode?: string; reason?: string } }
export interface CodeSent { sent: true; devCode?: string }

export interface MyEvent {
  id: string; title: string; description: string | null; timezone: string;
  startsAt: string; endsAt: string; date: string; startTime: string; endDate: string; endTime: string; label: string; past: boolean;
  location: { name: string | null; address: string | null; lat: number | null; lng: number | null } | null;
  entity: { type: 'event' | 'place'; id: string } | null;
  reminder: { minutes: number; at: string | null; status: 'scheduled' | 'sent' | 'failed' | 'no_channel' | 'skipped_stale' } | null;
}

export interface MyEventInput {
  title: string; description?: string | null; date: string; startTime: string; endDate?: string | null; endTime: string; timezone: string;
  location?: { name?: string | null; address?: string | null; lat?: number | null; lng?: number | null } | null;
  entityType?: 'event' | 'place' | null; entityId?: string | null; reminderMinutes?: number | null;
}

export interface RouteResult { mode: 'walk' | 'drive'; estimate: boolean; distanceKm: number; durationMin: number; geometry: Array<[number, number]>; attribution: string | null }
export interface GeocodeItem { label: string; sublabel: string | null; lat: number; lng: number; source: string }
export interface DeliveryResult { webPush: { sent: number; failed: number }; expo: { sent: number; failed: number } }

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
  route: (from: { lat: number; lng: number }, to: { lat: number; lng: number }, mode: 'walk' | 'drive') => request<RouteResult>('/v1/route', { query: { from: `${from.lat},${from.lng}`, to: `${to.lat},${to.lng}`, mode }, timeoutMs: 20_000 }),
  geocode: (q: string) => request<{ items: GeocodeItem[] }>('/v1/geocode', { query: { q } }),
  // Accounts
  register: (b: { email: string; password: string; name?: string; locale?: string }) => request<AuthResponse>('/v1/auth/register', { method: 'POST', body: b }),
  login: (b: { email: string; password: string }) => request<AuthResponse>('/v1/auth/login', { method: 'POST', body: b }),
  logout: () => request<void>('/v1/auth/logout', { method: 'POST', body: {}, auth: true }),
  resetStart: (email: string) => request<CodeSent>('/v1/auth/password-reset/start', { method: 'POST', body: { email } }),
  resetConfirm: (b: { email: string; code: string; password: string }) => request<AuthResponse>('/v1/auth/password-reset/confirm', { method: 'POST', body: b }),
  contactStart: (b: { channel: 'email'; email: string } | { channel: 'phone'; phone: string }) => request<CodeSent>('/v1/me/contact/start', { method: 'POST', body: b, auth: true }),
  contactConfirm: (channel: 'email' | 'phone', code: string) => request<Profile>('/v1/me/contact/confirm', { method: 'POST', body: { channel, code }, auth: true }),
  removePhone: () => request<Profile>('/v1/me/contact/phone', { method: 'DELETE', auth: true }),
  changePassword: (b: { current: string; password: string }) => request<{ ok: true }>('/v1/me/password', { method: 'POST', body: b, auth: true }),
  // Signed-in
  me: () => request<Profile>('/v1/me', { auth: true }),
  updateMe: (b: Record<string, unknown>) => request<Profile>('/v1/me', { method: 'PATCH', body: b, auth: true }),
  myEvents: (scope: 'upcoming' | 'past' | 'all') => request<{ items: MyEvent[]; reminderOptions: number[] }>('/v1/me/events', { query: { scope }, auth: true }),
  myEvent: (id: string) => request<{ event: MyEvent }>(`/v1/me/events/${id}`, { auth: true }),
  createMyEvent: (b: MyEventInput) => request<{ event: MyEvent; timeAdjusted: boolean }>('/v1/me/events', { method: 'POST', body: b, auth: true }),
  updateMyEvent: (id: string, b: MyEventInput) => request<{ event: MyEvent; timeAdjusted: boolean }>(`/v1/me/events/${id}`, { method: 'PUT', body: b, auth: true }),
  deleteMyEvent: (id: string) => request<void>(`/v1/me/events/${id}`, { method: 'DELETE', auth: true }),
  vapidKey: () => request<{ publicKey: string }>('/v1/push/vapid-public-key'),
  notificationStatus: () => request<{ channels: { webPush: number; nativePush: number }; prefs: Record<string, unknown> | null }>('/v1/me/notifications', { auth: true }),
  addWebPush: (sub: PushSubscriptionJSON) => request<{ subscribed: true }>('/v1/me/web-push', { method: 'POST', body: sub, auth: true }),
  removeWebPush: (endpoint: string) => request<void>('/v1/me/web-push', { method: 'DELETE', body: { endpoint }, auth: true }),
  testNotification: () => request<{ result: DeliveryResult }>('/v1/me/notifications/test', { method: 'POST', body: {}, auth: true }),
  deleteMe: () => request<void>('/v1/me', { method: 'DELETE', auth: true }),
  exportMe: () => request<unknown>('/v1/me/export', { auth: true }),
  saved: () => request<{ items: Array<{ entity: EntityDTO; savedAt: string }> }>('/v1/me/saved', { auth: true }),
  save: (type: 'event' | 'place', id: string) => request<unknown>(`/v1/me/saved/${type}/${id}`, { method: 'PUT', body: {}, auth: true }),
  unsave: (type: 'event' | 'place', id: string) => request<unknown>(`/v1/me/saved/${type}/${id}`, { method: 'DELETE', auth: true }),
  interactions: (items: Array<{ entityType: 'event' | 'place'; entityId: string; kind: string }>) => request<unknown>('/v1/me/interactions', { method: 'POST', body: { items }, auth: true }),
  registerPush: (token: string, platform: 'ios' | 'android') => request<unknown>('/v1/me/push-tokens', { method: 'POST', body: { token, platform }, auth: true }),
  unregisterPush: (token: string) => request<void>('/v1/me/push-tokens', { method: 'DELETE', body: { token }, auth: true }),
  submitEvent: (b: Record<string, unknown>) => request<{ id: string }>('/v1/submissions/events', { method: 'POST', body: b, auth: true }),
};
