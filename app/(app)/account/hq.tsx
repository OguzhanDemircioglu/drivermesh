import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { MeshBackground } from '@/components/MeshBackground';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { MapPicker } from '@/components/MapPicker';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/auth/AuthProvider';
import { getHq, saveHq, type Hq } from '@/lib/hq';
import { theme } from '@/theme';

export default function HqScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const toast = useToast();
  const [hq, setHq] = useState<Hq>({ lat: null, lng: null, address: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const isOwner = profile?.role === 'owner';

  useEffect(() => {
    if (!profile?.organization_id) return;
    getHq(profile.organization_id)
      .then((current) => {
        if (current) setHq(current);
      })
      .finally(() => setLoading(false));
  }, [profile?.organization_id]);

  const onSave = useCallback(async () => {
    if (!profile?.organization_id) return;
    if (hq.lat == null || hq.lng == null) return;
    setSaving(true);
    try {
      await saveHq(profile.organization_id, hq);
      toast.success(t('hq.savedTitle'), t('hq.savedText'));
      router.back();
    } catch (e) {
      toast.error(t('hq.saveError'), (e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [profile?.organization_id, hq, t, router, toast]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <MeshBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          >
            <Feather name="arrow-left" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.title}>{t('hq.title')}</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.subtitle}>{t('hq.subtitle')}</Text>

          {loading ? (
            <ActivityIndicator color={theme.colors.accent} style={{ marginVertical: 24 }} />
          ) : (
            <>
              <Card>
                <Text style={styles.sectionTitle}>{t('hq.sectionMap')}</Text>
                <View style={styles.locWrap}>
                  <Feather name="map-pin" size={16} color={theme.colors.accent} />
                  <View style={{ flex: 1 }}>
                    {hq.lat != null && hq.lng != null ? (
                      <>
                        <Text style={styles.locValue} numberOfLines={2}>
                          {hq.address ?? `${hq.lat.toFixed(5)}, ${hq.lng.toFixed(5)}`}
                        </Text>
                        <Text style={styles.locCoords}>
                          {hq.lat.toFixed(5)}, {hq.lng.toFixed(5)}
                        </Text>
                      </>
                    ) : (
                      <Text style={[styles.locValue, { color: theme.colors.textMuted }]}>
                        {t('hq.notSet')}
                      </Text>
                    )}
                  </View>
                </View>
                <Pressable
                  onPress={() => setPickerOpen(true)}
                  disabled={!isOwner}
                  style={({ pressed }) => [
                    styles.mapBtn,
                    !isOwner && { opacity: 0.45 },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Feather name="map" size={16} color={theme.colors.accent} />
                  <Text style={styles.mapBtnText}>
                    {hq.lat != null ? t('hq.changeOnMap') : t('hq.pickFromMap')}
                  </Text>
                </Pressable>
              </Card>

              <Card>
                <TextField
                  label={t('hq.addressLabel')}
                  icon="briefcase"
                  placeholder={t('hq.addressPlaceholder')}
                  value={hq.address ?? ''}
                  onChangeText={(v) => setHq({ ...hq, address: v })}
                  editable={isOwner}
                />
              </Card>

              {isOwner ? (
                <Button
                  title={t('hq.saveCta')}
                  onPress={onSave}
                  loading={saving}
                  disabled={hq.lat == null || hq.lng == null}
                />
              ) : null}
            </>
          )}
        </ScrollView>

        <MapPicker
          visible={pickerOpen}
          title={t('hq.title')}
          initial={
            hq.lat != null && hq.lng != null
              ? { lat: hq.lat, lng: hq.lng, address: hq.address }
              : null
          }
          onClose={() => setPickerOpen(false)}
          onConfirm={(r) => {
            setHq({ lat: r.lat, lng: r.lng, address: r.address ?? hq.address });
            setPickerOpen(false);
          }}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.semibold,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing['3xl'],
    gap: theme.spacing.lg,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    lineHeight: 20,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
    marginBottom: theme.spacing.sm,
  },
  locWrap: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  locValue: { color: theme.colors.text, fontSize: theme.font.size.sm, fontWeight: '500' },
  locCoords: { color: theme.colors.textDim, fontSize: theme.font.size.xs, marginTop: 2 },
  mapBtn: {
    marginTop: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentMuted,
  },
  mapBtnText: {
    color: theme.colors.accent,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
  },
});
