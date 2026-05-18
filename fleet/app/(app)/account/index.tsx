import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { MeshBackground } from '@/components/MeshBackground';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { setAppLocale, type AppLocale } from '@/i18n';
import {
  getFeedbackChannels,
  type FeedbackChannels,
} from '@/lib/feedback';
import { deleteFleet, deleteOwnAccount } from '@/lib/fleet';
import { demo, isDemoActive } from '@/demo/store';
import { captureException } from '@/lib/sentry';
import { theme } from '@/theme';
import type { UserRole } from '@/lib/database.types';

const ROLE_COLOR: Record<UserRole, string> = {
  owner: theme.colors.accent,
  manager: theme.colors.lavender,
  driver: theme.colors.mesh,
};

export default function AccountScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { profile, session, signOut, refreshProfile } = useAuth();
  const toast = useToast();
  const { confirm } = useConfirm();
  const [orgName, setOrgName] = useState<string | null>(null);
  const [channels, setChannels] = useState<FeedbackChannels | null>(null);

  useEffect(() => {
    if (!profile?.organization_id) {
      setOrgName(null);
      return;
    }
    if (isDemoActive()) {
      setOrgName('Demo Lojistik AŞ');
    } else {
      supabase
        .from('organizations')
        .select('name')
        .eq('id', profile.organization_id)
        .maybeSingle()
        .then(({ data }) => setOrgName(data?.name ?? null));
    }
  }, [profile?.organization_id]);

  // Konsolide focus effect — refreshProfile + getFeedbackChannels paralel
  // tetiklenir. Onceden 2 ayri useFocusEffect vardi, her focus'ta 2 sequential
  // hook fire ediyordu; simdi tek hook, ici asenkron paralel.
  useFocusEffect(
    useCallback(() => {
      refreshProfile();
      if (!profile?.organization_id) return;
      getFeedbackChannels(profile.organization_id)
        .then(setChannels)
        .catch(() => setChannels(null));
    }, [refreshProfile, profile?.organization_id]),
  );

  const currentLocale = (i18n.language as AppLocale) ?? 'tr';
  const handleLocale = (next: AppLocale) => {
    if (next === currentLocale) return;
    setAppLocale(next);
  };

  const fullName = profile?.full_name ?? session?.user.email?.split('@')[0] ?? '—';
  const role = profile?.role ?? 'driver';
  const isOwner = role === 'owner';
  const isManager = role === 'manager';

  const onSignOut = async () => {
    const ok = await confirm({
      title: t('home.logoutTitle'),
      message: t('home.logoutMessage'),
      confirmText: t('home.logoutConfirm'),
      cancelText: t('home.logoutCancel'),
      kind: 'warning',
    });
    if (ok) signOut();
  };

  const onDeleteFleet = async () => {
    if (!profile?.organization_id) return;
    const ok = await confirm({
      title: t('account.deleteFleetConfirmTitle'),
      message: t('account.deleteFleetConfirmText'),
      confirmText: t('account.deleteFleetConfirmBtn'),
      cancelText: t('common.cancel'),
      kind: 'destructive',
    });
    if (!ok) return;
    // Second-stage confirm — irreversible op, owner account also goes,
    // user will be signed out. Two-step gate is on purpose, not a typo.
    const finalOk = await confirm({
      title: t('account.deleteFleetFinalConfirmTitle'),
      message: t('account.deleteFleetFinalConfirmText'),
      confirmText: t('account.deleteFleetFinalConfirmBtn'),
      cancelText: t('common.cancel'),
      kind: 'destructive',
    });
    if (!finalOk) return;
    try {
      await deleteFleet(profile.organization_id);
      toast.success(
        t('account.deleteFleetSuccessTitle'),
        t('account.deleteFleetSuccessText'),
      );
      // signOut clears React auth state in both demo (deactivates demo +
      // resets session/profile/isDemo) and real (Supabase auth) paths;
      // AuthGate then bounces to welcome.
      await signOut();
    } catch (e) {
      toast.error(t('account.deleteFleetError'), (e as Error).message);
    }
  };

  const onDeleteAccount = async () => {
    // Patron'un yalnız "hesabımı sil" yolu yok — fleet'in başka kimsesi
    // kalmaz. Önce patronluğu devretsin ya da filoyu silsin.
    if (isOwner) {
      toast.warning(
        t('account.deleteAccountOwnerBlockTitle'),
        t('account.deleteAccountOwnerBlockText'),
      );
      return;
    }
    const ok = await confirm({
      title: t('account.deleteAccountConfirmTitle'),
      message: t('account.deleteAccountConfirmText'),
      confirmText: t('account.deleteAccountConfirmBtn'),
      cancelText: t('common.cancel'),
      kind: 'destructive',
    });
    if (!ok) return;
    const finalOk = await confirm({
      title: t('account.deleteAccountFinalConfirmTitle'),
      message: t('account.deleteAccountFinalConfirmText'),
      confirmText: t('account.deleteAccountFinalConfirmBtn'),
      cancelText: t('common.cancel'),
      kind: 'destructive',
    });
    if (!finalOk) return;
    try {
      // Backend: request_account_deletion RPC siler (profiles + notifications +
      // permission_overrides + vehicles.current_user_id NULL + auth.users).
      // Demo'da clearDemoStorage yapilir (in-memory state).
      await deleteOwnAccount();
      toast.success(
        t('account.deleteAccountSuccessTitle'),
        t('account.deleteAccountSuccessText'),
      );
      await signOut();
    } catch (e) {
      toast.error(t('account.deleteAccountError'), (e as Error).message);
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
          <Text style={styles.title}>{t('account.title')}</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile card */}
          <Card style={styles.profile}>
            <Avatar name={fullName} size={72} uri={profile?.avatar_url} />
            <Text style={styles.name}>{fullName}</Text>
            <View style={[styles.rolePill, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
              <View style={[styles.roleDot, { backgroundColor: ROLE_COLOR[role] }]} />
              <Text style={[styles.roleText, { color: ROLE_COLOR[role] }]}>
                {t(`roles.${role}`)}
              </Text>
            </View>
            {orgName ? (
              <Text style={styles.orgName}>
                <Feather name="briefcase" size={11} color={theme.colors.textMuted} /> {orgName}
              </Text>
            ) : null}
            <Text style={styles.email}>{session?.user.email}</Text>
          </Card>

          {/* Language — Profil kartının (avatar + email) hemen altında.
              Kullanıcı dil tercihini değiştirmek istediğinde profil görünümünden
              hızlı erişim. */}
          <Card>
            <Text style={styles.sectionTitle}>{t('account.language')}</Text>
            <View style={styles.langRow}>
              <Pressable
                onPress={() => handleLocale('tr')}
                style={({ pressed }) => [
                  styles.langBtn,
                  currentLocale === 'tr' && styles.langBtnActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text
                  style={[
                    styles.langBtnText,
                    currentLocale === 'tr' && styles.langBtnTextActive,
                  ]}
                >
                  {t('account.languageTr')}
                </Text>
                {currentLocale === 'tr' ? (
                  <Feather name="check" size={16} color={theme.colors.accent} />
                ) : null}
              </Pressable>
              <Pressable
                onPress={() => handleLocale('en')}
                style={({ pressed }) => [
                  styles.langBtn,
                  currentLocale === 'en' && styles.langBtnActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text
                  style={[
                    styles.langBtnText,
                    currentLocale === 'en' && styles.langBtnTextActive,
                  ]}
                >
                  {t('account.languageEn')}
                </Text>
                {currentLocale === 'en' ? (
                  <Feather name="check" size={16} color={theme.colors.accent} />
                ) : null}
              </Pressable>
            </View>
          </Card>

          {/* Quick stats */}
          <Card>
            <Text style={styles.sectionTitle}>{t('account.info')}</Text>
            <Row icon="user" label={t('account.rowName')} value={fullName} />
            <Row icon="mail" label={t('account.rowEmail')} value={session?.user.email ?? '—'} />
            <Row
              icon="phone"
              label={t('account.rowPhone')}
              value={profile?.phone ?? t('account.rowPhoneEmpty')}
              muted={!profile?.phone}
            />
            <Row
              icon="calendar"
              label={t('account.rowMembership')}
              value={formatDate(profile?.created_at, currentLocale)}
            />
            <Pressable
              onPress={() => router.push('/(app)/account/edit')}
              style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.6 }]}
            >
              <Feather name="edit-2" size={14} color={theme.colors.accent} />
              <Text style={styles.editBtnText}>{t('account.editProfile')}</Text>
            </Pressable>
          </Card>

          {/* Role-specific actions */}
          {isOwner ? (
            <Card>
              <Text style={styles.sectionTitle}>{t('account.ownerPanel')}</Text>
              <Action
                icon="map-pin"
                label={t('hq.accountLink')}
                hint={t('hq.accountLinkHint')}
                onPress={() => router.push('/(app)/account/hq')}
              />
              <Action
                icon="message-circle"
                label={t('feedback.accountLink')}
                hint={t('feedback.accountLinkHint')}
                onPress={() => router.push('/(app)/account/feedback')}
              />
              <Action
                icon="users"
                label={t('rideSettings.entryLabel')}
                hint={t('rideSettings.entryHint')}
                onPress={() => router.push('/(app)/account/ride-settings')}
              />
              <Action
                icon="shield"
                label={t('account.ownerActionPermissions')}
                hint={t('account.ownerActionPermissionsHint')}
                onPress={() => router.push('/(app)/permissions')}
              />
              <Action
                icon="trash-2"
                label={t('account.ownerActionDeleteFleet')}
                hint={t('account.ownerActionDeleteFleetHint')}
                onPress={onDeleteFleet}
                danger
              />
              <Action
                icon="bell"
                label={t('account.ownerActionNotifications')}
                hint={t('account.ownerActionNotificationsHint')}
                onPress={() => router.push('/(app)/notifications')}
              />
            </Card>
          ) : null}

          {isOwner || isManager ? (
            <Card>
              <Text style={styles.sectionTitle}>{t('account.management')}</Text>
              <Action
                icon="users"
                label={t('account.actionTeam')}
                onPress={() => router.push('/(app)/team')}
              />
              <Action
                icon="truck"
                label={t('account.actionFleet')}
                onPress={() => router.push('/(app)/vehicles')}
              />
              <Action
                icon="briefcase"
                label={t('account.actionJobs')}
                onPress={() => router.push('/(app)/jobs')}
              />
              <Action
                icon="tool"
                label={t('account.actionMaintenance')}
                onPress={() => router.push('/(app)/maintenance')}
              />
            </Card>
          ) : null}

          {/* Telegram bot link — visible to non-owners once the owner has set
              up a public bot username. Tapping deep-links to t.me/<handle>. */}
          {!isOwner &&
          channels?.telegram.enabled &&
          channels.telegram.botUsername ? (
            <Card>
              <View style={styles.tgCard}>
                <View style={styles.tgIconBox}>
                  <Feather name="send" size={18} color={theme.colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tgTitle}>{t('feedback.teamBotTitle')}</Text>
                  <Text style={styles.tgDesc}>{t('feedback.teamBotDesc')}</Text>
                  <Text style={styles.tgHandle}>
                    @{channels.telegram.botUsername}
                  </Text>
                  <Pressable
                    onPress={() =>
                      Linking.openURL(
                        `https://t.me/${channels.telegram.botUsername}`,
                      ).catch(() => {})
                    }
                    style={({ pressed }) => [
                      styles.tgOpenBtn,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Feather
                      name="external-link"
                      size={14}
                      color={theme.colors.bg}
                    />
                    <Text style={styles.tgOpenBtnText}>
                      {t('feedback.teamBotOpen')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </Card>
          ) : null}

          <Card>
            <Text style={styles.sectionTitle}>{t('account.help')}</Text>
            <Action
              icon="map"
              label={t('rideHistory.menuLabel')}
              onPress={() => router.push('/(app)/ride-history')}
            />
            <Action
              icon="help-circle"
              label={t('account.actionSupport')}
              onPress={() => router.push('/(app)/account/support')}
            />
            <Action
              icon="info"
              label={t('account.actionAbout')}
              hint={t('account.aboutHint')}
              onPress={() => toast.info(t('common.appName'), t('account.aboutText'))}
              onLongPress={() => {
                // Sentry pipeline dogrulama easter egg — gizli, 3s basili tut.
                // captureException uncaught throw degil; app crash etmez.
                // Stack trace bu satira kadar inecek, source map symbolication
                // dashboard'ta `app/(app)/account/index.tsx` olarak gorunmeli.
                captureException(
                  new Error('DriverMesh Sentry sourcemap test (account longpress)'),
                  { trigger: 'account_about_longpress', appVersion: '1.0.0' },
                );
                toast.info('Sentry', 'Test event gonderildi.');
              }}
              delayLongPress={3000}
            />
          </Card>

          {/* Hesap sil — her rol için. Patron'da "önce devret/filo sil"
              uyarısıyla erken döner; manager/şoförde 2-aşamalı onay. */}
          <Card>
            <Text style={styles.sectionTitle}>{t('account.dangerZone')}</Text>
            <Action
              icon="user-x"
              label={t('account.actionDeleteAccount')}
              hint={t('account.actionDeleteAccountHint')}
              onPress={onDeleteAccount}
              danger
            />
          </Card>

          <Button
            title={t('account.signOut')}
            variant="secondary"
            leftIcon={<Feather name="log-out" size={16} color={theme.colors.danger} />}
            onPress={onSignOut}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  muted,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Feather name={icon} size={15} color={theme.colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, muted && { color: theme.colors.textDim }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function Action({
  icon,
  label,
  hint,
  onPress,
  onLongPress,
  delayLongPress,
  danger,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  hint?: string;
  onPress: () => void;
  onLongPress?: () => void;
  delayLongPress?: number;
  danger?: boolean;
}) {
  const accent = danger ? theme.colors.danger : theme.colors.accent;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}
    >
      <View
        style={[
          styles.actionIcon,
          danger && { backgroundColor: 'rgba(239,68,68,0.12)' },
        ]}
      >
        <Feather name={icon} size={16} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.actionLabel, danger && { color: accent }]}>{label}</Text>
        {hint ? <Text style={styles.actionHint}>{hint}</Text> : null}
      </View>
      <Feather name="chevron-right" size={18} color={theme.colors.textDim} />
    </Pressable>
  );
}

function formatDate(iso?: string, locale: 'tr' | 'en' = 'tr') {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(locale === 'en' ? 'en-US' : 'tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
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

  profile: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: theme.spacing.xl,
  },
  name: {
    color: theme.colors.text,
    fontSize: theme.font.size.xl,
    fontWeight: theme.font.weight.bold,
    letterSpacing: -0.4,
    marginTop: 4,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.full,
    marginTop: 4,
  },
  roleDot: { width: 6, height: 6, borderRadius: 3 },
  roleText: { fontSize: theme.font.size.xs, fontWeight: theme.font.weight.semibold },
  orgName: { color: theme.colors.textMuted, fontSize: theme.font.size.sm, marginTop: 4 },
  email: { color: theme.colors.textDim, fontSize: theme.font.size.xs },

  sectionTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
    marginBottom: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  rowLabel: { color: theme.colors.textDim, fontSize: 11, letterSpacing: 0.4 },
  rowValue: { color: theme.colors.text, fontSize: theme.font.size.sm, fontWeight: '500' },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentMuted,
  },
  editBtnText: { color: theme.colors.accent, fontWeight: theme.font.weight.semibold },

  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { color: theme.colors.text, fontSize: theme.font.size.md, fontWeight: '500' },
  actionHint: { color: theme.colors.textMuted, fontSize: theme.font.size.xs, marginTop: 2 },

  langRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  langBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  langBtnActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentMuted,
  },
  langBtnText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.medium,
  },
  langBtnTextActive: {
    color: theme.colors.text,
    fontWeight: theme.font.weight.semibold,
  },

  tgCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  tgIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(255,122,26,0.32)',
  },
  tgTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
  },
  tgDesc: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.xs,
    lineHeight: 16,
    marginTop: 2,
  },
  tgHandle: {
    color: theme.colors.lavender,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
    marginTop: theme.spacing.sm,
  },
  tgOpenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accent,
    marginTop: theme.spacing.sm,
  },
  tgOpenBtnText: {
    color: theme.colors.bg,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.bold,
  },
});
