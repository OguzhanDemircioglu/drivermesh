import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Card } from '@/components/Card';
import { useToast } from '@/components/Toast';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/lib/database.types';
import { theme } from '@/theme';

type LookupResult = {
  invitationId: string;
  organizationId: string;
  organizationName: string;
  fullName: string;
  email: string;
  role: UserRole;
};

export default function RedeemScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();
  const [step, setStep] = useState<'code' | 'password'>('code');
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const codeSchema = useMemo(
    () =>
      z.object({
        code: z
          .string()
          .trim()
          .length(6, t('auth.redeem.errors.codeLength'))
          .regex(/^[A-Za-z0-9]+$/, t('auth.redeem.errors.codeChars')),
      }),
    [t],
  );

  const passwordSchema = useMemo(
    () =>
      z
        .object({
          password: z
            .string()
            .min(8, t('auth.redeem.errors.passwordMin'))
            .regex(/[A-Za-z]/, t('auth.redeem.errors.passwordLetter'))
            .regex(/[0-9]/, t('auth.redeem.errors.passwordDigit')),
          confirm: z.string(),
        })
        .refine((d) => d.password === d.confirm, {
          path: ['confirm'],
          message: t('auth.redeem.errors.passwordsMismatch'),
        }),
    [t],
  );

  type CodeForm = z.infer<typeof codeSchema>;
  type PassForm = z.infer<typeof passwordSchema>;

  const codeForm = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '' },
    mode: 'onTouched',
  });
  const passForm = useForm<PassForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '', confirm: '' },
    mode: 'onTouched',
  });

  const onLookup = codeForm.handleSubmit(async ({ code }) => {
    try {
      setSubmitting(true);
      const { data, error } = await supabase.rpc('redeem_invitation_lookup', {
        p_short_code: code,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : null;
      if (!row) {
        toast.warning(t('auth.redeem.notFoundTitle'), t('auth.redeem.notFoundText'));
        return;
      }
      setLookup({
        invitationId: row.invitation_id,
        organizationId: row.organization_id,
        organizationName: row.organization_name,
        fullName: row.full_name,
        email: row.email,
        role: row.role,
      });
      setStep('password');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('errors.generic');
      toast.error(t('auth.redeem.lookupErrorTitle'), msg);
    } finally {
      setSubmitting(false);
    }
  });

  const onAccept = passForm.handleSubmit(async ({ password }) => {
    if (!lookup) return;
    try {
      setSubmitting(true);
      const { error: signUpErr } = await supabase.auth.signUp({
        email: lookup.email,
        password,
        options: {
          data: {
            full_name: lookup.fullName,
            role: lookup.role,
            organization_id: lookup.organizationId,
          },
        },
      });
      if (signUpErr) throw signUpErr;

      // Eğer auto-confirm açıksa session zaten mevcut. Değilse manuel sign-in.
      const { data: sessData } = await supabase.auth.getSession();
      if (!sessData.session) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: lookup.email,
          password,
        });
        if (signInErr) throw signInErr;
      }

      const { error: completeErr } = await supabase.rpc('redeem_invitation_complete', {
        p_short_code: codeForm.getValues('code'),
      });
      if (completeErr) {
        console.warn('[redeem] complete error', completeErr.message);
      }
      // AuthGate session'ı algılayıp /(app)'e yönlendirecek
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('errors.generic');
      toast.error(t('auth.redeem.acceptErrorTitle'), humanize(msg, t));
    } finally {
      setSubmitting(false);
    }
  });

  const roleLabel = lookup ? t(`roles.${lookup.role}`) : '';

  return (
    <Screen scroll transparent contentStyle={styles.scroll}>
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
          <Feather name="mail" size={11} color={theme.colors.mesh} />
          <Text style={styles.eyebrowText}>{t('auth.redeem.eyebrow')}</Text>
        </View>
        <Text style={styles.title}>
          {step === 'code' ? t('auth.redeem.titleCode') : t('auth.redeem.titlePassword')}
        </Text>
        <Text style={styles.subtitle}>
          {step === 'code'
            ? t('auth.redeem.subtitleCode')
            : t('auth.redeem.subtitlePassword', {
                org: lookup?.organizationName ?? '',
                role: roleLabel.toLowerCase(),
              })}
        </Text>
      </View>

      {step === 'code' ? (
        <View style={styles.form}>
          <Controller
            control={codeForm.control}
            name="code"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label={t('auth.redeem.codeLabel')}
                icon="key"
                placeholder={t('auth.redeem.codePlaceholder')}
                autoCapitalize="characters"
                autoCorrect={false}
                value={value}
                onChangeText={(v) => onChange(v.toUpperCase())}
                onBlur={onBlur}
                error={codeForm.formState.errors.code?.message}
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={onLookup}
              />
            )}
          />
          <Button title={t('auth.redeem.continue')} onPress={onLookup} loading={submitting} />
        </View>
      ) : null}

      {step === 'password' && lookup ? (
        <View style={styles.form}>
          <Card style={styles.summary}>
            <View style={styles.summaryRow}>
              <Feather name="briefcase" size={14} color={theme.colors.mesh} />
              <Text style={styles.summaryText}>{lookup.organizationName}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Feather name="user" size={14} color={theme.colors.lavender} />
              <Text style={styles.summaryText}>{lookup.fullName}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Feather name="mail" size={14} color={theme.colors.textMuted} />
              <Text style={[styles.summaryText, { color: theme.colors.textMuted }]}>
                {lookup.email}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Feather name="shield" size={14} color={theme.colors.accent} />
              <Text style={[styles.summaryText, { color: theme.colors.accent }]}>
                {roleLabel}
              </Text>
            </View>
          </Card>

          <Controller
            control={passForm.control}
            name="password"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextField
                label={t('auth.register.password')}
                icon="lock"
                placeholder={t('auth.register.passwordPlaceholder')}
                isPassword
                autoCapitalize="none"
                textContentType="newPassword"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={passForm.formState.errors.password?.message}
                returnKeyType="next"
              />
            )}
          />
          <Controller
            control={passForm.control}
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
                error={passForm.formState.errors.confirm?.message}
                returnKeyType="done"
                onSubmitEditing={onAccept}
              />
            )}
          />
          <Button title={t('auth.redeem.submit')} onPress={onAccept} loading={submitting} />
          <Button
            title={t('auth.redeem.changeCode')}
            variant="ghost"
            onPress={() => {
              setLookup(null);
              setStep('code');
              passForm.reset();
            }}
          />
        </View>
      ) : null}

      {submitting && step === 'code' ? <ActivityIndicator color={theme.colors.accent} /> : null}
    </Screen>
  );
}

function humanize(msg: string, t: (key: string) => string) {
  if (/already (registered|exists)|user already/i.test(msg))
    return t('auth.redeem.errors.alreadyExists');
  if (/not found|invalid for this email/i.test(msg))
    return t('auth.redeem.errors.notFound');
  if (/network/i.test(msg)) return t('errors.network');
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
    backgroundColor: theme.colors.meshMuted,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  eyebrowText: {
    fontSize: 11,
    color: theme.colors.mesh,
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
  summary: { gap: 8 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryText: { color: theme.colors.text, fontSize: theme.font.size.sm },
});
