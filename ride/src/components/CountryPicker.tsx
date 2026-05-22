import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getCountriesOrderedForPicker, type Country } from '@/lib/countries';
import { colors, radii, spacing } from '@/theme';

type Props = {
  visible: boolean;
  onSelect: (iso: string) => void;
  onClose: () => void;
  selectedIso?: string;
};

export function CountryPicker({ visible, onSelect, onClose, selectedIso }: Props) {
  const { i18n, t } = useTranslation();
  const [query, setQuery] = useState('');

  const locale = i18n.language?.startsWith('tr') ? 'tr' : 'en';
  const all = useMemo(() => getCountriesOrderedForPicker(locale), [locale]);

  const filtered = useMemo<Country[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.iso.toLowerCase().includes(q),
    );
  }, [all, query]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            hitSlop={12}
            style={styles.closeBtn}
          >
            <Feather name="x" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t('countryPicker.title')}</Text>
          <View style={styles.closeBtn} />
        </View>

        <View style={styles.searchWrap}>
          <Feather name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('countryPicker.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
            style={styles.searchInput}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10}>
              <Feather name="x-circle" size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(c) => c.iso}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isSelected = item.iso === selectedIso;
            return (
              <Pressable
                accessibilityRole="button"
                onPress={() => onSelect(item.iso)}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { backgroundColor: colors.bgElevated },
                ]}
              >
                <Text style={styles.flag}>{item.flag}</Text>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.dial}>{item.dialCode}</Text>
                {isSelected ? (
                  <Feather name="check" size={20} color={colors.accent} style={styles.check} />
                ) : null}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>{t('countryPicker.empty')}</Text>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    paddingVertical: 0,
  },
  listContent: { paddingBottom: spacing['2xl'] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  flag: { fontSize: 24 },
  name: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '500' },
  dial: { color: colors.textMuted, fontSize: 15, fontWeight: '600', minWidth: 50, textAlign: 'right' },
  check: { marginLeft: 4 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl, fontSize: 14 },
});
