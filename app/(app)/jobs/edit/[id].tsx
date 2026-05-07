import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { MapPicker } from '@/components/MapPicker';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/auth/AuthProvider';
import { useCan } from '@/auth/useCan';
import { getJob, updateJob } from '@/lib/jobs';
import { getHq, type Hq } from '@/lib/hq';
import { theme } from '@/theme';

type FormData = {
  customerName: string;
  distanceKm?: string;
  etaMinutes?: string;
  notes?: string;
};
type Coord = { lat: number; lng: number; address: string | null };

export default function EditJobScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const toast = useToast();
  const canEdit = useCan('jobs.update_any');
  const isStaff = profile?.role === 'owner' || profile?.role === 'manager';
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hq, setHq] = useState<Hq | null>(null);
  const [pickupCoord, setPickupCoord] = useState<Coord | null>(null);
  const [pickupSource, setPickupSource] = useState<'hq' | 'map' | null>(null);
  const [dropoffCoord, setDropoffCoord] = useState<Coord | null>(null);
  const [pickerKind, setPickerKind] = useState<'pickup' | 'dropoff' | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        customerName: z
          .string()
          .min(2, t('jobs.new.errors.customerRequired'))
          .max(80, t('common.tooLong')),
        distanceKm: z
          .string()
          .optional()
          .refine((v) => !v || /^\d+([.,]\d+)?$/.test(v), t('jobs.new.errors.numeric')),
        etaMinutes: z
          .string()
          .optional()
          .refine((v) => !v || /^\d+$/.test(v), t('jobs.new.errors.integer')),
        notes: z.string().max(500, t('common.tooLong')).optional(),
      }),
    [t],
  );

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerName: '',
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
          distanceKm: j.distance_km != null ? String(j.distance_km) : '',
          etaMinutes: j.eta_minutes != null ? String(j.eta_minutes) : '',
          notes: j.notes ?? '',
        });
        if (j.pickup_lat != null && j.pickup_lng != null) {
          setPickupCoord({
            lat: j.pickup_lat,
            lng: j.pickup_lng,
            address: j.pickup_address ?? null,
          });
        }
        if (j.dropoff_lat != null && j.dropoff_lng != null) {
          setDropoffCoord({
            lat: j.dropoff_lat,
            lng: j.dropoff_lng,
            address: j.dropoff_address ?? null,
          });
        }
      })
      .catch((e) => console.warn('[edit-job] load failed', e))
      .finally(() => setLoading(false));
    if (profile?.organization_id) {
      getHq(profile.organization_id).then(setHq).catch(() => setHq(null));
    }
  }, [id, reset, profile?.organization_id]);

  const usePickupFromHq = () => {
    if (!hq || hq.lat == null || hq.lng == null) {
      toast.warning(t('jobs.new.hqMissingTitle'), t('jobs.new.hqMissingText'));
      return;
    }
    setPickupSource('hq');
    setPickupCoord({ lat: hq.lat, lng: hq.lng, address: hq.address ?? null });
  };

  const onSubmit = handleSubmit(async (data) => {
    if (!id) return;
    if (!canEdit.allowed) {
      toast.warning(
        t('common.permissionMissingTitle'),
        canEdit.reason ?? t('common.permissionMissing'),
      );
      return;
    }
    if (!pickupCoord) {
      toast.warning(t('jobs.new.pickupMissingTitle'), t('jobs.new.pickupMissingText'));
      return;
    }
    if (!dropoffCoord) {
      toast.warning(t('jobs.new.dropoffMissingTitle'), t('jobs.new.dropoffMissingText'));
      return;
    }
    setSubmitting(true);
    try {
      await updateJob(id, {
        customer_name: data.customerName,
        pickup_address:
          pickupCoord.address ?? `${pickupCoord.lat.toFixed(5)}, ${pickupCoord.lng.toFixed(5)}`,
        pickup_lat: pickupCoord.lat,
        pickup_lng: pickupCoord.lng,
        dropoff_address:
          dropoffCoord.address ?? `${dropoffCoord.lat.toFixed(5)}, ${dropoffCoord.lng.toFixed(5)}`,
        dropoff_lat: dropoffCoord.lat,
        dropoff_lng: dropoffCoord.lng,
        distance_km: data.distanceKm ? Number(data.distanceKm.replace(',', '.')) : null,
        eta_minutes: data.etaMinutes ? Number(data.etaMinutes) : null,
        notes: data.notes || null,
      });
      toast.success(t('jobs.edit.successTitle'), t('jobs.edit.successText'));
      router.back();
    } catch (e) {
      toast.error(t('jobs.edit.errorTitle'), (e as Error).message);
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

          {/* Pickup */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('jobs.new.pickup')}</Text>
            <View style={styles.choiceRow}>
              <ChoiceButton
                icon="briefcase"
                label={t('jobs.new.pickupHq')}
                hint={hq?.address ?? t('jobs.new.pickupHqEmpty')}
                active={pickupSource === 'hq'}
                disabled={!hq?.lat}
                onPress={usePickupFromHq}
              />
              <ChoiceButton
                icon="map"
                label={t('jobs.new.pickupMap')}
                active={pickupSource === 'map'}
                onPress={() => setPickerKind('pickup')}
              />
            </View>
            {pickupCoord ? (
              <SelectedRow
                icon="map-pin"
                label={
                  pickupCoord.address ??
                  `${pickupCoord.lat.toFixed(5)}, ${pickupCoord.lng.toFixed(5)}`
                }
                meta={`${pickupCoord.lat.toFixed(5)}, ${pickupCoord.lng.toFixed(5)}`}
              />
            ) : null}
          </View>

          {/* Dropoff */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('jobs.new.dropoff')}</Text>
            <Pressable
              onPress={() => setPickerKind('dropoff')}
              style={({ pressed }) => [styles.dropoffBtn, pressed && { opacity: 0.7 }]}
            >
              <Feather name="map" size={16} color={theme.colors.accent} />
              <Text style={styles.dropoffBtnText}>{t('jobs.new.pickupMap')}</Text>
            </Pressable>
            {dropoffCoord ? (
              <SelectedRow
                icon="flag"
                label={
                  dropoffCoord.address ??
                  `${dropoffCoord.lat.toFixed(5)}, ${dropoffCoord.lng.toFixed(5)}`
                }
                meta={`${dropoffCoord.lat.toFixed(5)}, ${dropoffCoord.lng.toFixed(5)}`}
              />
            ) : null}
          </View>

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
          <Button
            title={t('jobs.edit.submit')}
            onPress={onSubmit}
            loading={submitting}
            disabled={!pickupCoord || !dropoffCoord}
          />
        </View>
      )}

      <MapPicker
        visible={pickerKind !== null}
        title={pickerKind === 'pickup' ? t('jobs.new.pickup') : t('jobs.new.dropoff')}
        initial={
          pickerKind === 'pickup'
            ? pickupCoord
              ? { lat: pickupCoord.lat, lng: pickupCoord.lng, address: pickupCoord.address }
              : null
            : dropoffCoord
              ? { lat: dropoffCoord.lat, lng: dropoffCoord.lng, address: dropoffCoord.address }
              : null
        }
        onClose={() => setPickerKind(null)}
        onConfirm={(r) => {
          if (pickerKind === 'pickup') {
            setPickupSource('map');
            setPickupCoord({ lat: r.lat, lng: r.lng, address: r.address });
          } else if (pickerKind === 'dropoff') {
            setDropoffCoord({ lat: r.lat, lng: r.lng, address: r.address });
          }
          setPickerKind(null);
        }}
      />
    </Screen>
  );
}

