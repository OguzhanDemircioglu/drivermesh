import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
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

  const onPress = () => {
    if (isOnTrip) {
      Alert.alert(t('status.title'), t('status.onTripLocked'));
      return;
    }
    Alert.alert(t('status.title'), t('status.body'), [
      ...SELECTABLE.map((s) => ({
        text: t(STATUS_META[s].labelKey),
        onPress: async () => {
          try {
            const { error } = await (supabase as unknown as {
              rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
            }).rpc('set_my_status', { p_status: s });
            if (error) throw new Error(error.message);
            await refreshProfile();
          } catch (e) {
            Alert.alert('Hata', e instanceof Error ? e.message : t('errors.unknown'));
          }
        },
      })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };

  return (
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
});
