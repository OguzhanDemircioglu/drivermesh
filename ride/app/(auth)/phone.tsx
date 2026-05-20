import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import { AuthBackdrop } from '@/components/AuthBackdrop';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/auth/AuthProvider';
import { formatTrPhone, isValidTrMobile, toE164Tr } from '@/auth/phoneAuth';
import { isDevBypassEnabled } from '@/lib/devBypass';
import { colors, radii, spacing } from '@/theme';

export default function PhoneScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { signInWithPhone, devSignIn } = useAuth();
  const toast = useToast();

  const [raw, setRaw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const valid = isValidTrMobile(raw);

  const onSubmit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      // SMS provider (Twilio) yapılandırılana kadar dev build'lerde OTP'yi
      // atlamak için devSignIn fallback. AuthProvider release APK'larda
      // devSignIn'i undefined döndürür ve isDevBypassEnabled() false döner →
      // bu blok yalnızca dev build + DEV_BYPASS=on iken tetiklenir.
      if (isDevBypassEnabled() && devSignIn) {
        await devSignIn();
        return;
      }
      const e164 = toE164Tr(raw);
      await signInWithPhone(e164);
      router.push({ pathname: '/(auth)/verify-otp', params: { phone: e164 } });
    } catch (e) {
      const message = e instanceof Error ? e.message : t('errors.unknown');
      toast.show('error', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthBackdrop>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.root}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.back}
            hitSlop={12}
          >
            <Feather name="chevron-left" size={28} color={colors.text} />
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.title}>{t('phone.title')}</Text>
            <Text style={styles.subtitle}>{t('phone.subtitle')}</Text>
          </View>

          <View style={styles.formRow}>
            <View style={styles.countryChip}>
              <Text style={styles.countryText}>+90</Text>
            </View>
            <TextField
              label={t('phone.label')}
              placeholder={t('phone.placeholder')}
              value={formatTrPhone(raw)}
              onChangeText={setRaw}
              keyboardType="number-pad"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={onSubmit}
              maxLength={13}
              containerStyle={styles.fieldGrow}
            />
          </View>

          <Button
            title={t('phone.cta')}
            onPress={onSubmit}
            disabled={!valid}
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
  formRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-end',
    marginTop: spacing.md,
  },
  countryChip: {
    height: 54,
    paddingHorizontal: 16,
    borderRadius: radii.lg,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  countryText: { color: colors.text, fontSize: 17, fontWeight: '600' },
  fieldGrow: { flex: 1 },
});
