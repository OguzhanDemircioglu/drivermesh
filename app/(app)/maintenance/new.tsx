import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { MultiPhotoPicker, type MultiPhotoItem } from '@/components/MultiPhotoPicker';
import { useAuth } from '@/auth/AuthProvider';
import { getVehicle } from '@/lib/vehicles';
import { createMaintenanceRequest, MaintenanceError } from '@/lib/maintenance';
import { uploadImage } from '@/lib/cloudinary';
import { checkPermission } from '@/lib/permissions';
import type { Vehicle } from '@/lib/database.types';
import { theme } from '@/theme';

type FormData = {
  reason: string;
  estimatedMinutes?: string;
};

export default function NewMaintenanceRequestScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const { profile, session } = useAuth();
  const toast = useToast();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [photos, setPhotos] = useState<MultiPhotoItem[]>([]);
  const [autoApprove, setAutoApprove] = useState(false);

  const schema = useMemo(
    () =>
      z.object({
        reason: z
          .string()
          .min(3, t('maintenance.new.errors.reasonRequired'))
          .max(500, t('common.tooLong')),
        estimatedMinutes: z
          .string()
          .optional()
          .refine((v) => !v || /^\d+$/.test(v), t('maintenance.new.errors.minutesNumeric')),
      }),
    [t],
  );

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { reason: '', estimatedMinutes: '' },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (!vehicleId) return;
    let cancelled = false;
    Promise.all([
      getVehicle(vehicleId),
      session?.user.id
        ? checkPermission(session.user.id, 'vehicles.approve_maintenance')
        : Promise.resolve(false),
    ])
      .then(([v, canApprove]) => {
        if (cancelled) return;
        setVehicle(v);
        setAutoApprove(canApprove);
      })
      .catch((e) => console.warn('[maintenance/new] load', e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId, session?.user.id]);

  const onSubmit = handleSubmit(async (data) => {
    if (!vehicleId || !vehicle) return;
    if (!profile?.organization_id || !session?.user.id) {
      toast.error(t('common.sessionMissingTitle'), t('common.sessionMissingText'));
      return;
    }
    try {
      setSubmitting(true);
      // Foto'lari Cloudinary'a yükle (paralel).
      const uploaded: string[] = [];
      if (photos.length > 0) {
        const folder = `drivermesh/${profile.organization_id}/maintenance`;
        const results = await Promise.all(
          photos.map((p) =>
            uploadImage(p.uri, folder, { mimeType: p.mime, tags: ['maintenance'] }),
          ),
        );
        for (const r of results) uploaded.push(r.secureUrl);
      }
      const minutes = data.estimatedMinutes ? Number(data.estimatedMinutes) : null;
      await createMaintenanceRequest({
        organizationId: profile.organization_id,
        vehicleId,
        requesterId: session.user.id,
        reason: data.reason,
        photoUrls: uploaded,
        estimatedMinutes: minutes,
      });
      toast.success(
        autoApprove ? t('maintenance.new.successApprovedTitle') : t('maintenance.new.successPendingTitle'),
        autoApprove ? t('maintenance.new.successApprovedText') : t('maintenance.new.successPendingText'),
      );
      router.back();
    } catch (e: unknown) {
      if (e instanceof MaintenanceError) {
        if (e.code === 'active_job') {
          toast.error(t('maintenance.new.errorTitle'), t('maintenance.new.errorActiveJob'));
        } else if (e.code === 'reason_required') {
          toast.error(t('maintenance.new.errorTitle'), t('maintenance.new.errors.reasonRequired'));
        } else {
          toast.error(t('maintenance.new.errorTitle'), e.message);
        }
        return;
      }
      const msg = e instanceof Error ? e.message : t('maintenance.new.errorTitle');
      toast.error(t('maintenance.new.errorTitle'), msg);
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
        <Text style={styles.backText}>{t('common.back')}</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={styles.eyebrow}>
          <Feather name="tool" size={11} color={theme.colors.accent} />
          <Text style={styles.eyebrowText}>{t('maintenance.new.eyebrow')}</Text>
        </View>
        <Text style={styles.title}>{t('maintenance.new.title')}</Text>
        <Text style={styles.subtitle}>
          {autoApprove ? t('maintenance.new.subtitleAuto') : t('maintenance.new.subtitlePending')}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : !vehicle ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={28} color={theme.colors.warning} />
          <Text style={styles.permTitle}>{t('errors.notFound')}</Text>
        </View>
      ) : (
        <View style={styles.form}>
          <View style={styles.vehicleCard}>
            <Feather name="truck" size={20} color={theme.colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.vehiclePlate}>{vehicle.plate}</Text>
              <Text style={styles.vehicleSpec}>
                {vehicle.brand} {vehicle.model} · {vehicle.year}
              </Text>
            </View>
          </View>

          <Controller
            control={control}
            name="reason"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label={t('maintenance.new.reasonLabel')}
                icon="file-text"
                placeholder={t('maintenance.new.reasonPlaceholder')}
                multiline
                numberOfLines={4}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.reason?.message}
                returnKeyType="default"
              />
            )}
          />

          <View style={styles.photosWrap}>
            <Text style={styles.fieldLabel}>{t('maintenance.new.photosLabel')}</Text>
            <Text style={styles.fieldHint}>{t('maintenance.new.photosHint')}</Text>
            <MultiPhotoPicker
              items={photos}
              onAdd={(item) => setPhotos((p) => [...p, item])}
              onRemove={(idx) => setPhotos((p) => p.filter((_, i) => i !== idx))}
              max={5}
              disabled={submitting}
            />
          </View>

          <Controller
            control={control}
            name="estimatedMinutes"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label={t('maintenance.new.estimatedLabel')}
                icon="clock"
                placeholder={t('maintenance.new.estimatedPlaceholder')}
                keyboardType="number-pad"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.estimatedMinutes?.message}
                returnKeyType="done"
              />
            )}
          />

          <Button
            title={autoApprove ? t('maintenance.new.submitAuto') : t('maintenance.new.submitPending')}
            onPress={onSubmit}
            loading={submitting}
            leftIcon={<Feather name="tool" size={16} color="#0A0E1F" />}
          />
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
    backgroundColor: theme.colors.accentMuted,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  eyebrowText: {
    color: theme.colors.accent,
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.bold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.font.size['2xl'],
    fontWeight: theme.font.weight.bold,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    lineHeight: 20,
  },

  form: { gap: theme.spacing.lg },

  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  vehiclePlate: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.bold,
    letterSpacing: 0.5,
  },
  vehicleSpec: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
  },

  photosWrap: { gap: 6 },
  fieldLabel: {
    color: theme.colors.text,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
  },
  fieldHint: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.xs,
    marginBottom: 2,
  },

  center: { alignItems: 'center', gap: 8, paddingVertical: theme.spacing['2xl'] },
  permTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.semibold,
  },
});
