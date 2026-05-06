import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { MeshBackground } from '@/components/MeshBackground';
import { Card } from '@/components/Card';
import { useAuth } from '@/auth/AuthProvider';
import { useCan } from '@/auth/useCan';
import {
  deleteVehicle,
  getVehicle,
  listVehicleJobs,
  updateVehicle,
  type VehicleJobLite,
  type VehicleWithAdder,
} from '@/lib/vehicles';
import type { JobStatus, VehicleStatus } from '@/lib/database.types';
import { theme } from '@/theme';

const STATUS_OPTIONS: VehicleStatus[] = ['idle', 'active', 'maintenance'];

const STATUS_TONE: Record<VehicleStatus, { fg: string; bg: string }> = {
  active: { fg: theme.colors.success, bg: 'rgba(34,197,94,0.14)' },
  idle: { fg: theme.colors.textMuted, bg: 'rgba(138,147,166,0.12)' },
  maintenance: { fg: theme.colors.warning, bg: 'rgba(245,158,11,0.14)' },
};

const JOB_STATUS_TONE: Record<JobStatus, string> = {
  open: theme.colors.lavender,
  assigned: theme.colors.accent,
  in_progress: theme.colors.accent,
  completed: theme.colors.success,
  failed: theme.colors.danger,
  cancelled: theme.colors.textMuted,
};

const PLATE_GRADIENTS: Array<readonly [string, string]> = [
  ['#FF8C3D', '#FF7A1A'],
  ['#5B7FFF', '#3D5DDB'],
  ['#B89AF0', '#8C6CD2'],
  ['#22C55E', '#15803D'],
];

