import { useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '@/theme';

export type PickerOption = {
  value: string | null;
  label: string;
  hint?: string;
  icon?: keyof typeof Feather.glyphMap;
};

type Props = {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: PickerOption[];
  placeholder?: string;
  icon?: keyof typeof Feather.glyphMap;
  helper?: ReactNode;
};

export function Picker({
  label,
  value,
  onChange,
  options,
  placeholder,
  icon,
  helper,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const placeholderText = placeholder ?? t('common.search');

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.field, pressed && { opacity: 0.85 }]}
      >
        {icon ? (
          <Feather
            name={icon}
            size={18}
            color={selected ? theme.colors.accent : theme.colors.textDim}
            style={styles.icon}
          />
        ) : null}
        <Text style={[styles.value, !selected && styles.placeholder]} numberOfLines={1}>
          {selected ? selected.label : placeholderText}
        </Text>
        <Feather name="chevron-down" size={18} color={theme.colors.textMuted} />
      </Pressable>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <SafeAreaView edges={['bottom']}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{label}</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {options.map((opt) => {
                const active = opt.value === value;
                return (
                  <Pressable
                    key={opt.value ?? '__null'}
                    onPress={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      active && styles.optionActive,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    {opt.icon ? (
                      <Feather
                        name={opt.icon}
                        size={18}
                        color={active ? theme.colors.accent : theme.colors.textMuted}
                      />
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                        {opt.label}
                      </Text>
                      {opt.hint ? <Text style={styles.optionHint}>{opt.hint}</Text> : null}
                    </View>
                    {active ? (
                      <Feather name="check" size={18} color={theme.colors.accent} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: {
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.medium,
    color: theme.colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.lg,
  },
  icon: { marginRight: 10 },
  value: { flex: 1, color: theme.colors.text, fontSize: theme.font.size.md },
  placeholder: { color: theme.colors.textDim },
  helper: { fontSize: theme.font.size.xs, color: theme.colors.textDim, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.bgElevated,
    borderTopLeftRadius: theme.radius['2xl'],
    borderTopRightRadius: theme.radius['2xl'],
    borderTopWidth: 1,
    borderColor: theme.colors.borderStrong,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: theme.spacing.lg,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.borderStrong,
    alignSelf: 'center',
    marginBottom: theme.spacing.md,
  },
  sheetTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.semibold,
    marginBottom: theme.spacing.md,
    paddingHorizontal: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: theme.radius.md,
  },
  optionActive: { backgroundColor: theme.colors.accentMuted },
  optionLabel: { color: theme.colors.text, fontSize: theme.font.size.md, fontWeight: '500' },
  optionLabelActive: { color: theme.colors.accent, fontWeight: theme.font.weight.semibold },
  optionHint: { color: theme.colors.textMuted, fontSize: theme.font.size.xs, marginTop: 2 },
});
