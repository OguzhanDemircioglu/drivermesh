import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as ImagePicker from 'expo-image-picker';
import { MeshBackground } from '@/components/MeshBackground';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { demo, isDemoActive } from '@/demo/store';
import { theme } from '@/theme';

type FormData = {
  full_name: string;
  phone?: string;
};

export default function AccountEditScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { profile, refreshProfile, session } = useAuth();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(profile?.avatar_url ?? null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [sourceModalOpen, setSourceModalOpen] = useState(false);

  const schema = useMemo(
    () =>
      z.object({
        full_name: z
          .string()
          .trim()
          .min(2, t('account.edit.errors.nameMin'))
          .max(80, t('common.tooLong')),
        phone: z.string().trim().max(32, t('common.tooLong')).optional().or(z.literal('')),
      }),
    [t],
  );

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

  const openAvatarSource = () => {
    if (avatarBusy) return;
    setSourceModalOpen(true);
  };

  const pickFromSource = async (source: 'camera' | 'gallery') => {
    setSourceModalOpen(false);
    if (!profile?.id || avatarBusy) return;
    setAvatarBusy(true);
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast.error(
          t('account.edit.avatarPickError'),
          source === 'camera'
            ? t('account.edit.avatarCameraPermission')
            : t('account.edit.avatarPermission'),
        );
        return;
      }
      const opts = {
        mediaTypes: ['images'] as const,
        allowsEditing: true,
        aspect: [1, 1] as [number, number],
        quality: 0.6,
        base64: isDemoActive(),
      };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(opts)
          : await ImagePicker.launchImageLibraryAsync(opts);
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      if (isDemoActive()) {
        // Demo: AsyncStorage'a sığacak boyutta data URI olarak gömüyoruz —
        // hiçbir network/Supabase çağrısı yok.
        if (!asset.base64) {
          toast.error(t('account.edit.avatarPickError'), t('errors.generic'));
          return;
        }
        const mime = asset.mimeType ?? 'image/jpeg';
        const dataUri = `data:${mime};base64,${asset.base64}`;
        demo.updateProfile(profile.id, { avatar_url: dataUri });
        await refreshProfile();
        setAvatarUri(dataUri);
        return;
      }

      // Real mode: Supabase Storage'a yükle. `avatars` bucket'ı backend
      // hazırlanırken eklenmeli — yoksa kullanıcıya net mesaj geri dön.
      // TODO(backend): bucket policy → her authenticated user kendi
      //   `<userId>/...` klasörüne yazabilir; herkes okuyabilir (public read).
      const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${profile.id}/avatar.${ext}`;
      const fileRes = await fetch(asset.uri);
      const blob = await fileRes.blob();
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: asset.mimeType ?? 'image/jpeg' });
      if (uploadErr) {
        const msg = uploadErr.message ?? '';
        const bucketMissing = /bucket.*not.*found|not.*exist/i.test(msg);
        toast.error(
          t('account.edit.avatarUploadError'),
          bucketMissing ? t('account.edit.avatarBackendMissing') : msg,
        );
        return;
      }
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = pub.publicUrl;
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);
      if (updateErr) throw updateErr;
      await refreshProfile();
      setAvatarUri(publicUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('errors.generic');
      toast.error(t('account.edit.avatarUploadError'), msg);
    } finally {
      setAvatarBusy(false);
    }
  };

  const onSubmit = handleSubmit(async (data) => {
    if (!profile?.id) return;
    setSubmitting(true);
    try {
      const phoneValue = data.phone && data.phone.trim() ? data.phone.trim() : null;
      if (isDemoActive()) {
        demo.updateProfile(profile.id, {
          full_name: data.full_name.trim(),
          phone: phoneValue,
        });
        await refreshProfile();
        router.back();
        return;
      }
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
          <View style={styles.avatarBlock}>
            <Pressable
              onPress={openAvatarSource}
              disabled={avatarBusy}
              style={({ pressed }) => [styles.avatarPress, pressed && { opacity: 0.85 }]}
            >
              <Avatar name={profile?.full_name ?? '—'} size={104} uri={avatarUri} />
              <View style={styles.cameraBadge}>
                {avatarBusy ? (
                  <ActivityIndicator size="small" color={theme.colors.bg} />
                ) : (
                  <Feather name="camera" size={16} color={theme.colors.bg} />
                )}
              </View>
            </Pressable>
            <Text style={styles.avatarHint}>{t('account.edit.avatarChange')}</Text>
          </View>

          <Card>
            <Text style={styles.sectionTitle}>{t('account.info')}</Text>

            <Controller
              control={control}
              name="full_name"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextField
                  label={t('account.rowName')}
                  icon="user"
                  placeholder={t('account.edit.namePlaceholder')}
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
                  placeholder={t('account.edit.phonePlaceholder')}
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

      <Modal
        visible={sourceModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSourceModalOpen(false)}
      >
        <View style={styles.sourceBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSourceModalOpen(false)}
          />
          <View style={styles.sourceSheet}>
            <Text style={styles.sourceTitle}>{t('account.edit.avatarSourceTitle')}</Text>
            <Pressable
              onPress={() => pickFromSource('camera')}
              style={({ pressed }) => [styles.sourceRow, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.sourceIcon}>
                <Feather name="camera" size={20} color={theme.colors.accent} />
              </View>
              <Text style={styles.sourceRowText}>
                {t('account.edit.avatarFromCamera')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => pickFromSource('gallery')}
              style={({ pressed }) => [styles.sourceRow, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.sourceIcon}>
                <Feather name="image" size={20} color={theme.colors.accent} />
              </View>
              <Text style={styles.sourceRowText}>
                {t('account.edit.avatarFromGallery')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSourceModalOpen(false)}
              style={({ pressed }) => [styles.sourceCancel, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.sourceCancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  avatarBlock: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  avatarPress: {
    position: 'relative',
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: theme.colors.bg,
  },
  avatarHint: {
    color: theme.colors.accent,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
  },
  sourceBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,12,24,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  sourceSheet: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.xl,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.xs,
  },
  sourceTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  sourceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentMuted,
  },
  sourceRowText: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.medium,
  },
  sourceCancel: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.xs,
  },
  sourceCancelText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
  },
});
