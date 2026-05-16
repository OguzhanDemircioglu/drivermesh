import { useEffect, useRef, useState } from 'react';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, Image, StyleSheet, Text, TextInput, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  NotoSans_400Regular,
  NotoSans_500Medium,
  NotoSans_600SemiBold,
  NotoSans_700Bold,
} from '@expo-google-fonts/noto-sans';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { ConfirmProvider } from '@/components/ConfirmDialog';
import { ToastProvider } from '@/components/Toast';
import { ForceUpdateModal } from '@/components/ForceUpdateModal';
import { setupI18n } from '@/i18n';
import { initSentry } from '@/lib/sentry';
import { checkAppVersion, type VersionCheckResult } from '@/lib/forceUpdate';
import { routeForPushPayload } from '@/lib/pushNotifications';
import { theme } from '@/theme';

// Native splash → JS bridge → ilk auth ekranı geçişini "kesintisiz" yapmak için
// aynı görseli JS Root'unda da arka planda render ediyoruz (ride pattern).
// AuthGate'in Stack'i bu image'in üzerine transparent contentStyle ile binebilir,
// böylece welcome/login arası flicker olmaz. Welcome ekranındaki WelcomeHero
// dil-bazlı override eder (TR/EN); diğer auth ekranlarında JS root bg fallback.
const DRIVERMESH_BG = require('../assets/drivermesh-splash.png');

// Module load — Sentry init mumkun olan en erken anda. DSN .env'de yoksa
// silent skip (dev). Native crashlar bile yakalanir bu sekilde.
initSentry();

SplashScreen.preventAutoHideAsync().catch(() => {});

// Tüm Text/TextInput'a default fontFamily — yüzlerce style block'una tek tek
// fontFamily eklemek yerine RN'nin defaultProps mekanizması.
// (RN 0.79'da hâlâ destekleniyor, sadece dev warning verebilir.)
type WithDefaultProps = { defaultProps?: { style?: unknown } };
const setDefaultFont = (Cmp: WithDefaultProps) => {
  if (!Cmp.defaultProps) Cmp.defaultProps = {};
  Cmp.defaultProps.style = [{ fontFamily: theme.font.family }, Cmp.defaultProps.style];
};
setDefaultFont(Text as unknown as WithDefaultProps);
setDefaultFont(TextInput as unknown as WithDefaultProps);

function AuthGate() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Push notification tap → deep-link routing. expo-notifications dinamik
  // import (modül yoksa no-op). Cold-start: getLastNotificationResponseAsync;
  // foreground/background: addNotificationResponseReceivedListener.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    import('expo-notifications')
      .then((Notifications) => {
        Notifications.getLastNotificationResponseAsync()
          .then((resp) => {
            if (cancelled || !resp) return;
            const route = routeForPushPayload(
              resp.notification.request.content.data as Record<string, unknown> | undefined,
            );
            router.replace(route as never);
          })
          .catch(() => {});
        const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
          const route = routeForPushPayload(
            resp.notification.request.content.data as Record<string, unknown> | undefined,
          );
          router.push(route as never);
        });
        cleanup = () => sub.remove();
      })
      .catch(() => {
        // expo-notifications native modul yok (dev build) — sessiz skip
      });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [session, router]);
  // Root navigator'ın mount tamamlanıp tamamlanmadığının tek güvenilir
  // sinyali. Fresh start + pm clear sonrası auth state useEffect'i navigator
  // mount'undan önce tetiklenebilir; key set olmadan replace çağırırsak
  // "Attempted to navigate before mounting the Root Layout" assert'i yer.
  const rootNavReady = !!useRootNavigationState()?.key;
  const splashHiddenRef = useRef(false);

  // Auth resolve olur olmaz doğru route'a yönlendir. Navigator mount tam
  // bitmeden tetiklenirse Expo Router içeride assert atar — try/catch
  // sessizce yutar, useEffect bir sonraki render'da rootNavReady true
  // olduğunda tekrar denenecektir.
  useEffect(() => {
    if (loading) return;
    if (!rootNavReady) return;
    const inAuthGroup = segments[0] === '(auth)';
    try {
      if (!session && !inAuthGroup) {
        router.replace('/(auth)/welcome');
      } else if (session && inAuthGroup) {
        router.replace('/(app)');
      }
    } catch {
      /* navigator not ready yet — retry on next state update */
    }
  }, [session, loading, rootNavReady, segments, router]);

  // Splash hide'ı View ekrana yerleştikten sonra tetikle. Bu sayede native
  // splash kapanırken ekranda zaten JS Root bg image hazır olur, geçişte
  // siyah frame yaşanmaz (ride pattern: aynı görsel native + JS).
  const handleRootLayout = () => {
    if (splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    SplashScreen.hideAsync().catch(() => {});
  };

  return (
    <View style={styles.root} onLayout={handleRootLayout}>
      {/* Tam ekran bg image — native splash ile birebir aynı görsel.
          Stack contentStyle transparent olduğu için Welcome/Login/Register
          ekranları bu image üzerine biner; WelcomeHero kendi dil-bazlı
          imajı ile bunu override eder. Boş frame/flicker yok. */}
      <Image
        source={DRIVERMESH_BG}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          animation: 'none',
          statusBarTranslucent: true,
        }}
      />
    </View>
  );
}

export default function RootLayout() {
  // Noto Sans (Google Fonts, OFL). Yüklenirken UI'i bloklamıyoruz — system
  // sans fallback ile başla, font hazır olunca otomatik swap. Bu önceki
  // davranışta `if (!fontsLoaded) return <splash>` ile harcanan süreyi geri
  // kazandırır (~200-500ms).
  useFonts({
    NotoSans: NotoSans_400Regular,
    NotoSans_500Medium,
    NotoSans_600SemiBold,
    NotoSans_700Bold,
  });

  useEffect(() => {
    setupI18n().catch((e) => console.warn('[i18n] init failed', e));
  }, []);

  // Force update version check — cold start + foreground transition.
  // demo modda no-op (lib guard).
  const [versionCheck, setVersionCheck] = useState<VersionCheckResult | null>(null);
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const r = await checkAppVersion();
      if (!cancelled) setVersionCheck(r);
    };
    run();
    // AppState listener: app foreground'a geri donerken tekrar check
    // (kullanici 1 hafta uyutmus olabilir, bu sirada force_update flag
    // backend tarafindan set edilmis olabilir).
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') run();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ToastProvider>
          <ConfirmProvider>
            <AuthProvider>
              <AuthGate />
              <ForceUpdateModal
                result={versionCheck}
                onDismiss={() => setVersionCheck(null)}
              />
            </AuthProvider>
          </ConfirmProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
});
