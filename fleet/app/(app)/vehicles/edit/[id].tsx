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
import { PhotoPicker } from '@/components/PhotoPicker';
import { useAuth } from '@/auth/AuthProvider';
import { useCan } from '@/auth/useCan';
import { getVehicle, updateVehicle } from '@/lib/vehicles';
import { destroyImage, publicIdFromUrl, uploadImage } from '@/lib/cloudinary';
import { theme } from '@/theme';

const currentYear = new Date().getFullYear();

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

export default function EditVehicleScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const toast = useToast();
  const canUpdate = useCan('vehicles.update');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [color, setColor] = useState<string | null>(null);

  // Yetki yoksa edit sayfasına hiç girilmesin — buton zaten detay
  // sayfasında guard'lı, defensive olarak burada da geri dön.
  useEffect(() => {
    if (!canUpdate.allowed && !canUpdate.loading) {
      router.back();
    }
  }, [canUpdate.allowed, canUpdate.loading, router]);
  // Status form'da düzenlenmez — operator kuralı: status sadece DB-side
  // (job lifecycle veya bakım toggle) ile değişir, manuel UI'dan değil.
  // photoUri: o anki gösterim. originalPhotoUrl: yüklerken kaydedilen DB değeri
  // (silme için Cloudinary public_id türetmek için).
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState<string | undefined>(undefined);
  const [originalPhotoUrl, setOriginalPhotoUrl] = useState<string | null>(null);

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
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { plate: '', brand: '', model: '', year: String(currentYear) },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getVehicle(id)
      .then((v) => {
        if (cancelled || !v) return;
        reset({
          plate: v.plate,
          brand: v.brand,
          model: v.model,
          year: String(v.year),
        });
        setColor(v.color);
        setPhotoUri(v.photo_url);
        setOriginalPhotoUrl(v.photo_url);
      })
      .catch((e) => {
        console.warn('[vehicle/edit] load failed', e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, reset]);

  const onSubmit = handleSubmit(async (data) => {
    if (!id) return;
    if (!profile?.organization_id) {
      toast.error(t('common.sessionMissingTitle'), t('common.sessionMissingText'));
      return;
    }
    if (!canUpdate.allowed) {
      toast.warning(
        t('common.permissionMissingTitle'),
        canUpdate.reason ?? t('common.permissionMissing'),
      );
      return;
    }
    try {
      setSubmitting(true);
      // Foto durumlari:
      //  (a) photoUri == originalPhotoUrl → degismedi, dokunma
      //  (b) photoUri null + originalPhotoUrl var → kaldirildi, eski Cloudinary asset'ini sil
      //  (c) photoUri yeni (originalPhotoUrl'den farkli) → upload et, eskisi varsa sil
      let nextPhotoUrl: string | null | undefined = undefined;
      const changed = photoUri !== originalPhotoUrl;
      if (changed) {
        if (photoUri) {
          const uploaded = await uploadImage(
            photoUri,
            `drivermesh/${profile.organization_id}/vehicles`,
            { mimeType: photoMime, tags: ['vehicle'] },
          );
          nextPhotoUrl = uploaded.secureUrl;
        } else {
          nextPhotoUrl = null;
        }
        // Eski asset'i temizle (Cloudinary'den) — best-effort, hatayi yutmazlik
        // ama ana akisi blokla.
        if (originalPhotoUrl) {
          const pid = publicIdFromUrl(originalPhotoUrl);
          if (pid) destroyImage(pid).catch((e) => console.warn('[vehicle/edit] destroy', e));
        }
      }
      await updateVehicle(id, {
        plate: data.plate,
        brand: data.brand,
        model: data.model,
        year: Number(data.year),
        color,
        ...(changed ? { photoUrl: nextPhotoUrl } : {}),
      });
      toast.success(t('vehicles.edit.successTitle'), t('vehicles.edit.successText'));
      router.back();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('vehicles.edit.errorTitle');
      toast.error(t('vehicles.edit.errorTitle'), humanize(msg, t));
    } finally {
      setSubmitting(false);
    }
  });

  // Yetki yoksa hiçbir UI render etme — useEffect router.back() çağırır.
  // (Daha önce "Yetki gerekli" sayfası flash oluyordu; artık detay
  // sayfasındaki Düzenle butonu zaten guard'lı, buraya gelinmez.)
  if (!canUpdate.allowed && !canUpdate.loading) {
    return null;
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
          <Feather name="edit-2" size={11} color={theme.colors.accent} />
          <Text style={styles.eyebrowText}>{t('vehicles.edit.eyebrow')}</Text>
        </View>
        <Text style={styles.title}>{t('vehicles.edit.title')}</Text>
        <Text style={styles.subtitle}>{t('vehicles.edit.subtitle')}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : (
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

          <Controller
            control={control}
            name="brand"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label={t('vehicles.new.brand')}
                icon="award"
                placeholder={t('vehicles.new.brandPlaceholder')}
                autoCapitalize="words"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.brand?.message}
                returnKeyType="next"
              />
            )}
          />

          <Controller
            control={control}
            name="model"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label={t('vehicles.new.model')}
                icon="layers"
                placeholder={t('vehicles.new.modelPlaceholder')}
                autoCapitalize="words"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.model?.message}
                returnKeyType="next"
              />
            )}
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
                    accessibilityLabel={colorLabel}
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

          <Button title={t('vehicles.edit.submit')} onPress={onSubmit} loading={submitting} />
        </View>
      )}
    </Screen>
  );
}

function humanize(msg: string, t: (k: string, opts?: Record<string, unknown>) => string) {
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

  form: { gap: theme.spacing.md },
  center: { alignItems: 'center', gap: 8, paddingVertical: theme.spacing['2xl'] },
  permTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.semibold,
  },
  permText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
  },

  colorWrap: { gap: 8 },
  colorLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.medium,
  },
  colorRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorHint: {
    color: theme.colors.textDim,
    fontSize: theme.font.size.xs,
    fontStyle: 'italic',
  },
});
