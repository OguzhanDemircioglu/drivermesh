import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Localization from 'expo-localization';
import type { CountryCode } from 'libphonenumber-js';
import { AuthBackdrop } from '@/components/AuthBackdrop';
import { Button } from '@/components/Button';
import { CountryPicker } from '@/components/CountryPicker';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/auth/AuthProvider';
import {
  formatNationalPhone,
  getExamplePlaceholder,
  isValidMobile,
  toE164,
} from '@/auth/phoneAuth';
import { getCountryByIso } from '@/lib/countries';
import { isDevBypassEnabled } from '@/lib/devBypass';
import { colors, radii, spacing } from '@/theme';

/** Cihaz bölgesinden ISO2 tahmin et — default 'TR'. */
function detectDeviceCountry(): CountryCode {
  try {
    const locales = Localization.getLocales();
    const region = locales[0]?.regionCode;
    if (region && region.length === 2) return region.toUpperCase() as CountryCode;
  } catch {
    /* ignore */
  }
  return 'TR';
}

export default function PhoneScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { signInWithPhone, devSignIn } = useAuth();
  const toast = useToast();

  const [iso, setIso] = useState<CountryCode>(() => detectDeviceCountry());
  const [raw, setRaw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const locale = i18n.language?.startsWith('tr') ? 'tr' : 'en';
  const country = useMemo(() => getCountryByIso(iso, locale), [iso, locale]);
  const placeholder = useMemo(() => getExamplePlaceholder(iso), [iso]);

  // Ülke değişince input'u temizle — eski format yeni ülkede valid olmayabilir.
  useEffect(() => {
    setRaw('');
  }, [iso]);

  const valid = isValidMobile(raw, iso);

  const onSubmit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      // SMS provider yapılandırılana kadar dev build'lerde OTP'yi atla.
      // Release APK'da isDevBypassEnabled() false → bu blok atlanır.
      if (isDevBypassEnabled() && devSignIn) {
        await devSignIn();
        return;
      }
      const e164 = toE164(raw, iso);
      if (!e164) {
        toast.show('error', t('phone.errorInvalid'));
        return;
      }
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
          <View style={styles.header}>
            <Text style={styles.title}>{t('phone.title')}</Text>
            <Text style={styles.subtitle}>{t('phone.subtitle')}</Text>
          </View>

          <View style={styles.formRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('countryPicker.title')}
              onPress={() => setPickerOpen(true)}
              style={({ pressed }) => [
                styles.countryChip,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.countryFlag}>{country?.flag ?? '🏳️'}</Text>
              <Text style={styles.countryDial}>{country?.dialCode ?? '+'}</Text>
            </Pressable>
            <TextField
              label={t('phone.label')}
              placeholder={placeholder}
              value={formatNationalPhone(raw, iso)}
              onChangeText={setRaw}
              keyboardType="number-pad"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={onSubmit}
              maxLength={20}
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

        <CountryPicker
          visible={pickerOpen}
          selectedIso={iso}
          onSelect={(next) => {
            setIso(next as CountryCode);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 54,
    paddingHorizontal: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countryFlag: { fontSize: 22 },
  countryDial: { color: colors.text, fontSize: 17, fontWeight: '600' },
  fieldGrow: { flex: 1 },
});
