import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { BrandModelPicker } from '@/components/BrandModelPicker';
import { useToast } from '@/components/Toast';
import { PhotoPicker } from '@/components/PhotoPicker';
import { useAuth } from '@/auth/AuthProvider';
import { createVehicle } from '@/lib/vehicles';
import { uploadImage } from '@/lib/cloudinary';
import { theme } from '@/theme';

const currentYear = new Date().getFullYear();

// Hex palette is constant; user-facing labels come from i18n via key lookup.
const COLOR_PALETTE: Array<{ key: 'white' | 'black' | 'silver' | 'red' | 'orange' | 'yellow' | 'green' | 'blue'; hex: string }> = [
  { key: 'white', hex: '#F8FAFC' },
  { key: 'black', hex: '#1F2937' },
  { key: 'silver', hex: '#94A3B8' },
  { key: 'red', hex: '#EF4444' },
  { key: 'orange', hex: '#FF7A1A' },
  { key: 'yellow', hex: '#F59E0B' },
  { key: 'green', hex: '#22C55E' },
  { key: 'blue', hex: '#3D5DDB' },
];

type FormData = {
  plate: string;
  brand: string;
  model: string;
  year: string;
};

export default function NewVehicleScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { profile, session } = useAuth();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [color, setColor] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState<string | undefined>(undefined);

  const schema = useMemo(
    () =>
      z.object({
        plate: z
          .string()
          .min(4, t('vehicles.new.errors.plateShort'))
          .max(15, t('vehicles.new.errors.plateLong'))
          .regex(/^[0-9A-Za-z\s]+$/, t('vehicles.new.errors.plateChars')),
        brand: z
          .string()
          .min(2, t('vehicles.new.errors.brandRequired'))
          .max(40, t('common.tooLong')),
        model: z
          .string()
          .min(1, t('vehicles.new.errors.modelRequired'))
          .max(40, t('common.tooLong')),
        year: z
          .string()
          .regex(/^\d{4}$/, t('vehicles.new.errors.yearFormat'))
          .refine((v) => {
            const n = Number(v);
            return n >= 1990 && n <= currentYear + 1;
          }, t('vehicles.new.errors.yearRange', { min: 1990, max: currentYear + 1 })),
      }),
    [t],
  );

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { plate: '', brand: '', model: '', year: String(currentYear) },
    mode: 'onTouched',
  });

  const brand = useWatch({ control, name: 'brand' });
  const model = useWatch({ control, name: 'model' });

  const onSubmit = handleSubmit(async (data) => {
    if (!profile?.organization_id || !session?.user.id) {
      toast.error(t('common.sessionMissingTitle'), t('common.sessionMissingText'));
      return;
    }
    try {
      setSubmitting(true);
      // Foto seçildiyse önce Cloudinary'ye yükle. Hata olursa toast gösterip
      // çık — vehicle yaratılmasın yarım veriyle.
      let photoUrl: string | null = null;
      if (photoUri) {
        const uploaded = await uploadImage(
          photoUri,
          `drivermesh/${profile.organization_id}/vehicles`,
          { mimeType: photoMime, tags: ['vehicle'] },
        );
        photoUrl = uploaded.secureUrl;
      }
      await createVehicle({
        organizationId: profile.organization_id,
        addedBy: session.user.id,
        plate: data.plate,
        brand: data.brand,
        model: data.model,
        year: Number(data.year),
        color,
        photoUrl,
      });
      toast.success(t('vehicles.new.successTitle'), t('vehicles.new.successText'));
      router.replace('/(app)/vehicles');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('vehicles.new.errorTitle');
      toast.error(t('vehicles.new.errorTitle'), humanize(msg, t));
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
          <Feather name="truck" size={11} color={theme.colors.accent} />
          <Text style={styles.eyebrowText}>{t('vehicles.new.eyebrow')}</Text>
        </View>
        <Text style={styles.title}>{t('vehicles.new.title')}</Text>
        <Text style={styles.subtitle}>{t('vehicles.new.subtitle')}</Text>
      </View>

      <View style={styles.form}>
        <PhotoPicker
          uri={photoUri}
          onPick={(uri, mime) => {
            setPhotoUri(uri);
            setPhotoMime(mime);
          }}
          onRemove={() => {
            setPhotoUri(null);
            setPhotoMime(undefined);
          }}
          aspect={[16, 10]}
          placeholderIcon="truck"
          disabled={submitting}
        />

        <Controller
          control={control}
          name="plate"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              label={t('vehicles.new.plate')}
              icon="hash"
              placeholder={t('vehicles.new.platePlaceholder')}
              autoCapitalize="characters"
              autoCorrect={false}
              value={value}
              onChangeText={(v) => onChange(v.toUpperCase())}
              onBlur={onBlur}
              error={errors.plate?.message}
              returnKeyType="next"
            />
          )}
        />

        <BrandModelPicker
          brand={brand}
          model={model}
          onBrandChange={(v) => setValue('brand', v, { shouldValidate: !!v, shouldTouch: !!v })}
          onModelChange={(v) => setValue('model', v, { shouldValidate: !!v, shouldTouch: !!v })}
          brandError={errors.brand?.message}
          modelError={errors.model?.message}
        />

        <Controller
          control={control}
          name="year"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              label={t('vehicles.new.year')}
              icon="calendar"
              placeholder={String(currentYear)}
              keyboardType="number-pad"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.year?.message}
              maxLength={4}
              returnKeyType="done"
              onSubmitEditing={onSubmit}
            />
          )}
        />

        {/* Colour swatches — stored on the vehicle row so the marker on the
            fleet map matches the real vehicle. Optional: leaving it blank
            falls back to the plate-derived gradient. */}
        <View style={styles.colorWrap}>
          <Text style={styles.colorLabel}>{t('vehicles.new.colorLabel')}</Text>
          <View style={styles.colorRow}>
            {COLOR_PALETTE.map((c) => {
              const active = color === c.hex;
              const colorLabel = t(`vehicles.new.colors.${c.key}`);
              return (
                <Pressable
                  key={c.key}
                  onPress={() => setColor(active ? null : c.hex)}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.colorSwatch,
                    {
                      backgroundColor: c.hex,
                      borderColor: active
                        ? theme.colors.text
                        : 'rgba(255,255,255,0.18)',
                      borderWidth: active ? 3 : 1.5,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={colorLabel}
                  accessibilityState={{ selected: active }}
                >
                  {active ? (
                    <Feather
                      name="check"
                      size={14}
                      color={c.key === 'white' || c.key === 'yellow' ? '#0A0E1F' : '#FFFFFF'}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.colorHint}>
            {color
              ? t('vehicles.new.colorPickedHint', {
                  label: t(
                    `vehicles.new.colors.${COLOR_PALETTE.find((c) => c.hex === color)?.key ?? 'white'}`,
                  ),
                })
              : t('vehicles.new.colorEmptyHint')}
          </Text>
        </View>

        <Button title={t('vehicles.new.submit')} onPress={onSubmit} loading={submitting} />
      </View>
    </Screen>
  );
}

function humanize(msg: string, t: (k: string, opts?: Record<string, unknown>) => string) {
  if (/vehicle_limit_reached/i.test(msg)) return t('vehicles.new.errors.limitReached');
  if (/duplicate|unique|already exists|vehicles_organization_id_plate_key/i.test(msg))
    return t('vehicles.new.errors.duplicate');
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

  colorWrap: { gap: 8 },
  colorLabel: {
    color: theme.colors.text,
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingVertical: 4,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorHint: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.xs,
    lineHeight: 18,
  },
});
