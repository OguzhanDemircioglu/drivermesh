import { useEffect, useRef, useState } from 'react';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { WelcomeHero } from '@/components/WelcomeHero';
import { setupI18n } from '@/i18n';
import { initSentry } from '@/lib/sentry';
import { checkAppVersion, type VersionCheckResult } from '@/lib/forceUpdate';
import { theme } from '@/theme';

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
  // splash kapanırken ekranda zaten React frame (WelcomeHero) hazır olur,
  // geçişte siyah frame yaşanmaz.
  const handleRootLayout = () => {
    if (splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    SplashScreen.hideAsync().catch(() => {});
  };

  // Min splash süresi yok — auth resolve eder etmez routing devreye girer.
  // Native splash + JS overlay görsel olarak birebir aynı resmi gösterdiği
  // için flicker yaşanmaz.
  const showSplash = loading;

  return (
    <View style={styles.root} onLayout={handleRootLayout}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
          animation: 'none',
          statusBarTranslucent: true,
        }}
      />
      {showSplash ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <WelcomeHero />
        </View>
      ) : null}
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
