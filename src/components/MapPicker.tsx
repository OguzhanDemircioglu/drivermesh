import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import MapView, {
  PROVIDER_GOOGLE,
  type Region,
} from 'react-native-maps';
import { LabeledMarker, type LabeledMarkerVariant } from './LabeledMarker';
import { theme } from '@/theme';

const GOOGLE_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID ??
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS ??
  '';

async function googleGeocode(
  query: string,
): Promise<{ lat: number; lng: number; formatted: string } | null> {
  if (!GOOGLE_KEY) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    query,
  )}&key=${GOOGLE_KEY}&language=tr&region=tr`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = (await res.json()) as {
    status: string;
    results: Array<{
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
    }>;
  };
  if (json.status !== 'OK' || !json.results.length) return null;
  const r = json.results[0];
  return {
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    formatted: r.formatted_address,
  };
}

async function googleReverseGeocode(
  lat: number,
  lng: number,
): Promise<string | null> {
  if (!GOOGLE_KEY) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}&language=tr`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = (await res.json()) as {
    status: string;
    results: Array<{ formatted_address: string }>;
  };
  if (json.status !== 'OK' || !json.results.length) return null;
  return json.results[0].formatted_address;
}

// Nominatim (OpenStreetMap) — free fallback when Google Geocoding API
// is not enabled for the project's API key. Lighter coverage but no key required.
const NOMINATIM_HEADERS = {
  'User-Agent': 'DriverMesh/0.1 (drivermesh2 fleet ops)',
  'Accept-Language': 'tr,en;q=0.8',
};

async function nominatimGeocode(
  query: string,
): Promise<{ lat: number; lng: number; formatted: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query,
    )}&format=json&limit=1&accept-language=tr`;
    const res = await fetch(url, { headers: NOMINATIM_HEADERS });
    if (!res.ok) return null;
    const json = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
    if (!json.length) return null;
    return {
      lat: parseFloat(json[0].lat),
      lng: parseFloat(json[0].lon),
      formatted: json[0].display_name,
    };
  } catch {
    return null;
  }
}

async function nominatimReverseGeocode(
  lat: number,
  lng: number,
): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=tr`;
    const res = await fetch(url, { headers: NOMINATIM_HEADERS });
    if (!res.ok) return null;
    const json = (await res.json()) as { display_name?: string };
    return json.display_name ?? null;
  } catch {
    return null;
  }
}

const ISTANBUL_CENTER: Region = {
  latitude: 41.0082,
  longitude: 28.9784,
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
};

type Props = {
  visible: boolean;
  title?: string;
  /** Optional label shown on the marker (e.g. "Lojistik üssü", "Teslim yeri") */
  pinLabel?: string;
  pinVariant?: LabeledMarkerVariant;
  initial?: { lat: number; lng: number; address?: string | null } | null;
  onClose: () => void;
  onConfirm: (result: { lat: number; lng: number; address: string | null }) => void;
};

