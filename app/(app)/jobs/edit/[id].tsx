import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/auth/AuthProvider';
import { useCan } from '@/auth/useCan';
import { getJob, updateJob } from '@/lib/jobs';
import { theme } from '@/theme';

const schema = z.object({
  customerName: z.string().min(2, 'Müşteri adı gerekli').max(80, 'Çok uzun'),
  pickupAddress: z.string().min(3, 'Alış adresi gerekli').max(200, 'Çok uzun'),
  dropoffAddress: z.string().min(3, 'Teslim adresi gerekli').max(200, 'Çok uzun'),
  distanceKm: z
    .string()
    .optional()
    .refine((v) => !v || /^\d+([.,]\d+)?$/.test(v), 'Sayı olmalı'),
  etaMinutes: z
    .string()
    .optional()
    .refine((v) => !v || /^\d+$/.test(v), 'Tam sayı olmalı'),
  notes: z.string().max(500, 'Çok uzun').optional(),
});

type FormData = z.infer<typeof schema>;

export default function EditJobScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const canEdit = useCan('jobs.update_any');
  const isStaff = profile?.role === 'owner' || profile?.role === 'manager';
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerName: '',
      pickupAddress: '',
      dropoffAddress: '',
      distanceKm: '',
      etaMinutes: '',
      notes: '',
    },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (!id) return;
    getJob(id)
      .then((j) => {
        if (!j) return;
        reset({
          customerName: j.customer_name,
          pickupAddress: j.pickup_address,
          dropoffAddress: j.dropoff_address,
          distanceKm: j.distance_km != null ? String(j.distance_km) : '',
          etaMinutes: j.eta_minutes != null ? String(j.eta_minutes) : '',
          notes: j.notes ?? '',
        });
      })
      .catch((e) => console.warn('[edit-job] load failed', e))
      .finally(() => setLoading(false));
  }, [id, reset]);

  const onSubmit = handleSubmit(async (data) => {
    if (!id) return;
    if (!canEdit.allowed) {
      Alert.alert(
        t('common.permissionMissingTitle'),
        canEdit.reason ?? t('common.permissionMissing'),
      );
      return;
    }
    setSubmitting(true);
    try {
      await updateJob(id, {
        customer_name: data.customerName,
        pickup_address: data.pickupAddress,
        dropoff_address: data.dropoffAddress,
        distance_km: data.distanceKm ? Number(data.distanceKm.replace(',', '.')) : null,
        eta_minutes: data.etaMinutes ? Number(data.etaMinutes) : null,
        notes: data.notes || null,
      });
      Alert.alert(t('jobs.edit.successTitle'), t('jobs.edit.successText'), [
        { text: t('common.done'), onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert(t('jobs.edit.errorTitle'), (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  });

  if (!isStaff) {
    return (
      <Screen scroll contentStyle={styles.scroll}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
        >
          <Feather name="arrow-left" size={22} color={theme.colors.text} />
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.notAllowed}>{canEdit.reason ?? t('common.permissionMissing')}</Text>
      </Screen>
    );
  }

  return (
    <Screen scroll contentStyle={styles.scroll}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
      >
        <Feather name="arrow-left" size={22} color={theme.colors.text} />
        <Text style={styles.backText}>{t('common.back')}</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={styles.eyebrow}>
          <Feather name="edit-3" size={11} color={theme.colors.accent} />
          <Text style={styles.eyebrowText}>{t('jobs.editCta')}</Text>
        </View>
        <Text style={styles.title}>{t('jobs.edit.title')}</Text>
        <Text style={styles.subtitle}>{t('jobs.edit.subtitle')}</Text>
      </View>

      {loading ? null : (
        <View style={styles.form}>
          <Controller
            control={control}
            name="customerName"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label={t('jobs.new.customer')}
                icon="briefcase"
                placeholder={t('jobs.new.customerPlaceholder')}
                autoCapitalize="words"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.customerName?.message}
                returnKeyType="next"
              />
            )}
          />
          <Controller
            control={control}
            name="pickupAddress"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label={t('jobs.new.pickup')}
                icon="map-pin"
                placeholder={t('jobs.new.pickupPlaceholder')}
                autoCapitalize="sentences"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.pickupAddress?.message}
                returnKeyType="next"
              />
            )}
          />
          <Controller
            control={control}
            name="dropoffAddress"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label={t('jobs.new.dropoff')}
                icon="flag"
                placeholder={t('jobs.new.dropoffPlaceholder')}
                autoCapitalize="sentences"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.dropoffAddress?.message}
                returnKeyType="next"
              />
            )}
          />
          <View style={styles.row}>
            <View style={styles.half}>
              <Controller
                control={control}
                name="distanceKm"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextField
                    label={t('jobs.new.distance')}
                    icon="navigation"
                    placeholder={t('jobs.new.distancePlaceholder')}
                    keyboardType="decimal-pad"
                    value={value ?? ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.distanceKm?.message}
                    returnKeyType="next"
                  />
                )}
              />
            </View>
            <View style={styles.half}>
              <Controller
                control={control}
                name="etaMinutes"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextField
                    label={t('jobs.new.eta')}
                    icon="clock"
                    placeholder={t('jobs.new.etaPlaceholder')}
                    keyboardType="number-pad"
                    value={value ?? ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.etaMinutes?.message}
                    returnKeyType="next"
                  />
                )}
              />
            </View>
          </View>
          <Controller
            control={control}
            name="notes"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label={t('jobs.new.notes')}
                icon="edit-3"
                placeholder={t('jobs.new.notesPlaceholder')}
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.notes?.message}
                returnKeyType="done"
                multiline
              />
            )}
          />
          <Button title={t('jobs.edit.submit')} onPress={onSubmit} loading={submitting} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingTop: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: theme.spacing['3xl'] },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  backText: { color: theme.colors.text, fontSize: theme.font.size.md, fontWeight: theme.font.weight.medium },
  header: { gap: theme.spacing.sm },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentMuted,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  eyebrowText: {
    fontSize: 11,
    color: theme.colors.accent,
    fontWeight: theme.font.weight.semibold,
    letterSpacing: 0.4,
  },
  title: {
    fontSize: theme.font.size['3xl'],
    fontWeight: theme.font.weight.bold,
    color: theme.colors.text,
    letterSpacing: -0.6,
  },
  subtitle: { fontSize: theme.font.size.md, color: theme.colors.textMuted, lineHeight: 22 },
  form: { gap: theme.spacing.lg, marginTop: theme.spacing.md },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  notAllowed: {
    color: theme.colors.danger,
    fontSize: theme.font.size.md,
    paddingVertical: theme.spacing['2xl'],
    textAlign: 'center',
  },
});
