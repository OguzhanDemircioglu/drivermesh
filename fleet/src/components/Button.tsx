import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost';

type Props = Omit<PressableProps, 'style'> & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  leftIcon?: React.ReactNode;
};

export function Button({
  title,
  variant = 'primary',
  loading,
  disabled,
  fullWidth = true,
  leftIcon,
  style,
  ...pressableProps
}: Props) {
  const isDisabled = disabled || loading;

  if (variant === 'primary') {
    return (
      <Pressable
        {...pressableProps}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.base,
          fullWidth && styles.full,
          pressed && !isDisabled && styles.pressed,
          isDisabled && styles.disabled,
          style,
        ]}
      >
        <LinearGradient
          colors={['#FF8C3D', '#FF7A1A', '#F36300']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: theme.radius.lg }]}
        />
        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator color="#0A0E1F" />
          ) : (
            <>
              {leftIcon}
              <Text style={[styles.text, styles.textPrimary]}>{title}</Text>
            </>
          )}
        </View>
      </Pressable>
    );
  }

  if (variant === 'secondary') {
    return (
      <Pressable
        {...pressableProps}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.base,
          styles.secondary,
          fullWidth && styles.full,
          pressed && !isDisabled && styles.pressed,
          isDisabled && styles.disabled,
          style,
        ]}
      >
        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator color={theme.colors.text} />
          ) : (
            <>
              {leftIcon}
              <Text style={[styles.text, styles.textSecondary]}>{title}</Text>
            </>
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      {...pressableProps}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.ghost,
        fullWidth && styles.full,
        pressed && !isDisabled && styles.ghostPressed,
        style,
      ]}
    >
      <Text style={[styles.text, styles.textGhost]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  full: { alignSelf: 'stretch' },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: theme.spacing.lg,
  },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  disabled: { opacity: 0.5 },
  text: {
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
    letterSpacing: 0.2,
  },
  textPrimary: { color: '#0A0E1F' },
  secondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  textSecondary: { color: theme.colors.text },
  ghost: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  ghostPressed: { opacity: 0.6 },
  textGhost: { color: theme.colors.textMuted },
});
