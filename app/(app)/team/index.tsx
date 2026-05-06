import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MeshBackground } from '@/components/MeshBackground';
import { Card } from '@/components/Card';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { useAuth } from '@/auth/AuthProvider';
import { useCan } from '@/auth/useCan';
import {
  listPendingInvitations,
  listTeamMembers,
  revokeInvitation,
  shortCode,
} from '@/lib/invitations';
import type { Invitation, Profile, UserRole } from '@/lib/database.types';
import { theme } from '@/theme';
import { useTranslation } from 'react-i18next';

const ROLE_TONE: Record<UserRole, string> = {
  owner: theme.colors.accent,
  manager: theme.colors.lavender,
  driver: theme.colors.mesh,
};

export default function TeamScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const toast = useToast();
  const { confirm } = useConfirm();
  const [members, setMembers] = useState<Profile[]>([]);
  const [pending, setPending] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.organization_id) return;
    try {
      const [m, p] = await Promise.all([
        listTeamMembers(profile.organization_id),
        listPendingInvitations(profile.organization_id),
      ]);
      setMembers(m);
      setPending(p);
    } catch (e) {
      console.warn('[team] load failed', e);
    } finally {
      setLoading(false);
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onRevoke = async (inv: Invitation) => {
    const ok = await confirm({
      title: t('team.revokeTitle'),
      message: t('team.revokeMessage', { name: inv.full_name, email: inv.email }),
      confirmText: t('team.revokeConfirm'),
      cancelText: t('team.revokeCancel'),
      kind: 'destructive',
    });
    if (!ok) return;
    try {
      await revokeInvitation(inv.id);
      await load();
    } catch (e) {
      toast.error(t('errors.generic'), t('team.revokeError'));
    }
  };

  const inviteCheck = useCan('members.invite');
  const onInvite = (role: 'manager' | 'driver') => {
    if (!inviteCheck.allowed) {
      toast.warning(
        t('common.permissionMissingTitle'),
        inviteCheck.reason ?? t('common.permissionMissing'),
      );
      return;
    }
    router.push({ pathname: '/(app)/team/invite', params: { role } });
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
          <Text style={styles.title}>{t('team.title')}</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.accent}
              colors={[theme.colors.accent]}
            />
          }
        >
          <View style={styles.inviteRow}>
            <Button
              title={t('team.addManager')}
              variant="secondary"
              fullWidth={false}
              style={[styles.inviteBtn, !inviteCheck.allowed && styles.btnLocked]}
              leftIcon={
                <Feather
                  name={inviteCheck.allowed ? 'user-plus' : 'lock'}
                  size={16}
                  color={inviteCheck.allowed ? theme.colors.text : theme.colors.textDim}
                />
              }
              onPress={() => onInvite('manager')}
            />
            <Button
              title={t('team.addDriver')}
              variant="secondary"
              fullWidth={false}
              style={[styles.inviteBtn, !inviteCheck.allowed && styles.btnLocked]}
              leftIcon={
                <Feather
                  name={inviteCheck.allowed ? 'truck' : 'lock'}
                  size={16}
                  color={inviteCheck.allowed ? theme.colors.text : theme.colors.textDim}
                />
              }
              onPress={() => onInvite('driver')}
            />
          </View>

          {/* Pending invitations */}
          {pending.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('team.pendingTitle')}</Text>
              <View style={styles.list}>
                {pending.map((inv) => (
                  <Card key={inv.id} style={styles.invCard}>
                    <View style={styles.invHead}>
                      <View style={styles.invIdent}>
                        <Text style={styles.invName} numberOfLines={1}>
                          {inv.full_name}
                        </Text>
                        <Text style={styles.invEmail} numberOfLines={1}>
                          {inv.email}
                        </Text>
                      </View>
                      <View style={[styles.roleBadge, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                        <View style={[styles.roleDot, { backgroundColor: ROLE_TONE[inv.role] }]} />
                        <Text style={[styles.roleText, { color: ROLE_TONE[inv.role] }]}>
                          {t(`roles.${inv.role}`)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.codeBox}>
                      <Text style={styles.codeLabel}>{t('team.inviteCode')}</Text>
                      <Text selectable style={styles.codeValue}>
                        {shortCode(inv.token)}
                      </Text>
                    </View>
                    <View style={styles.invActions}>
                      <Pressable
                        hitSlop={8}
                        onPress={() => onRevoke(inv)}
                        style={({ pressed }) => [styles.invAction, pressed && { opacity: 0.6 }]}
                      >
                        <Feather name="x-circle" size={14} color={theme.colors.danger} />
                        <Text style={[styles.invActionText, { color: theme.colors.danger }]}>
                          {t('team.cancel')}
                        </Text>
                      </Pressable>
                      <Text style={styles.expiry}>
                        {t('team.expiresIn', { time: formatExpiry(inv.expires_at, t) })}
                      </Text>
                    </View>
                  </Card>
                ))}
              </View>
            </View>
          ) : null}

          {/* Active members */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('team.activeTitle', { count: members.length })}
            </Text>
            {loading ? (
              <ActivityIndicator color={theme.colors.accent} style={{ marginVertical: 24 }} />
            ) : members.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyText}>{t('team.emptyMembers')}</Text>
              </Card>
            ) : (
              <View style={styles.list}>
                {members.map((m) => {
                  const canOpenPerms =
                    profile?.role === 'owner' && m.id !== profile?.id && m.role !== 'owner';
                  const Wrapper = canOpenPerms ? Pressable : View;
                  return (
                    <Wrapper
                      key={m.id}
                      onPress={
                        canOpenPerms
                          ? () => router.push(`/(app)/permissions/${m.id}`)
                          : undefined
                      }
                      style={({ pressed }: { pressed?: boolean } = {}) => [
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Card style={styles.memberCard}>
                        <Avatar name={m.full_name} size={42} />
                        <View style={styles.memberBody}>
                          <Text style={styles.memberName} numberOfLines={1}>
                            {m.full_name}
                            {m.id === profile?.id ? (
                              <Text style={styles.youTag}> · {t('common.you')}</Text>
                            ) : null}
                          </Text>
                          <Text style={styles.memberEmail} numberOfLines={1}>
                            {m.email}
                          </Text>
                        </View>
                        <View style={[styles.roleBadge, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                          <View style={[styles.roleDot, { backgroundColor: ROLE_TONE[m.role] }]} />
                          <Text style={[styles.roleText, { color: ROLE_TONE[m.role] }]}>
                            {t(`roles.${m.role}`)}
                          </Text>
                        </View>
                        {canOpenPerms ? (
                          <Feather
                            name="chevron-right"
                            size={16}
                            color={theme.colors.textDim}
                            style={{ marginLeft: 4 }}
                          />
                        ) : null}
                      </Card>
                    </Wrapper>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.helpBlock}>
            <Feather name="info" size={14} color={theme.colors.textDim} />
            <Text style={styles.helpText}>{t('team.helpText')}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function formatExpiry(iso: string, t: (key: string, opts?: Record<string, unknown>) => string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return t('team.expired');
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return t('common.days', { count: days });
  return t('common.hours', { count: hours });
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
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.semibold,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing['3xl'],
    gap: theme.spacing.xl,
  },

  inviteRow: { flexDirection: 'row', gap: 10 },
  inviteBtn: { flex: 1 },
  btnLocked: { opacity: 0.45 },

  section: { gap: theme.spacing.md },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.semibold,
    letterSpacing: -0.3,
  },
  list: { gap: 10 },

  invCard: { gap: 12 },
  invHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  invIdent: { flex: 1, gap: 2 },
  invName: { color: theme.colors.text, fontSize: theme.font.size.md, fontWeight: '600' },
  invEmail: { color: theme.colors.textMuted, fontSize: theme.font.size.sm },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,122,26,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,122,26,0.2)',
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  codeLabel: {
    color: theme.colors.accent,
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  codeValue: {
    color: theme.colors.text,
    fontSize: theme.font.size.xl,
    fontWeight: theme.font.weight.bold,
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
  invActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  invActionText: { fontSize: theme.font.size.sm, fontWeight: theme.font.weight.medium },
  expiry: { color: theme.colors.textDim, fontSize: theme.font.size.xs },

  memberCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberBody: { flex: 1, gap: 2 },
  memberName: { color: theme.colors.text, fontSize: theme.font.size.md, fontWeight: '600' },
  youTag: { color: theme.colors.accent, fontWeight: theme.font.weight.semibold },
  memberEmail: { color: theme.colors.textMuted, fontSize: theme.font.size.sm },

  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.full,
  },
  roleDot: { width: 6, height: 6, borderRadius: 3 },
  roleText: { fontSize: theme.font.size.xs, fontWeight: theme.font.weight.semibold },

  emptyCard: { alignItems: 'center', paddingVertical: theme.spacing.xl },
  emptyText: { color: theme.colors.textMuted, fontSize: theme.font.size.sm },

  helpBlock: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  helpText: {
    flex: 1,
    color: theme.colors.textDim,
    fontSize: theme.font.size.xs,
    lineHeight: 18,
  },
});
