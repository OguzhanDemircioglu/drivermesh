import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/auth/AuthProvider';
import { updateMyCustomer } from '@/lib/db/customers';
import { colors, radii, spacing } from '@/theme';

export default function EditProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { customer, refreshCustomer } = useAuth();
  const toast = useToast();

  const [fullName, setFullName] = useState(customer?.full_name ?? '');
  const [email, setEmail] = useState(customer?.email ?? '');
  const [submitting, setSubmitting] = useState(false);

  const dirty =
    fullName.trim() !== (customer?.full_name ?? '') ||
    email.trim() !== (customer?.email ?? '');
  const valid = fullName.trim().length >= 2;

  const onSave = async () => {
    if (!valid || !dirty || submitting || !customer) return;
    setSubmitting(true);
    try {
      await updateMyCustomer(customer.id, {
        full_name: fullName.trim(),
        email: email.trim() || null,
      });
      await refreshCustomer();
      toast.show('success', t('common.save') + ' ✓');
      router.back();
    } catch (e) {
      toast.show('error', e instanceof Error ? e.message : t('errors.unknown'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Feather name="chevron-left" size={28} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t('account.editProfile')}</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <TextField
            label={t('profileSetup.label')}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            maxLength={64}
          />
          <TextField
            label="E-posta"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            maxLength={120}
          />
          <View style={styles.lockedField}>
            <Text style={styles.lockedLabel}>Telefon</Text>
            <View style={styles.lockedRow}>
              <Text style={styles.lockedValue}>{customer?.phone ?? '—'}</Text>
              <Feather name="lock" size={14} color={colors.textDim} />
            </View>
          </View>

          <Button
            title={t('common.save')}
            onPress={onSave}
            disabled={!valid || !dirty}
            loading={submitting}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  title: { color: colors.text, fontSize: 19, fontWeight: '700' },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['2xl'] },
  lockedField: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 6,
  },
  lockedLabel: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  lockedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lockedValue: { color: colors.textDim, fontSize: 16 },
});
