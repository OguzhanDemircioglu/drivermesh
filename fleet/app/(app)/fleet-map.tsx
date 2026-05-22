import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  InteractionManager,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import MapView, { PROVIDER_GOOGLE, Polyline, type Region } from 'react-native-maps';
import { LabeledMarker } from '@/components/LabeledMarker';
import { LabelRenderPool, useLabelRenderPool, type LabelSpec } from '@/components/LabelRenderPool';
import { MiniLocationPin, darken, vehicleColorFromPlate } from '@/components/MiniLocationPin';
import { useAuth } from '@/auth/AuthProvider';
import { fetchFleetMap, type FleetMapSnapshot, type FleetMapVehicle } from '@/lib/queries';
import { openInMaps } from '@/lib/openInMaps';
import type { VehicleStatus } from '@/lib/database.types';
import { theme } from '@/theme';

const VARIANT_BY_STATUS: Record<
  VehicleStatus,
  'vehicle-active' | 'vehicle-idle' | 'vehicle-maintenance'
> = {
  active: 'vehicle-active',
  idle: 'vehicle-idle',
  maintenance: 'vehicle-maintenance',
};

const ISTANBUL_FALLBACK: Region = {
  latitude: 41.0082,
  longitude: 28.9784,
  latitudeDelta: 0.2,
  longitudeDelta: 0.2,
};

function regionThatFits(snap: FleetMapSnapshot): Region {
  const points: Array<{ lat: number; lng: number }> = [];
  if (snap.hq) points.push({ lat: snap.hq.lat, lng: snap.hq.lng });
  for (const v of snap.vehicles) {
    if (v.position) points.push(v.position);
    if (v.activeJob?.pickup) points.push(v.activeJob.pickup);
    if (v.activeJob?.dropoff) points.push(v.activeJob.dropoff);
  }
  if (points.length === 0) return ISTANBUL_FALLBACK;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  // Bbox'a %15 padding (önce %60 idi, kartlar üst üste geliyordu).
  // Floor 0.012 → tek araçlık veya çok yakın küme'lerde mahalleye kadar
  // zoom in eder ama hâlâ marker label'ları okunur.
  const padLat = Math.max((maxLat - minLat) * 1.15, 0.012);
  const padLng = Math.max((maxLng - minLng) * 1.15, 0.012);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: padLat,
    longitudeDelta: padLng,
  };
}

function scaleFromLatDelta(latDelta: number): number {
  // sqrt mapping keeps a usable range across zoom levels:
  //  - city-wide view (~0.1)  → ~1.3 (big)
  //  - district (~0.02)       → ~0.85
  //  - street (~0.005)        → ~0.55 (clamped to floor)
  const raw = Math.sqrt(latDelta) * 4;
  return Math.max(0.55, Math.min(1.4, raw));
}

