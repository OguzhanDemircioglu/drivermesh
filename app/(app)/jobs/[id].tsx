import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  InteractionManager,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { MeshBackground } from '@/components/MeshBackground';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Avatar } from '@/components/Avatar';
import { JobMiniMap } from '@/components/JobMiniMap';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { useAuth } from '@/auth/AuthProvider';
import { useCan } from '@/auth/useCan';
import { isDemoActive } from '@/demo/store';
import {
  acceptOpenJob,
  approveDriverRequest,
  cancelJob,
  completeJob,
  failJob,
  getJob,
  listOrgDrivers,
  reassignJob,
  rejectDriverRequest,
  startJob,
  type JobWithRefs,
} from '@/lib/jobs';
import type { JobStatus, Profile } from '@/lib/database.types';
import { theme } from '@/theme';

const STATUS_TONE: Record<JobStatus, { fg: string; bg: string }> = {
  open: { fg: theme.colors.mesh, bg: theme.colors.meshMuted },
  assigned: { fg: theme.colors.lavender, bg: 'rgba(184,154,240,0.16)' },
  in_progress: { fg: theme.colors.accent, bg: theme.colors.accentMuted },
  completed: { fg: theme.colors.success, bg: 'rgba(34,197,94,0.14)' },
  failed: { fg: theme.colors.danger, bg: theme.colors.dangerMuted },
  cancelled: { fg: theme.colors.textMuted, bg: 'rgba(138,147,166,0.14)' },
};

