import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { setAppLocale, type AppLocale } from '@/i18n';
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
  const [orgName, setOrgName] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.organization_id) {
      setOrgName(null);
      return;
    }
    supabase
      .from('organizations')
      .select('name')
      .eq('id', profile.organization_id)
      .maybeSingle()
      .then(({ data }) => setOrgName(data?.name ?? null));
  }, [profile?.organization_id]);

  useFocusEffect(
    useCallback(() => {
      refreshProfile();
    }, [refreshProfile]),
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

  const onSignOut = () => {
    Alert.alert(t('home.logoutTitle'), t('home.logoutMessage'), [
      { text: t('home.logoutCancel'), style: 'cancel' },
      { text: t('home.logoutConfirm'), style: 'destructive', onPress: () => signOut() },
    ]);
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
            <Avatar name={fullName} size={72} />
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

          {/* Language */}
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

          {/* Role-specific actions */}
          {isOwner ? (
            <Card>
              <Text style={styles.sectionTitle}>{t('account.ownerPanel')}</Text>
              <Action
                icon="shield"
                label={t('account.ownerActionPermissions')}
                hint={t('account.ownerActionPermissionsHint')}
                onPress={() => router.push('/(app)/permissions')}
              />
              <Action
                icon="trash-2"
                label={t('account.ownerActionDelete')}
                hint={t('account.ownerActionDeleteHint')}
                onPress={() => Alert.alert(t('common.soon'), t('common.notImplemented'))}
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
            </Card>
          ) : null}

          <Card>
            <Text style={styles.sectionTitle}>{t('account.help')}</Text>
            <Action
              icon="help-circle"
              label={t('account.actionSupport')}
              onPress={() => Alert.alert(t('account.actionSupport'), t('common.notImplemented'))}
            />
            <Action
              icon="info"
              label={t('account.actionAbout')}
              hint={t('account.aboutHint')}
              onPress={() => Alert.alert(t('common.appName'), t('account.aboutText'))}
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
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.actionIcon}>
        <Feather name={icon} size={16} color={theme.colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionLabel}>{label}</Text>
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
});
