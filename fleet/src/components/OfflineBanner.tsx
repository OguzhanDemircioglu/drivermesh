import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useOnline } from '@/hooks/useOnline';
import { theme } from '@/theme';

/**
 * Sticky offline banner. Slides down from the top when network is unreachable;
 * slides back up when reconnected. Renders above all other content via a
 * fixed-position absolute layer.
 *
 * Render this once inside the (app) layout so it covers every screen, but not
 * the auth flow (login/register don't need it — pre-session anyway).
 */
export function OfflineBanner() {
  const online = useOnline();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (online) {
      translateY.value = withTiming(-100, { duration: 250, easing: Easing.in(Easing.cubic) });
      opacity.value = withTiming(0, { duration: 200 });
    } else {
      translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
      opacity.value = withTiming(1, { duration: 250 });
    }
  }, [online, translateY, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents={online ? 'none' : 'auto'}
      style={[styles.root, { paddingTop: insets.top + 6 }, animStyle]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.pill}>
        <Feather name="wifi-off" size={14} color={theme.colors.bg} />
        <Text style={styles.text}>{t('offline.banner', { defaultValue: 'Çevrimdışı — bağlantı geri gelince eşzamanlanır' })}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.warning ?? '#F59E0B',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  text: {
    color: theme.colors.bg,
    fontSize: 13,
    fontWeight: '600',
  },
});
