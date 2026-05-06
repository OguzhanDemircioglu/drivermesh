import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Card } from './Card';
import { theme } from '@/theme';
import type { VehicleStatus } from '@/lib/database.types';

const statusTone: Record<VehicleStatus, { fg: string; bg: string }> = {
  active: { fg: theme.colors.success, bg: 'rgba(34,197,94,0.14)' },
  idle: { fg: theme.colors.textMuted, bg: 'rgba(138,147,166,0.12)' },
  maintenance: { fg: theme.colors.warning, bg: 'rgba(245,158,11,0.14)' },
};

const GRADIENTS: Array<readonly [string, string]> = [
  ['#FF8C3D', '#FF7A1A'],
  ['#5B7FFF', '#3D5DDB'],
  ['#B89AF0', '#8C6CD2'],
  ['#22C55E', '#15803D'],
];

type Props = {
  plate: string;
  brand: string;
  model: string;
  year: number;
  status: VehicleStatus;
  addedBy?: string | null;
  photoUrl?: string | null;
  onPress?: () => void;
};

function VehicleCardImpl({
  plate,
  brand,
  model,
  year,
  status,
  addedBy,
  photoUrl: _photoUrl,
  onPress,
}: Props) {
  const { t } = useTranslation();
  const s = statusTone[status];
  const colors = GRADIENTS[plate.charCodeAt(0) % GRADIENTS.length];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && { opacity: 0.85, transform: [{ scale: 0.995 }] }]}
    >
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={styles.thumb}>
            <LinearGradient
              colors={[colors[0], colors[1]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Feather name="truck" size={26} color="rgba(255,255,255,0.9)" />
          </View>
          <View style={styles.body}>
            <Text style={styles.plate}>{plate}</Text>
            <Text style={styles.model} numberOfLines={1}>
              {brand} {model} · {year}
            </Text>
            {addedBy ? (
              <Text style={styles.added} numberOfLines={1}>
                <Feather name="user" size={11} color={theme.colors.textDim} />{' '}
                {t('vehicles.addedBy', { name: addedBy })}
              </Text>
            ) : null}
          </View>
          <View style={[styles.badge, { backgroundColor: s.bg }]}>
            <Text style={[styles.badgeText, { color: s.fg }]}>
              {t(`vehicles.status.${status}`)}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

export const VehicleCard = memo(VehicleCardImpl);

const styles = StyleSheet.create({
  card: { padding: theme.spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  plate: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.bold,
    letterSpacing: 1.4,
    fontVariant: ['tabular-nums'],
  },
  model: { color: theme.colors.textMuted, fontSize: theme.font.size.sm },
  added: { color: theme.colors.textDim, fontSize: theme.font.size.xs, marginTop: 2 },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.full,
  },
  badgeText: { fontSize: theme.font.size.xs, fontWeight: theme.font.weight.semibold },
});
