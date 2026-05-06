import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { Button } from '@/components/Button';
import { JobCard } from '@/components/JobCard';
import { useAuth } from '@/auth/AuthProvider';
import { listJobs, simulateRideJob, type JobWithRefs } from '@/lib/jobs';
import { theme } from '@/theme';
import type { JobStatus } from '@/lib/database.types';

const FILTER_KEYS: Array<JobStatus | 'all'> = [
  'all',
  'open',
  'assigned',
  'in_progress',
  'completed',
];

export default function JobsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { profile, session } = useAuth();
  const [jobs, setJobs] = useState<JobWithRefs[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<JobStatus | 'all'>('all');

  const load = useCallback(async () => {
    if (!profile?.organization_id) return;
    try {
      const data = await listJobs(profile.organization_id);
      setJobs(data);
    } catch (e) {
      console.warn('[jobs] load failed', e);
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

  const visibleJobs = useMemo(() => {
    if (filter === 'all') return jobs;
    return jobs.filter((j) => j.status === filter);
  }, [jobs, filter]);

  const role = profile?.role ?? 'driver';
  const canCreate = role === 'owner' || role === 'manager';
  const isDriver = role === 'driver';

  // Driver-specific: show open jobs (assignable) + own jobs
  const driverOpenJobs = useMemo(
    () => (isDriver ? jobs.filter((j) => j.status === 'open' && !j.driver_id) : []),
    [jobs, isDriver],
  );
  const driverMyJobs = useMemo(
    () => (isDriver ? jobs.filter((j) => j.driver_id === session?.user.id) : []),
    [jobs, isDriver, session?.user.id],
  );

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
          <Text style={styles.title}>{t('jobs.title')}</Text>
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
          {canCreate ? (
            <View style={{ gap: 10 }}>
              <Button
                title={t('jobs.newJob')}
                leftIcon={<Feather name="plus" size={18} color="#0A0E1F" />}
                onPress={() => router.push('/(app)/jobs/new')}
              />
              <Pressable
                onPress={async () => {
                  try {
                    await simulateRideJob();
                    await load();
                    Alert.alert(t('jobs.simSuccessTitle'), t('jobs.simSuccessText'));
                  } catch (e: unknown) {
                    Alert.alert(
                      t('errors.generic'),
                      e instanceof Error ? e.message : t('errors.generic'),
                    );
                  }
                }}
                style={({ pressed }) => [styles.simBtn, pressed && { opacity: 0.7 }]}
              >
                <Feather name="zap" size={14} color={theme.colors.mesh} />
                <Text style={styles.simText}>{t('jobs.simulateRide')}</Text>
              </Pressable>
            </View>
          ) : null}

          {loading ? (
            <ActivityIndicator color={theme.colors.accent} style={{ marginVertical: 24 }} />
          ) : isDriver ? (
            <DriverView
              openJobs={driverOpenJobs}
              myJobs={driverMyJobs}
              onPressJob={(id) => router.push(`/(app)/jobs/${id}`)}
            />
          ) : (
            <ManagerView
              jobs={visibleJobs}
              filter={filter}
              onFilterChange={setFilter}
              onPressJob={(id) => router.push(`/(app)/jobs/${id}`)}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// =============================================================
// Owner / Manager view
// =============================================================

function ManagerView({
  jobs,
  filter,
  onFilterChange,
  onPressJob,
}: {
  jobs: JobWithRefs[];
  filter: JobStatus | 'all';
  onFilterChange: (s: JobStatus | 'all') => void;
  onPressJob: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {FILTER_KEYS.map((key) => {
          const active = key === filter;
          return (
            <Pressable
              key={key}
              onPress={() => onFilterChange(key)}
              style={({ pressed }) => [
                styles.filterChip,
                active && styles.filterChipActive,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {t(`jobs.filters.${key}`)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {jobs.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Feather name="package" size={26} color={theme.colors.accent} />
          <Text style={styles.emptyTitle}>{t('jobs.emptyFilterTitle')}</Text>
          <Text style={styles.emptyText}>{t('jobs.emptyFilterText')}</Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {jobs.map((j) => (
            <JobCard
              key={j.id}
              customer={j.customer_name}
              pickup={j.pickup_address}
              dropoff={j.dropoff_address}
              driver={j.driver?.full_name ?? null}
              distanceKm={j.distance_km != null ? Number(j.distance_km) : null}
              etaMinutes={j.eta_minutes ?? null}
              status={j.status}
              source={j.source}
              onPress={() => onPressJob(j.id)}
            />
          ))}
        </View>
      )}
    </>
  );
}

// =============================================================
// Driver view
// =============================================================

function DriverView({
  openJobs,
  myJobs,
  onPressJob,
}: {
  openJobs: JobWithRefs[];
  myJobs: JobWithRefs[];
  onPressJob: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t('jobs.driverOpenTitle', { count: openJobs.length })}
        </Text>
        {openJobs.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Feather name="inbox" size={22} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>{t('jobs.driverNoOpenTitle')}</Text>
            <Text style={styles.emptyText}>{t('jobs.driverNoOpenText')}</Text>
          </Card>
        ) : (
          <View style={styles.list}>
            {openJobs.map((j) => (
              <JobCard
                key={j.id}
                customer={j.customer_name}
                pickup={j.pickup_address}
                dropoff={j.dropoff_address}
                driver={null}
                distanceKm={j.distance_km != null ? Number(j.distance_km) : null}
                etaMinutes={j.eta_minutes ?? null}
                status={j.status}
                source={j.source}
                onPress={() => onPressJob(j.id)}
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t('jobs.driverMyTitle', { count: myJobs.length })}
        </Text>
        {myJobs.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Feather name="user-check" size={22} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>{t('jobs.driverNoMyTitle')}</Text>
            <Text style={styles.emptyText}>{t('jobs.driverNoMyText')}</Text>
          </Card>
        ) : (
          <View style={styles.list}>
            {myJobs.map((j) => (
              <JobCard
                key={j.id}
                customer={j.customer_name}
                pickup={j.pickup_address}
                dropoff={j.dropoff_address}
                driver={j.driver?.full_name ?? null}
                distanceKm={j.distance_km != null ? Number(j.distance_km) : null}
                etaMinutes={j.eta_minutes ?? null}
                status={j.status}
                source={j.source}
                onPress={() => onPressJob(j.id)}
              />
            ))}
          </View>
        )}
      </View>
    </>
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

  filters: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: theme.colors.accentMuted,
    borderColor: 'rgba(255,122,26,0.4)',
  },
  filterText: { color: theme.colors.textMuted, fontSize: theme.font.size.sm, fontWeight: '500' },
  filterTextActive: { color: theme.colors.accent, fontWeight: '600' },

  section: { gap: theme.spacing.md },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.semibold,
    letterSpacing: -0.3,
  },
  list: { gap: 10 },
  emptyCard: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: theme.spacing.xl,
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
    paddingHorizontal: theme.spacing.lg,
    lineHeight: 20,
  },
  simBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.meshMuted,
    borderWidth: 1,
    borderColor: 'rgba(91,127,255,0.25)',
  },
  simText: { color: theme.colors.mesh, fontSize: theme.font.size.xs, fontWeight: theme.font.weight.medium },
});
