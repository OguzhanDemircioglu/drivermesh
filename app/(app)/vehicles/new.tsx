import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Feather } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/auth/AuthProvider';
import { createVehicle } from '@/lib/vehicles';
import { theme } from '@/theme';

const currentYear = new Date().getFullYear();

const schema = z.object({
  plate: z
    .string()
    .min(4, 'Plaka çok kısa')
    .max(15, 'Plaka çok uzun')
    .regex(/^[0-9A-Za-z\s]+$/, 'Sadece harf ve rakam'),
  brand: z.string().min(2, 'Marka gerekli').max(40, 'Çok uzun'),
  model: z.string().min(1, 'Model gerekli').max(40, 'Çok uzun'),
  year: z
    .string()
    .regex(/^\d{4}$/, '4 haneli yıl gir')
    .refine((v) => {
      const n = Number(v);
      return n >= 1990 && n <= currentYear + 1;
    }, `Yıl 1990-${currentYear + 1} aralığında olmalı`),
});

type FormData = z.infer<typeof schema>;

export default function NewVehicleScreen() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { plate: '', brand: '', model: '', year: String(currentYear) },
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async (data) => {
    if (!profile?.organization_id || !session?.user.id) {
      Alert.alert('Hata', 'Oturum bilgisi eksik. Tekrar giriş yap.');
      return;
    }
    try {
      setSubmitting(true);
      await createVehicle({
        organizationId: profile.organization_id,
        addedBy: session.user.id,
        plate: data.plate,
        brand: data.brand,
        model: data.model,
        year: Number(data.year),
      });
      Alert.alert('Tamam', 'Araç filoya eklendi.', [
        { text: 'Tamam', onPress: () => router.replace('/(app)/vehicles') },
      ]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Kayıt başarısız';
      Alert.alert('Araç eklenemedi', humanize(msg));
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
          <Feather name="truck" size={11} color={theme.colors.accent} />
          <Text style={styles.eyebrowText}>Yeni araç</Text>
        </View>
        <Text style={styles.title}>Aracı tanımla</Text>
        <Text style={styles.subtitle}>
          Plaka, marka ve model. Fotoğraf adımı sonraki sürümde gelecek.
        </Text>
      </View>

      <View style={styles.form}>
        <Controller
          control={control}
          name="plate"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              label="Plaka"
              icon="hash"
              placeholder="34 ABC 123"
              autoCapitalize="characters"
              autoCorrect={false}
              value={value}
              onChangeText={(t) => onChange(t.toUpperCase())}
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
              label="Marka"
              icon="award"
              placeholder="Ford"
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
              label="Model"
              icon="layers"
              placeholder="Transit"
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
              label="Model yılı"
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

        <Button title="Aracı ekle" onPress={onSubmit} loading={submitting} />
      </View>
    </Screen>
  );
}

function humanize(msg: string) {
  if (/duplicate|unique|already exists|vehicles_organization_id_plate_key/i.test(msg))
    return 'Bu plaka filonda zaten kayıtlı.';
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
});
