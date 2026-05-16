import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, radii, spacing } from '@/theme';
import type { SearchVehiclesRow } from '@/lib/db/rides';

type Props = {
  vehicle: SearchVehiclesRow;
  onCall: (vehicle: SearchVehiclesRow) => void;
};

function formatDistance(raw: string | number | null | undefined): string {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
  if (!isFinite(n)) return '—';
  if (n < 0.1) return '<100 m';
  if (n < 1) return `${Math.round(n * 1000)} m`;
  return `${n.toFixed(n < 10 ? 1 : 0)} km`;
}

export function VehicleCard({ vehicle, onCall }: Props) {
  const { t } = useTranslation();
  const phone = vehicle.driver_phone;
  return (
    <View style={styles.card}>
      <View style={styles.photoWrap}>
        {vehicle.photo_url ? (
          <Image
            source={{ uri: vehicle.photo_url }}
            style={styles.photo}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Feather name="truck" size={32} color={colors.textDim} />
          </View>
        )}
        <View style={styles.plateBadge}>
          <Text style={styles.plateText}>{vehicle.plate}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {vehicle.brand} {vehicle.model}
          </Text>
          <View style={styles.distancePill}>
            <Feather name="map-pin" size={11} color={colors.accent} />
            <Text style={styles.distanceText}>{formatDistance(vehicle.distance_km)}</Text>
          </View>
        </View>
        <View style={styles.metaRow}>
          {vehicle.color ? <Text style={styles.meta}>{vehicle.color}</Text> : null}
          <Text style={styles.metaDim}>· {vehicle.year}</Text>
        </View>
        {vehicle.driver_name ? (
          <Text style={styles.driver} numberOfLines={1}>
            {vehicle.driver_name}
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onCall(vehicle)}
          style={({ pressed }) => [styles.callBtn, pressed && styles.pressed]}
        >
          <Feather name="phone-call" size={16} color={colors.bg} />
          <Text style={styles.callText}>{t('vehicles.callBtn')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!phone}
          onPress={() => phone && Linking.openURL(`tel:${phone}`)}
          style={({ pressed }) => [
            styles.phoneBtn,
            !phone && styles.phoneBtnDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Feather name="phone" size={18} color={phone ? colors.mesh : colors.textDim} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  photoWrap: { position: 'relative', height: 140, backgroundColor: colors.surface },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  plateBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(10,14,31,0.75)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  plateText: { color: colors.text, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { color: colors.text, fontSize: 17, fontWeight: '600', flex: 1 },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.accentMuted,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  distanceText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  metaRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  meta: { color: colors.text, fontSize: 13 },
  metaDim: { color: colors.textMuted, fontSize: 13 },
  driver: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  callBtn: {
    flex: 1,
    height: 44,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  callText: { color: colors.bg, fontWeight: '700', fontSize: 15 },
  phoneBtn: {
    width: 44,
    height: 44,
    backgroundColor: colors.meshMuted,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneBtnDisabled: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
});
