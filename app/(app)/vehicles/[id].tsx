import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  InteractionManager,
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
import { CachedImage } from '@/components/CachedImage';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { useAuth } from '@/auth/AuthProvider';
import { useCan } from '@/auth/useCan';
import {
  deleteVehicle,
  getVehicle,
  listVehicleJobs,
  setVehicleAtHq,
  type VehicleJobLite,
  type VehicleWithAdder,
} from '@/lib/vehicles';
import type { JobStatus, VehicleStatus } from '@/lib/database.types';
import { theme } from '@/theme';

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

// Hex → i18n key for the colour palette used in `vehicles/new.tsx`. Keeps
// the detail screen showing human labels ("Kırmızı") instead of raw hex
// for colours picked from the form's swatch row. Custom hex values that
// don't match a palette entry fall back to the hex string itself.
const COLOR_PALETTE_KEY_BY_HEX: Record<string, string> = {
  '#f8fafc': 'white',
  '#1f2937': 'black',
  '#94a3b8': 'silver',
  '#ef4444': 'red',
  '#ff7a1a': 'orange',
  '#f59e0b': 'yellow',
  '#22c55e': 'green',
  '#3d5ddb': 'blue',
};

export default function VehicleDetailScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const toast = useToast();
  const { confirm } = useConfirm();
  const canUpdate = useCan('vehicles.update');
  const canDelete = useCan('vehicles.delete');
  const [vehicle, setVehicle] = useState<VehicleWithAdder | null>(null);
  const [jobs, setJobs] = useState<VehicleJobLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingAtHq, setSavingAtHq] = useState(false);
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

  useFocusEffect(
    useCallback(() => {
      const handle = InteractionManager.runAfterInteractions(load);
      return () => handle.cancel();
    }, [load]),
  );

  const onMarkAtHq = useCallback(async () => {
    if (!vehicle || savingAtHq) return;
    if (!canUpdate.allowed) {
      toast.warning(
        t('common.permissionMissingTitle'),
        canUpdate.reason ?? t('common.permissionMissing'),
      );
      return;
    }
    setSavingAtHq(true);
    const prev = vehicle.is_at_hq;
    // Optimistic flip — the button transitions from active CTA to the
    // disabled "Araç Lojistik üssünde" pill in place. No popup.
    setVehicle({ ...vehicle, is_at_hq: true });
    try {
      await setVehicleAtHq(vehicle.id, true);
    } catch (e) {
      setVehicle({ ...vehicle, is_at_hq: prev });
      toast.error(t('vehicles.detail.statusError'), (e as Error).message);
    } finally {
      setSavingAtHq(false);
    }
  }, [vehicle, savingAtHq, canUpdate, t, toast]);

  const onDelete = useCallback(async () => {
    if (!vehicle) return;
    if (!canDelete.allowed) {
      toast.warning(
        t('common.permissionMissingTitle'),
        canDelete.reason ?? t('common.permissionMissing'),
      );
      return;
    }
    const ok = await confirm({
      title: t('vehicles.detail.deleteConfirmTitle'),
      message: t('vehicles.detail.deleteConfirmText', { plate: vehicle.plate }),
      confirmText: t('vehicles.detail.deleteConfirmBtn'),
      cancelText: t('common.cancel'),
      kind: 'destructive',
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteVehicle(vehicle.id);
      toast.success(
        t('vehicles.detail.deleteSuccessTitle'),
        t('vehicles.detail.deleteSuccessText'),
      );
      router.back();
    } catch (e) {
      setDeleting(false);
      toast.error(t('vehicles.detail.deleteError'), (e as Error).message);
    }
  }, [vehicle, canDelete, t, router, toast, confirm]);

  const gradient = useMemo<readonly [string, string]>(() => {
    if (!vehicle) return PLATE_GRADIENTS[0];
    // Operator-chosen colour wins. Compute a darker shade for the second
    // gradient stop so the hero still has depth.
    if (vehicle.color) {
      const m = /^#([\da-f]{6})$/i.exec(vehicle.color);
      if (m) {
        const n = parseInt(m[1], 16);
        const r = Math.max(0, Math.round(((n >> 16) & 0xff) * 0.82));
        const g = Math.max(0, Math.round(((n >> 8) & 0xff) * 0.82));
        const b = Math.max(0, Math.round((n & 0xff) * 0.82));
        const dark = `#${[r, g, b]
          .map((c) => c.toString(16).padStart(2, '0'))
          .join('')}`;
        return [vehicle.color, dark] as const;
      }
    }
    // Full-string hash fallback so different "34..." plates land on
    // different gradients (matches MiniLocationPin.vehicleColorFromPlate).
    let hash = 5381;
    for (let i = 0; i < vehicle.plate.length; i++) {
      hash = ((hash << 5) + hash + vehicle.plate.charCodeAt(i)) | 0;
    }
    return PLATE_GRADIENTS[Math.abs(hash) % PLATE_GRADIENTS.length];
  }, [vehicle]);

  const activeJob = useMemo(
    () =>
      jobs.find((j) => j.status === 'assigned' || j.status === 'in_progress') ?? null,
    [jobs],
  );
  const hasActiveJob = activeJob !== null;
  const currentDriverName = activeJob?.driver?.full_name ?? null;

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
          {vehicle && canUpdate.allowed ? (
            <Pressable
              onPress={() => router.push(`/(app)/vehicles/edit/${vehicle.id}`)}
              hitSlop={12}
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
            >
              <Feather name="edit-2" size={20} color={theme.colors.accent} />
            </Pressable>
          ) : (
            <View style={styles.backBtn} />
          )}
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
              {vehicle.photo_url ? (
                <CachedImage
                  uri={vehicle.photo_url}
                  style={styles.heroPhoto}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.heroPhotoEmpty}>
                  <Feather name="truck" size={48} color="rgba(255,255,255,0.95)" />
                </View>
              )}
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

            {/* "Vehicle returned to HQ" CTA — only shown when the vehicle is
                NOT currently at HQ AND has no active job. New vehicles are
                created with is_at_hq=true so this never shows for them; the
                "at HQ" state is rendered as a passive InfoRow inside the
                Bilgiler card below. The DB trigger flips is_at_hq to false
                on dispatch, which is when this CTA reappears so the operator
                can mark the vehicle as returned. */}
            {canUpdate.allowed && !hasActiveJob && !vehicle.is_at_hq ? (
              <Pressable
                onPress={onMarkAtHq}
                disabled={savingAtHq}
                style={({ pressed }) => [
                  styles.atHqBtn,
                  savingAtHq && { opacity: 0.55 },
                  pressed && { opacity: 0.85 },
                ]}
              >
                {savingAtHq ? (
                  <ActivityIndicator color={theme.colors.accent} size="small" />
                ) : (
                  <Feather name="home" size={16} color={theme.colors.accent} />
                )}
                <Text style={styles.atHqBtnText}>
                  {t('vehicles.detail.atHqCta')}
                </Text>
              </Pressable>
            ) : null}

            {/* Info */}
            <Card>
              <Text style={styles.sectionTitle}>{t('vehicles.detail.sectionInfo')}</Text>
              {currentDriverName ? (
                <InfoRow
                  icon="user-check"
                  label={`${t('vehicles.detail.currentDriver')}: ${currentDriverName}`}
                />
              ) : null}
              {vehicle.is_at_hq && !hasActiveJob ? (
                <InfoRow
                  icon="home"
                  label={t('vehicles.detail.atHqMarked')}
                />
              ) : null}
              {vehicle.color ? (
                <View style={styles.infoRow}>
                  <View style={[styles.colorSwatch, { backgroundColor: vehicle.color }]} />
                  <Text style={styles.infoText}>
                    {t('vehicles.detail.color')}:{' '}
                    {(() => {
                      const key = COLOR_PALETTE_KEY_BY_HEX[vehicle.color.toLowerCase()];
                      return key
                        ? t(`vehicles.new.colors.${key}`)
                        : vehicle.color.toUpperCase();
                    })()}
                  </Text>
                </View>
              ) : null}
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
  heroPhoto: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: theme.radius.lg,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  heroPhotoEmpty: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: theme.radius.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  infoText: { color: theme.colors.text, fontSize: theme.font.size.sm, flex: 1 },
  colorSwatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },

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

  atHqBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentMuted,
  },
  atHqBtnText: {
    color: theme.colors.accent,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
  },
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
