import { api } from './api';
import type { PushPermission, PushStatus } from './push';

export type { PushPermission, PushStatus } from './push';

/**
 * Web Push: a service worker (/sw.js) receives pushes from the passtra server (VAPID) and shows them even when
 * no passtra tab is open — as long as the browser itself is running. iOS/iPadOS: only for the site installed
 * to the Home Screen (16.4+). Nothing here simulates a notification: the test button goes through the server.
 */
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

function baseState(): PushPermission | null {
  if (typeof window === 'undefined') return 'unsupported';
  if (!window.isSecureContext) return 'insecure';
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (isIOS() && !isStandalone()) return 'ios_needs_install';
  if (!supported) return 'unsupported';
  return null;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/');
  const reg = existing ?? (await navigator.serviceWorker.register('/sw.js', { scope: '/' }));
  await navigator.serviceWorker.ready;
  return reg;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function getPushStatus(): Promise<PushStatus> {
  const b = baseState();
  if (b) return { permission: b, subscribed: false };
  const permission = Notification.permission as 'granted' | 'denied' | 'default';
  if (permission !== 'granted') return { permission, subscribed: false };
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  return { permission, subscribed: !!sub };
}

/** Must be called from a click: browsers only show the permission prompt in response to a user gesture. */
export async function enablePush(): Promise<PushStatus> {
  const b = baseState();
  if (b) return { permission: b, subscribed: false };
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { permission, subscribed: false };
  const reg = await registration();
  const { publicKey } = await api.vapidKey();
  let sub = await reg.pushManager.getSubscription();
  // A subscription made with another server key can't receive our pushes: replace it.
  const current = sub?.options.applicationServerKey;
  if (sub && current && btoa(String.fromCharCode(...new Uint8Array(current))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') !== publicKey) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
  await api.addWebPush(sub.toJSON());
  return { permission: 'granted', subscribed: true };
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker?.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api.removeWebPush(sub.endpoint).catch(() => undefined);
  await sub.unsubscribe();
}

export const canOpenSettings = false;

/** Keep the server's copy of this browser's subscription current (endpoints can rotate). */
export async function resyncPush(): Promise<void> {
  if (baseState() || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await api.addWebPush(sub.toJSON()).catch(() => undefined);
}
