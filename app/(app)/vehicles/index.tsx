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
import { Button } from '@/components/Button';
import { VehicleCard } from '@/components/VehicleCard';
import { useAuth } from '@/auth/AuthProvider';
import { listVehicles, type VehicleWithAdder } from '@/lib/vehicles';
import { theme } from '@/theme';
import { useTranslation } from 'react-i18next';

export default function VehiclesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<VehicleWithAdder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.organization_id) return;
    try {
      const data = await listVehicles(profile.organization_id);
      setVehicles(data);
    } catch (e) {
      console.warn('[vehicles] load failed', e);
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
          {/* Summary */}
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

          {canAdd ? (
            <Button
              title={t('vehicles.addCta')}
              leftIcon={<Feather name="plus" size={18} color="#0A0E1F" />}
              onPress={() => router.push('/(app)/vehicles/new')}
            />
          ) : null}

          {loading ? (
            <ActivityIndicator color={theme.colors.accent} style={{ marginVertical: 24 }} />
          ) : vehicles.length === 0 ? (
            <Card style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Feather name="truck" size={26} color={theme.colors.accent} />
              </View>
              <Text style={styles.emptyTitle}>{t('vehicles.emptyTitle')}</Text>
              <Text style={styles.emptyText}>
                {canAdd ? t('vehicles.emptyTextCanAdd') : t('vehicles.emptyTextReadOnly')}
              </Text>
            </Card>
          ) : (
            <View style={styles.list}>
              {vehicles.map((v) => (
                <VehicleCard
                  key={v.id}
                  plate={v.plate}
                  brand={v.brand}
                  model={v.model}
                  year={v.year}
                  status={v.status}
                  addedBy={v.added_by_profile?.full_name ?? null}
                  photoUrl={v.photo_url}
                  onPress={() => router.push(`/(app)/vehicles/${v.id}`)}
                />
              ))}
            </View>
          )}
        </ScrollView>
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

  list: { gap: 10 },
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
