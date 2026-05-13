/**
 * App version check + force/soft update flow.
 *
 * Cold start ve foreground transition'da Supabase `app_versions`
 * tablosundan platform versiyon bilgisini ceker, current versiyonla
 * karsilastirir:
 *
 *   current < min_supported   -> hard modal (kapatilamaz, sadece store)
 *   current < latest          -> soft banner (24 saatte 1 dismiss)
 *   current >= latest         -> ok, sessiz
 *
 * Demo modda hicbir is yapmaz (versiyon kontrolu prod-only).
 *
 * Apple/Google policy: hard update sadece kritik durumlar (security,
 * breaking change). Her release'de hard update = store reddi.
 */
import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { isDemoActive } from '@/demo/store';
import { captureException } from '@/lib/sentry';

const SOFT_DISMISS_KEY = 'drivermesh.force_update.soft_dismiss_at';
const SOFT_DISMISS_HOURS = 24;

export type VersionCheckResult =
  | { status: 'ok' }
  | { status: 'soft'; latest: string; storeUrl: string; messageTr: string; messageEn: string }
  | { status: 'force'; latest: string; storeUrl: string; messageTr: string; messageEn: string };

const APP_VERSION = (Constants.expoConfig?.version as string | undefined) ?? '1.0.0';

// Basit semver compare: "1.2.3" parts. Pre-release / build metadata
// kullanmiyoruz, full semver gerek yok.
function semverLT(a: string, b: string): boolean {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const ai = pa[i] ?? 0;
    const bi = pb[i] ?? 0;
    if (ai < bi) return true;
    if (ai > bi) return false;
  }
  return false;
}

export async function checkAppVersion(): Promise<VersionCheckResult | null> {
  if (isDemoActive()) return { status: 'ok' };

  const platform = Platform.OS as 'android' | 'ios';
  if (platform !== 'android' && platform !== 'ios') return null;

  try {
    const { data, error } = await supabase
      .from('app_versions')
      .select('*')
      .eq('platform', platform)
      .maybeSingle();

    if (error || !data) {
      // Network sorunu / row yok — sessiz fallback
      return null;
    }

    const minSupported = data.min_supported_version as string;
    const latest = data.latest_version as string;

    // Force check (kritik): current < min_supported
    if (semverLT(APP_VERSION, minSupported)) {
      return {
        status: 'force',
        latest,
        storeUrl: data.store_url as string,
        messageTr: data.force_update_message_tr as string,
        messageEn: data.force_update_message_en as string,
      };
    }

    // Soft check: current < latest, ama 24 saatte bir dismiss respect
    if (semverLT(APP_VERSION, latest)) {
      const dismissAt = await AsyncStorage.getItem(SOFT_DISMISS_KEY);
      if (dismissAt) {
        const dismissedHoursAgo =
          (Date.now() - parseInt(dismissAt, 10)) / (1000 * 60 * 60);
        if (dismissedHoursAgo < SOFT_DISMISS_HOURS) return { status: 'ok' };
      }
      return {
        status: 'soft',
        latest,
        storeUrl: data.store_url as string,
        messageTr: (data.release_notes_tr as string) ?? 'Yeni sürüm var',
        messageEn: (data.release_notes_en as string) ?? 'New version available',
      };
    }

    return { status: 'ok' };
  } catch (e) {
    captureException(e, { context: 'force_update_check' });
    return null;
  }
}

export async function dismissSoftUpdate(): Promise<void> {
  try {
    await AsyncStorage.setItem(SOFT_DISMISS_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export async function openStoreUrl(storeUrl: string): Promise<void> {
  try {
    // Android: market:// scheme tercih edilir, native Play Store acar.
    // iOS: https itunes.apple.com fallback (zaten store_url itunes URL).
    if (Platform.OS === 'android') {
      const marketUrl = storeUrl.replace(
        /^https?:\/\/play\.google\.com\/store\/apps\/details\?id=/,
        'market://details?id=',
      );
      const can = await Linking.canOpenURL(marketUrl);
      await Linking.openURL(can ? marketUrl : storeUrl);
    } else {
      await Linking.openURL(storeUrl);
    }
  } catch (e) {
    captureException(e, { context: 'force_update_open_store' });
  }
}

export { APP_VERSION };
