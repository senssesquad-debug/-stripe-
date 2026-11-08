import AsyncStorage from '@react-native-async-storage/async-storage';

/** Last searches, kept only on this device. */
const KEY = 'passtra.recentSearches.v1';
const MAX = 10;

export async function loadRecent(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function addRecent(q: string): Promise<string[]> {
  const list = [q, ...(await loadRecent()).filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, MAX);
  await AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => undefined);
  return list;
}

export async function clearRecent(): Promise<void> {
  await AsyncStorage.removeItem(KEY).catch(() => undefined);
}
