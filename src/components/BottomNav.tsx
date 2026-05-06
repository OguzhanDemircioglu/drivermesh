import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { theme } from '@/theme';

type TabKey = 'home' | 'jobs' | 'fleet' | 'account';

type Props = {
  active: TabKey;
  onChange: (key: TabKey) => void;
};

const TAB_DEFS: Array<{ key: TabKey; icon: keyof typeof Feather.glyphMap }> = [
  { key: 'home', icon: 'home' },
  { key: 'jobs', icon: 'briefcase' },
  { key: 'fleet', icon: 'truck' },
  { key: 'account', icon: 'user' },
];

export function BottomNav({ active, onChange }: Props) {
  const { t } = useTranslation();
  const tabs = TAB_DEFS.map((d) => ({ ...d, label: t(`bottomNav.${d.key}`) }));
  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['rgba(10,14,31,0)', 'rgba(10,14,31,0.95)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.fade}
        pointerEvents="none"
      />
      <View style={styles.bar}>
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <Pressable
              key={t.key}
              onPress={() => onChange(t.key)}
              hitSlop={8}
              style={({ pressed }) => [styles.tab, pressed && { opacity: 0.7 }]}
            >
              <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
                <Feather
                  name={t.icon}
                  size={20}
                  color={isActive ? theme.colors.accent : theme.colors.textMuted}
                />
              </View>
              <Text style={[styles.label, isActive && styles.labelActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 130,
  },
  bar: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    paddingBottom: 24,
    backgroundColor: 'rgba(19,24,41,0.92)',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  iconWrap: {
    width: 44,
    height: 32,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: theme.colors.accentMuted },
  label: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: theme.font.weight.medium,
  },
  labelActive: { color: theme.colors.accent, fontWeight: theme.font.weight.semibold },
});
