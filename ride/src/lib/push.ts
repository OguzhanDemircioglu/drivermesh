import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

export type PushPermission = 'granted' | 'denied' | 'undetermined';

// Notification handler — app foreground'dayken alert göster.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

export async function getPushPermission(): Promise<PushPermission> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

export async function requestPushPermission(): Promise<PushPermission> {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

export async function getDeviceToken(): Promise<{ token: string; platform: 'fcm' | 'apns' } | null> {
  if (!Device.isDevice) return null; // simülatör/web'de yok
  try {
    const tokenData = await Notifications.getDevicePushTokenAsync();
    const platform: 'fcm' | 'apns' = Platform.OS === 'ios' ? 'apns' : 'fcm';
    return { token: tokenData.data as string, platform };
  } catch {
    return null;
  }
}

export async function registerPushTokenForCustomer(customerId: string): Promise<void> {
  const perm = await getPushPermission();
  if (perm !== 'granted') return;
  const t = await getDeviceToken();
  if (!t) return;
  await supabase
    .from('customers')
    .update({
      push_token: t.token,
      push_platform: t.platform,
      push_token_updated_at: new Date().toISOString(),
    })
    .eq('id', customerId);
}

if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF7A1A',
  }).catch(() => {});
}
