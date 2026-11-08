import { Alert, Platform } from 'react-native';
import { useSyncExternalStore } from 'react';

/** Small cross-platform feedback helpers. (React Native Web's Alert is a no-op, so the web uses a toast and window.confirm.) */
let toast: { id: number; text: string; tone: 'info' | 'error' } | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

export function showToast(text: string, tone: 'info' | 'error' = 'info') {
  toast = { id: Date.now(), text, tone };
  listeners.forEach((l) => l());
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { toast = null; listeners.forEach((l) => l()); }, tone === 'error' ? 5000 : 3000);
}

export function useToast() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => toast, () => null);
}

export function confirmAsync(title: string, message: string, confirmLabel: string, cancelLabel: string, destructive = false): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? false);
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
