import { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, Text, TextInput, View } from 'react-native';
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
import { WelcomeHero } from '@/components/WelcomeHero';
import { setupI18n } from '@/i18n';
import { theme } from '@/theme';

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

const MIN_SPLASH_MS = 800;

function AuthGate() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [minElapsed, setMinElapsed] = useState(false);
  const splashHiddenRef = useRef(false);

  // Min süre timer — WelcomeHero overlay'in kullanıcıya gözükecek garanti süresi.
  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  // Auth resolve olur olmaz doğru route'a yönlendir.
  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (session && inAuthGroup) {
      router.replace('/(app)');
    }
  }, [session, loading, segments, router]);

  // Splash hide'ı View ekrana yerleştikten sonra tetikle. Bu sayede native
  // splash kapanırken ekranda zaten React frame (WelcomeHero) hazır olur,
  // geçişte siyah frame yaşanmaz.
  const handleRootLayout = () => {
    if (splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    SplashScreen.hideAsync().catch(() => {});
  };

  const showSplash = loading || !minElapsed;

  return (
    <View style={styles.root} onLayout={handleRootLayout}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
          animation: 'none',
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
  // Noto Sans (Google Fonts, ücretsiz, OFL). 4 weight yüklü; RN fontWeight
  // prop'u native synthesis ile bold/medium varyantları seçer ama biz default
  // olarak 'NotoSans' family adını set ettik → sistem regular'i kullanır,
  // explicit weight set edenler kendi map'ini bizden alır.
  const [fontsLoaded] = useFonts({
    NotoSans: NotoSans_400Regular,
    NotoSans_500Medium,
    NotoSans_600SemiBold,
    NotoSans_700Bold,
  });

  useEffect(() => {
    setupI18n().catch((e) => console.warn('[i18n] init failed', e));
  }, []);

  if (!fontsLoaded) {
    // Font yüklenene kadar render etme — yoksa Verdana fallback ile flash olur.
    return (
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <View style={StyleSheet.absoluteFill}>
            <WelcomeHero />
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ToastProvider>
          <ConfirmProvider>
            <AuthProvider>
              <AuthGate />
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
