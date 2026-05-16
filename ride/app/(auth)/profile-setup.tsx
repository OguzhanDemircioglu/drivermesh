import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AuthBackdrop } from '@/components/AuthBackdrop';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/auth/AuthProvider';
import { colors, spacing } from '@/theme';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { finalizeProfile } = useAuth();
  const toast = useToast();

  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const valid = fullName.trim().length >= 2;

  const onSubmit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await finalizeProfile({ fullName: fullName.trim() });
      router.replace('/(app)/(tabs)/home');
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('errors.unknown');
      toast.show('error', msg);
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
            <Text style={styles.title}>{t('profileSetup.title')}</Text>
            <Text style={styles.subtitle}>{t('profileSetup.subtitle')}</Text>
          </View>

          <TextField
            label={t('profileSetup.label')}
            placeholder={t('profileSetup.placeholder')}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={onSubmit}
            maxLength={64}
          />

          <Button
            title={t('profileSetup.cta')}
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
    justifyContent: 'center',
  },
  header: { gap: spacing.xs },
  title: { color: colors.text, fontSize: 31, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: 17, lineHeight: 24 },
});
