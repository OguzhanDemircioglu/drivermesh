import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  InteractionManager,
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
import { useTranslation } from 'react-i18next';
import { MeshBackground } from '@/components/MeshBackground';
import { Card } from '@/components/Card';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/auth/AuthProvider';
import { listOrgMembers, type TeamMemberLite } from '@/lib/permissions';
import type { UserRole } from '@/lib/database.types';
import { theme } from '@/theme';

const ROLE_TONE: Record<UserRole, string> = {
  owner: theme.colors.accent,
  manager: theme.colors.lavender,
  driver: theme.colors.mesh,
};

export default function PermissionsListScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [members, setMembers] = useState<TeamMemberLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isOwner = profile?.role === 'owner';

  const load = useCallback(async () => {
    if (!profile?.organization_id) return;
    try {
      const list = await listOrgMembers(profile.organization_id);
      setMembers(list.filter((m) => m.id !== profile.id));
    } catch (e) {
      console.warn('[permissions] load failed', e);
    } finally {
      setLoading(false);
    }
  }, [profile?.organization_id, profile?.id]);

  useFocusEffect(
    useCallback(() => {
      const handle = InteractionManager.runAfterInteractions(load);
      return () => handle.cancel();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const ROLE_LABEL: Record<UserRole, string> = {
    owner: t('roles.owner'),
    manager: t('roles.manager'),
    driver: t('roles.driver'),
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
          <Text style={styles.title}>{t('permissions.title')}</Text>
          <View style={styles.backBtn} />
        </View>

        {!isOwner ? (
          <View style={styles.notOwnerWrap}>
            <Card>
              <View style={styles.notOwnerContent}>
                <Feather name="lock" size={28} color={theme.colors.accent} />
                <Text style={styles.notOwnerTitle}>{t('permissions.notOwnerTitle')}</Text>
                <Text style={styles.notOwnerText}>{t('permissions.notOwnerText')}</Text>
              </View>
            </Card>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.accent}
              />
            }
          >
            <Text style={styles.subtitle}>{t('permissions.subtitle')}</Text>

            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={theme.colors.accent} />
              </View>
            ) : members.length === 0 ? (
              <Card>
                <Text style={styles.emptyText}>{t('permissions.memberListEmpty')}</Text>
              </Card>
            ) : (
              <Card>
                {members.map((m, i) => (
                  <Pressable
                    key={m.id}
                    onPress={() => router.push(`/(app)/permissions/${m.id}`)}
                    style={({ pressed }) => [
                      styles.memberRow,
                      i < members.length - 1 && styles.memberRowDivider,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Avatar name={m.full_name} size={42} uri={m.avatar_url} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{m.full_name}</Text>
                      <View style={styles.memberMeta}>
                        <View
                          style={[
                            styles.roleDot,
                            { backgroundColor: ROLE_TONE[m.role] },
                          ]}
                        />
                        <Text style={[styles.memberRole, { color: ROLE_TONE[m.role] }]}>
                          {ROLE_LABEL[m.role]}
                        </Text>
                        <Text style={styles.memberEmail} numberOfLines={1}>
                          · {m.email}
                        </Text>
                      </View>
                    </View>
                    <Feather
                      name="chevron-right"
                      size={20}
                      color={theme.colors.textDim}
                    />
                  </Pressable>
                ))}
              </Card>
            )}
          </ScrollView>
        )}
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
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    lineHeight: 20,
  },
  center: { paddingVertical: theme.spacing['2xl'], alignItems: 'center' },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    textAlign: 'center',
    paddingVertical: theme.spacing.lg,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  memberRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  memberName: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
  },
  memberMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  roleDot: { width: 6, height: 6, borderRadius: 3 },
  memberRole: {
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
  },
  memberEmail: {
    color: theme.colors.textDim,
    fontSize: theme.font.size.xs,
    flex: 1,
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
});
