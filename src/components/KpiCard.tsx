import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Card } from './Card';
import { theme } from '@/theme';

type Tone = 'orange' | 'mesh' | 'lavender' | 'success';

type Props = {
  label: string;
  value: string | number;
  delta?: string;
  icon: keyof typeof Feather.glyphMap;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
};

const toneColors: Record<Tone, { fg: string; bg: string }> = {
  orange: { fg: theme.colors.accent, bg: theme.colors.accentMuted },
  mesh: { fg: theme.colors.mesh, bg: theme.colors.meshMuted },
  lavender: { fg: theme.colors.lavender, bg: 'rgba(184,154,240,0.14)' },
  success: { fg: theme.colors.success, bg: 'rgba(34,197,94,0.14)' },
};

export function KpiCard({ label, value, delta, icon, tone = 'orange', style }: Props) {
  const c = toneColors[tone];
  const positive = delta?.startsWith('+');
  return (
    <Card style={[styles.card, style]}>
      <View style={[styles.iconWrap, { backgroundColor: c.bg }]}>
        <Feather name={icon} size={18} color={c.fg} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {delta ? (
        <Text
          style={[
            styles.delta,
            { color: positive ? theme.colors.success : theme.colors.danger },
          ]}
        >
          {delta}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, minHeight: 130 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: theme.font.size['2xl'],
    fontWeight: theme.font.weight.bold,
    color: theme.colors.text,
    letterSpacing: -0.4,
    marginTop: 4,
  },
  label: { fontSize: theme.font.size.sm, color: theme.colors.textMuted },
  delta: { fontSize: theme.font.size.xs, fontWeight: theme.font.weight.medium, marginTop: 2 },
});
