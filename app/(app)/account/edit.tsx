import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MeshBackground } from '@/components/MeshBackground';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme';

const schema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, 'Ad soyad en az 2 karakter olmalı')
    .max(80, 'Çok uzun'),
  phone: z
    .string()
    .trim()
    .max(32, 'Çok uzun')
    .optional()
    .or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

export default function AccountEditScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { profile, refreshProfile, session } = useAuth();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: profile?.full_name ?? '',
      phone: profile?.phone ?? '',
    },
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async (data) => {
    if (!profile?.id) return;
    setSubmitting(true);
    try {
      const phoneValue = data.phone && data.phone.trim() ? data.phone.trim() : null;
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name.trim(),
          phone: phoneValue,
        })
        .eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      router.back();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('errors.generic');
      toast.error(t('errors.generic'), msg);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <MeshBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          >
            <Feather name="arrow-left" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.title}>{t('account.editProfile')}</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Card>
            <Text style={styles.sectionTitle}>{t('account.info')}</Text>

            <Controller
              control={control}
              name="full_name"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextField
                  label={t('account.rowName')}
                  icon="user"
                  placeholder="Ahmet Yılmaz"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.full_name?.message}
                  returnKeyType="next"
                />
              )}
            />

            <Controller
              control={control}
              name="phone"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextField
                  label={t('account.rowPhone')}
                  icon="phone"
                  placeholder="+90 5xx xxx xx xx"
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.phone?.message}
                  returnKeyType="done"
                  onSubmitEditing={onSubmit}
                />
              )}
            />

            <View style={styles.readonly}>
              <Feather name="mail" size={14} color={theme.colors.textDim} />
              <Text style={styles.readonlyText} numberOfLines={1}>
                {session?.user.email}
              </Text>
              <Feather name="lock" size={12} color={theme.colors.textDim} />
            </View>
          </Card>

          <Button
            title={t('common.save')}
            onPress={onSubmit}
            loading={submitting}
            disabled={!isDirty || submitting}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.semibold,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing['3xl'],
    gap: theme.spacing.lg,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
    marginBottom: theme.spacing.md,
  },
  readonly: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
  },
  readonlyText: {
    flex: 1,
    color: theme.colors.textDim,
    fontSize: theme.font.size.sm,
  },
});
