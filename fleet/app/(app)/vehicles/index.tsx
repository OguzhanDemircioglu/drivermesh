import { useCallback, useState } from 'react';
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
import { BottomNav } from '@/components/BottomNav';
import { MeshBackground } from '@/components/MeshBackground';
import { useBottomNavRouter } from '@/hooks/useBottomNavRouter';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { VehicleCard } from '@/components/VehicleCard';
import { useAuth } from '@/auth/AuthProvider';
import { listVehicles, type VehicleWithAdder } from '@/lib/vehicles';
import { badgeFromSummary } from '@/lib/photoAuthenticity';
import { claimVehicle } from '@/lib/vehicleClaim';
import { useToast } from '@/components/Toast';
import { theme } from '@/theme';
import { useTranslation } from 'react-i18next';

export default function VehiclesScreen() {
  const nav = useBottomNavRouter('fleet');
  const router = useRouter();
  const { t } = useTranslation();
  const { profile, session } = useAuth();
  const toast = useToast();
  const [vehicles, setVehicles] = useState<VehicleWithAdder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);

  const onClaim = useCallback(
    async (vehicleId: string) => {
      if (!session?.user.id || claiming) return;
      setClaiming(vehicleId);
      try {
        await claimVehicle(vehicleId, session.user.id, 'manual');
        toast.success(t('vehicleClaim.successClaim'));
        await load();
      } catch (e) {
        toast.error(t('vehicleClaim.errorTitle'), (e as Error).message);
      } finally {
        setClaiming(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session?.user.id, claiming, t, toast],
  );

  const load = useCallback(async () => {
    if (!profile?.organization_id) {
      // Profile yoksa (oturum bozulmuş / yetim auth user) sonsuz spinner'ı önle.
      setVehicles([]);
      setLoading(false);
      return;
    }
    try {
      const data = await listVehicles(profile.organization_id);
      setVehicles(data);
    } catch (e) {
      console.warn('[vehicles] load failed', e);
    } finally {
      setLoading(false);
    }
  }, [profile?.organization_id]);

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

  const canAdd = profile?.role === 'owner' || profile?.role === 'manager';
  const activeCount = vehicles.filter((v) => v.status === 'active').length;

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
          <Text style={styles.title}>{t('vehicles.title')}</Text>
          <View style={styles.backBtn} />
        </View>

        <FlatList
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          data={loading || vehicles.length === 0 ? [] : vehicles}
          keyExtractor={(v) => v.id}
          removeClippedSubviews
          windowSize={10}
          maxToRenderPerBatch={10}
          initialNumToRender={8}
          renderItem={({ item: v }) => (
            <VehicleCard
              plate={v.plate}
              brand={v.brand}
              model={v.model}
              year={v.year}
              status={v.status}
              addedBy={v.added_by_profile?.full_name ?? null}
              currentUserName={v.current_user_profile?.full_name ?? null}
              onClaim={
                // Driver/manager kendi üzerinde olmayan idle aracı alabilir.
                // Owner için button gerek yok (her şey zaten üzerinde).
                profile?.role !== 'owner' &&
                v.status === 'idle' &&
                v.current_user_id !== session?.user.id &&
                !v.maintenance_started_at
                  ? () => onClaim(v.id)
                  : null
              }
              photoUrl={v.photo_url}
              color={v.color}
              authenticityBadge={badgeFromSummary({
                suspected_ai: v.suspected_ai ?? undefined,
                ai_score: v.ai_score ?? 0,
                exif_status: v.exif_status as never,
                content_class: v.content_class as never,
                content_top_label: v.content_top_label ?? '',
                content_score: v.content_score ?? 0,
              })}
              onPress={() => router.push(`/(app)/vehicles/${v.id}`)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.listGap} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.accent}
              colors={[theme.colors.accent]}
            />
          }
          ListHeaderComponent={
            <View style={styles.headerStack}>
              <Card style={styles.summary}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{vehicles.length}</Text>
                  <Text style={styles.summaryLabel}>{t('vehicles.summaryTotal')}</Text>
                </View>
                <View style={styles.summarySep} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: theme.colors.success }]}>
                    {activeCount}
                  </Text>
                  <Text style={styles.summaryLabel}>{t('vehicles.summaryActive')}</Text>
                </View>
                <View style={styles.summarySep} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: theme.colors.warning }]}>
                    {vehicles.filter((v) => v.status === 'maintenance').length}
                  </Text>
                  <Text style={styles.summaryLabel}>{t('vehicles.summaryMaintenance')}</Text>
                </View>
              </Card>

              <View style={styles.ctaRow}>
                {canAdd ? (
                  <Button
                    title={t('vehicles.addCta')}
                    leftIcon={<Feather name="plus" size={18} color="#0A0E1F" />}
                    onPress={() => router.push('/(app)/vehicles/new')}
                    style={{ flex: 1 }}
                  />
                ) : null}
                <Button
                  title={t('fleetMap.openCta')}
                  variant="secondary"
                  leftIcon={<Feather name="map" size={16} color={theme.colors.text} />}
                  onPress={() => router.push('/(app)/fleet-map')}
                  style={canAdd ? { flex: 1 } : undefined}
                />
              </View>
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={theme.colors.accent} style={{ marginVertical: 24 }} />
            ) : (
              <Card style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <Feather name="truck" size={26} color={theme.colors.accent} />
                </View>
                <Text style={styles.emptyTitle}>{t('vehicles.emptyTitle')}</Text>
                <Text style={styles.emptyText}>
                  {canAdd ? t('vehicles.emptyTextCanAdd') : t('vehicles.emptyTextReadOnly')}
                </Text>
              </Card>
            )
          }
        />
      </SafeAreaView>
      <BottomNav {...nav} />
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
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summarySep: { width: 1, height: 28, backgroundColor: theme.colors.border },
  summaryValue: {
    color: theme.colors.text,
    fontSize: theme.font.size['2xl'],
    fontWeight: theme.font.weight.bold,
    letterSpacing: -0.4,
  },
  summaryLabel: { color: theme.colors.textMuted, fontSize: theme.font.size.xs },

  headerStack: { gap: theme.spacing.lg, marginBottom: theme.spacing.lg },
  ctaRow: { flexDirection: 'row', gap: 10 },
  listGap: { height: 10 },
  emptyCard: { alignItems: 'center', gap: 10, paddingVertical: theme.spacing.xl },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: theme.spacing.lg,
  },
});
