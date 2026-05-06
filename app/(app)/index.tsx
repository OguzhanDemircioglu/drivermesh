import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { MeshBackground } from '@/components/MeshBackground';
import { Avatar } from '@/components/Avatar';
import { KpiCard } from '@/components/KpiCard';
import { JobCard } from '@/components/JobCard';
import { BottomNav } from '@/components/BottomNav';
import { Card } from '@/components/Card';
import { useAuth } from '@/auth/AuthProvider';
import { fetchHomeStats, type HomeStats } from '@/lib/queries';
import { theme } from '@/theme';

const EMPTY_STATS: HomeStats = {
  vehiclesTotal: 0,
  vehiclesActive: 0,
  teamCount: 0,
  pendingInvitations: 0,
  jobsToday: 0,
  jobsOpen: 0,
  jobsInProgress: 0,
  jobsCompletedToday: 0,
  todaysJobs: [],
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { session, profile, signOut } = useAuth();
  const [tab, setTab] = useState<'home' | 'jobs' | 'fleet' | 'account'>('home');
  const [stats, setStats] = useState<HomeStats>(EMPTY_STATS);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const next = await fetchHomeStats();
      setStats(next);
    } catch (e) {
      console.warn('[home] fetchHomeStats failed', e);
    }
  }, []);

  useEffect(() => {
    if (!profile?.organization_id) return;
    loadStats();
  }, [profile?.organization_id, loadStats]);

  useFocusEffect(
    useCallback(() => {
      if (profile?.organization_id) loadStats();
    }, [profile?.organization_id, loadStats]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  }, [loadStats]);

  const fullName = useMemo(() => {
    if (profile?.full_name) return profile.full_name;
    const email = session?.user.email ?? '';
    return email.split('@')[0] || t('common.user');
  }, [profile, session, t]);

  const firstName = fullName.split(' ')[0];
  const role = profile?.role ?? 'owner';
  const canAdd = role === 'owner' || role === 'manager';
  const isFleetReady = stats.vehiclesTotal > 0 && stats.teamCount > 1;
  const hasAnyData =
    stats.vehiclesTotal > 0 || stats.teamCount > 1 || stats.pendingInvitations > 0;

  const onTabChange = (next: typeof tab) => {
    setTab(next);
    if (next === 'home') return;
    if (next === 'jobs') {
      setTab('home');
      router.push('/(app)/jobs');
      return;
    }
    if (next === 'fleet') {
      setTab('home');
      router.push('/(app)/vehicles');
      return;
    }
    if (next === 'account') {
      setTab('home');
      router.push('/(app)/account');
      return;
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <MeshBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 110 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.accent}
              colors={[theme.colors.accent]}
            />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Avatar name={fullName} size={48} />
              <View style={styles.headerText}>
                <Text style={styles.greet}>{t('home.greeting')}</Text>
                <Text style={styles.name} numberOfLines={1}>
                  {firstName}
                </Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <Pressable
                hitSlop={10}
                onPress={() => router.push('/(app)/notifications')}
                style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
              >
                <Feather name="bell" size={20} color={theme.colors.text} />
              </Pressable>
              <Pressable
                hitSlop={10}
                onPress={() =>
                  Alert.alert(t('home.logoutTitle'), t('home.logoutMessage'), [
                    { text: t('home.logoutCancel'), style: 'cancel' },
                    { text: t('home.logoutConfirm'), style: 'destructive', onPress: () => signOut() },
                  ])
                }
                style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
              >
                <Feather name="log-out" size={20} color={theme.colors.text} />
              </Pressable>
            </View>
          </View>

          {/* Hero */}
          {isFleetReady ? (
            <FleetReadyHero stats={stats} />
          ) : (
            <FleetSetupHero
              stats={stats}
              onInvite={() => router.push('/(app)/team')}
              onAddVehicle={() => router.push('/(app)/vehicles/new')}
            />
          )}

          {/* KPI grid */}
          <View style={styles.kpiGrid}>
            <KpiCard
              label={t('home.kpiActiveVehicles')}
              value={`${stats.vehiclesActive} / ${stats.vehiclesTotal}`}
              icon="truck"
              tone="orange"
              style={styles.kpiHalf}
            />
            <KpiCard
              label={t('home.kpiTodayJobs')}
              value={stats.jobsToday}
              icon="package"
              tone="mesh"
              style={styles.kpiHalf}
            />
            <KpiCard
              label={t('home.kpiOpenJobs')}
              value={stats.jobsOpen}
              icon="alert-circle"
              tone="lavender"
              style={styles.kpiHalf}
            />
            <KpiCard
              label={t('home.kpiCompleted')}
              value={stats.jobsCompletedToday}
              icon="check-circle"
              tone="success"
              style={styles.kpiHalf}
            />
          </View>

          {/* Quick actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('home.quickActions')}</Text>
            <View style={styles.quickRow}>
              <QuickAction
                label={canAdd ? t('home.quickNew') : t('home.quickMyJobs')}
                icon={canAdd ? 'plus-square' : 'briefcase'}
                onPress={() =>
                  router.push(canAdd ? '/(app)/jobs/new' : '/(app)/jobs')
                }
              />
              <QuickAction
                label={canAdd ? t('home.quickAddTeam') : t('home.quickMyTeam')}
                icon={role === 'driver' ? 'users' : 'user-plus'}
                badge={stats.pendingInvitations > 0 ? stats.pendingInvitations : undefined}
                onPress={() => router.push('/(app)/team')}
              />
              <QuickAction
                label={canAdd ? t('home.quickAddVehicle') : t('home.quickFleet')}
                icon="truck"
                onPress={() =>
                  router.push(canAdd ? '/(app)/vehicles/new' : '/(app)/vehicles')
                }
              />
              <QuickAction
                label={t('home.quickReports')}
                icon="bar-chart-2"
                onPress={() => router.push('/(app)/reports')}
              />
            </View>
          </View>

          {/* Today's jobs */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('home.sectionTodayJobs')}</Text>
              {stats.todaysJobs.length > 0 ? (
                <Pressable hitSlop={8} onPress={() => router.push('/(app)/jobs')}>
                  <Text style={styles.sectionLink}>{t('home.sectionAll')}</Text>
                </Pressable>
              ) : null}
            </View>
            {stats.todaysJobs.length === 0 ? (
              <EmptyJobs
                hasAnyData={hasAnyData}
                onCreate={() =>
                  router.push(canAdd ? '/(app)/jobs/new' : '/(app)/jobs')
                }
              />
            ) : (
              <View style={styles.jobList}>
                {stats.todaysJobs.map((j) => (
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
                    onPress={() => router.push(`/(app)/jobs/${j.id}`)}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* FAB */}
      <Pressable
        onPress={() =>
          router.push(canAdd ? '/(app)/jobs/new' : '/(app)/jobs')
        }
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + 92 },
          pressed && { transform: [{ scale: 0.95 }] },
        ]}
      >
        <LinearGradient
          colors={['#FF8C3D', '#FF7A1A', '#F36300']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 30 }]}
        />
        <Feather name="plus" size={26} color="#0A0E1F" />
      </Pressable>

      <BottomNav active={tab} onChange={onTabChange} />
    </View>
  );
}

