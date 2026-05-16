import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '@/theme';

type Props = {
  value: number; // 0-5
  onChange: (next: number) => void;
  size?: number;
};

export function StarRating({ value, onChange, size = 44 }: Props) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= value;
        return (
          <Pressable
            key={i}
            accessibilityRole="button"
            onPress={() => onChange(i)}
            hitSlop={6}
            style={({ pressed }) => [styles.btn, pressed && { transform: [{ scale: 1.1 }] }]}
          >
            <Feather
              name={filled ? 'star' : 'star'}
              size={size}
              color={filled ? colors.warning : colors.textDim}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 16, justifyContent: 'center' },
  btn: { padding: 4 },
});
