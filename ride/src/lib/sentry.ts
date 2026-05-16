/**
 * Sentry crash reporting for the customer (ride) app.
 *
 * DSN env: `EXPO_PUBLIC_SENTRY_DSN_RIDE` (.env). DSN yoksa silent skip
 * (dev/CI). Event'ler `app: 'ride'` tag'i ile gönderilir — Sentry'de
 * fleet ↔ ride filtrelemesi tag üzerinden.
 *
 * Native modülü release/preview build'de Sentry/sentry.gradle aracılığıyla
 * gelir; @sentry/react-native package eklenmeden init no-op kalır.
 */
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

const DSN =
  process.env.EXPO_PUBLIC_SENTRY_DSN_RIDE ??
  (Constants.expoConfig?.extra?.sentryDsn as string | undefined);

const APP_VERSION = (Constants.expoConfig?.version as string | undefined) ?? '0.1.0';
const APP_ENV =
  process.env.EXPO_PUBLIC_APP_ENV ??
  (Constants.expoConfig?.extra?.appEnv as string | undefined) ??
  (__DEV__ ? 'development' : 'production');

let _initialized = false;

export function initSentry(): void {
  if (_initialized) return;
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30_000,
    tracesSampleRate: __DEV__ ? 1.0 : 0.05,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: __DEV__
      ? 0
      : ((Device.totalMemory ?? 0) > 3 * 1024 * 1024 * 1024 ? 0.5 : 0),
    enableNativeCrashHandling: true,
    enableNativeNagger: false,
    debug: __DEV__,
    release: `drivermeshride@${APP_VERSION}`,
    environment: APP_ENV,
    sendDefaultPii: false,
    beforeSend(event) {
      event.tags = { ...(event.tags ?? {}), app: 'ride' };
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