export default function VehicleDetailScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const canUpdate = useCan('vehicles.update');
  const canDelete = useCan('vehicles.delete');
  const [vehicle, setVehicle] = useState<VehicleWithAdder | null>(null);
  const [jobs, setJobs] = useState<VehicleJobLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<VehicleStatus | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [v, vJobs] = await Promise.all([getVehicle(id), listVehicleJobs(id, 5)]);
      setVehicle(v);
      setJobs(vJobs);
    } catch (e) {
      console.warn('[vehicles/detail] load failed', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onChangeStatus = useCallback(
    async (next: VehicleStatus) => {
      if (!vehicle || vehicle.status === next || savingStatus) return;
      if (!canUpdate.allowed) {
        Alert.alert(t('common.permissionMissingTitle'), canUpdate.reason ?? t('common.permissionMissing'));
        return;
      }
      setSavingStatus(next);
      const prev = vehicle.status;
      setVehicle({ ...vehicle, status: next });
      try {
        await updateVehicle(vehicle.id, { status: next });
        Alert.alert(t('vehicles.detail.statusSavedTitle'), t('vehicles.detail.statusSavedText'));
      } catch (e) {
        setVehicle({ ...vehicle, status: prev });
        Alert.alert(t('vehicles.detail.statusError'), (e as Error).message);
      } finally {
        setSavingStatus(null);
      }
    },
    [vehicle, savingStatus, canUpdate, t],
  );

  const onDelete = useCallback(() => {
    if (!vehicle) return;
    if (!canDelete.allowed) {
      Alert.alert(
        t('common.permissionMissingTitle'),
        canDelete.reason ?? t('common.permissionMissing'),
      );
      return;
    }
    Alert.alert(
      t('vehicles.detail.deleteConfirmTitle'),
      t('vehicles.detail.deleteConfirmText', { plate: vehicle.plate }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('vehicles.detail.deleteConfirmBtn'),
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteVehicle(vehicle.id);
              Alert.alert(
                t('vehicles.detail.deleteSuccessTitle'),
                t('vehicles.detail.deleteSuccessText'),
                [{ text: t('common.done'), onPress: () => router.back() }],
              );
            } catch (e) {
              setDeleting(false);
              Alert.alert(t('vehicles.detail.deleteError'), (e as Error).message);
            }
          },
        },
      ],
    );
  }, [vehicle, canDelete, t, router]);

  const gradient = useMemo<readonly [string, string]>(() => {
    if (!vehicle) return PLATE_GRADIENTS[0];
    return PLATE_GRADIENTS[vehicle.plate.charCodeAt(0) % PLATE_GRADIENTS.length];
  }, [vehicle]);

  const dateFormatter = useCallback(
    (iso: string) =>
      new Date(iso).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'tr-TR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }),
    [i18n.language],
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
          <Text style={styles.title}>{t('vehicles.detail.title')}</Text>
          <View style={styles.backBtn} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        ) : !vehicle ? (
          <View style={styles.center}>
            <Text style={styles.notFound}>{t('vehicles.detail.notFound')}</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero */}
            <View style={styles.hero}>
              <LinearGradient
                colors={[gradient[0], gradient[1]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroBg}
              />
              <Feather name="truck" size={36} color="rgba(255,255,255,0.95)" />
              <Text style={styles.heroPlate}>{vehicle.plate}</Text>
              <Text style={styles.heroModel}>
                {vehicle.brand} {vehicle.model} · {vehicle.year}
              </Text>
              <View style={[styles.heroBadge, { backgroundColor: STATUS_TONE[vehicle.status].bg }]}>
                <View style={[styles.heroDot, { backgroundColor: STATUS_TONE[vehicle.status].fg }]} />
                <Text style={[styles.heroBadgeText, { color: STATUS_TONE[vehicle.status].fg }]}>
                  {t(`vehicles.status.${vehicle.status}`)}
                </Text>
              </View>
            </View>

            {/* Status switcher */}
            <Card>
              <Text style={styles.sectionTitle}>{t('vehicles.detail.sectionStatus')}</Text>
              <Text style={styles.sectionHint}>{t('vehicles.detail.statusHint')}</Text>
              <View style={styles.statusRow}>
                {STATUS_OPTIONS.map((s) => {
                  const active = vehicle.status === s;
                  const tone = STATUS_TONE[s];
                  return (
                    <Pressable
                      key={s}
                      onPress={() => onChangeStatus(s)}
                      disabled={savingStatus !== null || !canUpdate.allowed}
                      style={({ pressed }) => [
                        styles.statusBtn,
                        active && {
                          borderColor: tone.fg,
                          backgroundColor: tone.bg,
                        },
                        (!canUpdate.allowed || savingStatus !== null) && { opacity: 0.55 },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      {savingStatus === s ? (
                        <ActivityIndicator color={tone.fg} size="small" />
                      ) : (
                        <View style={[styles.statusDot, { backgroundColor: tone.fg }]} />
                      )}
                      <Text style={[styles.statusBtnText, active && { color: tone.fg }]}>
                        {t(`vehicles.status.${s}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {!canUpdate.allowed && !canUpdate.loading ? (
                <Text style={styles.permWarn}>
                  <Feather name="lock" size={11} color={theme.colors.textDim} />{' '}
                  {canUpdate.reason}
                </Text>
              ) : null}
            </Card>

            {/* Info */}
            <Card>
              <Text style={styles.sectionTitle}>{t('vehicles.detail.sectionInfo')}</Text>
              {vehicle.added_by_profile?.full_name ? (
                <InfoRow
                  icon="user"
                  label={t('vehicles.addedBy', { name: vehicle.added_by_profile.full_name })}
                />
              ) : null}
              <InfoRow
                icon="calendar"
                label={`${t('vehicles.detail.addedOn')}: ${dateFormatter(vehicle.created_at)}`}
              />
            </Card>

            {/* Recent jobs */}
            <Card>
              <Text style={styles.sectionTitle}>{t('vehicles.detail.sectionRecentJobs')}</Text>
              {jobs.length === 0 ? (
                <Text style={styles.empty}>{t('vehicles.detail.noJobs')}</Text>
              ) : (
                jobs.map((j) => (
                  <Pressable
                    key={j.id}
                    onPress={() => router.push(`/(app)/jobs/${j.id}`)}
                    style={({ pressed }) => [styles.jobRow, pressed && { opacity: 0.7 }]}
                  >
                    <View
                      style={[
                        styles.jobDot,
                        { backgroundColor: JOB_STATUS_TONE[j.status as JobStatus] ?? theme.colors.textMuted },
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.jobName} numberOfLines={1}>
                        {j.customer_name}
                      </Text>
                      <Text style={styles.jobMeta} numberOfLines={1}>
                        {t(`jobs.status.${j.status}`, j.status)}
                        {j.driver?.full_name ? ` · ${j.driver.full_name}` : ''}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={theme.colors.textDim} />
                  </Pressable>
                ))
              )}
            </Card>

            {/* Delete */}
            <Pressable
              onPress={onDelete}
              disabled={deleting || !canDelete.allowed}
              style={({ pressed }) => [
                styles.deleteBtn,
                (!canDelete.allowed || deleting) && { opacity: 0.5 },
                pressed && { opacity: 0.7 },
              ]}
            >
              {deleting ? (
                <ActivityIndicator color={theme.colors.danger} />
              ) : (
                <>
                  <Feather name="trash-2" size={16} color={theme.colors.danger} />
                  <Text style={styles.deleteText}>{t('vehicles.detail.deleteCta')}</Text>
                </>
              )}
            </Pressable>
            {!canDelete.allowed && !canDelete.loading ? (
              <Text style={[styles.permWarn, { textAlign: 'center' }]}>
                <Feather name="lock" size={11} color={theme.colors.textDim} />{' '}
                {canDelete.reason}
              </Text>
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function InfoRow({
  icon,
  label,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Feather name={icon} size={14} color={theme.colors.textMuted} />
      <Text style={styles.infoText} numberOfLines={2}>
        {label}
      </Text>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { color: theme.colors.textMuted, fontSize: theme.font.size.md },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing['3xl'],
    gap: theme.spacing.lg,
  },

  hero: {
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    gap: 8,
    position: 'relative',
  },
  heroBg: { ...StyleSheet.absoluteFillObject, opacity: 0.18 },
  heroPlate: {
    color: theme.colors.text,
    fontSize: theme.font.size['3xl'],
    fontWeight: theme.font.weight.bold,
    letterSpacing: 2,
    marginTop: 4,
  },
  heroModel: { color: theme.colors.textMuted, fontSize: theme.font.size.sm },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: theme.radius.full,
    marginTop: 6,
  },
  heroDot: { width: 6, height: 6, borderRadius: 3 },
  heroBadgeText: { fontSize: theme.font.size.xs, fontWeight: theme.font.weight.semibold },

  sectionTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
  },
  sectionHint: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.xs,
    marginTop: 2,
    marginBottom: theme.spacing.md,
  },

  statusRow: { flexDirection: 'row', gap: 8 },
  statusBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBtnText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
  },
  permWarn: {
    color: theme.colors.textDim,
    fontSize: theme.font.size.xs,
    marginTop: theme.spacing.sm,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  infoText: { color: theme.colors.text, fontSize: theme.font.size.sm },

  empty: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    paddingVertical: 8,
  },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  jobDot: { width: 8, height: 8, borderRadius: 4 },
  jobName: { color: theme.colors.text, fontSize: theme.font.size.sm, fontWeight: '600' },
  jobMeta: { color: theme.colors.textMuted, fontSize: theme.font.size.xs, marginTop: 2 },

  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.dangerMuted,
    backgroundColor: 'rgba(239,68,68,0.06)',
  },
  deleteText: {
    color: theme.colors.danger,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
  },
});
