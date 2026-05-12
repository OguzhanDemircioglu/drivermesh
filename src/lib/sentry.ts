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
// APP_ENV oncelik sirasi:
//   1. process.env.EXPO_PUBLIC_APP_ENV (Metro build-time inline; .env'de
//      EXPO_PUBLIC_APP_ENV=production set edilmeli — degisikten sonra
//      Metro bundle cache invalidate icin source file touch gerekiyor.)
//   2. Constants.expoConfig.extra.appEnv (app.json `extra.appEnv` field —
//      runtime fallback, bazen Hermes bundle'da expoConfig undefined olabilir)
//   3. __DEV__ fallback (Hermes release'de bazen yine true; iki katmanli
//      bypass icin yukaridaki ikiden biri set edilmeli)
const APP_ENV =
  process.env.EXPO_PUBLIC_APP_ENV ??
  (Constants.expoConfig?.extra?.appEnv as string | undefined) ??
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
    // Performans trace: production'da %5 (free plan 10K transactions/month
    // limitini ~600 daily active user'a kadar tasir). Dev'de %100.
    tracesSampleRate: __DEV__ ? 1.0 : 0.05,
    // Replay (UI session recording) — sadece error oldugunda, %50.
    // Free plan 50 replay/month; %50 sample rate ~100 crash/month'a kadar
    // tasir. Crash rate dusukse %100'e cikarilabilir.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: __DEV__ ? 0 : 0.5,
    enableNativeCrashHandling: true,
    enableNativeNagger: false, // dev'de annoying Sentry uyarisi kapat
    debug: __DEV__,
    release: `drivermesh@${APP_VERSION}`,
    environment: APP_ENV,
    // KVKK PII minimization — Sentry default'unu kapat. Biz setSentryUser
    // ile id+email manuel set ediyoruz (privacy policy'de belirtildi);
    // ekstra IP / user-agent / device-fingerprint toplama yok.
    sendDefaultPii: false,
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
