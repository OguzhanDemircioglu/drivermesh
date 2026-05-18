import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Card } from './Card';
import { CachedImage } from './CachedImage';
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

function gradientIndexFromPlate(plate: string): number {
  // Full-string hash so every Istanbul "34 ..." plate doesn't collapse to
  // the same gradient. Matches MiniLocationPin.vehicleColorFromPlate.
  if (!plate) return 0;
  let hash = 5381;
  for (let i = 0; i < plate.length; i++) {
    hash = ((hash << 5) + hash + plate.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % GRADIENTS.length;
}

type Props = {
  plate: string;
  brand: string;
  model: string;
  year: number;
  status: VehicleStatus;
  addedBy?: string | null;
  /** Araç şu an kimin üzerinde — driver veya owner adı. Set'liyse card'da
   * "Üzerinde: <ad>" satırı görünür (vehicles_set_default_owner trigger
   * sonrası hiçbir araç sahipsiz kalmaz, bu yüzden hep gösterilebilir). */
  currentUserName?: string | null;
  photoUrl?: string | null;
  /** Operator-chosen colour (hex). When set, overrides the plate-derived
   * gradient with a solid colour matching the real vehicle. */
  color?: string | null;
  /** Photo authenticity badge type from `badgeFromSummary()`. Card sag
   * altinda kucuk bir flag gosterir — Patron araclar listesinde supheli
   * foto'lari bir bakista ayirt edebilsin. */
  authenticityBadge?: 'wrong_content' | 'ai_generated' | 'exif_missing' | 'exif_stale' | null;
  onPress?: () => void;
};

function darken(hex: string, amount = 0.15): string {
  // Quick brightness reduction so the operator's flat colour still reads
  // as a gradient on the card thumb without a second palette pick.
  const m = /^#([\da-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  let r = (n >> 16) & 0xff;
  let g = (n >> 8) & 0xff;
  let b = n & 0xff;
  r = Math.max(0, Math.round(r * (1 - amount)));
  g = Math.max(0, Math.round(g * (1 - amount)));
  b = Math.max(0, Math.round(b * (1 - amount)));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function VehicleCardImpl({
  plate,
  brand,
  model,
  year,
  status,
  addedBy,
  currentUserName,
  photoUrl,
  color,
  authenticityBadge,
  onPress,
}: Props) {
  const { t } = useTranslation();
  const s = statusTone[status];
  const colors: readonly [string, string] = color
    ? [color, darken(color, 0.18)]
    : GRADIENTS[gradientIndexFromPlate(plate)];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && { opacity: 0.85, transform: [{ scale: 0.995 }] }]}
    >
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={styles.thumb}>
            {/* The colour gradient sits behind everything as a fallback —
                the photo (if present) layers on top via cover. The gradient
                still leaks at the edges of letterboxed photos so the card
                keeps the per-vehicle identity colour even with portraits. */}
            <LinearGradient
              colors={[colors[0], colors[1]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {photoUrl ? (
              <CachedImage
                uri={photoUrl}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : (
              <Feather name="truck" size={26} color="rgba(255,255,255,0.9)" />
            )}
          </View>
          <View style={styles.body}>
            <Text style={styles.plate}>{plate}</Text>
            <Text style={styles.model} numberOfLines={1}>
              {brand} {model} · {year}
            </Text>
            {currentUserName ? (
              <Text style={styles.added} numberOfLines={1}>
                <Feather name="user-check" size={11} color={theme.colors.accent} />{' '}
                {t('vehicles.currentUser', { name: currentUserName })}
              </Text>
            ) : addedBy ? (
              <Text style={styles.added} numberOfLines={1}>
                <Feather name="user" size={11} color={theme.colors.textDim} />{' '}
                {t('vehicles.addedBy', { name: addedBy })}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={[styles.badge, { backgroundColor: s.bg }]}>
              <Text style={[styles.badgeText, { color: s.fg }]}>
                {t(`vehicles.status.${status}`)}
              </Text>
            </View>
            {authenticityBadge ? <AuthenticityFlag kind={authenticityBadge} /> : null}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

// Foto authenticity mini-flag (sag-altta status pill'in altinda).
// Tam metin VehicleCard'a sigmaz, sadece icon + kisa label.
const FLAG_CONFIG = {
  wrong_content: { icon: 'alert-octagon' as const, color: '#EF4444', label: 'Yanlis' },
  ai_generated: { icon: 'cpu' as const, color: '#F59E0B', label: 'AI' },
  exif_missing: { icon: 'help-circle' as const, color: '#94A3B8', label: 'EXIF' },
  exif_stale: { icon: 'clock' as const, color: '#94A3B8', label: 'Eski' },
};

function AuthenticityFlag({ kind }: { kind: NonNullable<Props['authenticityBadge']> }) {
  const c = FLAG_CONFIG[kind];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 4,
        backgroundColor: c.color + '22',
      }}
    >
      <Feather name={c.icon} size={9} color={c.color} />
      <Text style={{ fontSize: 9, color: c.color, fontWeight: '700' }}>{c.label}</Text>
    </View>
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
