import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { MeshBackground } from '@/components/MeshBackground';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Avatar } from '@/components/Avatar';
import { JobMiniMap } from '@/components/JobMiniMap';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { useAuth } from '@/auth/AuthProvider';
import { useCan } from '@/auth/useCan';
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

const STATUS_INFO: Record<
  JobStatus,
  { label: string; fg: string; bg: string }
> = {
  open: { label: 'Açık', fg: theme.colors.mesh, bg: theme.colors.meshMuted },
  assigned: { label: 'Atandı', fg: theme.colors.lavender, bg: 'rgba(184,154,240,0.16)' },
  in_progress: { label: 'Sürüyor', fg: theme.colors.accent, bg: theme.colors.accentMuted },
  completed: { label: 'Tamamlandı', fg: theme.colors.success, bg: 'rgba(34,197,94,0.14)' },
  failed: { label: 'Başarısız', fg: theme.colors.danger, bg: theme.colors.dangerMuted },
  cancelled: { label: 'İptal', fg: theme.colors.textMuted, bg: 'rgba(138,147,166,0.14)' },
};

export default function JobDetailScreen() {
  const router = useRouter();
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

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const role = profile?.role ?? 'driver';
  const userId = session?.user.id;
  const isMyJob = !!job && job.driver_id === userId;
  const isStaff = role === 'owner' || role === 'manager';

  const guarded = async (fn: () => Promise<void>, label: string) => {
    try {
      setBusy(true);
      await fn();
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Bir hata oldu';
      toast.error(`${label} hatası`, msg);
    } finally {
      setBusy(false);
    }
  };

  const onAccept = async () => {
    if (!job || !userId) return;
    const ok = await confirm({
      title: 'Bu işi al',
      message: `${job.customer_name} işini üstüne alıyorsun.`,
      confirmText: 'Al',
    });
    if (ok) guarded(() => acceptOpenJob(job.id, userId), 'İş alma');
  };

  const onStart = async () => {
    if (!job) return;
    const ok = await confirm({
      title: 'İşi başlat',
      message: 'Müşterinin yanına vardın mı? Süre saymaya başlayacak.',
      confirmText: 'Başlat',
    });
    if (ok) guarded(() => startJob(job.id), 'Başlatma');
  };

  const onComplete = async () => {
    if (!job) return;
    const ok = await confirm({
      title: 'İşi bitir',
      message: 'Teslimat tamamlandı mı? Süre kaydedilecek.',
      confirmText: 'Bitir',
    });
    if (ok) guarded(() => completeJob(job.id), 'Tamamlama');
  };

  const onFail = () => {
    if (!showFailInput) {
      setShowFailInput(true);
      return;
    }
    if (!job) return;
    if (failReason.trim().length < 3) {
      toast.warning('Sebep gerekli', 'Kısa bir başarısızlık nedeni yaz.');
      return;
    }
    guarded(() => failJob(job.id, failReason), 'Başarısız');
  };

  const onCancel = async () => {
    if (!job) return;
    if (!canCancel.allowed) {
      toast.warning('Yetki gerekli', canCancel.reason ?? 'Bu yetki sende yok.');
      return;
    }
    const ok = await confirm({
      title: 'İşi iptal et',
      message: 'Bu işi iptal etmek istiyor musun?',
      confirmText: 'İptal et',
      kind: 'destructive',
    });
    if (ok) guarded(() => cancelJob(job.id), 'İptal');
  };

  const openReassign = useCallback(async () => {
    if (!profile?.organization_id) return;
    if (!canReassign.allowed) {
      toast.warning('Yetki gerekli', canReassign.reason ?? 'Bu yetki sende yok.');
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
  }, [profile?.organization_id, canReassign, toast]);

  const onPickDriver = (driverId: string | null) => {
    if (!job) return;
    setReassignOpen(false);
    guarded(() => reassignJob(job.id, driverId), 'Atama');
  };

  const onApproveRequest = async () => {
    if (!job || !job.created_by) return;
    const createdBy = job.created_by;
    const ok = await confirm({
      title: 'Talebi onayla',
      message: `${job.creator?.full_name ?? 'Şoför'} bu işi kendisi yapmak istiyor. Onaylıyor musun?`,
      confirmText: 'Onayla',
    });
    if (ok) guarded(() => approveDriverRequest(job.id, createdBy), 'Onaylama');
  };

  const onRejectRequest = async () => {
    if (!job) return;
    const ok = await confirm({
      title: 'Talebi reddet',
      message: `${job.creator?.full_name ?? 'Şoför'} talebini reddetmek istiyor musun?`,
      confirmText: 'Reddet',
      kind: 'destructive',
    });
    if (ok) guarded(() => rejectDriverRequest(job.id), 'Reddetme');
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
        <Text style={styles.notFound}>İş bulunamadı.</Text>
        <Button title="Geri dön" variant="secondary" fullWidth={false} onPress={() => router.back()} />
      </View>
    );
  }

  const status = STATUS_INFO[job.status];

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
          <Text style={styles.title}>İş detayı</Text>
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
              <View style={[styles.badge, { backgroundColor: status.bg }]}>
                <Text style={[styles.badgeText, { color: status.fg }]}>{status.label}</Text>
              </View>
            </View>

            <View style={styles.routeWrap}>
              <View style={styles.routeRow}>
                <View style={[styles.markerOuter, { borderColor: theme.colors.mesh }]}>
                  <View style={[styles.markerInner, { backgroundColor: theme.colors.mesh }]} />
                </View>
                <View style={styles.routeCol}>
                  <Text style={styles.routeLabel}>ALIŞ</Text>
                  <Text style={styles.routeText}>{job.pickup_address}</Text>
                </View>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.routeRow}>
                <View style={[styles.markerOuter, { borderColor: theme.colors.accent }]}>
                  <View style={[styles.markerInner, { backgroundColor: theme.colors.accent }]} />
                </View>
                <View style={styles.routeCol}>
                  <Text style={styles.routeLabel}>TESLİM</Text>
                  <Text style={styles.routeText}>{job.dropoff_address}</Text>
                </View>
              </View>
            </View>

            <View style={styles.metaGrid}>
              <Meta
                icon="navigation"
                label="Mesafe"
                value={
                  job.distance_km != null
                    ? `${Number(job.distance_km).toFixed(1)} km`
                    : '—'
                }
              />
              <Meta
                icon="clock"
                label="Süre"
                value={job.eta_minutes != null ? `${job.eta_minutes} dk` : '—'}
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
                <Avatar name={job.driver.full_name} size={40} />
                <View style={styles.subBody}>
                  <Text style={styles.subLabel}>Atanmış şoför</Text>
                  <Text style={styles.subValue}>{job.driver.full_name}</Text>
                </View>
              </View>
            </Card>
          ) : null}

          {job.notes ? (
            <Card style={styles.subCard}>
              <Text style={styles.subLabel}>Not</Text>
              <Text style={styles.subValue}>{job.notes}</Text>
            </Card>
          ) : null}

          {job.fail_reason ? (
            <Card style={[styles.subCard, { borderColor: theme.colors.danger }]}>
              <Text style={[styles.subLabel, { color: theme.colors.danger }]}>
                Başarısızlık nedeni
              </Text>
              <Text style={styles.subValue}>{job.fail_reason}</Text>
            </Card>
          ) : null}

          {job.started_at && job.completed_at ? (
            <Card style={styles.subCard}>
              <View style={styles.subRow}>
                <Feather name="clock" size={20} color={theme.colors.accent} />
                <View style={styles.subBody}>
                  <Text style={styles.subLabel}>Yolculuk süresi</Text>
                  <Text style={styles.subValue}>
                    {formatJobDuration(job.started_at, job.completed_at)}
                  </Text>
                </View>
              </View>
            </Card>
          ) : null}

          <Card style={styles.subCard}>
            <Text style={styles.subLabel}>Zaman çizelgesi</Text>
            <Timeline label="Açıldı" date={job.created_at} icon="plus" />
            {job.assigned_at ? (
              <Timeline label="Şoföre atandı" date={job.assigned_at} icon="user-check" />
            ) : null}
            {job.started_at ? (
              <Timeline label="Yola çıkıldı" date={job.started_at} icon="navigation" />
            ) : null}
            {job.completed_at ? (
              <Timeline
                label={job.status === 'failed' ? 'Başarısız bitti' : 'Tamamlandı'}
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
                  <Text style={styles.approvalBadgeText}>Şoför talebi</Text>
                </View>
              </View>
              <Text style={styles.approvalTitle}>
                {job.creator?.full_name ?? 'Bir şoför'} bu işi kendisi yapmak istiyor
              </Text>
              <Text style={styles.approvalHint}>
                Onaylarsan iş ona atanır. Reddedersen iş iptal edilir.
              </Text>
              <View style={styles.approvalActions}>
                <Button
                  title="Reddet"
                  variant="ghost"
                  fullWidth={false}
                  onPress={onRejectRequest}
                  leftIcon={
                    <Feather name="x" size={16} color={theme.colors.danger} />
                  }
                />
                <Button
                  title="Onayla"
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
              <Button title="Bu işi al" onPress={onAccept} loading={busy} />
            </View>
          ) : null}

          {job.status === 'assigned' && isMyJob ? (
            <View style={styles.actions}>
              <Button title="İşi başlat" onPress={onStart} loading={busy} />
            </View>
          ) : null}

          {job.status === 'in_progress' && isMyJob && job.started_at ? (
            <LiveTimerCard startedAt={job.started_at} />
          ) : null}

          {job.status === 'in_progress' && isMyJob ? (
            <View style={styles.actions}>
              <Button title="İşi bitir" onPress={onComplete} loading={busy} />
              {showFailInput ? (
                <View style={styles.failBox}>
                  <Text style={styles.failLabel}>Başarısızlık nedeni</Text>
                  <TextInput
                    value={failReason}
                    onChangeText={setFailReason}
                    placeholder="Trafik kazası, müşteri reddetti, ulaşılamadı..."
                    placeholderTextColor={theme.colors.textDim}
                    multiline
                    style={styles.failInput}
                  />
                  <View style={styles.failRow}>
                    <Button
                      title="Vazgeç"
                      variant="ghost"
                      fullWidth={false}
                      onPress={() => {
                        setShowFailInput(false);
                        setFailReason('');
                      }}
                    />
                    <Button
                      title="Başarısız olarak kapat"
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
                  title="Başarısız bittiğini bildir"
                  variant="secondary"
                  onPress={onFail}
                />
              )}
            </View>
          ) : null}

          {isStaff &&
          (job.status === 'open' ||
            job.status === 'assigned' ||
            job.status === 'in_progress') ? (
            <View style={styles.actions}>
              <Button
                title={job.driver ? 'Şoförü değiştir' : 'Şoför ata'}
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
                title="İşi iptal et"
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
              <Text style={styles.modalTitle}>Şoför seç</Text>
              <Text style={styles.modalHint}>
                Yeni şoför seçince iş ona atanır. "Atamayı kaldır" işi tekrar
                açık listeye düşürür.
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
                        <Avatar name={d.full_name} size={36} />
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
                      Şoför yok — önce bir şoför davet et.
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
                    Atamayı kaldır (tekrar açık listeye düşür)
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
                <Text style={styles.modalCloseText}>Kapat</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

function LiveTimerCard({ startedAt }: { startedAt: string }) {
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
      <Text style={styles.timerLabel}>Yolculuk süresi</Text>
      <Text style={styles.timerValue}>
        {pad(h)}:{pad(m)}:{pad(s)}
      </Text>
      <Text style={styles.timerHint}>Müşteriyi teslim edince işi bitir.</Text>
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