export function MapPicker({
  visible,
  title,
  pinLabel,
  pinVariant = 'pickup',
  initial,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  const mapRef = useRef<MapView | null>(null);
  const [region, setRegion] = useState<Region>(() =>
    initial
      ? {
          latitude: initial.lat,
          longitude: initial.lng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }
      : ISTANBUL_CENTER,
  );
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    initial ? { lat: initial.lat, lng: initial.lng } : null,
  );
  const [address, setAddress] = useState<string | null>(initial?.address ?? null);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Reset when reopened
  useEffect(() => {
    if (!visible) return;
    if (initial) {
      setRegion({
        latitude: initial.lat,
        longitude: initial.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
      setPin({ lat: initial.lat, lng: initial.lng });
      setAddress(initial.address ?? null);
    } else {
      setRegion(ISTANBUL_CENTER);
      setPin(null);
      setAddress(null);
    }
  }, [visible, initial]);

  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      setResolvingAddress(true);
      try {
        // Try Google first (consistent labels). If the key isn't enabled
        // for Geocoding API the call returns null, fall through to OSM.
        const fromGoogle = await googleReverseGeocode(lat, lng);
        if (fromGoogle) {
          setAddress(fromGoogle);
          return;
        }
        const fromOsm = await nominatimReverseGeocode(lat, lng);
        if (fromOsm) {
          setAddress(fromOsm);
          return;
        }
        // Last resort: expo-location native (Play Services geocoder)
        const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        const r = results[0];
        if (r) {
          const parts = [r.street, r.streetNumber, r.district, r.city, r.region]
            .filter((p): p is string => Boolean(p && p.trim()));
          const label = [...new Set(parts)].join(', ');
          setAddress(label || null);
        } else {
          setAddress(null);
        }
      } catch (e) {
        console.warn('[MapPicker] reverseGeocode failed', e);
        setAddress(null);
      } finally {
        setResolvingAddress(false);
      }
    },
    [],
  );

  const handleMapPress = useCallback(
    (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      setPin({ lat: latitude, lng: longitude });
      reverseGeocode(latitude, longitude);
    },
    [reverseGeocode],
  );

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    const apply = (lat: number, lng: number, label: string) => {
      const next: Region = {
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(next);
      setPin({ lat, lng });
      setAddress(label);
      mapRef.current?.animateToRegion(next, 600);
    };
    try {
      // 1) Google Geocoding (best when key is authorized)
      const g = await googleGeocode(q);
      if (g) {
        apply(g.lat, g.lng, g.formatted);
        return;
      }
      // 2) Nominatim (free, no key) — handles most Turkey landmarks
      const osm = await nominatimGeocode(q);
      if (osm) {
        apply(osm.lat, osm.lng, osm.formatted);
        return;
      }
      // 3) Native expo-location (Play Services / Apple geocoder)
      const results = await Location.geocodeAsync(q);
      if (!results.length) {
        setSearchError(t('mapPicker.searchNoResult'));
        return;
      }
      const first = results[0];
      apply(first.latitude, first.longitude, q);
      reverseGeocode(first.latitude, first.longitude);
    } catch (e) {
      console.warn('[MapPicker] search failed', e);
      setSearchError(t('mapPicker.searchFailed'));
    } finally {
      setSearching(false);
    }
  }, [query, reverseGeocode, t]);

  const handleUseMyLocation = useCallback(async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next: Region = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(next);
      setPin({ lat: next.latitude, lng: next.longitude });
      mapRef.current?.animateToRegion(next, 500);
      reverseGeocode(next.latitude, next.longitude);
    } catch (e) {
      console.warn('[MapPicker] location failed', e);
    } finally {
      setLocating(false);
    }
  }, [reverseGeocode]);

  const handleConfirm = () => {
    if (!pin) return;
    onConfirm({ lat: pin.lat, lng: pin.lng, address });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <StatusBar style="light" />
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.header}>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
            >
              <Feather name="x" size={22} color={theme.colors.text} />
            </Pressable>
            <Text style={styles.title} numberOfLines={1}>
              {title ?? t('mapPicker.title')}
            </Text>
            <Pressable
              onPress={handleUseMyLocation}
              hitSlop={12}
              disabled={locating}
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && { opacity: 0.6 },
                locating && { opacity: 0.5 },
              ]}
            >
              {locating ? (
                <ActivityIndicator size="small" color={theme.colors.accent} />
              ) : (
                <Feather name="crosshair" size={20} color={theme.colors.accent} />
              )}
            </Pressable>
          </View>

          <View style={styles.searchWrap}>
            <Feather name="search" size={16} color={theme.colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={(v) => {
                setQuery(v);
                if (searchError) setSearchError(null);
              }}
              onSubmitEditing={handleSearch}
              placeholder={t('mapPicker.searchPlaceholder')}
              placeholderTextColor={theme.colors.textDim}
              returnKeyType="search"
              style={styles.searchInput}
              autoCapitalize="words"
            />
            {query.length > 0 ? (
              <Pressable
                onPress={() => {
                  setQuery('');
                  setSearchError(null);
                }}
                hitSlop={8}
              >
                <Feather name="x-circle" size={16} color={theme.colors.textDim} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={handleSearch}
              disabled={!query.trim() || searching}
              hitSlop={6}
              style={({ pressed }) => [
                styles.searchBtn,
                (!query.trim() || searching) && { opacity: 0.5 },
                pressed && { opacity: 0.7 },
              ]}
            >
              {searching ? (
                <ActivityIndicator size="small" color="#0A0E1F" />
              ) : (
                <Feather name="arrow-right" size={16} color="#0A0E1F" />
              )}
            </Pressable>
          </View>
          {searchError ? <Text style={styles.searchError}>{searchError}</Text> : null}

          <View style={styles.mapWrap}>
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={StyleSheet.absoluteFill}
              initialRegion={region}
              onPress={handleMapPress}
              showsUserLocation
              showsMyLocationButton={false}
              toolbarEnabled={false}
            >
              {pin ? (
                <LabeledMarker
                  variant={pinVariant}
                  label={pinLabel ?? title ?? t('mapPicker.title')}
                  coordinate={{ latitude: pin.lat, longitude: pin.lng }}
                />
              ) : null}
            </MapView>

            {!pin ? (
              <View style={styles.hintWrap} pointerEvents="none">
                <View style={styles.hintBubble}>
                  <Feather name="map-pin" size={14} color={theme.colors.accent} />
                  <Text style={styles.hintText}>{t('mapPicker.tapHint')}</Text>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.bottom}>
            {pin ? (
              <View style={styles.addrRow}>
                <Feather name="map-pin" size={14} color={theme.colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.addrLabel}>{t('mapPicker.selectedLabel')}</Text>
                  {resolvingAddress ? (
                    <Text style={styles.addrValue}>{t('mapPicker.resolvingAddress')}</Text>
                  ) : (
                    <Text style={styles.addrValue} numberOfLines={2}>
                      {address ?? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`}
                    </Text>
                  )}
                </View>
              </View>
            ) : null}
            <Pressable
              onPress={handleConfirm}
              disabled={!pin}
              style={({ pressed }) => [
                styles.confirmBtn,
                !pin && { opacity: 0.5 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Feather name="check" size={18} color="#0A0E1F" />
              <Text style={styles.confirmText}>{t('mapPicker.confirm')}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.semibold,
    textAlign: 'center',
  },
  mapWrap: { flex: 1, overflow: 'hidden' },
  hintWrap: {
    position: 'absolute',
    top: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10,14,31,0.85)',
    borderColor: theme.colors.border,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
  },
  hintText: { color: theme.colors.text, fontSize: theme.font.size.sm },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.font.size.sm,
    paddingVertical: 4,
  },
  searchBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchError: {
    color: theme.colors.danger,
    fontSize: theme.font.size.xs,
    marginHorizontal: theme.spacing.md,
    marginBottom: 4,
  },

  bottom: {
    backgroundColor: theme.colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  addrRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  addrLabel: {
    color: theme.colors.textDim,
    fontSize: theme.font.size.xs,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  addrValue: {
    color: theme.colors.text,
    fontSize: theme.font.size.sm,
    marginTop: 2,
    lineHeight: 20,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.accent,
    paddingVertical: 14,
    borderRadius: theme.radius.lg,
  },
  confirmText: {
    color: '#0A0E1F',
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.bold,
  },
});
