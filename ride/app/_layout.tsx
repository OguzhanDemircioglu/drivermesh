import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import { routeForPushPayload } from '@/lib/push';

const DRIVERMESH_BG = require('../assets/drivermesh.webp');

// Image.prefetch JS yüklenince hemen başlatıyoruz ki AuthBackdrop ilk
// render anında cache'ten gelsin.
Image.prefetch(DRIVERMESH_BG).catch(() => {});
import {
  NotoSans_400Regular,
  NotoSans_500Medium,
  NotoSans_600SemiBold,
  NotoSans_700Bold,
} from '@expo-google-fonts/noto-sans';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ForceUpdateModal } from '@/components/ForceUpdateModal';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ToastProvider } from '@/components/Toast';
import { persister, queryClient } from '@/lib/queryClient';
import { initSentry } from '@/lib/sentry';
import { colors } from '@/theme';
import '@/i18n';

// Module load — Sentry init mümkün olan en erken anda. DSN .env'de yoksa
// silent skip (dev). Native crash'ler bile yakalanır bu sayede.
initSentry();

// Native splash JS bridge yüklenmeden gösterilir; aşağıda manuel hideAsync().
SplashScreen.preventAutoHideAsync().catch(() => {});
SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
        <SafeAreaProvider>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000 }}
          >
            <AuthProvider>
              <ToastProvider>
                <AppShell />
              </ToastProvider>
            </AuthProvider>
          </PersistQueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

function AppShell() {
  const { loading } = useAuth();
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    NotoSans_400Regular,
    NotoSans_500Medium,
    NotoSans_600SemiBold,
    NotoSans_700Bold,
  });

  const ready = !loading && fontsLoaded;
  const splashHiddenRef = useRef(false);

  // Push notification tap → deep-link routing.
  // Cold start: getLastNotificationResponseAsync (app kapalıyken gelen tap).
  // Foreground/background: addNotificationResponseReceivedListener.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
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
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [ready, router]);

  // Splash'i Welcome (veya ilk ekran) ilk frame'i çizdikten SONRA gizle.
  // useEffect ile gizlemek erken oluyor — React mount + Stack route push arası
  // siyah ekran flicker'ı yaratıyor. onLayout root view'ın gerçek render anına
  // bağlı, splash → ekran geçişi kesintisiz.
  const onLayout = useCallback(async () => {
    if (ready && !splashHiddenRef.current) {
      splashHiddenRef.current = true;
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  if (!ready) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} onLayout={onLayout}>
      {/* Splash → ilk ekran arası flicker'ı kapatmak için: root'ta drivermesh
          image zaten görünür durumda. Welcome AuthBackdrop'ı bunun üstüne
          aynı image'i render eder, üst-üste hiç boşluk yok. Post-auth
          ekranlar Screen component'i ile bg'yi kapatır. */}
      <Image
        source={DRIVERMESH_BG}
        style={StyleSheet.absoluteFill}
        contentFit="fill"
        cachePolicy="memory-disk"
        priority="high"
      />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <OfflineBanner />
      <ForceUpdateModal />
    </View>
  );
}
