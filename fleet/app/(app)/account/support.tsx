import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { MeshBackground } from '@/components/MeshBackground';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/auth/AuthProvider';
import { isDemoActive } from '@/demo/store';
import {
  isSupportConfigured,
  sendSupportMessage,
  SupportError,
} from '@/lib/support';
import { theme } from '@/theme';

const MAX_LEN = 1000;

export default function SupportScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { profile, session } = useAuth();
  const toast = useToast();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  // Demo modunda tamamen kapalı — kullanıcı yine de yazabilir ama Gönder
  // butonu pasif. UI'de hint kart görünür.
  const demoLocked = isDemoActive();
  const configMissing = !isSupportConfigured();

  const trimmedLen = text.trim().length;
  const canSend = !demoLocked && !configMissing && trimmedLen >= 10 && !sending;

  const onSend = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      await sendSupportMessage({
        text,
        userName: profile?.full_name ?? '—',
        userEmail: session?.user.email ?? '—',
        userRole: profile?.role ?? '—',
      });
      toast.success(
        t('support.successTitle'),
        t('support.successText'),
      );
      setText('');
      router.back();
    } catch (e) {
      const code = e instanceof SupportError ? e.code : 'unknown';
      const messages: Record<string, string> = {
        demo_disabled: t('support.errorDemo'),
        env_missing: t('support.errorEnvMissing'),
        network: t('common.networkError'),
        telegram: t('support.errorTelegram'),
        unknown: t('errors.generic'),
      };
      toast.error(t('support.errorTitle'), messages[code] ?? t('errors.generic'));
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <MeshBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          >
            <Feather name="arrow-left" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.title}>{t('support.title')}</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Card>
            <View style={styles.intro}>
              <View style={styles.iconWrap}>
                <Feather name="message-circle" size={20} color={theme.colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.introTitle}>{t('support.introTitle')}</Text>
                <Text style={styles.introText}>{t('support.introText')}</Text>
              </View>
            </View>
          </Card>

          {demoLocked ? (
            <Card style={styles.warnCard}>
              <View style={styles.warnRow}>
                <Feather name="info" size={18} color={theme.colors.warning} />
                <Text style={styles.warnText}>{t('support.demoLockedHint')}</Text>
              </View>
            </Card>
          ) : configMissing ? (
            <Card style={styles.warnCard}>
              <View style={styles.warnRow}>
                <Feather name="alert-triangle" size={18} color={theme.colors.warning} />
                <Text style={styles.warnText}>{t('support.envMissingHint')}</Text>
              </View>
            </Card>
          ) : null}

          <Card style={{ gap: 8 }}>
            <Text style={styles.fieldLabel}>{t('support.messageLabel')}</Text>
            <TextInput
              value={text}
              onChangeText={(v) => setText(v.slice(0, MAX_LEN))}
              placeholder={t('support.messagePlaceholder')}
              placeholderTextColor={theme.colors.textDim}
              multiline
              editable={!demoLocked}
              maxLength={MAX_LEN}
              style={styles.textArea}
              textAlignVertical="top"
            />
            <Text style={styles.counter}>
              {trimmedLen} / {MAX_LEN}
            </Text>
          </Card>

          <Button
            title={t('support.sendCta')}
            onPress={onSend}
            loading={sending}
            disabled={!canSend}
            leftIcon={<Feather name="send" size={16} color={theme.colors.bg} />}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.semibold,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing['3xl'],
    gap: theme.spacing.lg,
  },

  intro: { flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-start' },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentMuted,
  },
  introTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
  },
  introText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    lineHeight: 20,
    marginTop: 4,
  },

  warnCard: {
    borderColor: 'rgba(245,158,11,0.32)',
    backgroundColor: 'rgba(245,158,11,0.08)',
  },
  warnRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  warnText: {
    color: theme.colors.warning,
    fontSize: theme.font.size.sm,
    flex: 1,
    lineHeight: 20,
  },

  fieldLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  textArea: {
    minHeight: 160,
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    lineHeight: 22,
  },
  counter: {
    alignSelf: 'flex-end',
    color: theme.colors.textDim,
    fontSize: theme.font.size.xs,
  },
});
