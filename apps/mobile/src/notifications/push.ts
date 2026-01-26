import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type PushPermissionStatus = 'granted' | 'denied' | 'undetermined';

export function getPushPlatform(): 'ios' | 'android' | null {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return null;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function getPushPermissionStatus(): Promise<PushPermissionStatus> {
  const perm = await Notifications.getPermissionsAsync();
  return perm.status;
}

export async function requestPushPermissions(): Promise<PushPermissionStatus> {
  const perm = await Notifications.requestPermissionsAsync();
  return perm.status;
}

export async function getExpoPushToken(): Promise<string> {
  if (!Device.isDevice) {
    throw new Error('Push notifications require a physical device.');
  }

  await ensureAndroidChannel();
  const res = await Notifications.getExpoPushTokenAsync();
  return res.data;
}

