import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useFonts } from 'expo-font';

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
import { colors } from '@/theme';
import '@/i18n';

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
  const [fontsLoaded] = useFonts({
    NotoSans_400Regular,
    NotoSans_500Medium,
    NotoSans_600SemiBold,
    NotoSans_700Bold,
  });

  const ready = !loading && fontsLoaded;
  const splashHiddenRef = useRef(false);

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
