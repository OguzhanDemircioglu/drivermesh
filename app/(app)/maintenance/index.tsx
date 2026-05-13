import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/auth/AuthProvider';
import { listMaintenanceRequests, type MaintenanceRequestWithRefs } from '@/lib/maintenance';
import { badgeFromSummary, type AuthenticityBadge } from '@/lib/photoAuthenticity';
import { theme } from '@/theme';

type Tab = 'pending' | 'all';

export default function MaintenanceListScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('pending');
  const [items, setItems] = useState<MaintenanceRequestWithRefs[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (withSpinner = true) => {
      if (!profile?.organization_id) return;
      try {
        if (withSpinner) setLoading(true);
        const list = await listMaintenanceRequests(profile.organization_id, {
          onlyPending: tab === 'pending',
        });
        setItems(list);
      } catch (e) {
        console.warn('[maintenance/list] load', e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [profile?.organization_id, tab],
  );

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  const dateFormat = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language === 'tr' ? 'tr-TR' : 'en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  const statusKey = (s: MaintenanceRequestWithRefs['status']) =>
    `maintenance.detail.status${s.charAt(0).toUpperCase()}${s.slice(1)}` as const;

  const statusColor = (s: MaintenanceRequestWithRefs['status']): string => {
    switch (s) {
      case 'pending':
        return theme.colors.warning;
      case 'approved':
        return theme.colors.success;
      case 'rejected':
        return theme.colors.danger;
      default:
        return theme.colors.textMuted;
    }
  };

  return (
    <Screen contentStyle={styles.scroll}>
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
          <Feather name="tool" size={11} color={theme.colors.accent} />
          <Text style={styles.eyebrowText}>{t('maintenance.new.eyebrow')}</Text>
        </View>
        <Text style={styles.title}>{t('maintenance.list.title')}</Text>
      </View>

      <View style={styles.tabs}>
        {(['pending', 'all'] as Tab[]).map((k) => (
          <Pressable
            key={k}
            onPress={() => setTab(k)}
            style={[styles.tab, tab === k && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>
              {k === 'pending' ? t('maintenance.list.tabPending') : t('maintenance.list.tabAll')}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Feather name="check-circle" size={28} color={theme.colors.textMuted} />
          <Text style={styles.emptyText}>
            {tab === 'pending' ? t('maintenance.list.emptyPending') : t('maintenance.list.empty')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(false);
              }}
              tintColor={theme.colors.accent}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/(app)/maintenance/${item.id}`)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.rowHead}>
                <Text style={styles.rowPlate}>{item.vehicle?.plate ?? '—'}</Text>
                <View style={[styles.statusPill, { borderColor: statusColor(item.status) }]}>
                  <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
                    {t(statusKey(item.status))}
                  </Text>
                </View>
              </View>
              <Text style={styles.rowReason} numberOfLines={2}>
                {item.reason}
              </Text>
              <View style={styles.rowMeta}>
                <Text style={styles.rowMetaText}>
                  {item.requester?.full_name ?? '—'}
                </Text>
                <Text style={styles.rowMetaText}>·</Text>
                <Text style={styles.rowMetaText}>{dateFormat(item.requested_at)}</Text>
                {item.photo_urls.length > 0 ? (
                  <>
                    <Text style={styles.rowMetaText}>·</Text>
                    <View style={styles.photoIndicator}>
                      <Feather name="image" size={10} color={theme.colors.textMuted} />
                      <Text style={styles.rowMetaText}>{item.photo_urls.length}</Text>
                    </View>
                  </>
                ) : null}
              </View>
              <AuthenticityBadgeRow item={item} />
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

// Photo authenticity flag — 3 katmanli check sonucu (lib/photoAuthenticity.ts).
// Edge fn `photo-authenticity-check` v6 arkada DB row'una yazar; talep
// olusturulduktan ~5-15 sn sonra goruntulenir (Pull-to-refresh ile guncel).
function AuthenticityBadgeRow({ item }: { item: MaintenanceRequestWithRefs }) {
  const badge: AuthenticityBadge = badgeFromSummary({
    suspected_ai: item.suspected_ai ?? undefined,
    ai_score: item.ai_score ?? 0,
    exif_status: item.exif_status as never,
    content_class: item.content_class as never,
    content_top_label: item.content_top_label ?? '',
    content_score: item.content_score ?? 0,
  });
  if (!badge) return null;
  const config = {
    wrong_content: {
      icon: 'alert-octagon' as const,
      color: theme.colors.danger,
      bg: 'rgba(239,68,68,0.12)',
      label: item.content_top_label
        ? `Yanlis icerik: ${item.content_top_label}`
        : 'Yanlis icerik',
    },
    ai_generated: {
      icon: 'cpu' as const,
      color: '#F59E0B',
      bg: 'rgba(245,158,11,0.12)',
      label: 'AI ile uretilmis suphesi',
    },
    exif_missing: {
      icon: 'help-circle' as const,
      color: theme.colors.textMuted,
      bg: 'rgba(148,163,184,0.12)',
      label: 'EXIF metadata yok',
    },
    exif_stale: {
      icon: 'clock' as const,
      color: theme.colors.textMuted,
      bg: 'rgba(148,163,184,0.12)',
      label: 'EXIF tarihi eski',
    },
  }[badge];
  if (!config) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 6,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        backgroundColor: config.bg,
        alignSelf: 'flex-start',
      }}
    >
      <Feather name={config.icon} size={11} color={config.color} />
      <Text style={{ fontSize: 11, color: config.color, fontWeight: '600' }}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingTop: theme.spacing.lg, gap: theme.spacing.md, flex: 1 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { color: theme.colors.text, fontSize: theme.font.size.md, fontWeight: theme.font.weight.medium },

  header: { gap: theme.spacing.sm },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: theme.colors.accentMuted,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  eyebrowText: {
    color: theme.colors.accent,
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.bold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.font.size['2xl'],
    fontWeight: theme.font.weight.bold,
  },

  tabs: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.full,
    padding: 4,
    alignSelf: 'flex-start',
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
  },
  tabActive: { backgroundColor: theme.colors.accentMuted },
  tabText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.medium,
  },
  tabTextActive: { color: theme.colors.accent, fontWeight: theme.font.weight.semibold },

  center: { alignItems: 'center', gap: 8, paddingVertical: theme.spacing['2xl'] },
  emptyText: { color: theme.colors.textMuted, fontSize: theme.font.size.sm },

  listContent: { gap: 10, paddingBottom: theme.spacing['3xl'] },

  row: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowPlate: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.bold,
    letterSpacing: 0.5,
  },
  rowReason: { color: theme.colors.text, fontSize: theme.font.size.sm, lineHeight: 19 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  rowMetaText: { color: theme.colors.textMuted, fontSize: theme.font.size.xs },
  photoIndicator: { flexDirection: 'row', alignItems: 'center', gap: 3 },

  statusPill: {
    borderWidth: 1,
    borderRadius: theme.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
    letterSpacing: 0.4,
  },
});
