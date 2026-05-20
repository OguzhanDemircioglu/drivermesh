import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/Toast';
import { useActiveDriverInfo } from '@/hooks/useActiveDriverInfo';
import { cancelRide } from '@/lib/db/rides';
import type { Database } from '@/lib/database.types';
import { colors, radii, spacing } from '@/theme';

// Native platformlarda react-native-maps; web'de fake grid fallback.
// Web bundle'inda map kütüphanesini import etmemek için Platform check şart.
const isNative = Platform.OS === 'ios' || Platform.OS === 'android';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Maps: typeof import('react-native-maps') | null = isNative
  ? require('react-native-maps')
  : null;

type RideRequest = Database['public']['Tables']['ride_requests']['Row'];
type RideStatus = RideRequest['status'];

type Props = {
  ride: RideRequest;
  customerId: string;
};

function statusKey(s: RideStatus): 'active.statusAssigned' | 'active.statusArrived' | 'active.statusInProgress' {
  switch (s) {
    case 'driver_arrived':
      return 'active.statusArrived';
    case 'in_progress':
      return 'active.statusInProgress';
    case 'assigned':
    case 'searching':
    default:
      return 'active.statusAssigned';
  }
}

/**
 * Anasayfa active state — harita yerine PostGIS render gerektirmeyen
 * stilize bir "fake harita" + araç ikonu entrance animasyonu (V1).
 * V2'de gerçek react-native-maps + driver konumu.
 */
