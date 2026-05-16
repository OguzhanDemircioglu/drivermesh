import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnline } from '@/utils/netinfo';
import { colors, radii } from '@/theme';
import { useTranslation } from 'react-i18next';

/**
 * Internet kesilince sticky banner: "İnternet bağlantın yok".
 * Online'a dönünce 2 sn yeşil "Bağlantı kuruldu" sonra kaybolur.
 */
export function OfflineBanner() {
  const { isOnline } = useOnline();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [showRestored, setShowRestored] = useState(false);
  const wasOfflineRef = useRef(false);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      setShowRestored(false);
      return;
    }
    if (wasOfflineRef.current) {
      setShowRestored(true);
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      const id = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(
          () => {
            setShowRestored(false);
            wasOfflineRef.current = false;
          },
        );
      }, 2000);
      return () => clearTimeout(id);
    }
  }, [isOnline, opacity]);

  if (isOnline && !showRestored) return null;

  return (
    <Animated.View
      style={[
        styles.wrap,
        { top: insets.top, opacity, pointerEvents: 'none' },
        isOnline ? styles.restored : styles.offline,
      ]}
    >
      <Text style={styles.text}>
        {isOnline ? t('errors.networkRestored') : t('errors.network')}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9998,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomLeftRadius: radii.sm,
    borderBottomRightRadius: radii.sm,
  },
  offline: { backgroundColor: colors.dangerMuted, borderBottomWidth: 1, borderBottomColor: colors.danger },
  restored: { backgroundColor: 'rgba(34,197,94,0.18)', borderBottomWidth: 1, borderBottomColor: colors.success },
  text: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
