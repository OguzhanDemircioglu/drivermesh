import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import { AuthBackdrop } from '@/components/AuthBackdrop';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/auth/AuthProvider';
import { digitsOnly, isValidOtp } from '@/auth/phoneAuth';
import { colors, spacing } from '@/theme';

const RESEND_SECONDS = 60;

function formatPhoneForDisplay(e164: string): string {
  // +905XXXXXXXXX → +90 5XX XXX XX XX
  const d = digitsOnly(e164).slice(-10);
  return `+90 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)}`;
}

export default function VerifyOtpScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { verifyPhoneOtp, signInWithPhone } = useAuth();
  const toast = useToast();

  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const onSubmit = async () => {
    if (!phone || !isValidOtp(code) || submitting) return;
    setSubmitting(true);
    try {
      await verifyPhoneOtp(phone, code);
      // AuthProvider session değişimini yakalayıp customer fetch eder;
      // index.tsx gate buradan otomatik /profile-setup veya /home'a yönlendirir.
      router.replace('/');
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('otp.errorInvalid');
      toast.show('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    if (!phone || secondsLeft > 0 || resending) return;
    setResending(true);
    try {
      await signInWithPhone(phone);
      setSecondsLeft(RESEND_SECONDS);
      toast.show('success', t('otp.resendActive'));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('errors.unknown');
      toast.show('error', msg);
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthBackdrop>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.root}>
          <Pressable onPress={() => router.back()} style={styles.back} hitSlop={12}>
            <Feather name="chevron-left" size={28} color={colors.text} />
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.title}>{t('otp.title')}</Text>
            <Text style={styles.subtitle}>
              {t('otp.subtitle', { phone: phone ? formatPhoneForDisplay(phone) : '' })}
            </Text>
          </View>

          <TextField
            placeholder={t('otp.placeholder')}
            value={code}
            onChangeText={(v) => setCode(digitsOnly(v).slice(0, 6))}
            keyboardType="number-pad"
            autoFocus
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={onSubmit}
          />

          <View style={styles.resend}>
            {secondsLeft > 0 ? (
              <Text style={styles.resendCountdown}>
                {t('otp.resendCountdown', { seconds: secondsLeft })}
              </Text>
            ) : (
              <Pressable onPress={onResend} disabled={resending} hitSlop={8}>
                <Text style={styles.resendActive}>{t('otp.resendActive')}</Text>
              </Pressable>
            )}
          </View>

          <Button
            title={t('otp.cta')}
            onPress={onSubmit}
            disabled={!isValidOtp(code)}
            loading={submitting}
          />
        </View>
      </KeyboardAvoidingView>
    </AuthBackdrop>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['2xl'],
    gap: spacing.lg,
  },
  back: { alignSelf: 'flex-start' },
  header: { gap: spacing.xs, marginTop: spacing.md },
  title: { color: colors.text, fontSize: 31, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: 17, lineHeight: 24 },
  resend: { alignItems: 'center', marginTop: spacing.xs },
  resendCountdown: { color: colors.textDim, fontSize: 14 },
  resendActive: { color: colors.accent, fontSize: 15, fontWeight: '600' },
});
