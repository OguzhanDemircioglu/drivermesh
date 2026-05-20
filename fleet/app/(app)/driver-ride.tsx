import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/Card';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/auth/AuthProvider';
import { useDriverActiveRide } from '../../src/hooks/useDriverActiveRide';
import { supabase } from '@/lib/supabase';
import { isDemoActive } from '@/demo/store';
import { theme } from '@/theme';

export default function DriverRideScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const toast = useToast();
  const { session } = useAuth();
  const driverId = session?.user.id;
  const { data: ride, loading, refetch } = useDriverActiveRide(driverId);
  const [busy, setBusy] = useState(false);
  const [fareStr, setFareStr] = useState('');
  const [distanceStr, setDistanceStr] = useState('');
  // complete_ride success'inden sonra rating modal'ı için kapatılan ride id.
  // useDriverActiveRide 'completed'i yakalamadığı için yereldeki ride.id'yi
  // saklamak en güvenilir yöntem.
  const [pendingRatingRideId, setPendingRatingRideId] = useState<string | null>(null);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingBusy, setRatingBusy] = useState(false);

  const callRpc = async (
    fn: 'driver_arrived' | 'start_ride' | 'complete_ride',
    args: Record<string, unknown>,
  ): Promise<void> => {
    setBusy(true);
    try {
      // Demo modunda backend yok — toast ile ilerleme hissi ver.
      if (isDemoActive()) {
        toast.info(t('common.done'), '');
        setBusy(false);
        return;
      }
      const { error } = await (
        supabase as unknown as {
          rpc: (
            f: string,
            a: Record<string, unknown>,
          ) => Promise<{ error: { message: string } | null }>;
        }
      ).rpc(fn, args);
      if (error) throw new Error(error.message);
      // complete_ride sonrası rating modal aç (ride id'yi ride henüz null'a
      // düşmeden yakala).
      if (fn === 'complete_ride' && ride) {
        setPendingRatingRideId(ride.id);
        setRatingStars(0);
        setRatingComment('');
      }
      await refetch();
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('errors.unknown'));
    } finally {
      setBusy(false);
    }
  };

  const submitRating = async () => {
    if (!pendingRatingRideId || ratingStars < 1 || ratingStars > 5) return;
    setRatingBusy(true);
    try {
      // Demo modunda backend yok — başarılı rating gibi davran.
      if (isDemoActive()) {
        toast.success(t('driverRide.ratingSent'), '');
        setPendingRatingRideId(null);
        setRatingBusy(false);
        return;
      }
      const { error } = await (
        supabase as unknown as {
          rpc: (
            f: string,
            a: Record<string, unknown>,
          ) => Promise<{ error: { message: string } | null }>;
        }
      ).rpc('submit_driver_rating', {
        p_ride_id: pendingRatingRideId,
        p_stars: ratingStars,
        p_comment: ratingComment.trim() || null,
      });
      if (error) throw new Error(error.message);
      toast.success(t('driverRide.ratingSent'), '');
      setPendingRatingRideId(null);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('errors.unknown'));
    } finally {
      setRatingBusy(false);
    }
  };

  const ratingModal = pendingRatingRideId ? (
    <RatingModal
      stars={ratingStars}
      comment={ratingComment}
      busy={ratingBusy}
      onStars={setRatingStars}
      onComment={setRatingComment}
      onSubmit={submitRating}
      onSkip={() => setPendingRatingRideId(null)}
      t={t}
    />
  ) : null;

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
        {ratingModal}
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
        {ratingModal}
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
      {ratingModal}
    </SafeAreaView>
  );
}

function RatingModal({
  stars,
  comment,
  busy,
  onStars,
  onComment,
  onSubmit,
  onSkip,
  t,
}: {
  stars: number;
  comment: string;
  busy: boolean;
  onStars: (n: number) => void;
  onComment: (s: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
  t: (k: string) => string;
}) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onSkip}>
      <TouchableWithoutFeedback onPress={onSkip}>
        <View style={styles.modalBackdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>{t('driverRide.ratingTitle')}</Text>
              <Text style={styles.modalBody}>{t('driverRide.ratingBody')}</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable
                    key={n}
                    hitSlop={6}
                    onPress={() => onStars(n)}
                    accessibilityRole="button"
                    accessibilityLabel={`${n} ${t('driverRide.ratingStarsLabel')}`}
                  >
                    <Feather
                      name="star"
                      size={36}
                      color={n <= stars ? theme.colors.accent : theme.colors.textDim}
                    />
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                placeholder={t('driverRide.ratingCommentPlaceholder')}
                placeholderTextColor={theme.colors.textDim}
                multiline
                value={comment}
                onChangeText={onComment}
                maxLength={500}
              />
              <View style={styles.modalActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={onSkip}
                  disabled={busy}
                  style={({ pressed }) => [styles.modalSkip, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.modalSkipText}>{t('driverRide.ratingSkip')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={onSubmit}
                  disabled={busy || stars < 1}
                  style={({ pressed }) => [
                    styles.modalSubmit,
                    (busy || stars < 1) && styles.ctaDisabled,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Feather name="check" size={18} color={theme.colors.bg} />
                  <Text style={styles.ctaText}>{t('driverRide.ratingSubmit')}</Text>
                </Pressable>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: theme.colors.bgElevated,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl + 8,
    gap: 12,
  },
  modalTitle: { color: theme.colors.text, fontSize: 19, fontWeight: '700' },
  modalBody: { color: theme.colors.textMuted, fontSize: 14, marginBottom: 4 },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalSkip: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  modalSkipText: { color: theme.colors.textMuted, fontSize: 15, fontWeight: '600' },
  modalSubmit: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent,
  },
});
