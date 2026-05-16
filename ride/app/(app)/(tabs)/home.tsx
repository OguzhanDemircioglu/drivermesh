import { useEffect, useMemo, useRef } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { VehicleCard } from '@/components/VehicleCard';
import { ActiveRideView } from '@/components/ActiveRideView';
import { useAuth } from '@/auth/AuthProvider';
import { useActiveRide } from '@/hooks/useActiveRide';
import { usePendingRating } from '@/hooks/usePendingRating';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useNearbyVehicles } from '@/hooks/useNearbyVehicles';
import { colors, radii, spacing } from '@/theme';
import type { SearchVehiclesRow } from '@/lib/db/rides';

function greetingKey(): 'home.greetingMorning' | 'home.greetingAfternoon' | 'home.greetingEvening' {
  const h = new Date().getHours();
  if (h < 12) return 'home.greetingMorning';
  if (h < 18) return 'home.greetingAfternoon';
  return 'home.greetingEvening';
}

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { customer } = useAuth();
  const activeRide = useActiveRide(customer?.id);
  const pending = usePendingRating(customer?.id);
  const geo = useGeolocation();
  const list = useNearbyVehicles(geo.position?.lat, geo.position?.lng);

  const cityLabel = useMemo(() => geo.city ?? '—', [geo.city]);

  // Yolculuk tamamlandığında otomatik rating ekranına yönlendir (tek seferlik).
  const completedFiredFor = useRef<string | null>(null);
  useEffect(() => {
    const r = activeRide.data;
    if (!r) return;
    if (r.status === 'completed' && completedFiredFor.current !== r.id) {
      completedFiredFor.current = r.id;
      router.push({ pathname: '/(app)/ride/rating', params: { rideId: r.id } });
    }
  }, [activeRide.data, router]);

  const hasActive = !!activeRide.data && activeRide.data.status !== 'completed';

  if (hasActive && activeRide.data) {
    return (
      <Screen>
        <View style={styles.activeWrap}>
          <ActiveRideView ride={activeRide.data} customerId={customer!.id} />
        </View>
      </Screen>
    );
  }

  const onCall = (v: SearchVehiclesRow) => {
    router.push({
      pathname: '/(app)/ride/call-modal',
      params: { vehicleId: v.vehicle_id, hqLat: String(v.hq_lat), hqLng: String(v.hq_lng) },
    });
  };

  if (geo.permission === 'denied') {
    return (
      <Screen>
        <View style={styles.permissionWrap}>
          <Feather name="map-pin" size={48} color={colors.textDim} />
          <Text style={styles.permissionTitle}>{t('vehicles.permissionRequired')}</Text>
          <Text style={styles.permissionBody}>{t('vehicles.permissionBody')}</Text>
          <Pressable
            onPress={() => Linking.openSettings()}
            style={({ pressed }) => [styles.permissionBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.permissionBtnText}>{t('vehicles.permissionOpenSettings')}</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (geo.permission === 'undetermined') {
    return (
      <Screen>
        <View style={styles.permissionWrap}>
          <Feather name="map-pin" size={48} color={colors.accent} />
          <Text style={styles.permissionTitle}>{t('vehicles.permissionRequired')}</Text>
          <Text style={styles.permissionBody}>{t('vehicles.permissionBody')}</Text>
          <Pressable
            onPress={() => void geo.requestPermission()}
            style={({ pressed }) => [styles.permissionBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.permissionBtnText}>{t('common.continue')}</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const headerNode = (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.greeting}>
          {t(greetingKey())}
          {customer?.full_name ? `, ${customer.full_name.split(' ')[0]}` : ''} 👋
        </Text>
      </View>
      <View style={styles.cityBadge}>
        <Feather name="map-pin" size={14} color={colors.accent} />
        <Text style={styles.cityText}>{cityLabel}</Text>
      </View>
    </View>
  );

  const pendingNode = pending.data ? (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: '/(app)/ride/rating', params: { rideId: pending.data!.id } })
      }
      style={styles.pendingBanner}
    >
      <View style={styles.pendingIconWrap}>
        <Feather name="star" size={18} color={colors.warning} />
      </View>
      <Text style={styles.pendingText}>{t('home.pendingRating')}</Text>
      <Feather name="chevron-right" size={20} color={colors.warning} />
    </Pressable>
  ) : null;

  const data = list.data ?? [];

  if (list.isLoading) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
          {headerNode}
          {pendingNode}
          <View style={styles.center}>
            <Text style={styles.dim}>...</Text>
          </View>
        </ScrollView>
      </Screen>
    );
  }

  const refreshFab = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('vehicles.refresh')}
      onPress={() => void list.refetch()}
      disabled={list.isRefetching}
      style={({ pressed }) => [
        styles.fab,
        pressed && { opacity: 0.85 },
        list.isRefetching && { opacity: 0.6 },
      ]}
    >
      <Feather
        name="refresh-cw"
        size={26}
        color={colors.bg}
        style={list.isRefetching ? styles.fabSpinning : undefined}
      />
    </Pressable>
  );

  if (data.length === 0) {
    return (
      <Screen>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={list.isRefetching}
              onRefresh={() => void list.refetch()}
              tintColor={colors.accent}
            />
          }
        >
          {headerNode}
          {pendingNode}
          <View style={styles.center}>
            <Feather name="truck" size={48} color={colors.textDim} />
            <Text style={styles.emptyTitle}>{t('vehicles.emptyTitle')}</Text>
            <Text style={styles.emptyBody}>{t('vehicles.emptyBody')}</Text>
          </View>
        </ScrollView>
        {refreshFab}
      </Screen>
    );
  }

  const refreshControl = (
    <RefreshControl
      refreshing={list.isRefetching}
      onRefresh={() => void list.refetch()}
      tintColor={colors.accent}
    />
  );
  const listHeader = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
      {headerNode}
      {pendingNode}
    </View>
  );

  // FlashList web'de blank render — RPC max 50 vehicle olduğu için virtualization
  // gerekli değil; web tarafında ScrollView + map, native'de FlashList.
  return (
    <Screen>
      {Platform.OS === 'web' ? (
        <ScrollView contentContainerStyle={styles.listContent} refreshControl={refreshControl}>
          {listHeader}
          {data.map((item) => (
            <VehicleCard key={item.vehicle_id} vehicle={item} onCall={onCall} />
          ))}
        </ScrollView>
      ) : (
        <FlashList
          data={data}
          keyExtractor={(item) => item.vehicle_id}
          renderItem={({ item }) => <VehicleCard vehicle={item} onCall={onCall} />}
          ListHeaderComponent={listHeader}
          contentContainerStyle={styles.listContent}
          refreshControl={refreshControl}
          estimatedItemSize={278}
        />
      )}
      {refreshFab}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  greeting: { color: colors.text, fontSize: 25, fontWeight: '700' },
  cityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.accentMuted,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  cityText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing['2xl'] },
  activeWrap: { flex: 1, padding: spacing.lg, gap: spacing.md },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.md,
  },
  pendingIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(245,158,11,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingText: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
    minHeight: 240,
  },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '600', marginTop: spacing.sm },
  emptyBody: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  dim: { color: colors.textDim },
  permissionWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  permissionTitle: { color: colors.text, fontSize: 19, fontWeight: '700', marginTop: spacing.sm },
  permissionBody: { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
  permissionBtn: {
    marginTop: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
  },
  permissionBtnText: { color: colors.bg, fontSize: 15, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fabSpinning: { opacity: 0.7 },
});
