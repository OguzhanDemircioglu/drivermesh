import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { isDevBypassEnabled } from '@/lib/devBypass';

export type GeoPermission = 'granted' | 'denied' | 'undetermined';

export type GeoState = {
  permission: GeoPermission;
  loading: boolean;
  position: { lat: number; lng: number } | null;
  city: string | null;
  /** İnsan-okunur tam adres (reverse-geocode), yoksa null */
  address: string | null;
  error?: string;
};

/**
 * GPS izni ister, mevcut konumu döner ve reverse-geocode ile şehir adını çıkarır.
 * Konum izni reddedilirse permission='denied' döndürür — UI buna göre banner gösterir.
 */
export function useGeolocation(autoRequest = true): GeoState & {
  requestPermission: () => Promise<void>;
  refresh: () => Promise<void>;
} {
  const [state, setState] = useState<GeoState>({
    permission: 'undetermined',
    loading: false,
    position: null,
    city: null,
    address: null,
  });

  const fetchAndReverseGeocode = useCallback(async () => {
    try {
      setState((s) => ({ ...s, loading: true }));
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      let city: string | null = null;
      let address: string | null = null;
      try {
        const reverse = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        const r = reverse[0];
        city = r?.city ?? r?.region ?? null;
        address = r
          ? [r.name, r.street, r.district, r.city ?? r.region]
              .filter(Boolean)
              .join(', ')
          : null;
      } catch {
        /* reverse geocode opsiyonel */
      }
      setState({
        permission: 'granted',
        loading: false,
        position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        city,
        address,
      });
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : 'geolocation failed',
      }));
    }
  }, []);

  const requestPermission = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      await fetchAndReverseGeocode();
    } else {
      setState((s) => ({ ...s, permission: 'denied', loading: false }));
    }
  }, [fetchAndReverseGeocode]);

  const refresh = useCallback(async () => {
    if (state.permission === 'granted') {
      await fetchAndReverseGeocode();
    }
  }, [state.permission, fetchAndReverseGeocode]);

  useEffect(() => {
    if (!autoRequest) return;
    let cancelled = false;
    (async () => {
      // Dev/preview: gerçek izin atla, sahte Galata konumu kullan.
      // Production build'de isDevBypassEnabled() false döner;
      // dev makinede EXPO_PUBLIC_DEV_BYPASS=off ile de kapatılabilir.
      if (isDevBypassEnabled()) {
        if (cancelled) return;
        setState({
          permission: 'granted',
          loading: false,
          position: { lat: 41.0256, lng: 28.9742 },
          city: 'İstanbul',
          address: 'Galata Kulesi, Bereketzade, Beyoğlu, İstanbul',
        });
        return;
      }
      const { status } = await Location.getForegroundPermissionsAsync();
      if (cancelled) return;
      if (status === 'granted') {
        await fetchAndReverseGeocode();
      } else if (status === 'denied') {
        setState((s) => ({ ...s, permission: 'denied', loading: false }));
      } else {
        setState((s) => ({ ...s, permission: 'undetermined', loading: false }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [autoRequest, fetchAndReverseGeocode]);

  return { ...state, requestPermission, refresh };
}
