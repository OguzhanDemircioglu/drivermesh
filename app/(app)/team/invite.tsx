import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Feather } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Card } from '@/components/Card';
import { useAuth } from '@/auth/AuthProvider';
import { createInvitation, shortCode } from '@/lib/invitations';
import type { UserRole } from '@/lib/database.types';
import { theme } from '@/theme';

const schema = z.object({
  fullName: z.string().min(2, 'Ad soyad en az 2 karakter olmalı').max(60, 'Çok uzun'),
  email: z.string().min(1, 'E-posta gerekli').email('Geçerli bir e-posta gir'),
});

type FormData = z.infer<typeof schema>;

type InviteResult = {
  code: string;
  email: string;
  fullName: string;
  role: Extract<UserRole, 'manager' | 'driver'>;
};

export default function InviteScreen() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const params = useLocalSearchParams<{ role?: string }>();
  const role: Extract<UserRole, 'manager' | 'driver'> = useMemo(() => {
    return params.role === 'driver' ? 'driver' : 'manager';
  }, [params.role]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '', email: '' },
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async (data) => {
    if (!profile?.organization_id || !session?.user.id) {
      Alert.alert('Hata', 'Oturum bilgisi eksik. Tekrar giriş yap.');
      return;
    }
    try {
      setSubmitting(true);
      const inv = await createInvitation({
        organizationId: profile.organization_id,
        invitedBy: session.user.id,
        email: data.email,
        fullName: data.fullName,
        role,
      });
      setResult({
        code: shortCode(inv.token),
        email: inv.email,
        fullName: inv.full_name,
        role,
      });
      reset();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Davet oluşturulamadı';
      Alert.alert('Davet hatası', msg);
    } finally {
      setSubmitting(false);
    }
  });

  const onShare = async (r: InviteResult) => {
    try {
      await Share.share({
        message: `DriverMesh davet kodun: ${r.code}\n\nUygulamayı indir → "Davet kodum var" ile giriş yap.`,
      });
    } catch {}
  };

  if (result) {
    return (
      <Screen scroll contentStyle={styles.scroll}>
        <Pressable
          onPress={() => router.replace('/(app)/team')}
          hitSlop={12}
          style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
        >
          <Feather name="arrow-left" size={22} color={theme.colors.text} />
          <Text style={styles.backText}>Ekibim</Text>
        </Pressable>

        <View style={styles.successHeader}>
          <View style={styles.checkCircle}>
            <Feather name="check" size={28} color="#0A0E1F" />
          </View>
          <Text style={styles.title}>Davet hazır</Text>
          <Text style={styles.subtitle}>
            {result.fullName} adına {result.role === 'manager' ? 'yönetici' : 'şoför'}{' '}
            daveti oluşturdun.
          </Text>
        </View>

        <Card style={styles.codeCard}>
          <Text style={styles.codeLabel}>Davet kodu</Text>
          <Text selectable style={styles.codeValue}>
            {result.code}
          </Text>
          <Text style={styles.codeHint}>
            Bu kodu {result.email} adresine sahip kişiye ilet. 7 gün içinde kullanmazsa
            süresi dolar.
          </Text>
        </Card>

        <View style={styles.actions}>
          <Button
            title="Paylaş"
            leftIcon={<Feather name="share-2" size={18} color="#0A0E1F" />}
            onPress={() => onShare(result)}
          />
          <Button
            title="Yeni davet"
            variant="secondary"
            onPress={() => setResult(null)}
          />
          <Button title="Ekibe dön" variant="ghost" onPress={() => router.replace('/(app)/team')} />
        </View>
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
        <Text style={styles.backText}>Geri</Text>
      </Pressable>

      <View style={styles.header}>
        <View
          style={[
            styles.eyebrow,
            {
              backgroundColor:
                role === 'manager' ? 'rgba(184,154,240,0.16)' : theme.colors.meshMuted,
            },
          ]}
        >
          <Feather
            name={role === 'manager' ? 'briefcase' : 'truck'}
            size={11}
            color={role === 'manager' ? theme.colors.lavender : theme.colors.mesh}
          />
          <Text
            style={[
              styles.eyebrowText,
              { color: role === 'manager' ? theme.colors.lavender : theme.colors.mesh },
            ]}
          >
            {role === 'manager' ? 'Yönetici daveti' : 'Şoför daveti'}
          </Text>
        </View>
        <Text style={styles.title}>
          {role === 'manager' ? 'Yönetici ekle' : 'Şoför ekle'}
        </Text>
        <Text style={styles.subtitle}>
          Davet ettiğin kişiye 6 haneli bir kod oluşturulur. Bu kodla{'\n'}
          uygulamada hesabını kurar.
        </Text>
      </View>

      <View style={styles.form}>
        <Controller
          control={control}
          name="fullName"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              label="Ad Soyad"
              icon="user"
              placeholder={role === 'manager' ? 'Selim Karakaya' : 'Mehmet Yılmaz'}
              autoCapitalize="words"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.fullName?.message}
              returnKeyType="next"
            />
          )}
        />

        <Controller
          control={control}
          name="email"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              label="E-posta"
              icon="mail"
              placeholder="kisi@firma.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.email?.message}
              returnKeyType="done"
              onSubmitEditing={onSubmit}
            />
          )}
        />

        <Button title="Davet oluştur" onPress={onSubmit} loading={submitting} />
      </View>
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
    alignSelf: 'flex-start',
  },
  eyebrowText: {
    fontSize: 11,
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

  successHeader: { alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.xl },
  checkCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  codeCard: { alignItems: 'center', gap: 10, paddingVertical: theme.spacing['2xl'] },
  codeLabel: {
    color: theme.colors.accent,
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  codeValue: {
    color: theme.colors.text,
    fontSize: 44,
    fontWeight: theme.font.weight.black,
    letterSpacing: 8,
    fontVariant: ['tabular-nums'],
  },
  codeHint: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
    lineHeight: 20,
  },
  actions: { gap: 10, marginTop: theme.spacing.md },
});
