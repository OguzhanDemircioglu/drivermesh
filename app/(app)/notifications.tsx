import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  InteractionManager,
  Pressable,
  RefreshControl,
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
import { supabase } from '@/lib/supabase';
import {
  listNotifications,
  markNotificationRead,
  type NotificationWithActor,
} from '@/lib/permissions';
import type { Profile } from '@/lib/database.types';
import { demo, isDemoActive } from '@/demo/store';
import { theme } from '@/theme';

type MemberLookup = Record<string, Pick<Profile, 'full_name'>>;

export default function NotificationsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const [items, setItems] = useState<NotificationWithActor[]>([]);
  const [members, setMembers] = useState<MemberLookup>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await listNotifications(50);
      setItems(list);

      const memberIds = Array.from(
        new Set(
          list
            .map((n) => (n.payload as { member_id?: string }).member_id)
            .filter((x): x is string => Boolean(x)),
        ),
      );
      if (memberIds.length > 0) {
        if (isDemoActive()) {
          const map: MemberLookup = {};
          memberIds.forEach((id) => {
            const p = demo.profileById(id);
            if (p) map[p.id] = { full_name: p.full_name };
          });
          setMembers(map);
        } else {
          const { data } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', memberIds);
          const map: MemberLookup = {};
          (data ?? []).forEach((p) => {
            map[p.id] = { full_name: p.full_name };
          });
          setMembers(map);
        }
      } else {
        setMembers({});
      }
    } catch (e) {
      console.warn('[notifications] load failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const handlePress = useCallback(
    async (n: NotificationWithActor) => {
      if (!n.read_at) {
        setItems((curr) =>
          curr.map((it) =>
            it.id === n.id ? { ...it, read_at: new Date().toISOString() } : it,
          ),
        );
        markNotificationRead(n.id).catch((e) =>
          console.warn('[notifications] mark read failed', e),
        );
      }

      // Deep-link by event type / payload
      const payload = n.payload as { key?: string; job_id?: string };
      if (
        (n.type === 'driver_request' ||
          n.type === 'request_approved' ||
          n.type === 'request_rejected') &&
        payload.job_id
      ) {
        router.push(`/(app)/jobs/${payload.job_id}`);
        return;
      }
      const key = payload.key;
      if (!key) return;
      if (key.startsWith('vehicles.')) {
        router.push('/(app)/vehicles');
      } else if (key.startsWith('jobs.')) {
        router.push('/(app)/jobs');
      } else if (key.startsWith('members.')) {
        router.push('/(app)/team');
      }
    },
    [router],
  );

  const unreadCount = useMemo(
    () => items.filter((it) => !it.read_at).length,
    [items],
  );

  const handleMarkAll = useCallback(async () => {
    const unread = items.filter((it) => !it.read_at);
    if (unread.length === 0) return;
    setItems((curr) =>
      curr.map((it) =>
        it.read_at ? it : { ...it, read_at: new Date().toISOString() },
      ),
    );
    await Promise.all(
      unread.map((it) =>
        markNotificationRead(it.id).catch((e) =>
          console.warn('[notifications] markAll partial fail', e),
        ),
      ),
    );
  }, [items]);

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
          <View style={styles.titleWrap}>
            <Text style={styles.title}>{t('notifications.title')}</Text>
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            ) : null}
          </View>
          <Pressable
            onPress={handleMarkAll}
            hitSlop={12}
            disabled={unreadCount === 0}
            style={({ pressed }) => [
              styles.backBtn,
              pressed && { opacity: 0.6 },
              unreadCount === 0 && { opacity: 0.3 },
            ]}
          >
            <Feather name="check-circle" size={20} color={theme.colors.accent} />
          </Pressable>
        </View>

        <FlatList
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          data={loading || items.length === 0 ? [] : items}
          keyExtractor={(n) => n.id}
          removeClippedSubviews
          windowSize={10}
          maxToRenderPerBatch={10}
          initialNumToRender={8}
          renderItem={({ item: n }) => (
            <NotificationItem
              item={n}
              members={members}
              onPress={() => handlePress(n)}
              isOwnAction={n.actor_id === profile?.id}
              locale={i18n.language as 'tr' | 'en'}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.itemGap} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.accent}
            />
          }
          ListHeaderComponent={
            <Text style={styles.subtitle}>{t('notifications.subtitle')}</Text>
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={theme.colors.accent} />
              </View>
            ) : (
              <Card>
                <View style={styles.emptyWrap}>
                  <Feather name="bell-off" size={28} color={theme.colors.textDim} />
                  <Text style={styles.emptyText}>{t('notifications.empty')}</Text>
                </View>
              </Card>
            )
          }
        />
      </SafeAreaView>
    </View>
  );
}

