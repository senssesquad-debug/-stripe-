import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, type Href } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { api, ApiError, type AuthResponse, type Profile } from './api';
import { store } from './store';
import { loadToken, setSessionExpiredHandler, storeToken } from './token';

/**
 * passtra accounts (own API: email + password, revocable sessions).
 * Browsing never requires an account. Actions that do (My events, notifications, submissions) go through
 * requireAuth(): the user is told why, signs in, and the interrupted action then continues.
 * The profile is cached on the device so it survives restarts and short offline periods.
 */
export type Session = { token: string; user: Profile };
interface AuthState { ready: boolean; session: Session | null }

const PROFILE_KEY = 'passtra.profile.v1';
let state: AuthState = { ready: false, session: null };
const listeners = new Set<() => void>();
const set = (s: AuthState) => { state = s; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

async function persistProfile(user: Profile | null) {
  if (user) await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(user)).catch(() => undefined);
  else await AsyncStorage.removeItem(PROFILE_KEY).catch(() => undefined);
}

async function clearLocal() {
  await storeToken(null);
  await persistProfile(null);
  set({ ready: true, session: null });
}

setSessionExpiredHandler(() => { if (state.session) void clearLocal(); });

/** Restore the session on app start: cached profile first (instant, offline), then refreshed from the server. */
export async function initAuth(): Promise<void> {
  const token = await loadToken();
  if (!token) return set({ ready: true, session: null });
  const cached = await AsyncStorage.getItem(PROFILE_KEY).catch(() => null);
  if (cached) set({ ready: true, session: { token, user: JSON.parse(cached) as Profile } });
  try {
    const user = await api.me();
    await persistProfile(user);
    set({ ready: true, session: { token, user } });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) await clearLocal();
    else if (!cached) set({ ready: true, session: null }); // offline and nothing cached: treat as signed out for now
  }
}

/** Dev/test servers without an email service return the code in the response; shown only in that case. */
export const devCodes = new Map<string, string>();

export async function applyAuth(r: AuthResponse): Promise<void> {
  if (r.emailVerification?.devCode && r.user.email) devCodes.set(r.user.email, r.emailVerification.devCode);
  await storeToken(r.token);
  await persistProfile(r.user);
  set({ ready: true, session: { token: r.token, user: r.user } });
  await syncLocalData();
}

export async function setProfile(user: Profile): Promise<void> {
  if (!state.session) return;
  await persistProfile(user);
  set({ ready: true, session: { ...state.session, user } });
}

export async function refreshProfile(): Promise<Profile | null> {
  if (!state.session) return null;
  const user = await api.me();
  await setProfile(user);
  return user;
}

export async function signOut(): Promise<void> {
  await api.logout().catch(() => undefined); // revoke on the server; sign out locally regardless
  await clearLocal();
}

/** Upload what the user did while signed out: preferences and device-local saves. */
async function syncLocalData() {
  const s = store.get();
  await api.updateMe({ locale: s.locale ?? undefined, interests: s.interests, budget: s.budget, ageRange: s.ageRange }).catch(() => undefined);
  await Promise.all(Object.values(s.saved).map((x) => api.save(x.type, x.entity.id).catch(() => undefined)));
}

export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, () => state.session, () => null);
}
export function useAuthReady(): boolean {
  return useSyncExternalStore(subscribe, () => state.ready, () => false);
}
export const isSignedIn = () => !!state.session;

// ── "Sign in to continue" ─────────────────────────────────────────────────

export type AuthReason = 'myEvents' | 'notifications' | 'submit' | 'account' | 'sync';
let pending: (() => void) | null = null;

/** Run the action now if signed in; otherwise explain, open sign-in, and run it right after a successful sign-in. */
export function requireAuth(reason: AuthReason, action: () => void): void {
  if (state.session) return action();
  pending = action;
  router.push({ pathname: '/signin', params: { reason } });
}

/** Called by the sign-in screen once the user is signed in. */
export function finishSignIn(): void {
  const next = pending;
  pending = null;
  if (router.canGoBack()) router.back();
  else router.replace('/' as Href);
  if (next) setTimeout(next, 60);
}

export function cancelSignIn(): void {
  pending = null;
}
