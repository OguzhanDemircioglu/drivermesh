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
import { demo, isDemoActive } from '@/demo/store';
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

type Props = {
  /**
   * Compact (default) → header içinde küçük chip.
   * Expanded → full-width comfortable tap target; anasayfa primary status row için.
   */
  expanded?: boolean;
};

export function StatusPill({ expanded = false }: Props = {}) {
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
      // Demo modunda Supabase yok — RPC çağırma, doğrudan demo store'a yaz.
      // Kullanıcı alert görmesin, status rahatça değişsin.
      if (isDemoActive() && profile?.id) {
        demo.updateProfile(profile.id, { status: next });
        await refreshProfile();
        setSheetOpen(false);
        return;
      }
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
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('errors.unknown'));
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
        hitSlop={expanded ? 4 : 8}
        style={({ pressed }) => [
          styles.pill,
          expanded && styles.pillExpanded,
          { borderColor: meta.color, backgroundColor: meta.color + '22' },
          pressed && { opacity: 0.7 },
        ]}
      >
        <View style={[styles.dot, expanded && styles.dotExpanded, { backgroundColor: meta.color }]} />
        <Feather name={meta.icon} size={expanded ? 18 : 14} color={meta.color} />
        <Text style={[styles.text, expanded && styles.textExpanded, { color: meta.color }]}>
          {t(meta.labelKey)}
        </Text>
        {!isOnTrip ? (
          <Feather
            name="chevron-down"
            size={expanded ? 18 : 14}
            color={meta.color}
            style={expanded ? styles.chevronExpanded : undefined}
          />
        ) : null}
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
  pillExpanded: {
    alignSelf: 'stretch',
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 10,
    borderWidth: 1.5,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotExpanded: { width: 10, height: 10, borderRadius: 5 },
  text: { fontSize: 13, fontWeight: '600' },
  textExpanded: { flex: 1, fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  chevronExpanded: { marginLeft: 4 },
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
