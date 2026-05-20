// GuidedTourOverlay — demo modunda kullanıcıyı sayfa sayfa gezdiren tooltip.
//
// AsyncStorage'da `chatbot.tourActive=true` iken tetiklenir.
// Mevcut route'a göre uygun step'i bulur, alt yarıda bot bubble + CTA gösterir.
// Step'in `waitForRoute` field'ı varsa, kullanıcı oraya gittiğinde otomatik next.

import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/theme';
import { TOUR_STEPS, type TourStep } from '@/chatbot/tour';
import { TOUR_ACTIVE_KEY, TOUR_COMPLETED_KEY } from '@/chatbot/keys';
import { useAuth } from '@/auth/AuthProvider';

const BOT_ICON = require('../../assets/chatbot.png');

export function GuidedTourOverlay() {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [welcomeHintShown, setWelcomeHintShown] = useState(false);
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const { signOut } = useAuth();

  // Bootstrap + route-change polling: AsyncStorage flag her pathname
  // değişiminde yeniden okunur (OnboardingWelcome dismiss → Welcome'a
  // router.replace sonrası tour flag set edilir, bu effect onu yakalar).
  useEffect(() => {
    (async () => {
      try {
        const flag = await AsyncStorage.getItem(TOUR_ACTIVE_KEY);
        setActive(flag === 'true');
      } catch {
        /* ignore */
      }
    })();
  }, [pathname]);

  // Welcome ekranındayken Demo App highlight göster
  const isWelcomeRoute =
    pathname === '/' ||
    pathname === '/welcome' ||
    (segments[0] === '(auth)' && (segments as readonly string[])[1] === 'welcome');

  // Kullanıcı belirli bir route'a gittiğinde waitForRoute step'ini next yap
  useEffect(() => {
    if (!active) return;
    const step = TOUR_STEPS[stepIndex];
    if (step?.waitForRoute && pathnameMatches(pathname, step.waitForRoute)) {
      setStepIndex((i) => Math.min(i + 1, TOUR_STEPS.length - 1));
    }
  }, [active, pathname, stepIndex]);

  const advance = useCallback(async () => {
    const current = TOUR_STEPS[stepIndex];
    if (current?.isFinal) {
      // Tour bitir
      try {
        await AsyncStorage.setItem(TOUR_ACTIVE_KEY, 'false');
        await AsyncStorage.setItem(TOUR_COMPLETED_KEY, 'true');
      } catch {
        /* ignore */
      }
      setActive(false);
      // Demo'dan çık + gerçek auth flow'a dön
      try {
        await signOut();
      } catch {
        /* ignore */
      }
      router.replace('/(auth)/welcome');
      return;
    }
    setStepIndex((i) => Math.min(i + 1, TOUR_STEPS.length - 1));
  }, [router, signOut, stepIndex]);

  const skipTour = useCallback(async () => {
    try {
      await AsyncStorage.setItem(TOUR_ACTIVE_KEY, 'false');
    } catch {
      /* ignore */
    }
    setActive(false);
  }, []);

  // DEBUG: pathname'i ekranda göster
  if (active) {
    // overlay alt köşede mini debug satırı (geçici)
  }

  if (!active) return null;

  // Welcome ekranında özel bir hint card göstermiyoruz — floating robot
  // (welcome.tsx içinde) zaten görünür durumda, çift bot ikon önlenir.
  // Tour overlay sadece (app) grubunda step tooltip'i göstersin.
  const inAuthGroup = segments[0] === '(auth)';
  if (inAuthGroup) return null;

  // Demo akışında: mevcut step'in tooltip'ini göster (sadece route eşleşiyorsa)
  const step = TOUR_STEPS[stepIndex];
  if (!step) return null;
  if (!pathnameMatches(pathname, step.route)) {
    // User farklı rotaya gitti, sessiz bekle — useEffect waitForRoute yakalar
    return null;
  }

  const waitingForTap = !!step.waitForRoute;
  const isLast = !!step.isFinal;

  return (
    <SafeAreaView style={styles.fullScreen} pointerEvents="box-none" edges={['bottom']}>
      <View style={styles.tooltipCard} pointerEvents="auto">
        <View style={styles.tooltipHeader}>
          <Image source={BOT_ICON} style={styles.bubbleAvatar} />
          <Text style={styles.tooltipTitle}>{t(step.titleKey)}</Text>
          <Pressable onPress={skipTour} hitSlop={8} style={styles.closeBtn}>
            <Text style={styles.skipText}>×</Text>
          </Pressable>
        </View>
        <Text style={styles.tooltipBody}>{t(step.bodyKey)}</Text>
        {waitingForTap ? (
          <Text style={styles.tapHint}>{t('chatbot.tour.ctaTapTarget')}</Text>
        ) : (
          <Pressable
            onPress={advance}
            style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.ctaText}>
              {isLast ? t('chatbot.tour.ctaFinish') : t('chatbot.tour.ctaNext')}
            </Text>
          </Pressable>
        )}
        <View style={styles.progressRow}>
          {TOUR_STEPS.map((_, i) => (
            <View
              key={i}
              style={[styles.progressDot, i === stepIndex && styles.progressDotActive]}
            />
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

function pathnameMatches(actual: string, want: string): boolean {
  // Expo Router pathname normalizesi: '/' vs '/(app)/' eşleşmesi için
  // basit "prefix match" — daha sofistike route guard V0.2'de.
  if (want === '/(app)/') return actual === '/' || actual === '/(app)/' || actual === '/(app)';
  return actual.includes(want.replace(/\(.*?\)/g, '').replace(/^\/+/, ''));
}

const styles = StyleSheet.create({
  fullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  tooltipCard: {
    margin: theme.spacing.md,
    marginBottom: 110, // bottom nav üstünde
    padding: theme.spacing.md,
    borderRadius: theme.radius['2xl'],
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    gap: theme.spacing.sm,
  },
  tooltipHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tooltipTitle: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.bold,
  },
  closeBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  bubbleAvatar: { width: 36, height: 36, borderRadius: 18 },
  tooltipBody: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.md,
    lineHeight: 22,
  },
  tapHint: {
    color: theme.colors.accent,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
    fontStyle: 'italic',
    marginTop: 4,
  },
  ctaBtn: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 12,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    marginTop: 4,
  },
  ctaText: {
    color: 'white',
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.textDim,
  },
  progressDotActive: {
    backgroundColor: theme.colors.accent,
    width: 14,
  },
  skipText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.xl,
    fontWeight: '300',
  },

  welcomeHintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: theme.spacing.md,
    marginBottom: 200,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    borderRadius: theme.radius['2xl'],
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  welcomeHintBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  welcomeHintText: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.medium,
    lineHeight: 20,
  },
});
