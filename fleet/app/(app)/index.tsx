import { useCallback, useMemo, useState } from 'react';
import {
  InteractionManager,
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
import { JobCard } from '@/components/JobCard';
import { BottomNav } from '@/components/BottomNav';
import { Card } from '@/components/Card';
import { StatusPill } from '@/components/StatusPill';
import { useDriverActiveRide } from '../../src/hooks/useDriverActiveRide';
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
  vehiclesList: [],
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { session, profile } = useAuth();

  // Saat dilimine göre selamlama. JavaScript `new Date().getHours()` cihazın
  // sistem timezone'unu kullanır → kullanıcı hangi ülkedeyse o yerel saatte
  // doğru karşılama gelir, ekstra timezone hesabı gerekmez.
  // Aralıklar: 05–11 sabah, 12–17 öğleden sonra, 18–22 akşam, 23–04 gece.
  const greetingKey = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'home.greetingMorning';
    if (h >= 12 && h < 18) return 'home.greetingAfternoon';
    if (h >= 18 && h < 23) return 'home.greetingEvening';
    return 'home.greetingNight';
  }, []);

  const [tab, setTab] = useState<'home' | 'jobs' | 'fleet' | 'account'>('home');
  const [stats, setStats] = useState<HomeStats>(EMPTY_STATS);
  const [refreshing, setRefreshing] = useState(false);
  const isDriver = profile?.role === 'driver';
  const driverActive = useDriverActiveRide(isDriver ? session?.user.id : undefined);

  const loadStats = useCallback(async () => {
    try {
      const next = await fetchHomeStats();
      setStats(next);
    } catch (e) {
      console.warn('[home] fetchHomeStats failed', e);
    }
  }, []);

  // Defer the stats fetch until the slide-in animation has finished. The
  // load itself is a few hundred ms of bridge + JSON work; running it
  // concurrently with the screen transition makes the tail of the slide
  // visibly stutter on slower devices.
  useFocusEffect(
    useCallback(() => {
      if (!profile?.organization_id) return;
      const handle = InteractionManager.runAfterInteractions(loadStats);
      return () => handle.cancel();
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
              <Avatar name={fullName} size={72} uri={profile?.avatar_url} />
              <View style={styles.headerText}>
                <Text style={styles.greet} numberOfLines={1}>
                  {t(greetingKey)}
                </Text>
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
                <Feather name="bell" size={28} color={theme.colors.text} />
              </Pressable>
            </View>
          </View>

          {/* Status row — bildirim + dil seçici satırının ALTINDA, full-width
              comfortable tap target. Driver için ride'da görünürlüğü,
              owner/manager için takım visibility'sini etkiler. */}
          <View style={styles.statusRow}>
            <StatusPill expanded />
          </View>

          {/* Driver active-ride banner — şoför aktif yolculuktayken anasayfa kısayolu */}
          {isDriver && driverActive.data ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(app)/driver-ride')}
              style={({ pressed }) => [styles.driverBanner, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.driverBannerIcon}>
                <Feather name="navigation" size={20} color={theme.colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.driverBannerTitle}>{t('driverRide.bannerTitle')}</Text>
                <Text style={styles.driverBannerHint}>{t('driverRide.bannerSubtitle')}</Text>
              </View>
              <Feather name="chevron-right" size={20} color={theme.colors.accent} />
            </Pressable>
          ) : null}

          {/* Live status strip — demo ile aynı görünüm, her kullanıcıda
              gösterilir. Onboarding setup hero'su kaldırıldı; filo
              kurma adımlarına QuickAction'lardan ulaşılır. */}
          <Pressable
            onPress={() => router.push('/(app)/fleet-map')}
            style={({ pressed }) => [styles.liveStrip, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.livePulseDot} />
            <Text style={styles.liveLabel}>{t('home.heroLive')}</Text>
            <Text style={styles.liveSep}>·</Text>
            <Text style={styles.liveCta} numberOfLines={1}>{t('home.liveStripCta')}</Text>
            <Feather name="chevron-right" size={14} color={theme.colors.accent} />
          </Pressable>

          {/* Filo Ritmi — KPI grid'in yerini aldı: filo durumunu macro
              (segmentli bar) + micro (per-vehicle dot) + mikro KPI metni
              tek karede. Klasik 4-cell sayım yerine "filomun ritmi nasıl?"
              hissi veriyor. */}
          <FleetRhythm
            vehicles={stats.vehiclesList}
            jobsCompletedToday={stats.jobsCompletedToday}
            jobsOpen={stats.jobsOpen}
            onVehicleTap={(id) => router.push(`/(app)/vehicles/${id}`)}
          />

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
                canCreate={canAdd}
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

      <BottomNav active={tab} onChange={onTabChange} />
    </View>
  );
}

// ============================================================
// Filo Ritmi — segmentli bar + per-vehicle dot satırı + mikro KPI
// ============================================================

type FleetRhythmProps = {
  vehicles: HomeStats['vehiclesList'];
  jobsCompletedToday: number;
  jobsOpen: number;
  onVehicleTap: (id: string) => void;
};

const STATUS_COLORS: Record<'active' | 'idle' | 'maintenance', string> = {
  active: theme.colors.success,
  idle: theme.colors.textMuted,
  maintenance: theme.colors.warning,
};

function FleetRhythm({
  vehicles,
  jobsCompletedToday,
  jobsOpen,
  onVehicleTap,
}: FleetRhythmProps) {
  const { t } = useTranslation();
  const total = vehicles.length;
  const counts = {
    active: vehicles.filter((v) => v.status === 'active').length,
    idle: vehicles.filter((v) => v.status === 'idle').length,
    maintenance: vehicles.filter((v) => v.status === 'maintenance').length,
  };

  // Plate'in son 3 hane gibi okunan kısmı (ör. "34 ABC 123" → "123").
  // Tek hücreye sığsın diye kısa label.
  const plateTail = (plate: string) => plate.replace(/\s+/g, '').slice(-3);

  return (
    <View style={styles.rhythmCard}>
      <View style={styles.rhythmTopRow}>
        <Text style={styles.rhythmCountText}>
          <Text style={[styles.rhythmCountStrong, { color: STATUS_COLORS.active }]}>
            {counts.active}
          </Text>{' '}
          {t('home.fleetRhythm.active')}
          {counts.idle > 0 ? (
            <Text>
              {'  ·  '}
              <Text style={[styles.rhythmCountStrong, { color: STATUS_COLORS.idle }]}>
                {counts.idle}
              </Text>{' '}
              {t('home.fleetRhythm.idle')}
            </Text>
          ) : null}
          {counts.maintenance > 0 ? (
            <Text>
              {'  ·  '}
              <Text
                style={[styles.rhythmCountStrong, { color: STATUS_COLORS.maintenance }]}
              >
                {counts.maintenance}
              </Text>{' '}
              {t('home.fleetRhythm.maintenance')}
            </Text>
          ) : null}
        </Text>
      </View>

      {/* Stacked bar — flex oranları doğrudan filo karışımını verir. */}
      {total > 0 ? (
        <View style={styles.rhythmBar}>
          {counts.active > 0 ? (
            <View
              style={[
                styles.rhythmBarSeg,
                { flex: counts.active, backgroundColor: STATUS_COLORS.active },
              ]}
            />
          ) : null}
          {counts.idle > 0 ? (
            <View
              style={[
                styles.rhythmBarSeg,
                { flex: counts.idle, backgroundColor: STATUS_COLORS.idle },
              ]}
            />
          ) : null}
          {counts.maintenance > 0 ? (
            <View
              style={[
                styles.rhythmBarSeg,
                { flex: counts.maintenance, backgroundColor: STATUS_COLORS.maintenance },
              ]}
            />
          ) : null}
        </View>
      ) : (
        <View style={[styles.rhythmBar, styles.rhythmBarEmpty]} />
      )}

      {/* Per-vehicle dot satırı — tap → araç detay. */}
      {vehicles.length > 0 ? (
        <View style={styles.rhythmDotsRow}>
          {vehicles.map((v) => {
            const c =
              STATUS_COLORS[v.status as 'active' | 'idle' | 'maintenance'] ??
              theme.colors.textMuted;
            return (
              <Pressable
                key={v.id}
                onPress={() => onVehicleTap(v.id)}
                style={({ pressed }) => [
                  styles.rhythmDotCell,
                  pressed && { opacity: 0.7 },
                ]}
                hitSlop={6}
              >
                <View style={[styles.rhythmDot, { backgroundColor: c }]} />
                <Text style={styles.rhythmDotLabel} numberOfLines={1}>
                  {plateTail(v.plate)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Mikro KPI footer — eski grid'deki "Bugün biten" + "Açık iş". */}
      <View style={styles.rhythmFooter}>
        <Text style={styles.rhythmFooterText}>
          <Feather name="check-circle" size={11} color={theme.colors.success} />{' '}
          {t('home.completedToday')}:{' '}
          <Text style={styles.rhythmFooterStrong}>{jobsCompletedToday}</Text>
        </Text>
        <Text style={styles.rhythmFooterSep}>·</Text>
        <Text style={styles.rhythmFooterText}>
          <Feather name="alert-circle" size={11} color={theme.colors.lavender} />{' '}
          {t('home.kpiOpenJobs')}:{' '}
          <Text style={styles.rhythmFooterStrong}>{jobsOpen}</Text>
        </Text>
      </View>
    </View>
  );
}

// ============================================================
// Hero variants
// ============================================================

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
      disabled={disabled}
      style={({ pressed }) => [
        styles.quickItem,
        pressed && !disabled && styles.quickItemPressed,
        disabled && { opacity: 0.45 },
      ]}
    >
      <View style={styles.quickIconWrap}>
        <Feather name={icon} size={24} color={theme.colors.accent} />
        {badge ? (
          <View style={styles.badgePill}>
            <Text style={styles.badgePillText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.quickLabel} numberOfLines={2}>
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
  canCreate,
  onCreate,
}: {
  hasAnyData: boolean;
  canCreate: boolean;
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
      {canCreate ? (
        <Pressable
          onPress={onCreate}
          style={({ pressed }) => [styles.emptyCta, pressed && { opacity: 0.85 }]}
        >
          <Feather name="plus" size={16} color={theme.colors.accent} />
          <Text style={styles.emptyCtaText}>{t('home.emptyJobsCta')}</Text>
        </Pressable>
      ) : null}
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  headerText: { flex: 1 },
  greet: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.medium,
  },
  name: {
    color: theme.colors.text,
    fontSize: theme.font.size['2xl'],
    fontWeight: theme.font.weight.bold,
    letterSpacing: -0.6,
    marginTop: 2,
  },
  headerRight: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  statusRow: { marginTop: 8 },
  driverBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentMuted,
    marginTop: 6,
  },
  driverBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverBannerTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  driverBannerHint: { color: theme.colors.textMuted, fontSize: 13, marginTop: 2 },
  iconBtn: {
    width: 60,
    height: 60,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  liveStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.32)',
    backgroundColor: 'rgba(34,197,94,0.08)',
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.success,
  },
  liveLabel: {
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
    color: theme.colors.success,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  liveSep: { color: theme.colors.textDim, fontSize: 12 },
  liveCta: {
    flex: 1,
    textAlign: 'right',
    color: theme.colors.accent,
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
  },

  rhythmCard: {
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  rhythmTopRow: { flexDirection: 'row', alignItems: 'center' },
  rhythmCountText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.medium,
  },
  rhythmCountStrong: {
    fontWeight: theme.font.weight.bold,
    fontSize: theme.font.size.md,
  },
  rhythmBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  rhythmBarSeg: { height: '100%' },
  rhythmBarEmpty: { backgroundColor: 'rgba(255,255,255,0.04)' },
  rhythmDotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingTop: 2,
  },
  rhythmDotCell: { alignItems: 'center', gap: 6, minWidth: 36 },
  rhythmDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  rhythmDotLabel: {
    color: theme.colors.textDim,
    fontSize: 10,
    fontWeight: theme.font.weight.medium,
    letterSpacing: 0.4,
  },
  rhythmFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  rhythmFooterText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.xs,
  },
  rhythmFooterStrong: {
    color: theme.colors.text,
    fontWeight: theme.font.weight.semibold,
  },
  rhythmFooterSep: { color: theme.colors.textDim, fontSize: 11 },

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

  // 5 item → 2 sütun grid (2 satır 2 + son satır 1 sola yaslı). Tek
  // satıra sıkışmış 5 ufacık item yerine, her aksiyona belirgin geniş
  // bir kart. Daha az aksiyon görünür ama her biri rahat tap-target.
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickItem: {
    width: '48%',
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    alignItems: 'center',
    gap: 8,
  },
  quickItemPressed: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.surface,
  },
  quickIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(255,122,26,0.32)',
  },
  quickLabel: {
    fontSize: theme.font.size.sm,
    color: theme.colors.text,
    fontWeight: theme.font.weight.semibold,
    textAlign: 'center',
  },
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
});
