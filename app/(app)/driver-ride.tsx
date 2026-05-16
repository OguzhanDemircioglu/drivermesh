import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/Card';
import { useAuth } from '@/auth/AuthProvider';
import { useDriverActiveRide } from '@/hooks/useDriverActiveRide';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme';

export default function DriverRideScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { session } = useAuth();
  const driverId = session?.user.id;
  const { data: ride, loading, refetch } = useDriverActiveRide(driverId);
  const [busy, setBusy] = useState(false);
  const [fareStr, setFareStr] = useState('');
  const [distanceStr, setDistanceStr] = useState('');

  const callRpc = async (
    fn: 'driver_arrived' | 'start_ride' | 'complete_ride',
    args: Record<string, unknown>,
  ): Promise<void> => {
    setBusy(true);
    try {
      const { error } = await (
        supabase as unknown as {
          rpc: (
            f: string,
            a: Record<string, unknown>,
          ) => Promise<{ error: { message: string } | null }>;
        }
      ).rpc(fn, args);
      if (error) throw new Error(error.message);
      await refetch();
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Bilinmeyen');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!ride) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Pressable
            hitSlop={12}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <Feather name="arrow-left" size={20} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.title}>{t('driverRide.title')}</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.center}>
          <Feather name="check-circle" size={48} color={theme.colors.textDim} />
          <Text style={styles.emptyTitle}>{t('driverRide.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('driverRide.emptyBody')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusLabel =
    ride.status === 'searching'
      ? t('driverRide.statusSearching')
      : ride.status === 'assigned'
        ? t('driverRide.statusAssigned')
        : ride.status === 'driver_arrived'
          ? t('driverRide.statusArrived')
          : t('driverRide.statusInProgress');

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Pressable
          hitSlop={12}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <Feather name="arrow-left" size={20} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.title}>{t('driverRide.title')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>
        <Card>
          <View style={styles.banner}>
            <View style={styles.iconWrap}>
              <Feather
                name={
                  ride.status === 'in_progress'
                    ? 'navigation'
                    : ride.status === 'driver_arrived'
                      ? 'check-circle'
                      : 'map-pin'
                }
                size={20}
                color={theme.colors.accent}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusLabel}>{statusLabel}</Text>
              <Text style={styles.pickup}>{ride.pickup_address ?? '—'}</Text>
            </View>
          </View>
        </Card>

        {ride.status === 'assigned' ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => callRpc('driver_arrived', { p_ride_id: ride.id })}
            style={({ pressed }) => [
              styles.cta,
              busy && styles.ctaDisabled,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Feather name="map-pin" size={18} color={theme.colors.bg} />
            <Text style={styles.ctaText}>{t('driverRide.ctaArrived')}</Text>
          </Pressable>
        ) : null}

        {ride.status === 'driver_arrived' ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => callRpc('start_ride', { p_ride_id: ride.id })}
            style={({ pressed }) => [
              styles.cta,
              busy && styles.ctaDisabled,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Feather name="navigation" size={18} color={theme.colors.bg} />
            <Text style={styles.ctaText}>{t('driverRide.ctaStart')}</Text>
          </Pressable>
        ) : null}

        {ride.status === 'in_progress' ? (
          <Card style={{ gap: 12 }}>
            <Text style={styles.sectionTitle}>{t('driverRide.completeTitle')}</Text>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('driverRide.fareLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={theme.colors.textDim}
                keyboardType="decimal-pad"
                value={fareStr}
                onChangeText={setFareStr}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('driverRide.distanceLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={theme.colors.textDim}
                keyboardType="decimal-pad"
                value={distanceStr}
                onChangeText={setDistanceStr}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => {
                const fare = parseFloat(fareStr.replace(',', '.'));
                const dist = parseFloat(distanceStr.replace(',', '.'));
                callRpc('complete_ride', {
                  p_ride_id: ride.id,
                  p_fare_final: isFinite(fare) ? fare : null,
                  p_distance_km: isFinite(dist) ? dist : null,
                });
              }}
              style={({ pressed }) => [
                styles.cta,
                busy && styles.ctaDisabled,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Feather name="check" size={18} color={theme.colors.bg} />
              <Text style={styles.ctaText}>{t('driverRide.ctaComplete')}</Text>
            </Pressable>
          </Card>
        ) : null}

        <Card style={{ gap: 8 }}>
          <Text style={styles.sectionTitle}>{t('driverRide.timeline')}</Text>
          <TimelineRow label={t('driverRide.tlRequested')} time={ride.requested_at} />
          <TimelineRow label={t('driverRide.tlAssigned')} time={ride.assigned_at} />
          <TimelineRow label={t('driverRide.tlArrived')} time={ride.arrived_at} />
          <TimelineRow label={t('driverRide.tlStarted')} time={ride.started_at} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function TimelineRow({ label, time }: { label: string; time: string | null }) {
  const done = !!time;
  return (
    <View style={styles.tlRow}>
      <Feather
        name={done ? 'check-circle' : 'circle'}
        size={14}
        color={done ? theme.colors.success : theme.colors.textDim}
      />
      <Text style={[styles.tlLabel, !done && { color: theme.colors.textDim }]}>{label}</Text>
      <Text style={styles.tlTime}>{time ? new Date(time).toLocaleTimeString() : '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: theme.spacing.lg, gap: theme.spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  title: { color: theme.colors.text, fontSize: 19, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  emptyTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '600', marginTop: 8 },
  emptyBody: { color: theme.colors.textMuted, fontSize: 14, textAlign: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusLabel: { color: theme.colors.text, fontSize: 17, fontWeight: '700' },
  pickup: { color: theme.colors.textMuted, fontSize: 14, marginTop: 2 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.colors.accent,
    paddingVertical: 16,
    borderRadius: theme.radius.lg,
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: theme.colors.bg, fontSize: 16, fontWeight: '700' },
  sectionTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  field: { gap: 6 },
  fieldLabel: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '600' },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.colors.text,
    fontSize: 16,
  },
  tlRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tlLabel: { flex: 1, color: theme.colors.text, fontSize: 13 },
  tlTime: { color: theme.colors.textMuted, fontSize: 12 },
});
