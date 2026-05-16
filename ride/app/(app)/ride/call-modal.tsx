import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/auth/AuthProvider';
import { useGeolocation } from '@/hooks/useGeolocation';
import { requestRide } from '@/lib/db/rides';
import { colors, radii, spacing } from '@/theme';

function mapErrorToI18n(message: string): string {
  if (message.includes('T3')) return 'errors.T3';
  if (message.includes('T4')) return 'errors.T4';
  if (message.includes('T6')) return 'errors.T6';
  if (message.includes('T7')) return 'errors.T7';
  return 'errors.unknown';
}

/**
 * Çağır modal'ı: pickup gösterimi + tek "Çağır" butonu.
 * request_ride başarılıysa ride_request status='assigned' olarak yaratılır
 * (atama otomatik, ayrı bir "kabul" adımı yok). Modal kapanır, anasayfa
 * active state'e (F7) geçer; bekleme + iptal + harita orada.
 */
export default function CallModal() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ vehicleId: string }>();
  const { customer } = useAuth();
  const geo = useGeolocation();
  const toast = useToast();
  const qc = useQueryClient();

  const [submitting, setSubmitting] = useState(false);
  const pickupReady = geo.position != null && geo.address != null;

  const close = () => router.back();

  const onCall = async () => {
    if (!pickupReady || submitting) return;
    setSubmitting(true);
    try {
      await requestRide({
        vehicleId: params.vehicleId!,
        pickupLat: geo.position!.lat,
        pickupLng: geo.position!.lng,
        pickupAddress: geo.address!,
      });
      // Aktif yolculuk query'sini invalidate et; home active state'e geç.
      await qc.invalidateQueries({ queryKey: ['ride', 'active', customer?.id] });
      close();
      router.replace('/(app)/(tabs)/home');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      toast.show('error', t(mapErrorToI18n(msg)));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.root}>
        <Pressable onPress={close} hitSlop={12} style={styles.closeBtn}>
          <Feather name="x" size={24} color={colors.text} />
        </Pressable>

        <Text style={styles.title}>{t('call.title')}</Text>

        <View style={styles.formWrap}>
          <View style={styles.pickupCard}>
            <View style={styles.iconWrap}>
              <Feather name="map-pin" size={18} color={colors.mesh} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pickupLabel}>{t('call.pickupLabel')}</Text>
              <Text style={styles.pickupValue} numberOfLines={2}>
                {geo.address ?? t('call.pickupLoading')}
              </Text>
            </View>
          </View>

          <Button
            title={t('call.cta')}
            onPress={onCall}
            disabled={!pickupReady || submitting}
            loading={submitting}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  closeBtn: { alignSelf: 'flex-end' },
  title: { color: colors.text, fontSize: 25, fontWeight: '700' },
  formWrap: { gap: spacing.lg, marginTop: spacing.md },
  pickupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.meshMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupLabel: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  pickupValue: { color: colors.text, fontSize: 15, marginTop: 2 },
});
