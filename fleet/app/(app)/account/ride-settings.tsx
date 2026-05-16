import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/Card';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme';

type Visibility = {
  organization_id: string;
  ride_enabled: boolean | null;
  operating_hours: unknown;
};

export default function RideSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [data, setData] = useState<Visibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.organization_id) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('fleets_visibility' as never)
      .select('organization_id, ride_enabled, operating_hours')
      .eq('organization_id', profile.organization_id)
      .maybeSingle();
    if (error) {
      console.warn('[ride-settings] load failed', error.message);
    } else {
      setData(data as never);
    }
    setLoading(false);
  }, [profile?.organization_id]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (next: boolean) => {
    if (!profile?.organization_id || saving) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('fleets_visibility' as never)
        .update({ ride_enabled: next } as never)
        .eq('organization_id', profile.organization_id);
      if (error) throw new Error(error.message);
      setData((d) => (d ? { ...d, ride_enabled: next } : d));
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Bilinmeyen');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const enabled = data?.ride_enabled === true;

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.header}>
          <Pressable
            hitSlop={12}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <Feather name="arrow-left" size={20} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.title}>{t('rideSettings.title')}</Text>
          <View style={{ width: 36 }} />
        </View>

        <Card>
          <View style={styles.row}>
            <View style={styles.iconWrap}>
              <Feather name="users" size={18} color={theme.colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{t('rideSettings.toggleLabel')}</Text>
              <Text style={styles.rowHint}>{t('rideSettings.toggleHint')}</Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={toggle}
              disabled={saving}
              trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
              thumbColor={theme.colors.text}
            />
          </View>
        </Card>

        <Card style={{ gap: 8 }}>
          <Text style={styles.sectionTitle}>{t('rideSettings.statusTitle')}</Text>
          <Text style={styles.statusBody}>
            {enabled ? t('rideSettings.statusOn') : t('rideSettings.statusOff')}
          </Text>
          <Text style={styles.statusNote}>{t('rideSettings.note')}</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: theme.spacing.lg, gap: theme.spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  title: { color: theme.colors.text, fontSize: 19, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  rowHint: { color: theme.colors.textMuted, fontSize: 13, marginTop: 2 },
  sectionTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  statusBody: { color: theme.colors.text, fontSize: 14 },
  statusNote: { color: theme.colors.textMuted, fontSize: 12 },
});