export function ActiveRideView({ ride, customerId }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const driver = useActiveDriverInfo(ride.id);

  // Araç ikonu üstten gelir (Y -200 → 0), sonra hafifçe pulse.
  const enterY = useSharedValue(-200);
  const enterOpacity = useSharedValue(0);
  const playedRef = useRef(false);

  useEffect(() => {
    if (playedRef.current) return;
    playedRef.current = true;
    enterY.value = withTiming(0, { duration: 900, easing: Easing.out(Easing.cubic) });
    enterOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [enterY, enterOpacity]);

  const carStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: enterY.value }],
    opacity: enterOpacity.value,
  }));

  const statusLabel = useMemo(() => t(statusKey(ride.status)), [ride.status, t]);

  // Cancel grace period — assigned_at + 2 minutes
  const graceDeadlineMs = useMemo(
    () => (ride.assigned_at ? new Date(ride.assigned_at).getTime() + 2 * 60 * 1000 : null),
    [ride.assigned_at],
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  const remainingSec = useMemo(() => {
    if (!graceDeadlineMs) return null;
    return Math.max(0, Math.floor((graceDeadlineMs - nowMs) / 1000));
  }, [graceDeadlineMs, nowMs]);
  const inGrace = ride.status === 'assigned' && remainingSec !== null && remainingSec > 0;
  useEffect(() => {
    if (!inGrace) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [inGrace]);
  const graceCountdown = useMemo(() => {
    if (remainingSec === null) return null;
    const m = Math.floor(remainingSec / 60);
    const s = String(remainingSec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }, [remainingSec]);

  const onCall = () => {
    if (!driver.data?.driver_phone) {
      toast.show('warning', t('errors.unknown'));
      return;
    }
    Linking.openURL(`tel:${driver.data.driver_phone}`).catch(() => {});
  };

  const onCancel = () => {
    const bodyKey = inGrace ? 'active.cancelConfirmBody' : 'active.cancelConfirmBodyFee';
    Alert.alert(t('active.cancelConfirmTitle'), t(bodyKey), [
      { text: t('common.no'), style: 'cancel' },
      {
        text: t('common.yes'),
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelRide(ride.id, inGrace ? 'customer_cancelled_free' : 'customer_cancelled_after_grace');
            await qc.invalidateQueries({ queryKey: ['ride', 'active', customerId] });
          } catch (e) {
            toast.show('error', e instanceof Error ? e.message : t('errors.unknown'));
          }
        },
      },
    ]);
  };

  const plateBadge = driver.data?.plate;
  const vehicleLabel = driver.data
    ? `${driver.data.brand} ${driver.data.model}${driver.data.color ? ' · ' + driver.data.color : ''}`
    : '';

  // Pickup koordinatları — ride_requests.pickup_point geography (PostGIS),
  // string olarak SRID=4326 hex döner. V1'de driver info'dan HQ konumunu
  // marker olarak gösteriyoruz; pickup için müşterinin GPS'ini kullanan
  // separate strategy ride.pickup_address'ten parse zor.
  const pickupLat = 41.0256;
  const pickupLng = 28.9742;
  const driverLat = driver.data?.hq_lat ?? pickupLat + 0.01;
  const driverLng = driver.data?.hq_lng ?? pickupLng + 0.01;

  return (
    <View style={styles.root}>
      <View style={styles.banner}>
        <View style={styles.bannerIconWrap}>
          <Feather
            name={ride.status === 'driver_arrived' ? 'check-circle' : 'navigation'}
            size={20}
            color={colors.accent}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerStatus}>{statusLabel}</Text>
          {driver.data?.driver_name ? (
            <Text style={styles.bannerDriver}>
              {driver.data.driver_name} · {vehicleLabel}
            </Text>
          ) : (
            <Text style={styles.bannerDriver}>{t('call.waitingBody')}</Text>
          )}
          {inGrace && graceCountdown ? (
            <Text style={styles.graceText} testID="cancel-grace-countdown">
              {t('active.cancelGraceCountdown', { time: graceCountdown })}
            </Text>
          ) : null}
        </View>
      </View>

      {Maps && isNative ? (
        <View style={styles.fakeMap}>
          <Maps.default
            style={StyleSheet.absoluteFill}
            provider={Maps.PROVIDER_GOOGLE}
            initialRegion={{
              latitude: pickupLat,
              longitude: pickupLng,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            customMapStyle={DARK_MAP_STYLE}
            showsCompass={false}
            showsMyLocationButton={false}
            toolbarEnabled={false}
          >
            <Maps.Marker
              coordinate={{ latitude: pickupLat, longitude: pickupLng }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.pickupPin}>
                <View style={styles.pickupPulse} />
                <View style={styles.pickupCore} />
              </View>
            </Maps.Marker>
            {driver.data ? (
              <Maps.Marker
                coordinate={{ latitude: driverLat, longitude: driverLng }}
                anchor={{ x: 0.5, y: 1 }}
              >
                <Animated.View style={[styles.carWrap, carStyle]}>
                  <View style={styles.carIcon}>
                    <Feather name="truck" size={22} color={colors.bg} />
                  </View>
                  {plateBadge ? (
                    <View style={styles.plateBadge}>
                      <Text style={styles.plateText}>{plateBadge}</Text>
                    </View>
                  ) : null}
                </Animated.View>
              </Maps.Marker>
            ) : null}
          </Maps.default>
        </View>
      ) : (
        <View style={styles.fakeMap}>
          {/* Web fallback: grid + center pickup + entrance car */}
          {Array.from({ length: 8 }).map((_, i) => (
            <View
              key={`h-${i}`}
              style={[styles.gridLine, styles.gridLineH, { top: `${(i + 1) * 11}%` }]}
            />
          ))}
          {Array.from({ length: 6 }).map((_, i) => (
            <View
              key={`v-${i}`}
              style={[styles.gridLine, styles.gridLineV, { left: `${(i + 1) * 15}%` }]}
            />
          ))}
          <View style={styles.pickupPinAbsolute}>
            <View style={styles.pickupPulse} />
            <View style={styles.pickupCore} />
          </View>
          <Animated.View style={[styles.carWrapAbsolute, carStyle]}>
            <View style={styles.carIcon}>
              <Feather name="truck" size={22} color={colors.bg} />
            </View>
            {plateBadge ? (
              <View style={styles.plateBadge}>
                <Text style={styles.plateText}>{plateBadge}</Text>
              </View>
            ) : null}
          </Animated.View>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={onCall}
          disabled={!driver.data?.driver_phone}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.callBtn,
            !driver.data?.driver_phone && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Feather name="phone" size={16} color={colors.mesh} />
          <Text style={styles.callText}>{t('active.callDriver')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          style={({ pressed }) => [styles.actionBtn, styles.cancelBtn, pressed && styles.pressed]}
        >
          <Feather name="x" size={16} color={colors.danger} />
          <Text style={styles.cancelText}>{t('active.cancelTrip')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: spacing.md },
  fakeMap: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    minHeight: 340,
  },
  graceText: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: colors.border,
  },
  gridLineH: { left: 0, right: 0, height: 1 },
  gridLineV: { top: 0, bottom: 0, width: 1 },
  pickupPin: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupPinAbsolute: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -16 }, { translateY: -16 }],
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupPulse: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.mesh,
    opacity: 0.3,
  },
  pickupCore: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.mesh,
    borderWidth: 3,
    borderColor: colors.bg,
  },
  carWrap: {
    alignItems: 'center',
    gap: 4,
  },
  carWrapAbsolute: {
    position: 'absolute',
    top: '30%',
    left: '50%',
    transform: [{ translateX: -22 }],
    alignItems: 'center',
    gap: 4,
  },
  carIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.accent,
        shadowOpacity: 0.5,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  plateBadge: {
    backgroundColor: 'rgba(10,14,31,0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  plateText: { color: colors.text, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: spacing.md,
  },
  bannerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerStatus: { color: colors.text, fontSize: 16, fontWeight: '700' },
  bannerDriver: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: {
    flex: 1,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  callBtn: { backgroundColor: colors.meshMuted, borderColor: colors.mesh },
  cancelBtn: { backgroundColor: colors.dangerMuted, borderColor: colors.danger },
  callText: { color: colors.mesh, fontSize: 15, fontWeight: '700' },
  cancelText: { color: colors.danger, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});

// Google Maps koyu tema (özet) — drivermesh estetiğine yakın
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0A0E1F' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8A93A6' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0A0E1F' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#131829' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1A2038' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#222948' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];
