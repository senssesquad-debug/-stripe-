import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

/**
 * Device notification state.
 *  granted/denied/default — the OS/browser permission
 *  unsupported — this browser/device cannot receive push
 *  ios_needs_install — iPhone/iPad Safari: push works only for the site added to the Home Screen (iOS 16.4+)
 *  insecure — web page not served over HTTPS
 *  not_configured — the build has no push project (EAS projectId) / server has no push keys
 */
export type PushPermission = 'granted' | 'denied' | 'default' | 'unsupported' | 'ios_needs_install' | 'insecure' | 'not_configured';
export interface PushStatus { permission: PushPermission; subscribed: boolean }

const projectId = () => Constants.expoConfig?.extra?.eas?.projectId as string | undefined;

export async function getPushStatus(): Promise<PushStatus> {
  if (!projectId()) return { permission: 'not_configured', subscribed: false };
  const p = await Notifications.getPermissionsAsync();
  const permission: PushPermission = p.granted ? 'granted' : p.canAskAgain ? 'default' : 'denied';
  return { permission, subscribed: p.granted };
}

/** Ask for permission (only from an explicit user action) and register this device's push token with the API. */
export async function enablePush(): Promise<PushStatus> {
  const id = projectId();
  if (!id) return { permission: 'not_configured', subscribed: false };
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return { permission: perm.canAskAgain ? 'default' : 'denied', subscribed: false };
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'passtra', importance: Notifications.AndroidImportance.DEFAULT });
  }
  const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
  await api.registerPush(token, Platform.OS === 'ios' ? 'ios' : 'android');
  return { permission: 'granted', subscribed: true };
}

export async function disablePush(): Promise<void> {
  const id = projectId();
  if (!id) return;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId: id }).catch(() => null))?.data;
  if (token) await api.unregisterPush(token).catch(() => undefined);
}

/** Open the app's system notification settings (where a "blocked" permission is changed). */
export const canOpenSettings = true;

export async function resyncPush(): Promise<void> {
  const s = await getPushStatus();
  if (s.permission === 'granted') await enablePush().catch(() => undefined);
}