/** Returns Date.now() that ticks once per minute. Used for live elapsed timers. */
function useNowMinute(): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    // Tick every 30 s so a fresh minute boundary is picked up quickly
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** "00:42" (h<10) or "12:08" — used on the marker timer line. */
function formatHM(elapsedMs: number): string {
  const totalSec = Math.max(0, Math.floor(elapsedMs / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Looping pickup→dropoff animation for in_progress jobs.
 * Returns a map: vehicleId → lerped { lat, lng } updated ~10fps.
 * Doesn't track real GPS — purely visual signal that the truck is moving.
 */
function useActiveJobAnimation(snap: FleetMapSnapshot | null): Record<
  string,
  { lat: number; lng: number }
> {
  const [positions, setPositions] = useState<Record<string, { lat: number; lng: number }>>({});

  useEffect(() => {
    if (!snap) {
      setPositions({});
      return;
    }
    type Track = {
      id: string;
      pickup: { lat: number; lng: number };
      dropoff: { lat: number; lng: number };
    };
    const tracks: Track[] = [];
    for (const v of snap.vehicles) {
      if (
        v.activeJob &&
        v.activeJob.status === 'in_progress' &&
        v.activeJob.pickup &&
        v.activeJob.dropoff
      ) {
        tracks.push({ id: v.id, pickup: v.activeJob.pickup, dropoff: v.activeJob.dropoff });
      }
    }
    if (tracks.length === 0) {
      setPositions({});
      return;
    }

    const CYCLE_MS = 30_000;
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = (Date.now() - start) % CYCLE_MS;
      const t = elapsed / CYCLE_MS; // 0..1 — restarts at pickup each cycle
      const next: Record<string, { lat: number; lng: number }> = {};
      for (const tk of tracks) {
        next[tk.id] = {
          lat: tk.pickup.lat + (tk.dropoff.lat - tk.pickup.lat) * t,
          lng: tk.pickup.lng + (tk.dropoff.lng - tk.pickup.lng) * t,
        };
      }
      setPositions(next);
    }, 150);
    return () => clearInterval(id);
  }, [snap]);

  return positions;
}

export default function FleetMapScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const mapRef = useRef<MapView | null>(null);
  const [snap, setSnap] = useState<FleetMapSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [markerScale, setMarkerScale] = useState(1);
  const animatedPositions = useActiveJobAnimation(snap);
  const nowMinute = useNowMinute();

  // Build label specs that the off-screen pool will rasterise to PNGs.
  // HQ + vehicles go through the pool. Pickup/dropoff render as
  // direct-child MiniLocationPin (mavi/turuncu teardrop + address bubble)
  // for a more prominent location signal at the route endpoints.
  const labelSpecs = useMemo<LabelSpec[]>(() => {
    if (!snap) return [];
    const out: LabelSpec[] = [];
    if (snap.hq) {
      out.push({
        key: 'hq',
        variant: 'hq',
        // HQ glyph shows the garage icon only — no text on the map.
        label: '',
        scale: markerScale,
      });
    }
    for (const v of snap.vehicles) {
      if (!v.position) continue;
      // Only hide a vehicle from the map when the operator has explicitly
      // marked it as parked at HQ (is_at_hq=true). The HQ marker visually
      // covers all parked-at-HQ vehicles. Idle vehicles that are NOT
      // marked still show — the operator might be on the road but not
      // currently on a job (e.g. between deliveries).
      if (v.isAtHq && !v.activeJob) continue;
      let timer: string | undefined;
      let hint: string | undefined;
      if (v.activeJob?.status === 'in_progress' && v.activeJob.startedAt) {
        const elapsedMs = nowMinute - new Date(v.activeJob.startedAt).getTime();
        timer = formatHM(elapsedMs);
      } else if (v.activeJob?.status === 'assigned') {
        timer = t('fleetMap.assignedHint');
      } else if (v.status === 'idle') {
        hint = t('fleetMap.boundFromHq');
      }
      out.push({
        key: `v:${v.id}`,
        variant: v.activeJob ? 'vehicle-active' : VARIANT_BY_STATUS[v.status],
        label: v.plate,
        timer,
        hint,
        scale: markerScale,
        // Drop alpha when zoomed in so pickup/dropoff teardrops underneath
        // remain readable.
        opacity: markerScale < 0.85 ? 0.7 : 1,
        // Pill colour ALWAYS matches the vehicle's own colour (operator-
        // chosen via vehicles.color, with a plate-derived fallback) — even
        // for maintenance vehicles, so an operator can recognise their
        // truck on the map by colour at a glance regardless of status.
        bgOverride: v.color ?? vehicleColorFromPlate(v.plate),
      });
    }
    return out;
  }, [snap, markerScale, t, nowMinute]);

  const { uris, setUri } = useLabelRenderPool(labelSpecs);

  const load = useCallback(async () => {
    if (!profile?.organization_id) return;
    try {
      const next = await fetchFleetMap(profile.organization_id);
      setSnap(next);
    } catch (e) {
      console.warn('[fleet-map] load failed', e);
    } finally {
      setLoading(false);
    }
  }, [profile?.organization_id]);

  useFocusEffect(
    useCallback(() => {
      const handle = InteractionManager.runAfterInteractions(load);
      return () => handle.cancel();
    }, [load]),
  );

  useEffect(() => {
    if (!snap || !mapRef.current) return;
    mapRef.current.animateToRegion(regionThatFits(snap), 700);
  }, [snap]);

  const counters = useMemo(() => {
    if (!snap) return { hq: 0, active: 0, maintenance: 0 };
    return {
      hq: snap.hq ? 1 : 0,
      // "boşta" kategorisi UI'dan kaldırıldı — idle araçlar artık ya HQ
      // marker'ı altında (is_at_hq=true) ya da aktif sayımı içinde.
      active: snap.vehicles.filter(
        (v) => v.status === 'active' || v.status === 'idle' || v.activeJob,
      ).length,
      maintenance: snap.vehicles.filter((v) => v.status === 'maintenance').length,
    };
  }, [snap]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
          >
            <Feather name="arrow-left" size={22} color={theme.colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('fleetMap.title')}</Text>
          </View>
          <Pressable
            onPress={load}
            hitSlop={12}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
          >
            <Feather name="refresh-cw" size={18} color={theme.colors.accent} />
          </Pressable>
        </View>

        <View style={styles.mapWrap}>
          {loading && !snap ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.colors.accent} />
            </View>
          ) : (
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={StyleSheet.absoluteFill}
              initialRegion={snap ? regionThatFits(snap) : ISTANBUL_FALLBACK}
              toolbarEnabled={false}
              onRegionChangeComplete={(r) => setMarkerScale(scaleFromLatDelta(r.latitudeDelta))}
              onMarkerPress={(e) => {
                // MapView-level handler is the only reliable way to catch
                // taps on image-backed markers on Android (per-marker
                // onPress is unreliable with the Google Maps SDK).
                const id = e.nativeEvent.id;
                if (!id || !snap) return;
                if (id.startsWith('v:')) {
                  router.push(`/(app)/vehicles/${id.slice(2)}`);
                  return;
                }
                if (id === 'hq' && snap.hq) {
                  openInMaps(snap.hq.lat, snap.hq.lng, snap.hq.address);
                  return;
                }
                if (id.startsWith('p:') || id.startsWith('d:')) {
                  const v = snap.vehicles.find((x) => x.id === id.slice(2));
                  if (id.startsWith('p:') && v?.activeJob?.pickup) {
                    openInMaps(
                      v.activeJob.pickup.lat,
                      v.activeJob.pickup.lng,
                      v.activeJob.pickupAddress,
                    );
                  } else if (id.startsWith('d:') && v?.activeJob?.dropoff) {
                    openInMaps(
                      v.activeJob.dropoff.lat,
                      v.activeJob.dropoff.lng,
                      v.activeJob.dropoffAddress,
                    );
                  }
                }
              }}
            >
              {snap?.hq ? (
                <LabeledMarker
                  variant="hq"
                  label={t('fleetMap.hqLabel')}
                  coordinate={{ latitude: snap.hq.lat, longitude: snap.hq.lng }}
                  imageUri={uris['hq']}
                  identifier="hq"
                  zIndex={0}
                />
              ) : null}

              {snap?.vehicles
                .filter((v) => !(v.isAtHq && !v.activeJob))
                .map((v) => (
                  <VehicleMarkerGroup
                    key={v.id}
                    v={v}
                    t={t}
                    imageUri={uris[`v:${v.id}`]}
                    animatedPos={animatedPositions[v.id] ?? null}
                    vehicleId={v.id}
                  />
                ))}
            </MapView>
          )}

          {!loading && snap && !snap.hq ? (
            <View style={styles.noHqBanner}>
              <Feather name="map-pin" size={14} color={theme.colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.noHqTitle}>{t('fleetMap.noHqTitle')}</Text>
                <Text style={styles.noHqText}>{t('fleetMap.noHqText')}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* Off-screen label rasterisation pool (must live OUTSIDE the MapView) */}
        <LabelRenderPool items={labelSpecs} onCaptured={setUri} />

        {/* Legend — "Boşta" satırı v8'de kaldırıldı, idle aktif sayımına gider */}
        <View style={styles.legend}>
          <LegendItem color={theme.colors.lavender} label={`${t('fleetMap.legendHq')} ${counters.hq}`} />
          <LegendItem color={theme.colors.success} label={`${t('fleetMap.legendActive')} ${counters.active}`} />
          <LegendItem color={theme.colors.warning} label={`${t('fleetMap.legendMaintenance')} ${counters.maintenance}`} />
        </View>
      </SafeAreaView>
    </View>
  );
}

