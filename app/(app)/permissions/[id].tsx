import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { MeshBackground } from '@/components/MeshBackground';
import { Card } from '@/components/Card';
import { Avatar } from '@/components/Avatar';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import {
  changeMemberRole,
  listMemberPermissions,
  removeOrgMember,
  setPermissionOverride,
  transferOwnership,
  PermissionError,
  type MemberPermission,
  type PermissionCategory,
} from '@/lib/permissions';
import { demo, isDemoActive } from '@/demo/store';
import type { UserRole } from '@/lib/database.types';
import { theme } from '@/theme';

const CATEGORY_ORDER: PermissionCategory[] = [
  'vehicles',
  'jobs',
  'members',
  'reports',
  'settings',
];

const ROLE_TONE: Record<UserRole, string> = {
  owner: theme.colors.accent,
  manager: theme.colors.lavender,
  driver: theme.colors.mesh,
};

type Member = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
};

export default function MemberPermissionsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const { confirm } = useConfirm();
  const [member, setMember] = useState<Member | null>(null);
  const [permissions, setPermissions] = useState<MemberPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [mgmtBusy, setMgmtBusy] = useState<'role' | 'remove' | 'transfer' | null>(
    null,
  );

  const isOwner = profile?.role === 'owner';
  const locale = (i18n.language === 'en' ? 'en' : 'tr') as 'en' | 'tr';

  const load = useCallback(async () => {
    if (!id) return;
    try {
      if (isDemoActive()) {
        const p = demo.profileById(id);
        const perms = await listMemberPermissions(id);
        setMember(
          p
            ? {
                id: p.id,
                full_name: p.full_name,
                email: p.email,
                role: p.role,
                avatar_url: p.avatar_url,
              }
            : null,
        );
        setPermissions(perms);
      } else {
        const [{ data: m, error: mErr }, perms] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, full_name, email, role, avatar_url')
            .eq('id', id)
            .maybeSingle(),
          listMemberPermissions(id),
        ]);
        if (mErr) throw mErr;
        setMember(m as Member | null);
        setPermissions(perms);
      }
    } catch (e) {
      console.warn('[member-perms] load failed', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<PermissionCategory, MemberPermission[]>();
    for (const p of permissions) {
      const key = p.category as PermissionCategory;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [permissions]);

  const handleToggle = useCallback(
    async (perm: MemberPermission, next: boolean) => {
      if (!isOwner || savingKey) return;
      const target =
        next === perm.default_allowed ? null : next;
      setSavingKey(perm.key);
      const prev = permissions;
      setPermissions((curr) =>
        curr.map((p) =>
          p.key === perm.key
            ? {
                ...p,
                override_allowed: target,
                effective_allowed: next,
              }
            : p,
        ),
      );
      try {
        await setPermissionOverride(id ?? '', perm.key, target);
      } catch (e) {
        setPermissions(prev);
        const code = e instanceof PermissionError ? e.code : 'unknown';
        const msg = t(`permissions.errors.${code}`, t('permissions.errors.unknown'));
        toast.error(t('permissions.saveError'), msg);
      } finally {
        setSavingKey(null);
      }
    },
    [id, isOwner, permissions, savingKey, t, toast],
  );

  const handleRevert = useCallback(
    async (perm: MemberPermission) => {
      if (!isOwner || savingKey || perm.override_allowed === null) return;
      setSavingKey(perm.key);
      const prev = permissions;
      setPermissions((curr) =>
        curr.map((p) =>
          p.key === perm.key
            ? { ...p, override_allowed: null, effective_allowed: p.default_allowed }
            : p,
        ),
      );
      try {
        await setPermissionOverride(id ?? '', perm.key, null);
      } catch (e) {
        setPermissions(prev);
        const code = e instanceof PermissionError ? e.code : 'unknown';
        const msg = t(`permissions.errors.${code}`, t('permissions.errors.unknown'));
        toast.error(t('permissions.saveError'), msg);
      } finally {
        setSavingKey(null);
      }
    },
    [id, isOwner, permissions, savingKey, t, toast],
  );

  const handleChangeRole = useCallback(async () => {
    if (!member || mgmtBusy || !id) return;
    if (member.role === 'owner') return;
    const next: UserRole = member.role === 'manager' ? 'driver' : 'manager';
    const ok = await confirm({
      title: t('permissions.changeRoleConfirmTitle'),
      message: t('permissions.changeRoleConfirmText', {
        name: member.full_name,
        role: t(`roles.${next}`),
      }),
      confirmText: t('common.confirm'),
      cancelText: t('common.cancel'),
    });
    if (!ok) return;
    setMgmtBusy('role');
    try {
      await changeMemberRole(id, next);
      setMember({ ...member, role: next });
      toast.success(t('common.done'), t('permissions.changeRoleSuccess'));
    } catch (e) {
      const code = e instanceof PermissionError ? e.code : 'unknown';
      const msg = t(
        `permissions.errors.${code}`,
        t('permissions.errors.unknown'),
      );
      toast.error(t('permissions.changeRoleError'), msg);
    } finally {
      setMgmtBusy(null);
    }
  }, [member, mgmtBusy, id, t, toast, confirm]);

  const handleTransferOwnership = useCallback(async () => {
    if (!member || mgmtBusy || !id) return;
    if (member.role === 'owner') return;
    const myFutureRole = member.role; // owner takes over the target's old role
    const ok = await confirm({
      title: t('permissions.transferOwnerConfirmTitle'),
      message: t('permissions.transferOwnerConfirmText', {
        name: member.full_name,
        role: t(`roles.${myFutureRole}`),
      }),
      confirmText: t('permissions.transferOwnerConfirmBtn'),
      cancelText: t('common.cancel'),
      kind: 'warning',
    });
    if (!ok) return;
    setMgmtBusy('transfer');
    try {
      await transferOwnership(id);
      // Refresh both viewer profile (now demoted) and the on-screen member
      // (now owner). We then bounce back to the team list — this screen
      // requires owner to render and we are no longer that.
      setMember({ ...member, role: 'owner' });
      toast.success(t('common.done'), t('permissions.transferOwnerSuccess'));
      await refreshProfile();
      router.back();
    } catch (e) {
      const code = e instanceof PermissionError ? e.code : 'unknown';
      const msg = t(
        `permissions.errors.${code}`,
        t('permissions.errors.unknown'),
      );
      toast.error(t('permissions.transferOwnerError'), msg);
    } finally {
      setMgmtBusy(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member, mgmtBusy, id, t, toast, confirm, router]);

  const handleRemoveMember = useCallback(async () => {
    if (!member || mgmtBusy || !id) return;
    if (member.role === 'owner') return;
    const ok = await confirm({
      title: t('permissions.removeMemberConfirmTitle'),
      message: t('permissions.removeMemberConfirmText', { name: member.full_name }),
      confirmText: t('permissions.removeMemberConfirmBtn'),
      cancelText: t('common.cancel'),
      kind: 'destructive',
    });
    if (!ok) return;
    setMgmtBusy('remove');
    try {
      await removeOrgMember(id);
      toast.success(t('common.done'), t('permissions.removeMemberSuccess'));
      router.back();
    } catch (e) {
      setMgmtBusy(null);
      const code = e instanceof PermissionError ? e.code : 'unknown';
      const msg = t(
        `permissions.errors.${code}`,
        t('permissions.errors.unknown'),
      );
      toast.error(t('permissions.removeMemberError'), msg);
    }
  }, [member, mgmtBusy, id, t, router, toast, confirm]);

  if (!isOwner) {
    return <NotOwner />;
  }

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
          <Text style={styles.title}>{t('permissions.title')}</Text>
          <View style={styles.backBtn} />
        </View>

        {loading || !member ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Card>
              <View style={styles.memberHeader}>
                <Avatar name={member.full_name} size={56} uri={member.avatar_url} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{member.full_name}</Text>
                  <View style={styles.roleRow}>
                    <View
                      style={[
                        styles.roleDot,
                        { backgroundColor: ROLE_TONE[member.role] },
                      ]}
                    />
                    <Text
                      style={[styles.roleLabel, { color: ROLE_TONE[member.role] }]}
                    >
                      {t(`roles.${member.role}`)}
                    </Text>
                    <Text style={styles.email} numberOfLines={1}>
                      · {member.email}
                    </Text>
                  </View>
                </View>
              </View>
            </Card>

            {member.role !== 'owner' ? (
              <Card>
                <Text style={styles.sectionTitle}>{t('permissions.memberMgmtTitle')}</Text>
                <Pressable
                  onPress={handleChangeRole}
                  disabled={mgmtBusy !== null}
                  style={({ pressed }) => [
                    styles.mgmtRow,
                    mgmtBusy !== null && { opacity: 0.5 },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View style={styles.mgmtIconWrap}>
                    {mgmtBusy === 'role' ? (
                      <ActivityIndicator size="small" color={theme.colors.accent} />
                    ) : (
                      <Feather name="user-plus" size={16} color={theme.colors.accent} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mgmtLabel}>{t('permissions.changeRoleCta')}</Text>
                    <Text style={styles.mgmtHint}>{t('permissions.changeRoleHint')}</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={theme.colors.textDim} />
                </Pressable>
                <Pressable
                  onPress={handleTransferOwnership}
                  disabled={mgmtBusy !== null}
                  style={({ pressed }) => [
                    styles.mgmtRow,
                    mgmtBusy !== null && { opacity: 0.5 },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View style={styles.mgmtIconWrap}>
                    {mgmtBusy === 'transfer' ? (
                      <ActivityIndicator size="small" color={theme.colors.accent} />
                    ) : (
                      <Feather name="award" size={16} color={theme.colors.accent} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mgmtLabel}>
                      {t('permissions.transferOwnerCta')}
                    </Text>
                    <Text style={styles.mgmtHint}>
                      {t('permissions.transferOwnerHint', {
                        role: t(`roles.${member.role}`),
                      })}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={theme.colors.textDim} />
                </Pressable>
                <Pressable
                  onPress={handleRemoveMember}
                  disabled={mgmtBusy !== null}
                  style={({ pressed }) => [
                    styles.mgmtRow,
                    styles.mgmtRowDanger,
                    mgmtBusy !== null && { opacity: 0.5 },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View style={[styles.mgmtIconWrap, styles.mgmtIconDanger]}>
                    {mgmtBusy === 'remove' ? (
                      <ActivityIndicator size="small" color={theme.colors.danger} />
                    ) : (
                      <Feather name="user-x" size={16} color={theme.colors.danger} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.mgmtLabel, { color: theme.colors.danger }]}>
                      {t('permissions.removeMemberCta')}
                    </Text>
                    <Text style={styles.mgmtHint}>{t('permissions.removeMemberHint')}</Text>
                  </View>
                </Pressable>
              </Card>
            ) : null}

            {CATEGORY_ORDER.map((cat) => {
              const items = grouped.get(cat);
              if (!items || items.length === 0) return null;
              return (
                <Card key={cat}>
                  <Text style={styles.sectionTitle}>
                    {t(`permissions.section${capitalize(cat)}`)}
                  </Text>
                  {items.map((p, i) => (
                    <PermissionRow
                      key={p.key}
                      perm={p}
                      locale={locale}
                      busy={savingKey === p.key}
                      isLast={i === items.length - 1}
                      onToggle={(next) => handleToggle(p, next)}
                      onRevert={() => handleRevert(p)}
                      tCriticalBadge={t('permissions.criticalBadge')}
                      tOverrideBadge={t('permissions.overrideBadge')}
                      tRevert={t('permissions.revertToDefault')}
                    />
                  ))}
                </Card>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function PermissionRow({
  perm,
  locale,
  busy,
  isLast,
  onToggle,
  onRevert,
  tCriticalBadge,
  tOverrideBadge,
  tRevert,
}: {
  perm: MemberPermission;
  locale: 'tr' | 'en';
  busy: boolean;
  isLast: boolean;
  onToggle: (next: boolean) => void;
  onRevert: () => void;
  tCriticalBadge: string;
  tOverrideBadge: string;
  tRevert: string;
}) {
  const label = locale === 'en' ? perm.label_en : perm.label_tr;
  const hasOverride = perm.override_allowed !== null;
  return (
    <View style={[styles.permRow, !isLast && styles.permRowDivider]}>
      <View style={{ flex: 1 }}>
        <View style={styles.permLabelRow}>
          <Text style={styles.permLabel}>{label}</Text>
          {perm.is_critical ? (
            <View style={styles.criticalBadge}>
              <Feather name="alert-triangle" size={10} color={theme.colors.warning} />
              <Text style={styles.criticalText}>{tCriticalBadge}</Text>
            </View>
          ) : null}
        </View>
        {hasOverride ? (
          <View style={styles.permMeta}>
            <Text style={styles.overrideText}>{tOverrideBadge}</Text>
            <Pressable hitSlop={8} onPress={onRevert} disabled={busy}>
              <Text style={styles.revertText}>{tRevert}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={theme.colors.accent} />
      ) : (
        <Switch
          value={perm.effective_allowed}
          onValueChange={onToggle}
          trackColor={{
            false: 'rgba(255,255,255,0.1)',
            true: theme.colors.accent,
          }}
          thumbColor="#fff"
          ios_backgroundColor="rgba(255,255,255,0.1)"
        />
      )}
    </View>
  );
}

function NotOwner() {
  const router = useRouter();
  const { t } = useTranslation();
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
          <Text style={styles.title}>{t('permissions.title')}</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.notOwnerWrap}>
          <Card>
            <View style={styles.notOwnerContent}>
              <Feather name="lock" size={28} color={theme.colors.accent} />
              <Text style={styles.notOwnerTitle}>{t('permissions.notOwnerTitle')}</Text>
              <Text style={styles.notOwnerText}>{t('permissions.notOwnerText')}</Text>
            </View>
          </Card>
        </View>
      </SafeAreaView>
    </View>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  memberName: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.bold,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  roleDot: { width: 6, height: 6, borderRadius: 3 },
  roleLabel: {
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
  },
  email: {
    color: theme.colors.textDim,
    fontSize: theme.font.size.xs,
    flex: 1,
  },

  sectionTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
    marginBottom: theme.spacing.sm,
  },

  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  permRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  permLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  permLabel: {
    color: theme.colors.text,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.medium,
  },
  permMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  overrideText: {
    color: theme.colors.lavender,
    fontSize: 11,
    fontWeight: theme.font.weight.semibold,
  },
  revertText: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: theme.font.weight.semibold,
    textDecorationLine: 'underline',
    marginLeft: 4,
  },
  criticalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(245,158,11,0.12)',
  },
  criticalText: {
    color: theme.colors.warning,
    fontSize: 10,
    fontWeight: theme.font.weight.semibold,
  },

  notOwnerWrap: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
  },
  notOwnerContent: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.lg,
  },
  notOwnerTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.semibold,
  },
  notOwnerText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: theme.spacing.md,
  },

  mgmtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  mgmtRowDanger: { borderBottomWidth: 0 },
  mgmtIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mgmtIconDanger: { backgroundColor: 'rgba(239,68,68,0.1)' },
  mgmtLabel: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: '500',
  },
  mgmtHint: { color: theme.colors.textMuted, fontSize: theme.font.size.xs, marginTop: 2 },
});
