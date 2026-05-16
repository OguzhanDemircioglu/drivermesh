import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { getRide } from '@/lib/db/rides';
import { colors, radii, spacing } from '@/theme';

export default function TripDetailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ rideId: string }>();
  const query = useQuery({
    queryKey: ['ride', params.rideId],
    queryFn: () => getRide(params.rideId!),
    enabled: !!params.rideId,
  });

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="chevron-left" size={28} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Yolculuk Detayı</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {query.isLoading ? (
          <Text style={styles.dim}>Yükleniyor…</Text>
        ) : !query.data ? (
          <Text style={styles.dim}>Yolculuk bulunamadı</Text>
        ) : (
          <>
            <View style={styles.statusCard}>
              <Feather
                name={query.data.status === 'completed' ? 'check-circle' : 'x-circle'}
                size={20}
                color={query.data.status === 'completed' ? colors.success : colors.danger}
              />
              <Text style={styles.statusText}>{query.data.status}</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.row}>
                <Feather name="map-pin" size={16} color={colors.mesh} />
                <Text style={styles.rowText}>{query.data.pickup_address}</Text>
              </View>
              {query.data.dropoff_address ? (
                <View style={styles.row}>
                  <Feather name="flag" size={16} color={colors.accent} />
                  <Text style={styles.rowText}>{query.data.dropoff_address}</Text>
                </View>
              ) : (
                <View style={styles.row}>
                  <Feather name="flag" size={16} color={colors.textDim} />
                  <Text style={[styles.rowText, { color: colors.textDim }]}>
                    Şoför yolda alındı
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.card}>
              {query.data.distance_km != null ? (
                <View style={styles.row}>
                  <Feather name="map" size={16} color={colors.textMuted} />
                  <Text style={styles.rowText}>{query.data.distance_km} km</Text>
                </View>
              ) : null}
              {query.data.duration_min != null ? (
                <View style={styles.row}>
                  <Feather name="clock" size={16} color={colors.textMuted} />
                  <Text style={styles.rowText}>{query.data.duration_min} dk</Text>
                </View>
              ) : null}
              <View style={styles.row}>
                <Feather name="credit-card" size={16} color={colors.textMuted} />
                <Text style={styles.rowText}>
                  {query.data.payment_method === 'cash' ? 'Kapıda nakit' : query.data.payment_method}
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  title: { color: colors.text, fontSize: 19, fontWeight: '700' },
  scroll: { padding: spacing.lg, gap: spacing.md },
  dim: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: spacing.lg },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  statusText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { color: colors.text, fontSize: 15 },
});
