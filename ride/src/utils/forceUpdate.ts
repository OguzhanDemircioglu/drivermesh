import Constants from 'expo-constants';
import { Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

const CACHE_KEY = '@ride:force-update:last-check';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 saat

export type ForceUpdateState = {
  required: boolean;
  storeUrl?: string;
  messageTr?: string;
  messageEn?: string;
  latestVersion?: string;
};

export function semverLt(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x < y) return true;
    if (x > y) return false;
  }
  return false;
}

export async function checkForceUpdate(): Promise<ForceUpdateState> {
  // Dev/preview build'lerde force update kontrolü atla — sadece production'da.
  const appEnv = (Constants.expoConfig?.extra?.appEnv as string | undefined) ?? 'development';
  if (appEnv !== 'production') return { required: false };

  // 1 saat cache — cold start'ı yormamak için
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as { at: number; state: ForceUpdateState };
      if (Date.now() - parsed.at < CACHE_TTL_MS) return parsed.state;
    }
  } catch {
    /* ignore */
  }

  const platform: 'android' | 'ios' = Platform.OS === 'ios' ? 'ios' : 'android';
  const currentVersion =
    (Constants.expoConfig?.version as string | undefined) ?? '0.0.0';

  try {
    // (platform, app) composite key — fleet ve ride aynı row'u paylaşmıyor.
    // Migration: 2026-05-16 app_versions_split_fleet_ride.
    const { data, error } = await supabase
      .from('app_versions')
      .select('latest_version, min_supported_version, store_url, force_update_message_tr, force_update_message_en')
      .eq('platform', platform)
      .eq('app', 'ride')
      .maybeSingle();

    if (error || !data) {
      return { required: false };
    }

    const required = semverLt(currentVersion, data.min_supported_version);
    const state: ForceUpdateState = {
      required,
      storeUrl: data.store_url ?? undefined,
      messageTr: data.force_update_message_tr ?? undefined,
      messageEn: data.force_update_message_en ?? undefined,
      latestVersion: data.latest_version ?? undefined,
    };

    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ at: Date.now(), state }),
    ).catch(() => {});

    return state;
  } catch {
    return { required: false };
  }
}

export function openStore(url?: string) {
  if (!url) return;
  Linking.openURL(url).catch(() => {});
}
