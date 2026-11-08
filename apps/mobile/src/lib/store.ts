import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EntityDTO, InterestGroup, Locale } from '@passtra/core';
import { useSyncExternalStore } from 'react';

/** Small persisted app store (no external state library). Stores only preferences and local saves. */
export interface AppState {
  hydrated: boolean;
  onboarded: boolean;
  locale: Locale | null; // null = follow device
  interests: InterestGroup[];
  city: string; // fallback / Explore city
  radiusKm: number;
  useLocation: boolean;
  theme: 'system' | 'light' | 'dark';
  budget: 'free' | 'low' | 'medium' | 'high' | null;
  ageRange: 'under_18' | '18_24' | '25_34' | '35_44' | '45_54' | '55_plus' | null;
  /** Saved items for signed-out users (synced on sign-in). Snapshot of the card for offline display. */
  saved: Record<string, { type: 'event' | 'place'; savedAt: string; entity: EntityDTO }>;
  lastFeedAt: string | null;
}

const KEY = 'passtra.state.v1';
const initial: AppState = {
  hydrated: false, onboarded: false, locale: null, interests: [], city: 'limassol', radiusKm: 10, useLocation: true,
  theme: 'system', budget: null, ageRange: null, saved: {}, lastFeedAt: null,
};

let state = initial;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const store = {
  get: () => state,
  set(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
    emit();
    const { hydrated: _h, ...persist } = state;
    AsyncStorage.setItem(KEY, JSON.stringify(persist)).catch(() => undefined);
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  async hydrate() {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      state = { ...initial, ...(raw ? (JSON.parse(raw) as Partial<AppState>) : {}), hydrated: true };
    } catch {
      state = { ...initial, hydrated: true };
    }
    emit();
  },
};

export function useAppState<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(store.get()), () => select(initial));
}

export function toggleSaved(entity: EntityDTO) {
  store.set((s) => {
    const saved = { ...s.saved };
    if (saved[entity.id]) delete saved[entity.id];
    else saved[entity.id] = { type: entity.type, savedAt: new Date().toISOString(), entity };
    return { saved };
  });
}
