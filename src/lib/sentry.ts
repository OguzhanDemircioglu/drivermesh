/**
 * Sentry crash reporting + performance monitoring.
 *
 * DSN: EXPO_PUBLIC_SENTRY_DSN (.env'de). DSN yoksa Sentry init'i skip
 * (development veya konfigure edilmemis ortam).
 *
 * Demo modda da Sentry init eder ama errorlari "demo:true" tag'i ile gonderir
 * (gerek prod kullanicilarinin kendi crash'leriyle karismasin).
 */
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const DSN =
  process.env.EXPO_PUBLIC_SENTRY_DSN ??
  (Constants.expoConfig?.extra?.sentryDsn as string | undefined);

const APP_VERSION = (Constants.expoConfig?.version as string | undefined) ?? '1.0.0';
const APP_ENV =
  process.env.EXPO_PUBLIC_APP_ENV ??
  (__DEV__ ? 'development' : 'production');

let _initialized = false;

export function initSentry(): void {
  if (_initialized) return;
  if (!DSN) {
    // Dev/CI'de DSN olmayabilir — silent skip
    return;
  }
  Sentry.init({
    dsn: DSN,
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30_000,
    // Performans: production'da %20, dev'de %100
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    // Replay (UI session recording) — tum kullanicilar icin pahali, %10
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: __DEV__ ? 0 : 1.0,
    enableNativeCrashHandling: true,
    enableNativeNagger: false, // dev'de annoying Sentry uyarisi kapat
    debug: __DEV__,
    release: `drivermesh@${APP_VERSION}`,
    environment: APP_ENV,
    beforeSend(event) {
      // Demo modda gonderilen event'leri tag'le
      try {
        const isDemo = (globalThis as { __DM_DEMO__?: boolean }).__DM_DEMO__;
        if (isDemo) {
          event.tags = { ...(event.tags ?? {}), demo: 'true' };
        }
      } catch {}
      return event;
    },
  });
  _initialized = true;
}

export function setSentryUser(userId: string | null, email?: string | null): void {
  if (!_initialized) return;
  if (userId) {
    Sentry.setUser({ id: userId, email: email ?? undefined });
  } else {
    Sentry.setUser(null);
  }
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!_initialized) {
    console.warn('[sentry] not initialized:', err);
    return;
  }
  Sentry.captureException(err, context ? { extra: context } : undefined);
}

export { Sentry };
