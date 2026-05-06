import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation, Trans } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/auth/AuthProvider';
import { theme } from '@/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUpFleet } = useAuth();
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);

  const schema = useMemo(
    () =>
      z
        .object({
          companyName: z
            .string()
            .min(2, t('auth.register.errors.companyMin'))
            .max(80, t('auth.register.errors.companyMax')),
          fullName: z
            .string()
            .min(2, t('auth.register.errors.nameMin'))
            .max(60, t('auth.register.errors.companyMax')),
          email: z
            .string()
            .min(1, t('auth.register.errors.emailRequired'))
            .email(t('auth.register.errors.emailInvalid')),
          password: z
            .string()
            .min(8, t('auth.register.errors.passwordMin'))
            .regex(/[A-Za-z]/, t('auth.register.errors.passwordLetter'))
            .regex(/[0-9]/, t('auth.register.errors.passwordDigit')),
          confirm: z.string(),
        })
        .refine((d) => d.password === d.confirm, {
          path: ['confirm'],
          message: t('auth.register.errors.passwordsMismatch'),
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
    defaultValues: { companyName: '', fullName: '', email: '', password: '', confirm: '' },
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async (data) => {
    try {
      setSubmitting(true);
      const result = await signUpFleet({
        email: data.email.trim().toLowerCase(),
        password: data.password,
        fullName: data.fullName.trim(),
        companyName: data.companyName.trim(),
      });
      if (result.requiresConfirmation) {
        Alert.alert(
          t('auth.register.verifyTitle'),
          t('auth.register.verifyMessage', { email: data.email.trim() }),
          [{ text: t('common.done'), onPress: () => router.replace('/(auth)/login') }],
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('auth.register.errors.signupFailed');
      Alert.alert(t('auth.register.errors.signupFailed'), humanize(msg, t));
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
          <View style={styles.eyebrowDot} />
          <Text style={styles.eyebrowText}>{t('auth.register.eyebrow')}</Text>
        </View>
        <Text style={styles.title}>{t('auth.register.title')}</Text>
        <Text style={styles.subtitle}>{t('auth.register.subtitle')}</Text>
      </View>

      <View style={styles.form}>
        <Controller
          control={control}
          name="companyName"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              label={t('auth.register.companyName')}
              icon="briefcase"
              placeholder={t('auth.register.companyNamePlaceholder')}
              autoCapitalize="words"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.companyName?.message}
              returnKeyType="next"
            />
          )}
        />

        <Controller
          control={control}
          name="fullName"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              label={t('auth.register.fullName')}
              icon="user"
              placeholder={t('auth.register.fullNamePlaceholder')}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
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
              label={t('auth.register.email')}
              icon="mail"
              placeholder={t('auth.register.emailPlaceholder')}
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
              label={t('auth.register.password')}
              icon="lock"
              placeholder={t('auth.register.passwordPlaceholder')}
              isPassword
              autoCapitalize="none"
              autoComplete="password-new"
              textContentType="newPassword"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.password?.message}
              returnKeyType="next"
            />
          )}
        />

        <Controller
          control={control}
          name="confirm"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              label={t('auth.register.confirm')}
              icon="shield"
              placeholder="••••••••"
              isPassword
              autoCapitalize="none"
              textContentType="newPassword"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.confirm?.message}
              returnKeyType="done"
              onSubmitEditing={onSubmit}
            />
          )}
        />

        <Button title={t('auth.register.submit')} onPress={onSubmit} loading={submitting} />

        <Text style={styles.disclaimer}>
          <Trans
            i18nKey="auth.register.disclaimer"
            components={[
              <Text key="terms" style={styles.disclaimerLink} />,
              <Text key="privacy" style={styles.disclaimerLink} />,
            ]}
          />
        </Text>
      </View>

      <View style={styles.altBlock}>
        <Text style={styles.altTitle}>{t('auth.register.altTitle')}</Text>
        <Text style={styles.altText}>{t('auth.register.altText')}</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('auth.register.footerPrompt')}</Text>
        <Pressable
          hitSlop={8}
          onPress={() => router.replace('/(auth)/login')}
          style={({ pressed }) => pressed && { opacity: 0.6 }}
        >
          <Text style={styles.footerLink}>{t('auth.register.footerLink')}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function humanize(msg: string, t: (key: string) => string) {
  if (/already (registered|exists)|user already/i.test(msg))
    return t('auth.register.errors.alreadyExists');
  if (/password should be at least/i.test(msg)) return t('auth.register.errors.passwordMin');
  if (/network/i.test(msg)) return t('errors.network');
  if (/rate.*limit|too many/i.test(msg)) return t('auth.register.errors.rateLimit');
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
  eyebrowDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.accent },
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
  disclaimer: {
    fontSize: theme.font.size.xs,
    color: theme.colors.textDim,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: -theme.spacing.xs,
  },
  disclaimerLink: { color: theme.colors.mesh, fontWeight: theme.font.weight.medium },
  altBlock: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 6,
  },
  altTitle: { color: theme.colors.text, fontWeight: theme.font.weight.semibold, fontSize: theme.font.size.md },
  altText: { color: theme.colors.textMuted, fontSize: theme.font.size.sm, lineHeight: 20 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  footerText: { color: theme.colors.textMuted, fontSize: theme.font.size.sm },
  footerLink: {
    color: theme.colors.lavender,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
  },
});
