import { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '@/theme';

type Props = TextInputProps & {
  label?: string;
  error?: string;
  icon?: keyof typeof Feather.glyphMap;
  /** Sağ tarafta gösterilen küçük ipucu ikonu (örn. read-only alanlar için
   * kilit). isPassword ile aynı anda kullanılmaz — eye-toggle önceliklidir. */
  rightIcon?: keyof typeof Feather.glyphMap;
  isPassword?: boolean;
};

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, error, icon, rightIcon, isPassword, style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!isPassword);
  const hasError = !!error;

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text
          style={[
            styles.label,
            focused && !hasError && styles.labelFocused,
            hasError && styles.labelError,
          ]}
        >
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          focused && !hasError && styles.fieldFocused,
          hasError && styles.fieldError,
        ]}
      >
        {icon ? (
          <Feather
            name={icon}
            size={18}
            color={
              hasError
                ? theme.colors.danger
                : focused
                  ? theme.colors.accent
                  : theme.colors.textMuted
            }
            style={styles.icon}
          />
        ) : null}
        <TextInput
          ref={ref}
          {...rest}
          secureTextEntry={hidden}
          placeholderTextColor={theme.colors.textMuted}
          selectionColor={theme.colors.accent}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, style]}
        />
        {isPassword ? (
          <Pressable
            hitSlop={12}
            onPress={() => setHidden((v) => !v)}
            style={({ pressed }) => [styles.toggle, pressed && { opacity: 0.6 }]}
          >
            <Feather
              name={hidden ? 'eye' : 'eye-off'}
              size={18}
              color={theme.colors.textMuted}
            />
          </Pressable>
        ) : rightIcon ? (
          <Feather
            name={rightIcon}
            size={14}
            color={theme.colors.textDim}
            style={styles.rightIcon}
          />
        ) : null}
      </View>
      {hasError ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: {
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.medium,
    color: theme.colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  labelFocused: { color: theme.colors.accent },
  labelError: { color: theme.colors.danger },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.lg,
  },
  fieldFocused: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.surface,
  },
  fieldError: {
    borderColor: theme.colors.danger,
    backgroundColor: theme.colors.dangerMuted,
  },
  icon: { marginRight: 10 },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    paddingVertical: 0,
  },
  toggle: { padding: 4, marginLeft: 8 },
  rightIcon: { marginLeft: 8 },
  errorText: {
    fontSize: 12,
    color: theme.colors.danger,
    marginTop: 0,
  },
});