// ============================================================
// Hero variants
// ============================================================

function FleetReadyHero({ stats }: { stats: HomeStats }) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={() => {}}
      style={({ pressed }) => [styles.hero, pressed && { opacity: 0.95 }]}
    >
      <LinearGradient
        colors={['#1A2348', '#0F1530', '#0A0E1F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroBg}
      />
      <View style={styles.heroBorder} />
      <View style={styles.heroBadge}>
        <View style={styles.pulseDot} />
        <Text style={styles.heroBadgeText}>{t('home.heroLive')}</Text>
      </View>
      <Text style={styles.heroTitle}>{t('home.heroReadyTitle')}</Text>
      <Text style={styles.heroSubtitle}>
        {t('home.heroReadySubtitle', {
          open: stats.jobsOpen,
          progress: stats.jobsInProgress,
          active: stats.vehiclesActive,
        })}
      </Text>
      <View style={styles.heroStats}>
        <View style={styles.heroStat}>
          <Text style={styles.heroStatValue}>{stats.teamCount}</Text>
          <Text style={styles.heroStatLabel}>{t('home.teamMembers')}</Text>
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.heroStat}>
          <Text style={styles.heroStatValue}>{stats.vehiclesTotal}</Text>
          <Text style={styles.heroStatLabel}>{t('home.vehicles')}</Text>
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.heroStat}>
          <Text style={[styles.heroStatValue, { color: theme.colors.success }]}>
            {stats.jobsCompletedToday}
          </Text>
          <Text style={styles.heroStatLabel}>{t('home.completedToday')}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function FleetSetupHero({
  stats,
  onInvite,
  onAddVehicle,
}: {
  stats: HomeStats;
  onInvite: () => void;
  onAddVehicle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.hero}>
      <LinearGradient
        colors={['#1A2348', '#0F1530', '#0A0E1F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroBg}
      />
      <View style={styles.heroBorder} />
      <View style={[styles.heroBadge, { backgroundColor: theme.colors.accentMuted }]}>
        <Feather name="zap" size={11} color={theme.colors.accent} />
        <Text style={[styles.heroBadgeText, { color: theme.colors.accent }]}>
          {t('home.heroSetup')}
        </Text>
      </View>
      <Text style={styles.heroTitle}>{t('home.heroSetupTitle')}</Text>
      <Text style={styles.heroSubtitle}>{t('home.heroSetupSubtitle')}</Text>

      <View style={styles.setupSteps}>
        <SetupStep
          step={1}
          title={t('home.setupTeam')}
          subtitle={
            stats.teamCount > 1
              ? t('home.setupTeamDone', { count: stats.teamCount })
              : stats.pendingInvitations > 0
                ? t('home.setupTeamPending', { count: stats.pendingInvitations })
                : t('home.setupTeamEmpty')
          }
          done={stats.teamCount > 1}
          onPress={onInvite}
        />
        <SetupStep
          step={2}
          title={t('home.setupVehicle')}
          subtitle={
            stats.vehiclesTotal > 0
              ? t('home.setupVehicleDone', { count: stats.vehiclesTotal })
              : t('home.setupVehicleEmpty')
          }
          done={stats.vehiclesTotal > 0}
          onPress={onAddVehicle}
        />
      </View>
    </View>
  );
}

function SetupStep({
  step,
  title,
  subtitle,
  done,
  onPress,
}: {
  step: number;
  title: string;
  subtitle: string;
  done: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.setupStep, pressed && { opacity: 0.85 }]}
    >
      <View
        style={[
          styles.setupNum,
          done && { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
        ]}
      >
        {done ? (
          <Feather name="check" size={14} color="#0A0E1F" />
        ) : (
          <Text style={styles.setupNumText}>{step}</Text>
        )}
      </View>
      <View style={styles.setupBody}>
        <Text style={styles.setupTitle}>{title}</Text>
        <Text style={styles.setupSubtitle}>{subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={theme.colors.textDim} />
    </Pressable>
  );
}

// ============================================================
// Quick action button
// ============================================================

function QuickAction({
  label,
  icon,
  onPress,
  badge,
  disabled,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  badge?: number;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickItem,
        disabled && { opacity: 0.45 },
        pressed && !disabled && { opacity: 0.8 },
      ]}
    >
      <View style={styles.quickIconWrap}>
        <Feather name={icon} size={20} color={theme.colors.accent} />
        {badge ? (
          <View style={styles.badgePill}>
            <Text style={styles.badgePillText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.quickLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

// ============================================================
// Empty jobs state
// ============================================================

function EmptyJobs({
  hasAnyData,
  onCreate,
}: {
  hasAnyData: boolean;
  onCreate: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <Feather name="package" size={22} color={theme.colors.accent} />
      </View>
      <Text style={styles.emptyTitle}>{t('home.emptyJobsTitle')}</Text>
      <Text style={styles.emptyText}>
        {hasAnyData
          ? t('home.emptyJobsTextHasData')
          : t('home.emptyJobsTextEmpty')}
      </Text>
      <Pressable
        onPress={onCreate}
        style={({ pressed }) => [styles.emptyCta, pressed && { opacity: 0.85 }]}
      >
        <Feather name="plus" size={16} color={theme.colors.accent} />
        <Text style={styles.emptyCtaText}>{t('home.emptyJobsCta')}</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  safe: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerText: { flex: 1 },
  greet: { color: theme.colors.textMuted, fontSize: theme.font.size.sm },
  name: {
    color: theme.colors.text,
    fontSize: theme.font.size.xl,
    fontWeight: theme.font.weight.bold,
    letterSpacing: -0.4,
  },
  headerRight: { flexDirection: 'row', gap: 10 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  hero: {
    borderRadius: theme.radius['2xl'],
    overflow: 'hidden',
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  heroBg: { ...StyleSheet.absoluteFillObject, borderRadius: theme.radius['2xl'] },
  heroBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(91,127,255,0.2)',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.success,
  },
  heroBadgeText: {
    fontSize: 11,
    color: theme.colors.text,
    fontWeight: theme.font.weight.semibold,
    letterSpacing: 0.4,
  },
  heroTitle: {
    fontSize: theme.font.size['2xl'],
    fontWeight: theme.font.weight.bold,
    color: theme.colors.text,
    letterSpacing: -0.5,
  },
  heroSubtitle: { color: theme.colors.textMuted, fontSize: theme.font.size.sm, lineHeight: 20 },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  heroStat: { flex: 1, gap: 2 },
  heroStatValue: {
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.bold,
    color: theme.colors.text,
  },
  heroStatLabel: { fontSize: 11, color: theme.colors.textDim },
  heroDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.08)' },

  setupSteps: { gap: 10, marginTop: theme.spacing.sm },
  setupStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  setupNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  setupNumText: { color: theme.colors.text, fontSize: 12, fontWeight: '700' },
  setupBody: { flex: 1, gap: 2 },
  setupTitle: { color: theme.colors.text, fontSize: theme.font.size.md, fontWeight: '600' },
  setupSubtitle: { color: theme.colors.textMuted, fontSize: theme.font.size.xs },

  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  kpiHalf: { flexBasis: '47%', flexGrow: 1 },

  section: { gap: theme.spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.semibold,
    letterSpacing: -0.3,
  },
  sectionLink: {
    color: theme.colors.mesh,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.medium,
  },

  quickRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickItem: {
    flex: 1,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 8,
  },
  quickIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentMuted,
  },
  quickLabel: { fontSize: 12, color: theme.colors.text, fontWeight: theme.font.weight.medium },
  badgePill: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: theme.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePillText: { color: 'white', fontSize: 10, fontWeight: '700' },

  jobList: { gap: 12 },

  emptyCard: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: theme.spacing.xl,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentMuted,
    marginTop: 4,
  },
  emptyCtaText: { color: theme.colors.accent, fontWeight: theme.font.weight.semibold },

  fab: {
    position: 'absolute',
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#FF7A1A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 12,
  },
});
