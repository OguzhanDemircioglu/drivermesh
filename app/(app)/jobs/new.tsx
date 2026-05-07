import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import { MapPicker } from '@/components/MapPicker';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/auth/AuthProvider';
import { createJob, listOrgDrivers } from '@/lib/jobs';
import { getHq, type Hq } from '@/lib/hq';
import { theme } from '@/theme';

type FormData = {
  customerName: string;
  distanceKm?: string;
  etaMinutes?: string;
  driverId?: string | null;
  notes?: string;
};

type Coord = { lat: number; lng: number; address: string | null };

export default function NewJobScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { profile, session } = useAuth();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

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
        driverId: z.string().nullable().optional(),
        notes: z.string().max(500, t('common.tooLong')).optional(),
      }),
    [t],
  );

  const [driverOptions, setDriverOptions] = useState<PickerOption[]>([
    {
      value: null,
      label: t('jobs.new.driverAuto'),
      hint: t('jobs.new.driverAutoHint'),
      icon: 'inbox',
    },
  ]);
  const [hq, setHq] = useState<Hq | null>(null);
  const [pickupCoord, setPickupCoord] = useState<Coord | null>(null);
  const [pickupSource, setPickupSource] = useState<'hq' | 'map' | null>(null);
  const [dropoffCoord, setDropoffCoord] = useState<Coord | null>(null);
  const [pickerKind, setPickerKind] = useState<'pickup' | 'dropoff' | null>(null);

  useEffect(() => {
    if (!profile?.organization_id) return;
    listOrgDrivers(profile.organization_id)
      .then((drivers) => {
        setDriverOptions([
          {
            value: null,
            label: t('jobs.new.driverAuto'),
            hint: t('jobs.new.driverAutoHint'),
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
    getHq(profile.organization_id).then(setHq).catch(() => setHq(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      distanceKm: '',
      etaMinutes: '',
      driverId: null,
      notes: '',
    },
    mode: 'onTouched',
  });

  const selectedDriverId = watch('driverId');

  const usePickupFromHq = () => {
    if (!hq || hq.lat == null || hq.lng == null) {
      toast.warning(t('jobs.new.hqMissingTitle'), t('jobs.new.hqMissingText'));
      return;
    }
    setPickupSource('hq');
    setPickupCoord({ lat: hq.lat, lng: hq.lng, address: hq.address ?? null });
  };

  const onSubmit = handleSubmit(async (data) => {
    if (!profile?.organization_id || !session?.user.id) {
      toast.error(t('common.sessionMissingTitle'), t('common.sessionMissingText'));
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
    try {
      setSubmitting(true);
      await createJob({
        organizationId: profile.organization_id,
        createdBy: session.user.id,
        customerName: data.customerName,
        pickupAddress: pickupCoord.address ?? `${pickupCoord.lat.toFixed(5)}, ${pickupCoord.lng.toFixed(5)}`,
        dropoffAddress: dropoffCoord.address ?? `${dropoffCoord.lat.toFixed(5)}, ${dropoffCoord.lng.toFixed(5)}`,
        pickupLat: pickupCoord.lat,
        pickupLng: pickupCoord.lng,
        dropoffLat: dropoffCoord.lat,
        dropoffLng: dropoffCoord.lng,
        distanceKm: data.distanceKm ? Number(data.distanceKm.replace(',', '.')) : null,
        etaMinutes: data.etaMinutes ? Number(data.etaMinutes) : null,
        driverId: data.driverId ?? null,
        notes: data.notes || null,
      });
      toast.success(
        t('jobs.new.successTitle'),
        data.driverId ? t('jobs.new.successAssigned') : t('jobs.new.successOpen'),
      );
      router.replace('/(app)/jobs');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('jobs.new.errorTitle');
      toast.error(t('jobs.new.errorTitle'), humanize(msg, t));
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
          <Feather name="package" size={11} color={theme.colors.accent} />
          <Text style={styles.eyebrowText}>{t('jobs.new.eyebrow')}</Text>
        </View>
        <Text style={styles.title}>{t('jobs.new.title')}</Text>
        <Text style={styles.subtitle}>{t('jobs.new.subtitle')}</Text>
      </View>

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
              label={pickupCoord.address ?? `${pickupCoord.lat.toFixed(5)}, ${pickupCoord.lng.toFixed(5)}`}
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
              label={dropoffCoord.address ?? `${dropoffCoord.lat.toFixed(5)}, ${dropoffCoord.lng.toFixed(5)}`}
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
          name="driverId"
          render={({ field: { value, onChange } }) => (
            <Picker
              label={t('jobs.new.driver')}
              icon="users"
              value={value ?? null}
              onChange={onChange}
              options={driverOptions}
              helper={
                selectedDriverId
                  ? t('jobs.new.helperAssigned')
                  : t('jobs.new.helperAuto')
              }
            />
          )}
        />

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
              onSubmitEditing={onSubmit}
              multiline
            />
          )}
        />

        <Button
          title={
            selectedDriverId ? t('jobs.new.submitAssign') : t('jobs.new.submitOpen')
          }
          onPress={onSubmit}
          loading={submitting}
          disabled={!pickupCoord || !dropoffCoord}
        />
      </View>

      <MapPicker
        visible={pickerKind !== null}
        title={
          pickerKind === 'pickup' ? t('jobs.new.pickup') : t('jobs.new.dropoff')
        }
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

function humanize(msg: string, t: (k: string) => string) {
  if (/permission|policy|row.level/i.test(msg)) return t('common.permissionDeniedShort');
  if (/network/i.test(msg)) return t('common.networkError');
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
  choiceHint: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },

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
  selectedMeta: {
    color: theme.colors.textDim,
    fontSize: 11,
    marginTop: 2,
  },
});
