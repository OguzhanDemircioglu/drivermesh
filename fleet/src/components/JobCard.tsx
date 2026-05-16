import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Card } from './Card';
import { theme } from '@/theme';
import type { JobSource, JobStatus } from '@/lib/database.types';

const statusTone: Record<JobStatus, { fg: string; bg: string; dot: string }> = {
  open: {
    fg: theme.colors.mesh,
    bg: theme.colors.meshMuted,
    dot: theme.colors.mesh,
  },
  assigned: {
    fg: theme.colors.lavender,
    bg: 'rgba(184,154,240,0.14)',
    dot: theme.colors.lavender,
  },
  in_progress: {
    fg: theme.colors.accent,
    bg: theme.colors.accentMuted,
    dot: theme.colors.accent,
  },
  completed: {
    fg: theme.colors.success,
    bg: 'rgba(34,197,94,0.12)',
    dot: theme.colors.success,
  },
  failed: {
    fg: theme.colors.danger,
    bg: theme.colors.dangerMuted,
    dot: theme.colors.danger,
  },
  cancelled: {
    fg: theme.colors.textMuted,
    bg: 'rgba(138,147,166,0.14)',
    dot: theme.colors.textMuted,
  },
};

const sourceTone: Partial<
  Record<JobSource, { icon: keyof typeof Feather.glyphMap; fg: string; bg: string }>
> = {
  ride: {
    icon: 'smartphone',
    fg: theme.colors.mesh,
    bg: theme.colors.meshMuted,
  },
  driver_request: {
    icon: 'user',
    fg: theme.colors.lavender,
    bg: 'rgba(184,154,240,0.14)',
  },
};

type Props = {
  customer: string;
  pickup: string;
  dropoff: string;
  driver: string | null;
  distanceKm: number | null;
  etaMinutes: number | null;
  status: JobStatus;
  source?: JobSource;
  onPress?: () => void;
};

function JobCardImpl({
  customer,
  pickup,
  dropoff,
  driver,
  distanceKm,
  etaMinutes,
  status,
  source,
  onPress,
}: Props) {
  const { t } = useTranslation();
  const s = statusTone[status];
  const src = source && source !== 'internal' ? sourceTone[source] : null;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && { opacity: 0.85, transform: [{ scale: 0.995 }] }]}
    >
      <Card style={styles.card}>
        {src ? (
          <View style={[styles.sourceBadge, { backgroundColor: src.bg }]}>
            <Feather name={src.icon} size={11} color={src.fg} />
            <Text style={[styles.sourceText, { color: src.fg }]}>
              {t(`jobs.source.${source as 'ride' | 'driver_request'}`)}
            </Text>
          </View>
        ) : null}
        <View style={styles.headerRow}>
          <Text style={styles.customer} numberOfLines={1}>
            {customer}
          </Text>
          <View style={[styles.badge, { backgroundColor: s.bg }]}>
            <View style={[styles.dot, { backgroundColor: s.dot }]} />
            <Text style={[styles.badgeText, { color: s.fg }]}>
              {t(`jobs.status.${status}`)}
            </Text>
          </View>
        </View>

        <View style={styles.routeWrap}>
          <View style={styles.routeRow}>
            <View style={[styles.markerOuter, { borderColor: theme.colors.mesh }]}>
              <View style={[styles.markerInner, { backgroundColor: theme.colors.mesh }]} />
            </View>
            <Text style={styles.routeText} numberOfLines={1}>
              {pickup}
            </Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={[styles.markerOuter, { borderColor: theme.colors.accent }]}>
              <View style={[styles.markerInner, { backgroundColor: theme.colors.accent }]} />
            </View>
            <Text style={styles.routeText} numberOfLines={1}>
              {dropoff}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.metaItem}>
            <Feather name="user" size={13} color={theme.colors.textMuted} />
            <Text style={styles.metaText} numberOfLines={1}>
              {driver ?? t('jobs.notAssigned')}
            </Text>
          </View>
          <View style={styles.metaSep} />
          <View style={styles.metaItem}>
            <Feather name="navigation" size={13} color={theme.colors.textMuted} />
            <Text style={styles.metaText}>
              {distanceKm != null
                ? t('common.km', { value: distanceKm.toFixed(1) })
                : t('jobs.distancePlaceholder')}
            </Text>
          </View>
          <View style={styles.metaSep} />
          <View style={styles.metaItem}>
            <Feather name="clock" size={13} color={theme.colors.textMuted} />
            <Text style={styles.metaText}>
              {etaMinutes != null
                ? t('common.minutes', { count: etaMinutes })
                : t('jobs.etaPlaceholder')}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

export const JobCard = memo(JobCardImpl);

const styles = StyleSheet.create({
  card: { gap: 14 },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  sourceText: { fontSize: 11, fontWeight: theme.font.weight.semibold, letterSpacing: 0.4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  customer: {
    flex: 1,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
    color: theme.colors.text,
    paddingRight: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.full,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: theme.font.size.xs, fontWeight: theme.font.weight.semibold },
  routeWrap: { gap: 6 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  markerOuter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerInner: { width: 6, height: 6, borderRadius: 3 },
  routeText: { flex: 1, color: theme.colors.text, fontSize: theme.font.size.sm },
  routeLine: {
    width: 2,
    height: 14,
    backgroundColor: theme.colors.border,
    marginLeft: 6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 12,
    gap: 10,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: theme.colors.textMuted, fontSize: theme.font.size.xs },
  metaSep: { width: 1, height: 12, backgroundColor: theme.colors.border },
});
