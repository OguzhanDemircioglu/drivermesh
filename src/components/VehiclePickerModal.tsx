// ============================================================================
// VehiclePickerModal — claim'lenebilir aracları listeleyen modal.
//
// Listede:
//   - status != 'maintenance' (bakimdaki gizli)
//   - aktif is (assigned/in_progress) bagi olmayan araclar
//   - excludeUserId ile kullanicinin mevcut araci listeden gizlenir
//
// Tap → onPick(vehicleId) callback.
// ============================================================================
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { Vehicle } from '@/lib/database.types';
import { listClaimableVehicles } from '@/lib/vehicleClaim';
import { theme } from '@/theme';

export type VehiclePickerModalProps = {
  visible: boolean;
  orgId: string;
  currentUserId: string;
  onPick: (vehicle: Vehicle) => void;
  onClose: () => void;
  /** true ise kullanicinin mevcut araci listede gosterilmez. Default true. */
  excludeMine?: boolean;
};

export function VehiclePickerModal({
  visible,
  orgId,
  currentUserId,
  onPick,
  onClose,
  excludeMine = true,
}: VehiclePickerModalProps) {
  const { t } = useTranslation();
  const [list, setList] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    listClaimableVehicles(orgId, { excludeUserId: excludeMine ? currentUserId : undefined })
      .then((vehicles) => {
        if (!cancelled) setList(vehicles);
      })
      .catch((e) => console.warn('[vehiclePicker] list failed', e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, orgId, currentUserId, excludeMine]);

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.head}>
            <Text style={styles.title}>{t('vehiclePicker.title')}</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
              <Feather name="x" size={20} color={theme.colors.text} />
            </Pressable>
          </View>
          <Text style={styles.hint}>{t('vehiclePicker.hint')}</Text>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.colors.accent} />
            </View>
          ) : list.length === 0 ? (
            <View style={styles.center}>
              <Feather name="alert-circle" size={28} color={theme.colors.textMuted} />
              <Text style={styles.emptyText}>{t('vehiclePicker.empty')}</Text>
            </View>
          ) : (
            <FlatList
              data={list}
              keyExtractor={(v) => v.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onPick(item)}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
                >
                  <View style={[styles.iconBox, { backgroundColor: item.color ?? theme.colors.accentMuted }]}>
                    <Feather name="truck" size={18} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.plate}>{item.plate}</Text>
                    <Text style={styles.spec}>
                      {item.brand} {item.model} · {item.year}
                    </Text>
                    {item.current_user_id ? (
                      <Text style={styles.takenHint}>
                        {t('vehiclePicker.heldByOther')}
                      </Text>
                    ) : null}
                  </View>
                  <Feather name="chevron-right" size={18} color={theme.colors.textMuted} />
                </Pressable>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 32,
    maxHeight: '80%',
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.bold,
  },
  close: { padding: 6 },
  hint: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    marginTop: 4,
    marginBottom: 12,
  },

  center: { alignItems: 'center', gap: 10, paddingVertical: theme.spacing['2xl'] },
  emptyText: { color: theme.colors.textMuted, fontSize: theme.font.size.sm },

  listContent: { gap: 10, paddingBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plate: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.bold,
    letterSpacing: 0.5,
  },
  spec: { color: theme.colors.textMuted, fontSize: theme.font.size.xs, marginTop: 2 },
  takenHint: {
    color: theme.colors.warning,
    fontSize: theme.font.size.xs,
    marginTop: 4,
    fontWeight: theme.font.weight.semibold,
  },
});
