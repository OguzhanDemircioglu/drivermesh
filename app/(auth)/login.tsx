import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/auth/AuthProvider';
import { theme } from '@/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);

  const schema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .min(1, t('auth.login.errors.emailRequired'))
          .email(t('auth.login.errors.emailInvalid')),
        password: z.string().min(6, t('auth.login.errors.passwordMin')),
      }),
    [t],
  );

  type FormData = z.infer<typeof schema>;

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async (data) => {
    try {
      setSubmitting(true);
      await signIn(data.email.trim().toLowerCase(), data.password);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('auth.login.errors.loginFailed');
      Alert.alert(t('auth.login.errors.loginFailed'), humanize(msg, t));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Screen scroll contentStyle={styles.scroll}>
      <View style={styles.header}>
        <Logo size={84} />
        <Text style={styles.brand}>
          Driver<Text style={styles.brandAccent}>Mesh</Text>
        </Text>
        <Text style={styles.subtitle}>{t('auth.login.subtitle')}</Text>
      </View>

      <View style={styles.form}>
        <Controller
          control={control}
          name="email"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              label={t('auth.login.email')}
              icon="mail"
              placeholder={t('auth.login.emailPlaceholder')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              textContentType="emailAddress"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.email?.message}
              returnKeyType="next"
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              label={t('auth.login.password')}
              icon="lock"
              placeholder={t('auth.login.passwordPlaceholder')}
              isPassword
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.password?.message}
              returnKeyType="done"
              onSubmitEditing={onSubmit}
            />
          )}
        />

        <Pressable
          hitSlop={8}
          onPress={() => Alert.alert(t('auth.login.forgotTitle'), t('auth.login.forgotSoon'))}
          style={({ pressed }) => [styles.forgot, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.forgotText}>{t('auth.login.forgot')}</Text>
        </Pressable>

        <Button title={t('auth.login.submit')} onPress={onSubmit} loading={submitting} />
      </View>

      <View style={styles.footer}>
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('auth.login.divider')}</Text>
          <View style={styles.dividerLine} />
        </View>
        <Button
          title={t('auth.login.startFleet')}
          variant="secondary"
          leftIcon={<FleetIcon />}
          onPress={() => router.push('/(auth)/register')}
        />
        <Pressable
          onPress={() => router.push('/(auth)/redeem')}
          hitSlop={8}
          style={({ pressed }) => [styles.inviteRow, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.invite}>{t('auth.login.invitePrompt')}</Text>
          <Text style={styles.inviteLink}>{t('auth.login.inviteLink')}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function FleetIcon() {
  return null; // gradient stroke icon eklenecek; şu an metin yeterli
}

function humanize(msg: string, t: (key: string) => string) {
  if (/invalid login credentials/i.test(msg)) return t('auth.login.errors.invalid');
  if (/email not confirmed/i.test(msg)) return t('auth.login.errors.emailNotConfirmed');
  if (/network/i.test(msg)) return t('errors.network');
  return msg;
}

const styles = StyleSheet.create({
  scroll: { paddingTop: theme.spacing.xl, gap: theme.spacing.xl },
  header: { alignItems: 'center', gap: theme.spacing.md, marginTop: theme.spacing.lg },
  brand: {
    fontSize: theme.font.size['3xl'],
    fontWeight: theme.font.weight.bold,
    color: theme.colors.text,
    letterSpacing: -0.6,
  },
  brandAccent: { color: theme.colors.lavender },
  subtitle: {
    fontSize: theme.font.size.md,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  form: { gap: theme.spacing.lg, marginTop: theme.spacing.xl },
  forgot: { alignSelf: 'flex-end', marginTop: -8 },
  forgotText: {
    color: theme.colors.mesh,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.medium,
  },
  footer: { gap: theme.spacing.lg, marginTop: theme.spacing.xl },
  divider: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  dividerText: {
    color: theme.colors.textDim,
    fontSize: theme.font.size.xs,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  inviteRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -theme.spacing.sm,
  },
  invite: {
    color: theme.colors.textDim,
    fontSize: theme.font.size.xs,
  },
  inviteLink: {
    color: theme.colors.lavender,
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
  },
});
