import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { StatCard } from '@/components/StatCard';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/auth/AuthProvider';
import { useMyStats } from '@/hooks/useStats';
import { switchLanguage } from '@/i18n';
import {
  getPushPermission,
  registerPushTokenForCustomer,
  requestPushPermission,
} from '@/lib/push';
import { colors, radii, spacing } from '@/theme';

export default function AccountScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { customer, signOut } = useAuth();
  const stats = useMyStats(customer?.id);
  const toast = useToast();
  const [busyLang, setBusyLang] = useState(false);
  const [busyNotif, setBusyNotif] = useState(false);

  const onNotificationsPress = async () => {
    if (busyNotif || !customer) return;
    setBusyNotif(true);
    try {
      const cur = await getPushPermission();
      if (cur === 'granted') {
        await registerPushTokenForCustomer(customer.id).catch(() => {});
        toast.show('success', 'Bildirimler açık');
        return;
      }
      if (cur === 'denied') {
        Alert.alert(
          'Bildirimler kapalı',
          'Sistem ayarlarından açabilirsin.',
          [
            { text: 'İptal', style: 'cancel' },
            { text: 'Ayarları aç', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
      // undetermined
      const next = await requestPushPermission();
      if (next === 'granted') {
        await registerPushTokenForCustomer(customer.id).catch(() => {});
        toast.show('success', 'Bildirimler açık');
      } else {
        toast.show('warning', t('permissions.pushDeny'));
      }
    } finally {
      setBusyNotif(false);
    }
  };

  const initials = (customer?.full_name ?? '?')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const onChangeLang = async (lang: 'tr' | 'en') => {
    if (i18n.language === lang || busyLang) return;
    setBusyLang(true);
    try {
      await switchLanguage(lang);
    } finally {
      setBusyLang(false);
    }
  };

  const onLogout = () => {
    Alert.alert(t('account.logoutConfirmTitle'), t('account.logoutConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.logout'),
        style: 'destructive',
        onPress: () => {
          signOut().catch(() => {});
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('account.title')}</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials || '?'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{customer?.full_name ?? '—'}</Text>
            <Text style={styles.phone}>{customer?.phone ?? ''}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(app)/account/edit-profile')}
            hitSlop={8}
            style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.7 }]}
          >
            <Feather name="edit-2" size={16} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <StatCard
            icon="navigation"
            label={t('home.statsTotalRides')}
            value={String(stats.data?.totalRides ?? 0)}
          />
          <StatCard
            icon="map"
            label={t('home.statsTotalKm')}
            value={`${stats.data?.totalKm ?? 0}`}
          />
        </View>

        <View style={styles.menuGroup}>
          <View style={styles.menuRow}>
            <Feather name="globe" size={18} color={colors.textMuted} />
            <Text style={styles.menuLabel}>{t('account.language')}</Text>
            <View style={styles.langPill}>
              <Pressable
                onPress={() => onChangeLang('tr')}
                style={[styles.langChip, i18n.language === 'tr' && styles.langChipActive]}
              >
                <Text
                  style={[
                    styles.langChipText,
                    i18n.language === 'tr' && styles.langChipTextActive,
                  ]}
                >
                  TR
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onChangeLang('en')}
                style={[styles.langChip, i18n.language === 'en' && styles.langChipActive]}
              >
                <Text
                  style={[
                    styles.langChipText,
                    i18n.language === 'en' && styles.langChipTextActive,
                  ]}
                >
                  EN
                </Text>
              </Pressable>
            </View>
          </View>

          <MenuLink
            icon="help-circle"
            label={t('account.help')}
            onPress={() => router.push('/(app)/account/help')}
          />
          <MenuLink
            icon="bell"
            label={t('account.notifications')}
            onPress={onNotificationsPress}
          />
        </View>

        <View style={styles.versionRow}>
          <Text style={styles.versionLabel}>{t('account.version')}</Text>
          <Text style={styles.versionValue}>
            {Constants.expoConfig?.version ?? '0.0.0'}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={onLogout}
          style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.85 }]}
        >
          <Feather name="log-out" size={16} color={colors.danger} />
          <Text style={styles.logoutText}>{t('common.logout')}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function MenuLink({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.7 }]}
    >
      <Feather name={icon} size={18} color={colors.textMuted} />
      <Text style={[styles.menuLabel, { flex: 1 }]}>{label}</Text>
      <Feather name="chevron-right" size={18} color={colors.textDim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['2xl'] },
  title: { color: colors.text, fontSize: 25, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.accent, fontSize: 21, fontWeight: '700' },
  name: { color: colors.text, fontSize: 19, fontWeight: '600' },
  phone: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuGroup: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuLabel: { color: colors.text, fontSize: 15 },
  langPill: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    padding: 3,
    gap: 2,
  },
  langChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.full,
  },
  langChipActive: { backgroundColor: colors.accent },
  langChipText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  langChipTextActive: { color: colors.bg },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  versionLabel: { color: colors.textMuted, fontSize: 13 },
  versionValue: { color: colors.textDim, fontSize: 13 },
  logoutBtn: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerMuted,
  },
  logoutText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
});
