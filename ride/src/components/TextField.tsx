import { forwardRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, radii } from '@/theme';

type Props = TextInputProps & {
  label?: string;
  error?: string;
  hint?: string;
  containerStyle?: ViewStyle;
};

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, error, hint, containerStyle, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const showError = !!error;
  const isMultiline = !!rest.multiline;
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.fieldWrap,
          isMultiline ? styles.fieldWrapMultiline : styles.fieldWrapSingle,
          focused && styles.focused,
          showError && styles.errorField,
        ]}
      >
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textDim}
          style={styles.input}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
      </View>
      {showError ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: {
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  fieldWrap: {
    borderRadius: radii.lg,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  fieldWrapSingle: {
    height: 54,
    alignItems: 'center',
  },
  fieldWrapMultiline: {
    minHeight: 120,
    alignItems: 'stretch',
    paddingVertical: 12,
  },
  focused: {
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  errorField: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerMuted,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
  },
  error: { color: colors.danger, fontSize: 13 },
  hint: { color: colors.textMuted, fontSize: 13 },
});
