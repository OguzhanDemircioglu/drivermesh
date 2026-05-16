import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/auth/AuthProvider';
import {
  approveMaintenanceRequest,
  cancelMaintenanceRequest,
  getMaintenanceRequest,
  MaintenanceError,
  rejectMaintenanceRequest,
  type MaintenanceRequestWithRefs,
} from '@/lib/maintenance';
import { checkPermission } from '@/lib/permissions';
import { theme } from '@/theme';

export default function MaintenanceDetailScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const toast = useToast();

  const [req, setReq] = useState<MaintenanceRequestWithRefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [canApprove, setCanApprove] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    Promise.all([
      getMaintenanceRequest(id),
      session?.user.id
        ? checkPermission(session.user.id, 'vehicles.approve_maintenance')
        : Promise.resolve(false),
    ])
      .then(([r, can]) => {
        if (cancelled) return;
        setReq(r);
        setCanApprove(can);
      })
      .catch((e) => console.warn('[maintenance/detail] load', e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, session?.user.id]);

  const reload = async () => {
    if (!id) return;
    const fresh = await getMaintenanceRequest(id);
    setReq(fresh);
  };

  const handleApprove = async () => {
    if (!req || !session?.user.id || busy) return;
    setBusy(true);
    try {
      await approveMaintenanceRequest(req.id, session.user.id);
      toast.success(t('maintenance.detail.approveSuccess'));
      await reload();
    } catch (e) {
      handleErr(e);
    } finally {
      setBusy(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!req || !session?.user.id || busy) return;
    if (!rejectReason.trim()) {
      toast.error(
        t('maintenance.detail.errorTitle'),
        t('maintenance.detail.errors.rejectionReasonRequired'),
      );
      return;
    }
    setBusy(true);
    try {
      await rejectMaintenanceRequest(req.id, session.user.id, rejectReason);
      toast.success(t('maintenance.detail.rejectSuccess'));
      setRejectOpen(false);
      setRejectReason('');
      await reload();
    } catch (e) {
      handleErr(e);
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!req || !session?.user.id || busy) return;
    setBusy(true);
    try {
      await cancelMaintenanceRequest(req.id, session.user.id);
      toast.success(t('maintenance.detail.cancelSuccess'));
      await reload();
    } catch (e) {
      handleErr(e);
    } finally {
      setBusy(false);
    }
  };

  const handleErr = (e: unknown) => {
    if (e instanceof MaintenanceError) {
      if (e.code === 'not_pending')
        toast.error(t('maintenance.detail.errorTitle'), t('maintenance.detail.errors.notPending'));
      else if (e.code === 'rejection_reason_required')
        toast.error(
          t('maintenance.detail.errorTitle'),
          t('maintenance.detail.errors.rejectionReasonRequired'),
        );
      else if (e.code === 'active_job')
        toast.error(t('maintenance.detail.errorTitle'), t('maintenance.new.errorActiveJob'));
      else toast.error(t('maintenance.detail.errorTitle'), e.message);
      return;
    }
    const msg = e instanceof Error ? e.message : t('maintenance.detail.errorTitle');
    toast.error(t('maintenance.detail.errorTitle'), msg);
  };

  if (loading) {
    return (
      <Screen contentStyle={styles.center}>
        <ActivityIndicator color={theme.colors.accent} />
      </Screen>
    );
  }
  if (!req) {
    return (
      <Screen contentStyle={styles.center}>
        <Feather name="alert-circle" size={28} color={theme.colors.warning} />
        <Text style={styles.permTitle}>{t('errors.notFound')}</Text>
      </Screen>
    );
  }

  const isOwn = req.requester_id === session?.user.id;
  const canDecide = canApprove && req.status === 'pending';
  const canCancel = isOwn && req.status === 'pending';

  const statusKey = `maintenance.detail.status${cap(req.status)}` as const;
  const statusColor = ((): string => {
    switch (req.status) {
      case 'pending':
        return theme.colors.warning;
      case 'approved':
        return theme.colors.success;
      case 'rejected':
        return theme.colors.danger;
      case 'cancelled':
      case 'expired':
        return theme.colors.textMuted;
      default:
        return theme.colors.text;
    }
  })();

  const dateFormat = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language === 'tr' ? 'tr-TR' : 'en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <Screen scroll contentStyle={styles.scroll}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
      >
        <Feather name="arrow-left" size={22} color={theme.colors.text} />
        <Text style={styles.backText}>{t('common.back')}</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={styles.eyebrow}>
          <Feather name="tool" size={11} color={theme.colors.accent} />
          <Text style={styles.eyebrowText}>{t('maintenance.new.eyebrow')}</Text>
        </View>
        <Text style={styles.title}>{t('maintenance.detail.title')}</Text>
        <View style={[styles.statusPill, { borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{t(statusKey)}</Text>
        </View>
      </View>

      {req.vehicle ? (
        <Pressable
          onPress={() => router.push(`/(app)/vehicles/${req.vehicle!.id}`)}
          style={({ pressed }) => [styles.vehicleCard, pressed && { opacity: 0.85 }]}
        >
          <Feather name="truck" size={20} color={theme.colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.vehiclePlate}>{req.vehicle.plate}</Text>
            <Text style={styles.vehicleSpec}>
              {req.vehicle.brand} {req.vehicle.model}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={theme.colors.textMuted} />
        </Pressable>
      ) : null}

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>{t('maintenance.detail.requestedBy')}</Text>
          <Text style={styles.metaValue}>{req.requester?.full_name ?? '—'}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>{t('maintenance.detail.requestedAt')}</Text>
          <Text style={styles.metaValue}>{dateFormat(req.requested_at)}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('maintenance.detail.reasonLabel')}</Text>
        <Text style={styles.reasonText}>{req.reason}</Text>
      </View>

      {req.photo_urls.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('maintenance.detail.photosLabel')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
            {req.photo_urls.map((url, idx) => (
              <Pressable key={idx} onPress={() => setPreviewIndex(idx)}>
                <Image source={{ uri: url }} style={styles.photo} resizeMode="cover" />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>{t('maintenance.detail.estimatedLabel')}</Text>
          <Text style={styles.metaValue}>
            {req.estimated_minutes
              ? t('maintenance.detail.minutesUnit', { n: req.estimated_minutes })
              : t('maintenance.detail.noEstimate')}
          </Text>
        </View>
        {req.decided_at && req.decider ? (
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>{t('maintenance.detail.decisionLabel')}</Text>
            <Text style={styles.metaValue}>
              {t('maintenance.detail.decidedBy', { name: req.decider.full_name })}
            </Text>
          </View>
        ) : null}
      </View>

      {req.status === 'rejected' && req.rejection_reason ? (
        <View style={[styles.section, styles.rejectionBox]}>
          <Text style={styles.rejectionLabel}>{t('maintenance.detail.rejectionReasonLabel')}</Text>
          <Text style={styles.reasonText}>{req.rejection_reason}</Text>
        </View>
      ) : null}

      {canDecide ? (
        <View style={styles.actions}>
          <Button
            title={t('maintenance.detail.approveButton')}
            onPress={handleApprove}
            loading={busy}
            leftIcon={<Feather name="check" size={16} color="#0A0E1F" />}
          />
          <Button
            title={t('maintenance.detail.rejectButton')}
            onPress={() => setRejectOpen(true)}
            disabled={busy}
            variant="secondary"
            leftIcon={<Feather name="x" size={16} color={theme.colors.danger} />}
          />
        </View>
      ) : null}

      {canCancel ? (
        <View style={styles.actions}>
          <Button
            title={t('maintenance.detail.cancelRequest')}
            onPress={handleCancel}
            loading={busy}
            variant="secondary"
            leftIcon={<Feather name="x-circle" size={16} color={theme.colors.danger} />}
          />
        </View>
      ) : null}

      {/* Reject modal */}
      <Modal
        animationType="fade"
        transparent
        visible={rejectOpen}
        onRequestClose={() => setRejectOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setRejectOpen(false)}>
          <Pressable style={styles.sheetBox} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>{t('maintenance.detail.rejectReasonTitle')}</Text>
            <TextField
              label={t('maintenance.detail.rejectReasonTitle')}
              placeholder={t('maintenance.detail.rejectReasonPlaceholder')}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={4}
            />
            <View style={styles.sheetActions}>
              <Button
                title={t('common.cancel')}
                onPress={() => setRejectOpen(false)}
                variant="secondary"
                disabled={busy}
              />
              <Button
                title={t('maintenance.detail.rejectConfirm')}
                onPress={handleRejectSubmit}
                loading={busy}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Photo preview modal */}
      <Modal
        animationType="fade"
        transparent
        visible={previewIndex !== null}
        onRequestClose={() => setPreviewIndex(null)}
      >
        <Pressable style={styles.previewBackdrop} onPress={() => setPreviewIndex(null)}>
          {previewIndex !== null && req.photo_urls[previewIndex] ? (
            <Image
              source={{ uri: req.photo_urls[previewIndex] }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          ) : null}
        </Pressable>
      </Modal>
    </Screen>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  scroll: { paddingTop: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: theme.spacing['3xl'] },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  backText: { color: theme.colors.text, fontSize: theme.font.size.md, fontWeight: theme.font.weight.medium },

  header: { gap: theme.spacing.sm },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: theme.colors.accentMuted,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  eyebrowText: {
    color: theme.colors.accent,
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.bold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.font.size['2xl'],
    fontWeight: theme.font.weight.bold,
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: theme.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  statusText: {
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
    letterSpacing: 0.4,
  },

  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  vehiclePlate: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.bold,
    letterSpacing: 0.5,
  },
  vehicleSpec: { color: theme.colors.textMuted, fontSize: theme.font.size.sm },

  metaRow: { flexDirection: 'row', gap: theme.spacing.lg, flexWrap: 'wrap' },
  metaItem: { flex: 1, minWidth: 140, gap: 2 },
  metaLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.xs,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  metaValue: {
    color: theme.colors.text,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.medium,
  },

  section: { gap: 6 },
  sectionLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  reasonText: { color: theme.colors.text, fontSize: theme.font.size.md, lineHeight: 22 },

  photoRow: { gap: 10, paddingVertical: 4 },
  photo: { width: 110, height: 110, borderRadius: theme.radius.md },

  rejectionBox: {
    padding: 12,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: theme.radius.md,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.danger,
  },
  rejectionLabel: {
    color: theme.colors.danger,
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  actions: { gap: theme.spacing.sm, marginTop: theme.spacing.sm },

  center: { alignItems: 'center', justifyContent: 'center', gap: 8, flex: 1 },
  permTitle: { color: theme.colors.text, fontSize: theme.font.size.lg, fontWeight: theme.font.weight.semibold },

  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheetBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 16,
    gap: 12,
  },
  sheetTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.semibold,
  },
  sheetActions: { flexDirection: 'row', gap: 10 },

  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  previewImage: { width: '100%', height: '85%' },
});
