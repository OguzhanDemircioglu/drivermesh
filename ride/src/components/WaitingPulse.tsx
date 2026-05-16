import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { colors } from '@/theme';

/**
 * Bekleme görseli — pulse animation (3 katmanlı ring).
 * Active ride başlamadığı sürece dönmeye devam eder.
 */
export function WaitingPulse() {
  const a = useSharedValue(0);
  const b = useSharedValue(0);
  const c = useSharedValue(0);

  useEffect(() => {
    a.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }), -1);
    setTimeout(() => {
      b.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }), -1);
    }, 500);
    setTimeout(() => {
      c.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }), -1);
    }, 1000);
    return () => {
      cancelAnimation(a);
      cancelAnimation(b);
      cancelAnimation(c);
    };
  }, [a, b, c]);

  const ringA = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + a.value * 1.5 }],
    opacity: 1 - a.value,
  }));
  const ringB = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + b.value * 1.5 }],
    opacity: 1 - b.value,
  }));
  const ringC = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + c.value * 1.5 }],
    opacity: 1 - c.value,
  }));

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={[styles.ring, ringA]} />
      <Animated.View style={[styles.ring, ringB]} />
      <Animated.View style={[styles.ring, ringC]} />
      <View style={styles.core} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  ring: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent,
    opacity: 0.4,
  },
  core: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    borderWidth: 3,
    borderColor: colors.bg,
  },
});