function ChoiceButton({
  icon,
  label,
  hint,
  active,
  disabled,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  hint?: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.choiceBtn,
        active && styles.choiceBtnActive,
        disabled && { opacity: 0.45 },
        pressed && !disabled && { opacity: 0.7 },
      ]}
    >
      <Feather
        name={icon}
        size={16}
        color={active ? theme.colors.accent : theme.colors.text}
      />
      <View style={{ flex: 1 }}>
        <Text style={[styles.choiceLabel, active && { color: theme.colors.accent }]}>{label}</Text>
        {hint ? (
          <Text style={styles.choiceHint} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function SelectedRow({
  icon,
  label,
  meta,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  meta: string;
}) {
  return (
    <View style={styles.selectedRow}>
      <Feather name={icon} size={14} color={theme.colors.accent} />
      <View style={{ flex: 1 }}>
        <Text style={styles.selectedLabel} numberOfLines={2}>
          {label}
        </Text>
        <Text style={styles.selectedMeta}>{meta}</Text>
      </View>
    </View>
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

  fieldGroup: { gap: 8 },
  fieldLabel: {
    color: theme.colors.text,
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choiceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  choiceBtnActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentMuted,
  },
  choiceLabel: {
    color: theme.colors.text,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
  },
  choiceHint: { color: theme.colors.textMuted, fontSize: 11, marginTop: 1 },

  dropoffBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  dropoffBtnText: {
    color: theme.colors.text,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
  },

  selectedRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(255,122,26,0.25)',
    alignItems: 'flex-start',
  },
  selectedLabel: {
    color: theme.colors.text,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
  },
  selectedMeta: { color: theme.colors.textDim, fontSize: 11, marginTop: 2 },

  notAllowed: {
    color: theme.colors.danger,
    fontSize: theme.font.size.md,
    paddingVertical: theme.spacing['2xl'],
    textAlign: 'center',
  },
});
