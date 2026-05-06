import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/theme';

type Props = {
  name: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function Avatar({ name, size = 44, style }: Props) {
  const initials = getInitials(name);
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2 }, styles.wrap, style]}>
      <LinearGradient
        colors={['#5B7FFF', '#B89AF0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
      />
      <Text style={[styles.text, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

function getInitials(name: string) {
  const cleaned = name.trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || cleaned[0].toUpperCase();
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  text: {
    color: '#0A0E1F',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
