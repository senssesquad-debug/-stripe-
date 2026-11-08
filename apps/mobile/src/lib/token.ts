import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Session token storage: Keychain/Keystore on iOS/Android (expo-secure-store), localStorage on the web.
 * Kept in memory after load so every API call doesn't touch storage.
 */
const KEY = 'passtra.session';
let token: string | null = null;
let loaded = false;

const web = {
  get: () => { try { return globalThis.localStorage?.getItem(KEY) ?? null; } catch { return null; } },
  set: (v: string | null) => { try { if (v) globalThis.localStorage?.setItem(KEY, v); else globalThis.localStorage?.removeItem(KEY); } catch { /* private mode */ } },
};

export async function loadToken(): Promise<string | null> {
  if (!loaded) {
    token = Platform.OS === 'web' ? web.get() : await SecureStore.getItemAsync(KEY).catch(() => null);
    loaded = true;
  }
  return token;
}

export function currentToken(): string | null {
  return token;
}

export async function storeToken(v: string | null): Promise<void> {
  token = v;
  loaded = true;
  if (Platform.OS === 'web') web.set(v);
  else if (v) await SecureStore.setItemAsync(KEY, v);
  else await SecureStore.deleteItemAsync(KEY).catch(() => undefined);
}

/** Called by the API client when the server says the session is no longer valid. */
let onExpired: (() => void) | null = null;
export const setSessionExpiredHandler = (fn: () => void) => { onExpired = fn; };
export const sessionExpired = () => onExpired?.();
