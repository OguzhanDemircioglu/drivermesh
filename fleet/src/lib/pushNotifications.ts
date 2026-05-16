// ============================================================================
// Push Notifications client helper
// ----------------------------------------------------------------------------
// expo-notifications native modulu kurulu degilse (mevcut dev build paketi
// yenilenmemis) hicbir cagri uygulamayi crashlemez. Module dinamik import +
// try/catch ile sarilmistir; modul yoksa register no-op doner.
// ============================================================================
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { isDemoActive } from '@/demo/store';

let handlerInited = false;
async function initHandler(): Promise<typeof import('expo-notifications') | null> {
  let mod: typeof import('expo-notifications');
  try {
    mod = await import('expo-notifications');
  } catch (e) {
    console.warn('[push] expo-notifications module not available', e);
    return null;
  }
  if (!handlerInited) {
    try {
      mod.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      handlerInited = true;
    } catch (e) {
      console.warn('[push] setNotificationHandler failed', e);
    }
  }
  return mod;
}

/**
 * Cihaz icin FCM token'ini alir, profiles tablosuna kaydeder.
 * Returns:
 *   - token string  → registered
 *   - null          → permission reddedildi / emulator / iOS / demo / native modul yok
 */
export async function registerForPushNotifications(
  userId: string,
): Promise<string | null> {
  if (isDemoActive()) return null;
  if (Platform.OS === 'ios') return null; // APNs key + Firebase iOS sonra

  let Device: typeof import('expo-device');
  try {
    Device = await import('expo-device');
  } catch {
    return null;
  }
  if (!Device.isDevice) return null;

  const Notifications = await initHandler();
  if (!Notifications) return null;

  let granted = false;
  try {
    const existing = await Notifications.getPermissionsAsync();
    granted = existing.status === 'granted';
    if (!granted) {
      const next = await Notifications.requestPermissionsAsync();
      granted = next.status === 'granted';
    }
  } catch (e) {
    console.warn('[push] permissions check failed', e);
    return null;
  }
  if (!granted) return null;

  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Bildirimler',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF7A1A',
    });
  } catch (e) {
    console.warn('[push] setChannel failed', e);
  }

  let token: string;
  try {
    const data = await Notifications.getDevicePushTokenAsync();
    token = data.data;
  } catch (e) {
    console.warn('[push] getDevicePushTokenAsync failed', e);
    return null;
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      push_token: token,
      push_platform: Platform.OS === 'android' ? 'android' : 'ios',
      push_token_updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (error) console.warn('[push] save token failed', error.message);
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

/**
 * Push notification payload deep-link mapping (data.screen → route).
 *
 * Backend push'larında `data.screen` (ve opsiyonel `ride_id`, `job_id` vb.)
 * geçer. Tap'te uygun route'a yönlendirilir.
 *   - 'driver_ride' veya 'ride'    → /(app)/driver-ride
 *   - 'job'      → /(app)/jobs/[id]  (data.job_id varsa)
 *   - 'jobs'     → /(app)/jobs
 *   - 'fleet_map'→ /(app)/fleet-map
 *   - 'notifications' → /(app)/notifications
 *   - default    → /(app) (home)
 */
export function routeForPushPayload(
  data: Record<string, unknown> | undefined | null,
): string {
  const screen = typeof data?.screen === 'string' ? data.screen : 'home';
  const jobId = typeof data?.job_id === 'string' ? data.job_id : null;
  switch (screen) {
    case 'driver_ride':
    case 'ride':
      return '/(app)/driver-ride';
    case 'job':
      return jobId ? `/(app)/jobs/${jobId}` : '/(app)/jobs';
    case 'jobs':
      return '/(app)/jobs';
    case 'fleet_map':
      return '/(app)/fleet-map';
    case 'notifications':
      return '/(app)/notifications';
    case 'home':
    default:
      return '/(app)';
  }
}
