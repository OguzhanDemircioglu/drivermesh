// ============================================================================
// Push Notifications client helper
// ----------------------------------------------------------------------------
// Cihaz token'ini alip profiles.push_token alanina yazar. Demo mode'da
// Supabase'e gitmedigi icin no-op. iOS henuz APNs key + Firebase yapilandirmasi
// olmadigindan iOS tarafinda token alinmiyor — sonradan acilacak.
//
// Server-side: Supabase 'send-push' Edge Function FCM v1 API ile push gonderir.
// notifications insert'i bir trigger ile bu Edge Function'a HTTP POST yapacak.
// ============================================================================
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { isDemoActive } from '@/demo/store';

// Foreground'da gelen bildirimleri kullaniciya goster — varsayilan davranis
// alert + ses; rozet uygulamadigimiz icin sayac yok.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Cihaz icin FCM token'ini alir, profiles tablosuna kaydeder.
 * Returns:
 *   - token string  → registered
 *   - null          → permission reddedildi / emulator / iOS henuz desteklenmiyor / demo
 */
export async function registerForPushNotifications(
  userId: string,
): Promise<string | null> {
  if (isDemoActive()) return null;
  if (!Device.isDevice) return null;
  // iOS henuz APNs key seti hazir degil — Firebase tarafini kuruncaya kadar
  // iOS tokenini almayalim ki kullaniciya bos izin promptu cikarmayalim.
  if (Platform.OS === 'ios') return null;

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.status === 'granted';
  if (!granted) {
    const next = await Notifications.requestPermissionsAsync();
    granted = next.status === 'granted';
  }
  if (!granted) return null;

  // Android: default channel (FCM bildirimi gosterilirken bu kanal kullanilir).
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Bildirimler',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF7A1A',
  });

  let token: string;
  try {
    const data = await Notifications.getDevicePushTokenAsync();
    token = data.data;
  } catch (e) {
    console.warn('[push] getDevicePushTokenAsync failed', e);
    return null;
  }

  // DB'ye kaydet — best-effort. Hata durumunda token'i return ederiz.
  const { error } = await supabase
    .from('profiles')
    .update({
      push_token: token,
      push_platform: Platform.OS === 'android' ? 'android' : 'ios',
      push_token_updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (error) {
    console.warn('[push] save token failed', error.message);
  }
  return token;
}

/** Sign-out'ta token'i temizlemek icin. */
export async function clearPushToken(userId: string): Promise<void> {
  if (isDemoActive()) return;
  await supabase
    .from('profiles')
    .update({
      push_token: null,
      push_platform: null,
      push_token_updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
}
