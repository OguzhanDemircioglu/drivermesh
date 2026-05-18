// Ride History — driver'ın geçmiş ride-source job'larını listeler.
// Hesap > Yolculuk Geçmişim'den erişilir.

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MeshBackground } from '@/components/MeshBackground';
import { Card } from '@/components/Card';
import { useAuth } from '@/auth/AuthProvider';
import { listMyRides, type RideHistoryItem } from '@/lib/rideHistory';
import { theme } from '@/theme';

const STATUS_TONE: Record<RideHistoryItem['status'], { fg: string; bg: string; labelKey: string }> = {
  created: { fg: theme.colors.textMuted, bg: 'rgba(138,147,166,0.12)', labelKey: 'jobs.status.created' },
  assigned: { fg: theme.colors.mesh, bg: theme.colors.meshMuted, labelKey: 'jobs.status.assigned' },
  in_progress: { fg: theme.colors.accent, bg: theme.colors.accentMuted, labelKey: 'jobs.status.in_progress' },
  completed: { fg: theme.colors.success, bg: 'rgba(34,197,94,0.14)', labelKey: 'jobs.status.completed' },
  failed: { fg: theme.colors.danger, bg: theme.colors.dangerMuted, labelKey: 'jobs.status.failed' },
  cancelled: { fg: theme.colors.textDim, bg: 'rgba(138,147,166,0.08)', labelKey: 'jobs.status.cancelled' },
};

export default function RideHistoryScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { session } = useAuth();
  const [rides, setRides] = useState<RideHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user.id) {
      setLoading(false);
      return;
    }
    try {
      const data = await listMyRides(session.user.id);
      setRides(data);
    } catch (e) {
      console.warn('[ride-history] load failed', e);
    } finally {
      setLoading(false);
    }
  }, [session?.user.id]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

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
          <Text style={styles.title}>{t('rideHistory.title')}</Text>
          <View style={styles.backBtn} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        ) : rides.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="map" size={40} color={theme.colors.textDim} />
            <Text style={styles.emptyTitle}>{t('rideHistory.emptyTitle')}</Text>
            <Text style={styles.emptyText}>{t('rideHistory.emptyText')}</Text>
          </View>
        ) : (
          <FlatList
            data={rides}
            keyExtractor={(r) => r.id}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.gap} />}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.accent}
                colors={[theme.colors.accent]}
              />
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/(app)/jobs/${item.id}`)}
                style={({ pressed }) => [pressed && { opacity: 0.85 }]}
              >
                <Card style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.customer} numberOfLines={1}>
                      {item.customer_name}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: STATUS_TONE[item.status].bg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: STATUS_TONE[item.status].fg },
                        ]}
                      >
                        {t(STATUS_TONE[item.status].labelKey)}
                      </Text>
                    </View>
                  </View>
                  {item.pickup_address ? (
                    <View style={styles.addrRow}>
                      <Feather name="map-pin" size={12} color={theme.colors.success} />
                      <Text style={styles.addrText} numberOfLines={1}>
                        {item.pickup_address}
                      </Text>
                    </View>
                  ) : null}
                  {item.dropoff_address ? (
                    <View style={styles.addrRow}>
                      <Feather name="navigation" size={12} color={theme.colors.accent} />
                      <Text style={styles.addrText} numberOfLines={1}>
                        {item.dropoff_address}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.metaRow}>
                    {item.distance_km != null ? (
                      <Text style={styles.meta}>{item.distance_km.toFixed(1)} km</Text>
                    ) : null}
                    <Text style={styles.meta}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </Card>
              </Pressable>
            )}
          />
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
    paddingHorizontal: theme.spacing.md,
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
    fontSize: theme.font.size.xl,
    fontWeight: theme.font.weight.bold,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: theme.spacing.xl,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.semibold,
    marginTop: 8,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    textAlign: 'center',
  },
  listContent: { paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.xl },
  gap: { height: 10 },
  card: { padding: theme.spacing.md, gap: 6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  customer: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
  },
  statusText: {
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
  },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addrText: {
    flex: 1,
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
  },
  metaRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  meta: { color: theme.colors.textDim, fontSize: theme.font.size.xs },
});