function NotificationItem({
  item,
  members,
  onPress,
  isOwnAction,
  locale,
}: {
  item: NotificationWithActor;
  members: MemberLookup;
  onPress: () => void;
  isOwnAction: boolean;
  locale: 'tr' | 'en';
}) {
  const { t } = useTranslation();
  const isUnread = !item.read_at;
  const payload = item.payload as {
    key?: string;
    allowed?: boolean;
    member_id?: string;
    label_tr?: string;
    label_en?: string;
    is_critical?: boolean;
    // driver_request / request_approved / request_rejected payload
    job_id?: string;
    requester_name?: string;
    customer_name?: string;
  };
  const memberName =
    payload.member_id && members[payload.member_id]
      ? members[payload.member_id].full_name
      : '—';
  const actorName = item.actor?.full_name ?? '—';
  const friendlyKey =
    (locale === 'en' ? payload.label_en : payload.label_tr) ?? payload.key ?? '';

  let title = t('notifications.unknownEvent');
  let body = '';
  if (item.type === 'permission_grant' && payload.key) {
    title = t('notifications.permissionGrantTitle', { key: friendlyKey });
    body =
      payload.allowed === false
        ? t('notifications.permissionGrantBodyOff', {
            actor: actorName,
            member: memberName,
            key: friendlyKey,
          })
        : t('notifications.permissionGrantBody', {
            actor: actorName,
            member: memberName,
            key: friendlyKey,
          });
  } else if (item.type === 'driver_request') {
    title = t('notifications.driverRequestTitle');
    body = t('notifications.driverRequestBody', {
      requester: payload.requester_name ?? actorName,
      customer: payload.customer_name ?? '—',
    });
  } else if (item.type === 'request_approved') {
    title = t('notifications.requestApprovedTitle');
    body = t('notifications.requestApprovedBody', {
      actor: actorName,
      customer: payload.customer_name ?? '—',
    });
  } else if (item.type === 'request_rejected') {
    title = t('notifications.requestRejectedTitle');
    body = t('notifications.requestRejectedBody', {
      actor: actorName,
      customer: payload.customer_name ?? '—',
    });
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.notifRow,
        isUnread && styles.notifRowUnread,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.notifIconWrap}>
        {item.actor ? (
          <Avatar name={actorName} size={36} uri={item.actor?.avatar_url} />
        ) : (
          <Feather name="bell" size={20} color={theme.colors.accent} />
        )}
        {isUnread ? <View style={styles.unreadDot} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.notifTitleRow}>
          <Text style={styles.notifTitle} numberOfLines={2}>
            {title}
          </Text>
          {payload.is_critical ? (
            <View style={styles.criticalPill}>
              <Feather name="alert-triangle" size={9} color={theme.colors.warning} />
              <Text style={styles.criticalText}>{t('permissions.criticalBadge')}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.notifBody}>{body}</Text>
        <Text style={styles.notifTime}>{relativeTime(item.created_at, t)}</Text>
      </View>
      {isOwnAction ? (
        <View style={styles.youPill}>
          <Text style={styles.youPillText}>{t('common.you')}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function relativeTime(iso: string, t: (k: string, opts?: any) => string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return t('notifications.timeJustNow');
  if (min < 60) return t('notifications.timeMinutes', { count: min });
  const hr = Math.round(min / 60);
  if (hr < 24) return t('notifications.timeHours', { count: hr });
  const day = Math.round(hr / 24);
  return t('notifications.timeDays', { count: day });
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
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.semibold,
  },
  badge: {
    backgroundColor: theme.colors.accent,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: theme.font.weight.bold,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing['3xl'],
  },
  itemGap: { height: theme.spacing.sm },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    lineHeight: 20,
    marginBottom: theme.spacing.lg,
  },
  center: { paddingVertical: theme.spacing['2xl'], alignItems: 'center' },
  emptyWrap: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.lg,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
  },

  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  notifRowUnread: {
    borderColor: theme.colors.accent,
    backgroundColor: 'rgba(255,122,26,0.06)',
  },
  notifIconWrap: { position: 'relative' },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.accent,
    borderWidth: 2,
    borderColor: theme.colors.bg,
  },
  notifTitle: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
  },
  notifTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  criticalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(245,158,11,0.15)',
  },
  criticalText: {
    color: theme.colors.warning,
    fontSize: 10,
    fontWeight: theme.font.weight.semibold,
    letterSpacing: 0.2,
  },
  notifBody: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.xs,
    marginTop: 2,
    lineHeight: 18,
  },
  notifTime: {
    color: theme.colors.textDim,
    fontSize: 11,
    marginTop: 4,
  },
  youPill: {
    backgroundColor: theme.colors.accentMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  youPillText: {
    color: theme.colors.accent,
    fontSize: 10,
    fontWeight: theme.font.weight.semibold,
  },
});
