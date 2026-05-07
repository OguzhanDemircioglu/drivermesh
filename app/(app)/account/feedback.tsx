import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { MeshBackground } from '@/components/MeshBackground';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/auth/AuthProvider';
import {
  getFeedbackChannels,
  saveFeedbackChannels,
  type FeedbackChannels,
} from '@/lib/feedback';
import { theme } from '@/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BOTFATHER_URL = 'https://t.me/BotFather';

const DEFAULTS: FeedbackChannels = {
  email: { enabled: false, address: '' },
  push: { enabled: true },
  telegram: { enabled: false, botUsername: '', botToken: '', chatId: '' },
};

type WizardStep = 'closed' | 'ask' | 'howto' | 'form';

export default function FeedbackChannelsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const toast = useToast();
  const isOwner = profile?.role === 'owner';
  const [channels, setChannels] = useState<FeedbackChannels>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState<WizardStep>('closed');
  const [tgDraft, setTgDraft] = useState({
    botUsername: '',
    botToken: '',
    chatId: '',
  });
  const [tgErrors, setTgErrors] = useState<{
    botUsername?: string;
    botToken?: string;
    chatId?: string;
  }>({});

  useEffect(() => {
    if (!profile?.organization_id) return;
    getFeedbackChannels(profile.organization_id)
      .then((c) => {
        setChannels(c);
        setTgDraft({
          botUsername: c.telegram.botUsername,
          botToken: c.telegram.botToken,
          chatId: c.telegram.chatId,
        });
      })
      .finally(() => setLoading(false));
  }, [profile?.organization_id]);

  const anyEnabled = useMemo(
    () => channels.email.enabled || channels.push.enabled || channels.telegram.enabled,
    [channels],
  );

  const validateEmail = (): boolean => {
    setEmailError(null);
    if (channels.email.enabled && !EMAIL_RE.test(channels.email.address.trim())) {
      setEmailError(t('feedback.invalidEmail'));
      return false;
    }
    return true;
  };

  const onSave = useCallback(async () => {
    if (!profile?.organization_id) return;
    if (!validateEmail()) return;
    setSaving(true);
    try {
      await saveFeedbackChannels(profile.organization_id, channels);
      toast.success(t('feedback.savedTitle'), t('feedback.savedText'));
      router.back();
    } catch (e) {
      toast.error(t('feedback.saveError'), (e as Error).message);
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.organization_id, channels, t, router, toast]);

  const onTestTelegram = () => {
    toast.success(t('feedback.telegramTestSent'), t('feedback.telegramTestSentBody'));
  };

  const onTelegramSwitch = (next: boolean) => {
    if (!isOwner) {
      toast.info(t('feedback.title'), t('feedback.telegramOnlyOwner'));
      return;
    }
    if (next) {
      // Switch ON → open the wizard. Don't actually flip enabled until the
      // wizard returns successfully — otherwise an "active but blank" bot
      // would silently swallow customer feedback.
      setTgDraft({
        botUsername: channels.telegram.botUsername,
        botToken: channels.telegram.botToken,
        chatId: channels.telegram.chatId,
      });
      setTgErrors({});
      setWizardStep('ask');
    } else {
      setChannels((c) => ({
        ...c,
        telegram: { ...c.telegram, enabled: false },
      }));
    }
  };

  const closeWizard = () => setWizardStep('closed');

  const onWizardActivate = () => {
    const errors: typeof tgErrors = {};
    const required = t('common.required');
    if (!tgDraft.botUsername.trim()) errors.botUsername = required;
    if (!tgDraft.botToken.trim()) errors.botToken = required;
    if (!tgDraft.chatId.trim()) errors.chatId = required;
    setTgErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error(t('feedback.saveError'), t('feedback.telegramRequiredAll'));
      return;
    }
    setChannels((c) => ({
      ...c,
      telegram: {
        enabled: true,
        botUsername: tgDraft.botUsername.trim().replace(/^@/, ''),
        botToken: tgDraft.botToken.trim(),
        chatId: tgDraft.chatId.trim(),
      },
    }));
    closeWizard();
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
          <Text style={styles.title}>{t('feedback.title')}</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.subtitle}>{t('feedback.subtitle')}</Text>

          {loading ? (
            <ActivityIndicator color={theme.colors.accent} style={{ marginVertical: 24 }} />
          ) : (
            <>
              {!anyEnabled ? (
                <View style={styles.warnPill}>
                  <Feather name="alert-triangle" size={14} color={theme.colors.warning} />
                  <Text style={styles.warnText}>{t('feedback.noneActive')}</Text>
                </View>
              ) : null}

              {/* Email */}
              <ChannelCard
                icon="mail"
                title={t('feedback.emailTitle')}
                desc={t('feedback.emailDesc')}
                enabled={channels.email.enabled}
                onToggle={(v) =>
                  setChannels((c) => ({ ...c, email: { ...c.email, enabled: v } }))
                }
              >
                {channels.email.enabled ? (
                  <TextField
                    label={t('feedback.emailLabel')}
                    icon="mail"
                    placeholder={t('feedback.emailPlaceholder')}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={channels.email.address}
                    onChangeText={(v) =>
                      setChannels((c) => ({ ...c, email: { ...c.email, address: v } }))
                    }
                    error={emailError ?? undefined}
                  />
                ) : null}
              </ChannelCard>

              {/* Push */}
              <ChannelCard
                icon="bell"
                title={t('feedback.pushTitle')}
                desc={t('feedback.pushDesc')}
                enabled={channels.push.enabled}
                onToggle={(v) =>
                  setChannels((c) => ({ ...c, push: { enabled: v } }))
                }
              />

              {/* Telegram */}
              <ChannelCard
                icon="send"
                title={t('feedback.telegramTitle')}
                desc={t('feedback.telegramDesc')}
                enabled={channels.telegram.enabled}
                onToggle={onTelegramSwitch}
              >
                {channels.telegram.enabled ? (
                  <View style={styles.tgSummary}>
                    <View style={styles.tgRow}>
                      <Feather name="at-sign" size={13} color={theme.colors.textMuted} />
                      <Text style={styles.tgRowText}>
                        {channels.telegram.botUsername || '—'}
                      </Text>
                    </View>
                    <View style={styles.tgRow}>
                      <Feather name="hash" size={13} color={theme.colors.textMuted} />
                      <Text style={styles.tgRowText}>
                        {channels.telegram.chatId || '—'}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        setTgDraft({
                          botUsername: channels.telegram.botUsername,
                          botToken: channels.telegram.botToken,
                          chatId: channels.telegram.chatId,
                        });
                        setWizardStep('form');
                      }}
                      style={({ pressed }) => [
                        styles.editBtn,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Feather name="edit-2" size={13} color={theme.colors.accent} />
                      <Text style={styles.editBtnText}>{t('common.edit')}</Text>
                    </Pressable>
                    <Pressable
                      onPress={onTestTelegram}
                      style={({ pressed }) => [
                        styles.testBtn,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Feather name="send" size={14} color={theme.colors.accent} />
                      <Text style={styles.testBtnText}>
                        {t('feedback.telegramTestCta')}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </ChannelCard>

              <Button
                title={t('feedback.saveCta')}
                onPress={onSave}
                loading={saving}
              />
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <TelegramWizard
        step={wizardStep}
        draft={tgDraft}
        errors={tgErrors}
        onChangeDraft={(patch) => setTgDraft((d) => ({ ...d, ...patch }))}
        onSetStep={setWizardStep}
        onClose={closeWizard}
        onActivate={onWizardActivate}
      />
    </View>
  );
}

// ----------------------------------------------------------------
// Telegram setup wizard
// ----------------------------------------------------------------

function TelegramWizard({
  step,
  draft,
  errors,
  onChangeDraft,
  onSetStep,
  onClose,
  onActivate,
}: {
  step: WizardStep;
  draft: { botUsername: string; botToken: string; chatId: string };
  errors: { botUsername?: string; botToken?: string; chatId?: string };
  onChangeDraft: (patch: Partial<{ botUsername: string; botToken: string; chatId: string }>) => void;
  onSetStep: (next: WizardStep) => void;
  onClose: () => void;
  onActivate: () => void;
}) {
  const { t } = useTranslation();
  const visible = step !== 'closed';
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={modalStyles.scrim} onPress={onClose}>
        <Pressable style={modalStyles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={modalStyles.sheetHeader}>
            <View style={modalStyles.sheetTitleWrap}>
              <Feather name="send" size={18} color={theme.colors.accent} />
              <Text style={modalStyles.sheetTitle}>
                {t('feedback.telegramWizardTitle')}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Feather name="x" size={20} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={modalStyles.sheetBody}
            showsVerticalScrollIndicator={false}
          >
            {step === 'ask' ? (
              <View style={{ gap: theme.spacing.md }}>
                <Text style={modalStyles.question}>
                  {t('feedback.telegramWizardQuestion')}
                </Text>
                <Pressable
                  onPress={() => onSetStep('form')}
                  style={({ pressed }) => [
                    modalStyles.choiceCta,
                    modalStyles.choicePrimary,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Feather name="check-circle" size={16} color={theme.colors.bg} />
                  <Text style={modalStyles.choicePrimaryText}>
                    {t('feedback.telegramHasIt')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => onSetStep('howto')}
                  style={({ pressed }) => [
                    modalStyles.choiceCta,
                    modalStyles.choiceSecondary,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Feather name="help-circle" size={16} color={theme.colors.text} />
                  <Text style={modalStyles.choiceSecondaryText}>
                    {t('feedback.telegramHowTo')}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {step === 'howto' ? (
              <View style={{ gap: theme.spacing.md }}>
                <Text style={modalStyles.howtoTitle}>
                  {t('feedback.telegramHowToTitle')}
                </Text>
                <Text style={modalStyles.howtoBody}>
                  {t('feedback.telegramHowToBody')}
                </Text>
                <Pressable
                  onPress={() => Linking.openURL(BOTFATHER_URL).catch(() => {})}
                  style={({ pressed }) => [
                    modalStyles.choiceCta,
                    modalStyles.choicePrimary,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Feather name="external-link" size={16} color={theme.colors.bg} />
                  <Text style={modalStyles.choicePrimaryText}>
                    {t('feedback.telegramOpenBotFather')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => onSetStep('form')}
                  style={({ pressed }) => [
                    modalStyles.choiceCta,
                    modalStyles.choiceSecondary,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={modalStyles.choiceSecondaryText}>
                    {t('feedback.telegramHasIt')}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {step === 'form' ? (
              <View style={{ gap: theme.spacing.md }}>
                <TextField
                  label={t('feedback.telegramUsernameLabel')}
                  icon="at-sign"
                  placeholder={t('feedback.telegramUsernamePlaceholder')}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={draft.botUsername}
                  onChangeText={(v) => onChangeDraft({ botUsername: v })}
                  error={errors.botUsername}
                />
                <Text style={modalStyles.fieldHint}>
                  {t('feedback.telegramUsernameHint')}
                </Text>
                <TextField
                  label={t('feedback.telegramTokenLabel')}
                  icon="key"
                  placeholder={t('feedback.telegramTokenPlaceholder')}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={draft.botToken}
                  onChangeText={(v) => onChangeDraft({ botToken: v })}
                  error={errors.botToken}
                />
                <Text style={modalStyles.fieldHint}>
                  {t('feedback.telegramTokenHint')}
                </Text>
                <TextField
                  label={t('feedback.telegramChatIdLabel')}
                  icon="hash"
                  placeholder={t('feedback.telegramChatIdPlaceholder')}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={draft.chatId}
                  onChangeText={(v) => onChangeDraft({ chatId: v })}
                  error={errors.chatId}
                />
                <Button
                  title={t('feedback.telegramSaveCta')}
                  onPress={onActivate}
                />
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ----------------------------------------------------------------
// Channel card
// ----------------------------------------------------------------

function ChannelCard({
  icon,
  title,
  desc,
  enabled,
  onToggle,
  children,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  desc: string;
  enabled: boolean;
  onToggle: (next: boolean) => void;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Card style={enabled ? styles.cardActive : undefined}>
      <View style={styles.cardHead}>
        <View
          style={[
            styles.iconWrap,
            enabled && {
              backgroundColor: theme.colors.accentMuted,
              borderColor: 'rgba(255,122,26,0.32)',
            },
          ]}
        >
          <Feather
            name={icon}
            size={18}
            color={enabled ? theme.colors.accent : theme.colors.textMuted}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle}>{title}</Text>
            <View
              style={[
                styles.statusPill,
                enabled ? styles.statusOn : styles.statusOff,
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  enabled ? styles.statusOnText : styles.statusOffText,
                ]}
              >
                {enabled ? t('feedback.enabled') : t('feedback.disabled')}
              </Text>
            </View>
          </View>
          <Text style={styles.cardDesc}>{desc}</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
          thumbColor="#fff"
        />
      </View>
      {children ? <View style={styles.cardBody}>{children}</View> : null}
    </Card>
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
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    lineHeight: 20,
  },

  warnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.32)',
  },
  warnText: {
    flex: 1,
    color: theme.colors.warning,
    fontSize: theme.font.size.xs,
    lineHeight: 16,
  },

  cardActive: { borderColor: 'rgba(255,122,26,0.28)' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
  },
  cardDesc: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.xs,
    lineHeight: 16,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusOn: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.32)',
  },
  statusOff: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: theme.colors.border,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: theme.font.weight.bold,
    letterSpacing: 0.4,
  },
  statusOnText: { color: theme.colors.success },
  statusOffText: { color: theme.colors.textDim },

  cardBody: { marginTop: theme.spacing.md, gap: theme.spacing.md },

  tgSummary: { gap: theme.spacing.sm },
  tgRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tgRowText: {
    color: theme.colors.text,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.medium,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  editBtnText: {
    color: theme.colors.accent,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentMuted,
  },
  testBtnText: {
    color: theme.colors.accent,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
  },
});

const modalStyles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.bgElevated,
    borderTopLeftRadius: theme.radius['2xl'],
    borderTopRightRadius: theme.radius['2xl'],
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing['2xl'],
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    maxHeight: '88%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  sheetTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
  },
  sheetBody: { gap: theme.spacing.lg },
  question: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    lineHeight: 22,
  },
  choiceCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.lg,
  },
  choicePrimary: {
    backgroundColor: theme.colors.accent,
  },
  choicePrimaryText: {
    color: theme.colors.bg,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.bold,
  },
  choiceSecondary: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  choiceSecondaryText: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.medium,
  },
  howtoTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
  },
  howtoBody: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    lineHeight: 22,
  },
  fieldHint: {
    color: theme.colors.textDim,
    fontSize: 11,
    marginTop: -8,
  },
});
