import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme';

type Status = 'active' | 'break' | 'off_duty' | 'on_trip' | 'unavailable';

const STATUS_META: Record<
  Status,
  { color: string; icon: keyof typeof Feather.glyphMap; labelKey: string }
> = {
  active: { color: '#22C55E', icon: 'check-circle', labelKey: 'status.active' },
  break: { color: '#F59E0B', icon: 'coffee', labelKey: 'status.break' },
  off_duty: { color: '#6B7280', icon: 'clock', labelKey: 'status.offDuty' },
  on_trip: { color: '#3B82F6', icon: 'navigation', labelKey: 'status.onTrip' },
  unavailable: { color: '#EF4444', icon: 'x-circle', labelKey: 'status.unavailable' },
};

// Manuel set edilebilir 4 status (on_trip auto, sistem set eder).
const SELECTABLE: Status[] = ['active', 'break', 'off_duty', 'unavailable'];

export function StatusPill() {
  const { t } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const status = ((profile as unknown as { status?: Status })?.status ?? 'off_duty') as Status;
  const meta = STATUS_META[status];
  const isOnTrip = status === 'on_trip';
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState<Status | null>(null);

  const onPress = () => {
    if (isOnTrip) {
      Alert.alert(t('status.title'), t('status.onTripLocked'));
      return;
    }
    setSheetOpen(true);
  };

  const onSelect = async (next: Status) => {
    if (busy) return;
    setBusy(next);
    try {
      const { error } = await (
        supabase as unknown as {
          rpc: (
            fn: string,
            args: Record<string, unknown>,
          ) => Promise<{ error: { message: string } | null }>;
        }
      ).rpc('set_my_status', { p_status: next });
      if (error) throw new Error(error.message);
      await refreshProfile();
      setSheetOpen(false);
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : t('errors.unknown'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('status.title')}: ${t(meta.labelKey)}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.pill,
          { borderColor: meta.color, backgroundColor: meta.color + '22' },
          pressed && { opacity: 0.7 },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: meta.color }]} />
        <Feather name={meta.icon} size={14} color={meta.color} />
        <Text style={[styles.text, { color: meta.color }]}>{t(meta.labelKey)}</Text>
        {!isOnTrip ? <Feather name="chevron-down" size={14} color={meta.color} /> : null}
      </Pressable>

      <Modal
        visible={sheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSheetOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setSheetOpen(false)}>
          <View style={styles.backdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.sheet}>
                <Text style={styles.sheetTitle}>{t('status.title')}</Text>
                <Text style={styles.sheetBody}>{t('status.body')}</Text>
                {SELECTABLE.map((s) => {
                  const m = STATUS_META[s];
                  const isCurrent = s === status;
                  const isBusy = busy === s;
                  return (
                    <Pressable
                      key={s}
                      accessibilityRole="button"
                      onPress={() => onSelect(s)}
                      disabled={!!busy}
                      style={({ pressed }) => [
                        styles.option,
                        { borderColor: m.color + '55' },
                        isCurrent && { backgroundColor: m.color + '14' },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <View style={[styles.dot, { backgroundColor: m.color }]} />
                      <Feather name={m.icon} size={16} color={m.color} />
                      <Text style={[styles.optionText, { color: m.color }]}>
                        {t(m.labelKey)}
                      </Text>
                      {isBusy ? (
                        <Feather name="loader" size={16} color={m.color} />
                      ) : isCurrent ? (
                        <Feather name="check" size={16} color={m.color} />
                      ) : null}
                    </Pressable>
                  );
                })}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSheetOpen(false)}
                  style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 13, fontWeight: '600' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.bgElevated,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl + 8,
    gap: 8,
  },
  sheetTitle: {
    color: theme.colors.text,
    fontSize: 19,
    fontWeight: '700',
  },
  sheetBody: {
    color: theme.colors.textMuted,
    fontSize: 14,
    marginBottom: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
  },
  optionText: { flex: 1, fontSize: 15, fontWeight: '600' },
  cancel: {
    marginTop: 6,
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: { color: theme.colors.textMuted, fontSize: 14, fontWeight: '600' },
});
