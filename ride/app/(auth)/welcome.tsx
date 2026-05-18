import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { AuthBackdrop } from '@/components/AuthBackdrop';
import { Button } from '@/components/Button';
import { useAuth } from '@/auth/AuthProvider';
import { colors, spacing } from '@/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { devSignIn } = useAuth();

  // Splash'tan welcome'a geçişte resim instant, butonlar 350ms sonra fade-in.
  const ctaOpacity = useSharedValue(0);
  const ctaTranslateY = useSharedValue(20);

  useEffect(() => {
    ctaOpacity.value = withDelay(
      350,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
    ctaTranslateY.value = withDelay(
      350,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
  }, [ctaOpacity, ctaTranslateY]);

  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaOpacity.value,
    transform: [{ translateY: ctaTranslateY.value }],
  }));

  return (
    <AuthBackdrop>
      <View style={styles.root}>
        <View style={styles.spacer} />
        <Animated.View style={[styles.cta, ctaStyle]}>
          <Button title={t('welcome.cta')} onPress={() => router.push('/(auth)/phone')} />
          {devSignIn ? (
            <Pressable
              accessibilityRole="button"
              onPress={async () => {
                await devSignIn();
              }}
              style={styles.devBtn}
            >
              <Text style={styles.devBtnText}>{t('welcome.devSignIn')}</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      </View>
    </AuthBackdrop>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['2xl'],
    justifyContent: 'flex-end',
  },
  spacer: { flex: 1 },
  cta: { gap: spacing.md },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.4,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  devBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: spacing.xs,
  },
  devBtnText: { color: colors.textDim, fontSize: 12, letterSpacing: 0.5 },
});
