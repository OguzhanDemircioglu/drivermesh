import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Picker, type PickerOption } from '@/components/Picker';
import { useAuth } from '@/auth/AuthProvider';
import { createJob, listOrgDrivers } from '@/lib/jobs';
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
  driverId: z.string().nullable().optional(),
  notes: z.string().max(500, 'Çok uzun').optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewJobScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { profile, session } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [driverOptions, setDriverOptions] = useState<PickerOption[]>([
    { value: null, label: 'Otomatik · ilk alan kazanır', hint: 'Açık iş, tüm şoförler görür', icon: 'inbox' },
  ]);

  useEffect(() => {
    if (!profile?.organization_id) return;
    listOrgDrivers(profile.organization_id)
      .then((drivers) => {
        setDriverOptions([
          {
            value: null,
            label: 'Otomatik · ilk alan kazanır',
            hint: 'Açık iş, tüm şoförler görür',
            icon: 'inbox',
          },
          ...drivers.map((d) => ({
            value: d.id,
            label: d.full_name,
            hint: d.email,
            icon: 'user' as const,
          })),
        ]);
      })
      .catch((e) => console.warn('[jobs/new] drivers fetch failed', e));
  }, [profile?.organization_id]);

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerName: '',
      pickupAddress: '',
      dropoffAddress: '',
      distanceKm: '',
      etaMinutes: '',
      driverId: null,
      notes: '',
    },
    mode: 'onTouched',
  });

  const selectedDriverId = watch('driverId');

  const onSubmit = handleSubmit(async (data) => {
    if (!profile?.organization_id || !session?.user.id) {
      Alert.alert('Hata', 'Oturum bilgisi eksik. Tekrar giriş yap.');
      return;
    }
    try {
      setSubmitting(true);
      await createJob({
        organizationId: profile.organization_id,
        createdBy: session.user.id,
        customerName: data.customerName,
        pickupAddress: data.pickupAddress,
        dropoffAddress: data.dropoffAddress,
        distanceKm: data.distanceKm ? Number(data.distanceKm.replace(',', '.')) : null,
        etaMinutes: data.etaMinutes ? Number(data.etaMinutes) : null,
        driverId: data.driverId ?? null,
        notes: data.notes || null,
      });
      Alert.alert(
        'Tamam',
        data.driverId ? 'İş şoföre atandı.' : 'İş açık olarak oluşturuldu, şoförler listede görür.',
        [{ text: 'Tamam', onPress: () => router.replace('/(app)/jobs') }],
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Kayıt başarısız';
      Alert.alert('İş oluşturulamadı', humanize(msg));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Screen scroll contentStyle={styles.scroll}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
      >
        <Feather name="arrow-left" size={22} color={theme.colors.text} />
        <Text style={styles.backText}>Geri</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={styles.eyebrow}>
          <Feather name="package" size={11} color={theme.colors.accent} />
          <Text style={styles.eyebrowText}>Yeni iş</Text>
        </View>
        <Text style={styles.title}>İşi tanımla</Text>
        <Text style={styles.subtitle}>
          Şoför seçersen direkt atanır, seçmezsen tüm şoförler listede görür ve ilk alan kazanır.
        </Text>
      </View>

      <View style={styles.form}>
        <Controller
          control={control}
          name="customerName"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              label="Müşteri / Sipariş"
              icon="briefcase"
              placeholder="Aksu Lojistik · #4821"
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
              label="Alış adresi"
              icon="map-pin"
              placeholder="Ümraniye Depo"
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
              label="Teslim adresi"
              icon="flag"
              placeholder="Ataşehir Finans Merkezi"
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
          name="driverId"
          render={({ field: { value, onChange } }) => (
            <Picker
              label="Şoför"
              icon="users"
              value={value ?? null}
              onChange={onChange}
              options={driverOptions}
              helper={
                selectedDriverId
                  ? 'Bildirim sadece atanan şoföre gider.'
                  : 'Tüm şoförlere bildirim, ilk alan kazanır.'
              }
            />
          )}
        />

        <Controller
          control={control}
          name="notes"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              label="Notlar (opsiyonel)"
              icon="edit-3"
              placeholder="Özel talimat, kapı kodu..."
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.notes?.message}
              returnKeyType="done"
              onSubmitEditing={onSubmit}
              multiline
            />
          )}
        />

        <Button
          title={selectedDriverId ? 'Şoföre ata ve aç' : 'İşi aç'}
          onPress={onSubmit}
          loading={submitting}
        />
      </View>
    </Screen>
  );
}

function humanize(msg: string) {
  if (/permission|policy|row.level/i.test(msg)) return 'Bu işlem için yetkin yok.';
  if (/network/i.test(msg)) return 'İnternet bağlantını kontrol et.';
  return msg;
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
  subtitle: {
    fontSize: theme.font.size.md,
    color: theme.colors.textMuted,
    lineHeight: 22,
  },
  form: { gap: theme.spacing.lg, marginTop: theme.spacing.md },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
});