function VehicleMarkerGroup({
  v,
  t,
  imageUri,
  animatedPos,
  vehicleId,
}: {
  v: FleetMapVehicle;
  t: (k: string) => string;
  imageUri: string | undefined;
  animatedPos: { lat: number; lng: number } | null;
  vehicleId: string;
}) {
  if (!v.position) return null;
  const variant = v.activeJob ? 'vehicle-active' : VARIANT_BY_STATUS[v.status];
  const hint = v.activeJob
    ? `${t('fleetMap.activeJob')}: ${truncate(v.activeJob.customerName, 16)}`
    : v.status === 'idle'
      ? t('fleetMap.boundFromHq')
      : undefined;
  // While the truck is "in_progress", animate its pin between pickup and dropoff.
  const coord = animatedPos ?? v.position;
  const showRoute =
    !!v.activeJob &&
    !!v.activeJob.pickup &&
    !!v.activeJob.dropoff &&
    (v.activeJob.status === 'in_progress' || v.activeJob.status === 'assigned');
  return (
    <>
      {showRoute && v.activeJob?.pickup && v.activeJob?.dropoff ? (
        <>
          {/* Backing — dash-pattern gap'lerini kapatır, koyu rengin alpha
              hali ile pin tail uçları her zaman renkli pixel'e değer. */}
          <Polyline
            coordinates={[
              { latitude: v.activeJob.pickup.lat, longitude: v.activeJob.pickup.lng },
              { latitude: v.activeJob.dropoff.lat, longitude: v.activeJob.dropoff.lng },
            ]}
            strokeColor={`${darken(v.color ?? vehicleColorFromPlate(v.plate))}55`}
            strokeWidth={3}
          />
          <Polyline
            coordinates={[
              { latitude: v.activeJob.pickup.lat, longitude: v.activeJob.pickup.lng },
              { latitude: v.activeJob.dropoff.lat, longitude: v.activeJob.dropoff.lng },
            ]}
            strokeColor={darken(v.color ?? vehicleColorFromPlate(v.plate))}
            strokeWidth={6}
            lineDashPattern={[10, 8]}
          />
        </>
      ) : null}
      {showRoute && v.activeJob?.pickup ? (
        <MiniLocationPin
          variant="pickup"
          coordinate={{
            latitude: v.activeJob.pickup.lat,
            longitude: v.activeJob.pickup.lng,
          }}
          identifier={`p:${vehicleId}`}
          // z-stack: HQ (0) < pickup/dropoff (5) < vehicle pill (20)
          zIndex={5}
        />
      ) : null}
      {showRoute && v.activeJob?.dropoff ? (
        <MiniLocationPin
          variant="dropoff"
          coordinate={{
            latitude: v.activeJob.dropoff.lat,
            longitude: v.activeJob.dropoff.lng,
          }}
          identifier={`d:${vehicleId}`}
          zIndex={5}
        />
      ) : null}
      <LabeledMarker
        variant={variant}
        label={v.plate}
        hint={hint}
        coordinate={{ latitude: coord.lat, longitude: coord.lng }}
        imageUri={imageUri}
        identifier={`v:${vehicleId}`}
        zIndex={20}
      />
    </>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function truncate(s: string, max: number) {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: 8,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.semibold,
  },
  subtitle: {
    color: theme.colors.textDim,
    fontSize: theme.font.size.xs,
    marginTop: 2,
  },
  mapWrap: { flex: 1, overflow: 'hidden' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },

  noHqBanner: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 10,
    padding: 10,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.4)',
    borderWidth: 1,
    borderRadius: theme.radius.md,
  },
  noHqTitle: {
    color: theme.colors.warning,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
  },
  noHqText: {
    color: theme.colors.text,
    fontSize: theme.font.size.xs,
    marginTop: 2,
    lineHeight: 18,
  },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
  },
});
