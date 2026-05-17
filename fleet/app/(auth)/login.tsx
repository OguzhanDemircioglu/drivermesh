import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/auth/AuthProvider';
import { theme } from '@/theme';

// Login form ekranı bg: masaüstünden gelen özel LOGİN.webp görseli.
const LOGIN_BG = require('../../assets/login-bg.webp');

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { t } = useTranslation();
  const toast = useToast();
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
      toast.error(t('auth.login.errors.loginFailed'), humanize(msg, t));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <View style={styles.heroBg}>
      <Image
        source={LOGIN_BG}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        priority="high"
      />
      <Screen scroll transparent contentStyle={styles.scroll}>
      {/* Üst boşluk — form ekranın alt yarısına itilir */}
      <View style={styles.topSpacer} />

      <View style={styles.form}>
        <Controller
          control={control}
          name="email"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
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
          onPress={() => toast.info(t('auth.login.forgotTitle'), t('auth.login.forgotSoon'))}
          style={({ pressed }) => [styles.forgot, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.forgotText}>{t('auth.login.forgot')}</Text>
        </Pressable>
      </View>

      {/* Welcome ile aynı buton seti — Sign In (form submit) + Start A Fleet
          + I Have An Invite Code. Demo App hariç. Aynı pozisyon. */}
      <View style={styles.footer}>
        <Button
          title={t('auth.welcome.signIn')}
          variant="secondary"
          onPress={onSubmit}
          loading={submitting}
          style={{ backgroundColor: 'rgb(238, 106, 29)', borderColor: 'rgb(238, 106, 29)' }}
        />
        <Button
          title={t('auth.welcome.startFleet')}
          variant="secondary"
          onPress={() => router.push('/(auth)/register')}
          style={{ backgroundColor: 'rgb(140, 30, 200)', borderColor: 'rgb(140, 30, 200)' }}
        />
        <Button
          title={t('auth.welcome.hasInvite')}
          variant="secondary"
          onPress={() => router.push('/(auth)/redeem')}
        />
      </View>
      </Screen>
    </View>
  );
}

function humanize(msg: string, t: (key: string) => string) {
  if (/invalid login credentials/i.test(msg)) return t('auth.login.errors.invalid');
  if (/email not confirmed/i.test(msg)) return t('auth.login.errors.emailNotConfirmed');
  if (/network/i.test(msg)) return t('errors.network');
  return msg;
}

const styles = StyleSheet.create({
  heroBg: { flex: 1 },
  // Scroll content alt yarıdan başlar — bg image üst yarıda DriverMesh logo'su
  // görünür; form alt yarıda yer alır.
  // Welcome WelcomeHero ile aynı paddingBottom: theme.spacing.sm — butonların
  // alt sınırı Welcome ekranı ile bire bir aynı pozisyonda olur.
  // Form ve footer ekranın altına yapışır — form butonların hemen üstünde.
  scroll: { paddingTop: theme.spacing.xl, paddingBottom: theme.spacing.sm, gap: theme.spacing.xl, flexGrow: 1, justifyContent: 'flex-end' },
  topSpacer: { height: 0 },
  form: { gap: theme.spacing.sm },
  forgot: { alignSelf: 'flex-end', marginTop: 6 },
  forgotText: {
    color: '#fff',
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
  },
  footer: { gap: theme.spacing.sm, marginTop: 0 },
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