export default function JobDetailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, session } = useAuth();
  const toast = useToast();
  const { confirm } = useConfirm();
  const canCancel = useCan('jobs.cancel');
  const canReassign = useCan('jobs.update_any');
  const [job, setJob] = useState<JobWithRefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failReason, setFailReason] = useState('');
  const [showFailInput, setShowFailInput] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [drivers, setDrivers] = useState<Profile[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getJob(id);
      setJob(data);
    } catch (e) {
      console.warn('[job] load failed', e);
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

  const role = profile?.role ?? 'driver';
  const userId = session?.user.id;
  const isMyJob = !!job && job.driver_id === userId;
  const isStaff = role === 'owner' || role === 'manager';

  const guarded = async (fn: () => Promise<void>, errorTitle: string) => {
    try {
      setBusy(true);
      await fn();
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('jobs.detail.genericError');
      toast.error(errorTitle, msg);
    } finally {
      setBusy(false);
    }
  };

  const onAccept = async () => {
    if (!job || !userId) return;
    const ok = await confirm({
      title: t('jobs.detail.acceptTitle'),
      message: t('jobs.detail.acceptMessage', { customer: job.customer_name }),
      confirmText: t('jobs.detail.acceptConfirm'),
    });
    if (ok) guarded(() => acceptOpenJob(job.id, userId), t('jobs.detail.acceptError'));
  };

  const onStart = async () => {
    if (!job) return;
    const ok = await confirm({
      title: t('jobs.detail.startTitle'),
      message: t('jobs.detail.startMessage'),
      confirmText: t('jobs.detail.startConfirm'),
    });
    if (ok) guarded(() => startJob(job.id), t('jobs.detail.startError'));
  };

  const onComplete = async () => {
    if (!job) return;
    const ok = await confirm({
      title: t('jobs.detail.completeTitle'),
      message: t('jobs.detail.completeMessage'),
      confirmText: t('jobs.detail.completeConfirm'),
    });
    if (ok) guarded(() => completeJob(job.id), t('jobs.detail.completeError'));
  };

  const onFail = () => {
    if (!showFailInput) {
      setShowFailInput(true);
      return;
    }
    if (!job) return;
    if (failReason.trim().length < 3) {
      toast.warning(
        t('jobs.detail.failReasonRequiredTitle'),
        t('jobs.detail.failReasonRequiredText'),
      );
      return;
    }
    guarded(() => failJob(job.id, failReason), t('jobs.detail.failError'));
  };

  const onCancel = async () => {
    if (!job) return;
    if (!canCancel.allowed) {
      toast.warning(
        t('common.permissionMissingTitle'),
        canCancel.reason ?? t('common.permissionMissing'),
      );
      return;
    }
    const ok = await confirm({
      title: t('jobs.detail.cancelTitle'),
      message: t('jobs.detail.cancelMessage'),
      confirmText: t('jobs.detail.cancelConfirm'),
      kind: 'destructive',
    });
    if (ok) guarded(() => cancelJob(job.id), t('jobs.detail.cancelError'));
  };

  const openReassign = useCallback(async () => {
    if (!profile?.organization_id) return;
    if (!canReassign.allowed) {
      toast.warning(
        t('common.permissionMissingTitle'),
        canReassign.reason ?? t('common.permissionMissing'),
      );
      return;
    }
    setReassignOpen(true);
    setDriversLoading(true);
    try {
      const list = await listOrgDrivers(profile.organization_id);
      setDrivers(list);
    } catch (e) {
      console.warn('[job] drivers fetch failed', e);
    } finally {
      setDriversLoading(false);
    }
  }, [profile?.organization_id, canReassign, toast, t]);

  const onPickDriver = (driverId: string | null) => {
    if (!job) return;
    setReassignOpen(false);
    guarded(() => reassignJob(job.id, driverId), t('jobs.detail.reassignError'));
  };

  const onApproveRequest = async () => {
    if (!job || !job.created_by) return;
    const createdBy = job.created_by;
    const name = job.creator?.full_name ?? t('jobs.detail.fallbackDriver');
    const ok = await confirm({
      title: t('jobs.detail.driverRequestApproveTitle'),
      message: t('jobs.detail.driverRequestApproveMessage', { name }),
      confirmText: t('jobs.detail.driverRequestApproveCta'),
    });
    if (ok)
      guarded(
        () => approveDriverRequest(job.id, createdBy),
        t('jobs.detail.driverRequestApproveError'),
      );
  };

  const onRejectRequest = async () => {
    if (!job) return;
    const name = job.creator?.full_name ?? t('jobs.detail.fallbackDriver');
    const ok = await confirm({
      title: t('jobs.detail.driverRequestRejectTitle'),
      message: t('jobs.detail.driverRequestRejectMessage', { name }),
      confirmText: t('jobs.detail.driverRequestRejectCta'),
      kind: 'destructive',
    });
    if (ok)
      guarded(
        () => rejectDriverRequest(job.id),
        t('jobs.detail.driverRequestRejectError'),
      );
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <MeshBackground />
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={[styles.root, styles.center]}>
        <MeshBackground />
        <Text style={styles.notFound}>{t('jobs.detail.notFound')}</Text>
        <Button
          title={t('common.back')}
          variant="secondary"
          fullWidth={false}
          onPress={() => router.back()}
        />
      </View>
    );
  }

  const tone = STATUS_TONE[job.status];
  const statusLabel = t(`jobs.status.${job.status}`);

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
          <Text style={styles.title}>{t('jobs.detail.title')}</Text>
          {isStaff &&
          job.status !== 'completed' &&
          job.status !== 'failed' &&
          job.status !== 'cancelled' ? (
            <Pressable
              onPress={() => router.push(`/(app)/jobs/edit/${job.id}`)}
              hitSlop={12}
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
            >
              <Feather name="edit-3" size={20} color={theme.colors.accent} />
            </Pressable>
          ) : (
            <View style={styles.backBtn} />
          )}
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Card style={styles.summary}>
            <View style={styles.summaryHead}>
              <Text style={styles.customer}>{job.customer_name}</Text>
              <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                <Text style={[styles.badgeText, { color: tone.fg }]}>{statusLabel}</Text>
              </View>
            </View>

            <View style={styles.routeWrap}>
              <View style={styles.routeRow}>
                <View style={[styles.markerOuter, { borderColor: theme.colors.mesh }]}>
                  <View style={[styles.markerInner, { backgroundColor: theme.colors.mesh }]} />
                </View>
                <View style={styles.routeCol}>
                  <Text style={styles.routeLabel}>{t('jobs.detail.pickup')}</Text>
                  <Text style={styles.routeText}>{job.pickup_address}</Text>
                </View>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.routeRow}>
                <View style={[styles.markerOuter, { borderColor: theme.colors.accent }]}>
                  <View style={[styles.markerInner, { backgroundColor: theme.colors.accent }]} />
                </View>
                <View style={styles.routeCol}>
                  <Text style={styles.routeLabel}>{t('jobs.detail.dropoff')}</Text>
                  <Text style={styles.routeText}>{job.dropoff_address}</Text>
                </View>
              </View>
            </View>

            <View style={styles.metaGrid}>
              <Meta
                icon="navigation"
                label={t('jobs.detail.distance')}
                value={
                  job.distance_km != null
                    ? `${Number(job.distance_km).toFixed(1)} km`
                    : '—'
                }
              />
              <Meta
                icon="clock"
                label={t('jobs.detail.eta')}
                value={
                  job.eta_minutes != null
                    ? t('common.minutes', { count: job.eta_minutes })
                    : '—'
                }
              />
            </View>
          </Card>

          {job.pickup_lat != null && job.pickup_lng != null && job.dropoff_lat != null && job.dropoff_lng != null ? (
            <JobMiniMap
              pickup={{ lat: job.pickup_lat, lng: job.pickup_lng }}
              dropoff={{ lat: job.dropoff_lat, lng: job.dropoff_lng }}
              inProgressStartedAt={job.status === 'in_progress' ? job.started_at : null}
              vehiclePlate={job.vehicle?.plate ?? null}
            />
          ) : null}

          {job.driver ? (
            <Card style={styles.subCard}>
              <View style={styles.subRow}>
                <Avatar name={job.driver.full_name} size={40} uri={job.driver.avatar_url} />
                <View style={styles.subBody}>
                  <Text style={styles.subLabel}>{t('jobs.detail.assignedDriver')}</Text>
                  <Text style={styles.subValue}>{job.driver.full_name}</Text>
                </View>
              </View>
            </Card>
          ) : null}

          {job.notes ? (
            <Card style={styles.subCard}>
              <Text style={styles.subLabel}>{t('jobs.detail.note')}</Text>
              <Text style={styles.subValue}>{job.notes}</Text>
            </Card>
          ) : null}

          {job.fail_reason ? (
            <Card style={[styles.subCard, { borderColor: theme.colors.danger }]}>
              <Text style={[styles.subLabel, { color: theme.colors.danger }]}>
                {t('jobs.detail.failReason')}
              </Text>
              <Text style={styles.subValue}>{job.fail_reason}</Text>
            </Card>
          ) : null}

          {job.started_at && job.completed_at ? (
            <Card style={styles.subCard}>
              <View style={styles.subRow}>
                <Feather name="clock" size={20} color={theme.colors.accent} />
                <View style={styles.subBody}>
                  <Text style={styles.subLabel}>{t('jobs.detail.tripDuration')}</Text>
                  <Text style={styles.subValue}>
                    {formatJobDuration(job.started_at, job.completed_at)}
                  </Text>
                </View>
              </View>
            </Card>
          ) : null}

          <Card style={styles.subCard}>
            <Text style={styles.subLabel}>{t('jobs.detail.timeline')}</Text>
            <Timeline
              label={t('jobs.detail.timelineCreated')}
              date={job.created_at}
              icon="plus"
            />
            {job.assigned_at ? (
              <Timeline
                label={t('jobs.detail.timelineAssigned')}
                date={job.assigned_at}
                icon="user-check"
              />
            ) : null}
            {job.started_at ? (
              <Timeline
                label={t('jobs.detail.timelineStarted')}
                date={job.started_at}
                icon="navigation"
              />
            ) : null}
            {job.completed_at ? (
              <Timeline
                label={
                  job.status === 'failed'
                    ? t('jobs.detail.timelineFailed')
                    : t('jobs.detail.timelineCompleted')
                }
                date={job.completed_at}
                icon={job.status === 'failed' ? 'x-circle' : 'check-circle'}
                tone={job.status === 'failed' ? 'danger' : 'success'}
              />
            ) : null}
          </Card>

          {/* Driver request awaiting staff approval */}
          {isStaff &&
          job.status === 'open' &&
          job.source === 'driver_request' ? (
            <Card style={styles.approvalCard}>
              <View style={styles.approvalHead}>
                <View style={styles.approvalBadge}>
                  <Feather name="user-check" size={12} color={theme.colors.lavender} />
                  <Text style={styles.approvalBadgeText}>
                    {t('jobs.detail.driverRequestBadge')}
                  </Text>
                </View>
              </View>
              <Text style={styles.approvalTitle}>
                {t('jobs.detail.driverRequestTitle', {
                  name: job.creator?.full_name ?? t('jobs.detail.fallbackDriver'),
                })}
              </Text>
              <Text style={styles.approvalHint}>
                {t('jobs.detail.driverRequestHint')}
              </Text>
              <View style={styles.approvalActions}>
                <Button
                  title={t('jobs.detail.driverRequestRejectCta')}
                  variant="ghost"
                  fullWidth={false}
                  onPress={onRejectRequest}
                  leftIcon={
                    <Feather name="x" size={16} color={theme.colors.danger} />
                  }
                />
                <Button
                  title={t('jobs.detail.driverRequestApproveCta')}
                  fullWidth={false}
                  style={{ flex: 1 }}
                  onPress={onApproveRequest}
                  loading={busy}
                  leftIcon={
                    <Feather name="check" size={16} color="#0A0E1F" />
                  }
                />
              </View>
            </Card>
          ) : null}

          {/* Action area */}
          {job.status === 'open' &&
          role === 'driver' &&
          job.source !== 'driver_request' ? (
            <View style={styles.actions}>
              <Button
                title={t('jobs.detail.acceptCta')}
                onPress={onAccept}
                loading={busy}
              />
            </View>
          ) : null}

          {job.status === 'assigned' && isMyJob ? (
            <View style={styles.actions}>
              <Button
                title={t('jobs.detail.startCta')}
                onPress={onStart}
                loading={busy}
              />
            </View>
          ) : null}

          {job.status === 'in_progress' && isMyJob && job.started_at ? (
            <LiveTimerCard startedAt={job.started_at} />
          ) : null}

          {job.status === 'in_progress' && isMyJob ? (
            <View style={styles.actions}>
              <Button
                title={t('jobs.detail.completeCta')}
                onPress={onComplete}
                loading={busy}
              />
              {showFailInput ? (
                <View style={styles.failBox}>
                  <Text style={styles.failLabel}>
                    {t('jobs.detail.failBoxLabel')}
                  </Text>
                  <TextInput
                    value={failReason}
                    onChangeText={setFailReason}
                    placeholder={t('jobs.detail.failBoxPlaceholder')}
                    placeholderTextColor={theme.colors.textDim}
                    multiline
                    style={styles.failInput}
                  />
                  <View style={styles.failRow}>
                    <Button
                      title={t('jobs.detail.failCancel')}
                      variant="ghost"
                      fullWidth={false}
                      onPress={() => {
                        setShowFailInput(false);
                        setFailReason('');
                      }}
                    />
                    <Button
                      title={t('jobs.detail.failConfirm')}
                      variant="secondary"
                      fullWidth={false}
                      style={{ flex: 1 }}
                      onPress={onFail}
                      loading={busy}
                    />
                  </View>
                </View>
              ) : (
                <Button
                  title={t('jobs.detail.failReportCta')}
                  variant="secondary"
                  onPress={onFail}
                />
              )}
            </View>
          ) : null}

          {/* Demo simulation — owner/manager can advance the job through
              states without being the assigned driver. Demo-only. */}
          {isDemoActive() &&
          isStaff &&
          (job.status === 'assigned' || job.status === 'in_progress') ? (
            <View style={styles.actions}>
              <View style={styles.simBadge}>
                <Feather name="zap" size={11} color={theme.colors.lavender} />
                <Text style={styles.simBadgeText}>
                  {t('jobs.detail.simulateBadge')}
                </Text>
              </View>
              <Button
                title={
                  job.status === 'assigned'
                    ? t('jobs.detail.simulateStartCta')
                    : t('jobs.detail.simulateCompleteCta')
                }
                variant="secondary"
                leftIcon={
                  <Feather name="play-circle" size={16} color={theme.colors.text} />
                }
                onPress={() =>
                  job.status === 'assigned' ? onStart() : onComplete()
                }
                loading={busy}
              />
            </View>
          ) : null}

          {isStaff &&
          (job.status === 'open' ||
            job.status === 'assigned' ||
            job.status === 'in_progress') ? (
            <View style={styles.actions}>
              <Button
                title={
                  job.driver
                    ? t('jobs.detail.reassignCtaChange')
                    : t('jobs.detail.reassignCtaAssign')
                }
                variant="secondary"
                leftIcon={
                  <Feather
                    name={canReassign.allowed ? 'user-check' : 'lock'}
                    size={16}
                    color={
                      canReassign.allowed
                        ? theme.colors.text
                        : theme.colors.textDim
                    }
                  />
                }
                onPress={openReassign}
              />
            </View>
          ) : null}

          {isStaff && (job.status === 'open' || job.status === 'assigned') ? (
            <View style={styles.actions}>
              <Button
                title={t('jobs.detail.cancelCta')}
                variant="ghost"
                leftIcon={
                  !canCancel.allowed ? (
                    <Feather name="lock" size={14} color={theme.colors.textDim} />
                  ) : undefined
                }
                onPress={onCancel}
              />
            </View>
          ) : null}
        </ScrollView>

        {/* Reassign modal */}
        <Modal
          visible={reassignOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setReassignOpen(false)}
        >
          <Pressable
            onPress={() => setReassignOpen(false)}
            style={styles.modalBackdrop}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={styles.modalSheet}
            >
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>{t('jobs.detail.reassignModalTitle')}</Text>
              <Text style={styles.modalHint}>
                {t('jobs.detail.reassignModalHint')}
              </Text>

              {driversLoading ? (
                <View style={{ paddingVertical: 24 }}>
                  <ActivityIndicator color={theme.colors.accent} />
                </View>
              ) : (
                <ScrollView
                  style={{ maxHeight: 320 }}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {drivers.map((d) => {
                    const active = d.id === job.driver_id;
                    return (
                      <Pressable
                        key={d.id}
                        onPress={() => onPickDriver(d.id)}
                        style={({ pressed }) => [
                          styles.modalRow,
                          active && styles.modalRowActive,
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <Avatar name={d.full_name} size={36} uri={d.avatar_url} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.modalRowName}>{d.full_name}</Text>
                          <Text style={styles.modalRowMeta} numberOfLines={1}>
                            {d.email}
                          </Text>
                        </View>
                        {active ? (
                          <Feather
                            name="check"
                            size={18}
                            color={theme.colors.accent}
                          />
                        ) : (
                          <Feather
                            name="chevron-right"
                            size={16}
                            color={theme.colors.textDim}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                  {drivers.length === 0 ? (
                    <Text style={styles.modalEmpty}>
                      {t('jobs.detail.reassignNoDrivers')}
                    </Text>
                  ) : null}
                </ScrollView>
              )}

              {job.driver_id ? (
                <Pressable
                  onPress={() => onPickDriver(null)}
                  style={({ pressed }) => [
                    styles.modalDangerRow,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Feather
                    name="user-x"
                    size={16}
                    color={theme.colors.danger}
                  />
                  <Text style={styles.modalDangerText}>
                    {t('jobs.detail.reassignUnassign')}
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => setReassignOpen(false)}
                style={({ pressed }) => [
                  styles.modalCloseBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.modalCloseText}>{t('common.close')}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

function LiveTimerCard({ startedAt }: { startedAt: string }) {
  const { t } = useTranslation();
  const startMs = new Date(startedAt).getTime();
  const [seconds, setSeconds] = useState(() =>
    Math.max(0, Math.floor((Date.now() - startMs) / 1000)),
  );
  useEffect(() => {
    const id = setInterval(() => {
      setSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [startMs]);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <View style={styles.timerCard}>
      <Text style={styles.timerLabel}>{t('jobs.detail.tripDuration')}</Text>
      <Text style={styles.timerValue}>
        {pad(h)}:{pad(m)}:{pad(s)}
      </Text>
      <Text style={styles.timerHint}>{t('jobs.detail.timerHint')}</Text>
    </View>
  );
}

function Meta({ icon, label, value }: { icon: keyof typeof Feather.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <View style={styles.metaIconWrap}>
        <Feather name={icon} size={14} color={theme.colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.metaLabel}>{label}</Text>
        <Text style={styles.metaValue}>{value}</Text>
      </View>
    </View>
  );
}

function Timeline({
  label,
  date,
  icon,
  tone = 'mesh',
}: {
  label: string;
  date: string;
  icon: keyof typeof Feather.glyphMap;
  tone?: 'mesh' | 'success' | 'danger' | 'accent';
}) {
  const color =
    tone === 'success'
      ? theme.colors.success
      : tone === 'danger'
        ? theme.colors.danger
        : tone === 'accent'
          ? theme.colors.accent
          : theme.colors.mesh;
  return (
    <View style={styles.timelineRow}>
      <View style={[styles.timelineIcon, { backgroundColor: `${color}22`, borderColor: color }]}>
        <Feather name={icon} size={11} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.timelineLabel}>{label}</Text>
        <Text style={styles.timelineDate}>{formatDateTime(date)}</Text>
      </View>
    </View>
  );
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatJobDuration(startedAt: string, completedAt: string): string {
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 60_000) {
    const sec = Math.max(0, Math.round(ms / 1000));
    return `${sec} sn`;
  }
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 60) return `${totalMin} dk`;
  const hr = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  return min ? `${hr} sa ${min} dk` : `${hr} sa`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  safe: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  notFound: { color: theme.colors.text, fontSize: theme.font.size.md },
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

  summary: { gap: theme.spacing.md },
  summaryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  customer: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.semibold,
    paddingRight: 8,
  },
  badge: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: theme.radius.full },
  badgeText: { fontSize: theme.font.size.xs, fontWeight: theme.font.weight.semibold },

  routeWrap: { gap: 6 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  routeCol: { flex: 1, gap: 1 },
  markerOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerInner: { width: 8, height: 8, borderRadius: 4 },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: theme.colors.border,
    marginLeft: 8,
  },
  routeLabel: {
    color: theme.colors.textDim,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  routeText: { color: theme.colors.text, fontSize: theme.font.size.sm },

  metaGrid: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  metaIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: theme.colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaLabel: { color: theme.colors.textDim, fontSize: 10, letterSpacing: 0.4 },
  metaValue: { color: theme.colors.text, fontSize: theme.font.size.sm, fontWeight: '500' },

  subCard: { gap: 8 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  subBody: { flex: 1, gap: 1 },
  subLabel: {
    color: theme.colors.textDim,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  subValue: { color: theme.colors.text, fontSize: theme.font.size.sm },

  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  timelineIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLabel: { color: theme.colors.text, fontSize: theme.font.size.sm, fontWeight: '500' },
  timelineDate: { color: theme.colors.textDim, fontSize: theme.font.size.xs },

  actions: { gap: 10, marginTop: theme.spacing.sm },

  simBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(184,154,240,0.16)',
    alignSelf: 'flex-start',
  },
  simBadgeText: {
    color: theme.colors.lavender,
    fontSize: 11,
    fontWeight: theme.font.weight.semibold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  approvalCard: {
    gap: theme.spacing.sm,
    borderColor: theme.colors.lavender,
    backgroundColor: 'rgba(184,154,240,0.08)',
  },
  approvalHead: { flexDirection: 'row', alignItems: 'center' },
  approvalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(184,154,240,0.16)',
  },
  approvalBadgeText: {
    fontSize: 11,
    color: theme.colors.lavender,
    fontWeight: theme.font.weight.semibold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  approvalTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
  },
  approvalHint: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    lineHeight: 20,
  },
  approvalActions: { flexDirection: 'row', gap: 8, marginTop: 4 },

  failBox: {
    gap: 10,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.dangerMuted,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  failLabel: {
    color: theme.colors.danger,
    fontSize: theme.font.size.xs,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontWeight: theme.font.weight.semibold,
  },
  failInput: {
    minHeight: 80,
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.md,
    padding: 12,
    textAlignVertical: 'top',
  },
  failRow: { flexDirection: 'row', gap: 8 },

  timerCard: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(255,122,26,0.3)',
    gap: 6,
  },
  timerLabel: {
    color: theme.colors.accent,
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  timerValue: {
    color: theme.colors.text,
    fontSize: 56,
    fontWeight: theme.font.weight.bold,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  timerHint: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.xs,
    marginTop: 2,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,12,24,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: theme.colors.bgElevated,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing['2xl'],
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.semibold,
  },
  modalHint: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.xs,
    lineHeight: 18,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  modalRowActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentMuted,
  },
  modalRowName: {
    color: theme.colors.text,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
  },
  modalRowMeta: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.xs,
    marginTop: 2,
  },
  modalEmpty: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    textAlign: 'center',
    paddingVertical: 16,
  },
  modalDangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    backgroundColor: 'rgba(239,68,68,0.06)',
  },
  modalDangerText: {
    color: theme.colors.danger,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
  },
  modalCloseBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
  },
});
