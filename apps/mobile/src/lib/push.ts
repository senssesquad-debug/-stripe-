import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

/** Ask for permission (only after the user opts in) and register the Expo push token with the API. */
export async function enablePush(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (Platform.OS === 'web') return 'unsupported';
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return 'denied';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'passtra', importance: Notifications.AndroidImportance.DEFAULT });
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return 'unsupported';
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await api.registerPush(token, Platform.OS === 'ios' ? 'ios' : 'android');
  return 'granted';
}
