import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { MeshBackground } from '@/components/MeshBackground';
import { Card } from '@/components/Card';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/auth/AuthProvider';
import { fetchReportStats, type ReportStats } from '@/lib/queries';
import { theme } from '@/theme';

const EMPTY: ReportStats = {
  rangeDays: 30,
  totalJobs: 0,
  byStatus: { open: 0, assigned: 0, in_progress: 0, completed: 0, failed: 0, cancelled: 0 },
  bySource: { internal: 0, driver_request: 0, ride: 0 },
  topDrivers: [],
  topVehicles: [],
  totalDistanceKm: 0,
  averageDistanceKm: null,
};

export default function ReportsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [stats, setStats] = useState<ReportStats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.organization_id) return;
    const next = await fetchReportStats(30);
    setStats(next);
    setLoading(false);
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

  const successRate =
    stats.totalJobs > 0
      ? Math.round((stats.byStatus.completed / stats.totalJobs) * 100)
      : null;

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
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('reports.title')}</Text>
            <Text style={styles.range}>{t('reports.rangeLabel', { days: stats.rangeDays })}</Text>
          </View>
          <View style={styles.backBtn} />
        </View>

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
          {!loading && stats.totalJobs === 0 ? (
            <Card>
              <View style={styles.emptyWrap}>
                <Feather name="bar-chart-2" size={28} color={theme.colors.textMuted} />
                <Text style={styles.emptyTitle}>{t('reports.empty')}</Text>
                <Text style={styles.emptyHint}>{t('reports.emptyHint')}</Text>
              </View>
            </Card>
          ) : (
            <>
              {/* Summary card */}
              <Card>
                <Text style={styles.sectionTitle}>{t('reports.summary')}</Text>
                <View style={styles.summaryRow}>
                  <SummaryStat
                    label={t('reports.totalJobs')}
                    value={stats.totalJobs}
                    color={theme.colors.text}
                  />
                  <SummaryStat
                    label={t('reports.completed')}
                    value={stats.byStatus.completed}
                    color={theme.colors.success}
                    suffix={successRate !== null ? `· %${successRate}` : undefined}
                  />
                  <SummaryStat
                    label={t('reports.failed')}
                    value={stats.byStatus.failed}
                    color={theme.colors.danger}
                  />
                </View>
                <View style={[styles.summaryRow, { marginTop: 12 }]}>
                  <SummaryStat
                    label={t('reports.inProgress')}
                    value={stats.byStatus.in_progress}
                    color={theme.colors.accent}
                  />
                  <SummaryStat
                    label={t('reports.open')}
                    value={stats.byStatus.open}
                    color={theme.colors.lavender}
                  />
                  <SummaryStat
                    label={t('reports.cancelled')}
                    value={stats.byStatus.cancelled}
                    color={theme.colors.textMuted}
                  />
                </View>
              </Card>

              {/* Source breakdown */}
              <Card>
                <Text style={styles.sectionTitle}>{t('reports.bySource')}</Text>
                <SourceRow
                  label={t('reports.sourceInternal')}
                  count={stats.bySource.internal}
                  total={stats.totalJobs}
                  color={theme.colors.accent}
                />
                <SourceRow
                  label={t('reports.sourceRide')}
                  count={stats.bySource.ride}
                  total={stats.totalJobs}
                  color={theme.colors.lavender}
                />
                <SourceRow
                  label={t('reports.sourceDriverRequest')}
                  count={stats.bySource.driver_request}
                  total={stats.totalJobs}
                  color={theme.colors.mesh}
                />
              </Card>

              {/* Distance */}
              <Card>
                <Text style={styles.sectionTitle}>{t('reports.distance')}</Text>
                <View style={styles.summaryRow}>
                  <SummaryStat
                    label={t('reports.distanceTotal')}
                    value={stats.totalDistanceKm}
                    color={theme.colors.text}
                    suffix="km"
                  />
                  <SummaryStat
                    label={t('reports.distanceAvg')}
                    value={stats.averageDistanceKm ?? '—'}
                    color={theme.colors.text}
                    suffix={stats.averageDistanceKm !== null ? 'km' : undefined}
                  />
                </View>
              </Card>

              {/* Top drivers */}
              {stats.topDrivers.length > 0 ? (
                <Card>
                  <Text style={styles.sectionTitle}>{t('reports.topDrivers')}</Text>
                  {stats.topDrivers.map((d) => (
                    <View key={d.id} style={styles.driverRow}>
                      <Avatar name={d.name} size={36} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.driverName}>{d.name}</Text>
                        <Text style={styles.driverMeta}>
                          <Text style={{ color: theme.colors.success }}>
                            {d.completed} {t('reports.completed').toLowerCase()}
                          </Text>
                          {d.failed > 0 ? (
                            <Text>
                              {' · '}
                              <Text style={{ color: theme.colors.danger }}>
                                {d.failed} {t('reports.failed').toLowerCase()}
                              </Text>
                            </Text>
                          ) : null}
                        </Text>
                      </View>
                    </View>
                  ))}
                </Card>
              ) : null}

              {/* Top vehicles */}
              {stats.topVehicles.length > 0 ? (
                <Card>
                  <Text style={styles.sectionTitle}>{t('reports.topVehicles')}</Text>
                  {stats.topVehicles.map((v) => (
                    <View key={v.id} style={styles.vehicleRow}>
                      <View style={styles.vehicleIcon}>
                        <Feather name="truck" size={16} color={theme.colors.success} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.vehiclePlate}>{v.plate}</Text>
                        <Text style={styles.vehicleMeta}>
                          {v.brand} {v.model}
                        </Text>
                      </View>
                      <Text style={styles.vehicleCount}>{v.jobs}</Text>
                    </View>
                  ))}
                </Card>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function SummaryStat({
  label,
  value,
  color,
  suffix,
}: {
  label: string;
  value: number | string;
  color: string;
  suffix?: string;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.statValue, { color }]} numberOfLines={1}>
        {value}
        {suffix ? <Text style={styles.statSuffix}> {suffix}</Text> : null}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function SourceRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <View style={styles.sourceWrap}>
      <View style={styles.sourceHead}>
        <Text style={styles.sourceLabel}>{label}</Text>
        <Text style={styles.sourceValue}>
          {count} <Text style={styles.sourcePct}>· %{Math.round(pct)}</Text>
        </Text>
      </View>
      <View style={styles.sourceBar}>
        <View style={[styles.sourceBarFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.semibold,
    textAlign: 'center',
  },
  range: {
    color: theme.colors.textDim,
    fontSize: theme.font.size.xs,
    textAlign: 'center',
    marginTop: 2,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing['3xl'],
    gap: theme.spacing.lg,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
    marginBottom: theme.spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  statValue: {
    fontSize: theme.font.size['2xl'],
    fontWeight: theme.font.weight.bold,
    letterSpacing: -0.5,
  },
  statSuffix: {
    fontSize: theme.font.size.xs,
    color: theme.colors.textDim,
    fontWeight: theme.font.weight.medium,
  },
  statLabel: {
    color: theme.colors.textDim,
    fontSize: theme.font.size.xs,
    marginTop: 2,
  },
  sourceWrap: { marginBottom: 12 },
  sourceHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  sourceLabel: { color: theme.colors.text, fontSize: theme.font.size.sm },
  sourceValue: { color: theme.colors.text, fontSize: theme.font.size.sm, fontWeight: '600' },
  sourcePct: { color: theme.colors.textDim, fontSize: theme.font.size.xs, fontWeight: '400' },
  sourceBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  sourceBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  driverName: { color: theme.colors.text, fontSize: theme.font.size.md, fontWeight: '600' },
  driverMeta: { color: theme.colors.textMuted, fontSize: theme.font.size.xs, marginTop: 2 },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  vehicleIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(46,204,113,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehiclePlate: { color: theme.colors.text, fontSize: theme.font.size.md, fontWeight: '600' },
  vehicleMeta: { color: theme.colors.textMuted, fontSize: theme.font.size.xs, marginTop: 2 },
  vehicleCount: {
    color: theme.colors.accent,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.bold,
  },
  emptyWrap: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
  },
  emptyHint: { color: theme.colors.textMuted, fontSize: theme.font.size.sm, textAlign: 'center' },
});
