import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { type ReactNode } from 'react';
import { theme } from '@/theme';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
};

export function Card({ children, style, elevated }: Props) {
  return <View style={[styles.base, elevated && styles.elevated, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
  },
  elevated: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.borderStrong,
  },
});
