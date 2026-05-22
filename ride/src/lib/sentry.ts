/**
 * Sentry stub — ride app'inde Sentry kasten devre dışı. Fleet'te kalır,
 * ride'da hiç olmayacak. Bu modül public API'yi koruyup tüm çağrıları
 * no-op yapar; tüketici kod (app/_layout.tsx initSentry, vehicle services
 * captureException vb.) değişmeden çalışır.
 *
 * Geri açmak için: package.json'a `@sentry/react-native` ekle, app.config.js
 * plugin'ini geri koy, metro.config.js'i `getSentryExpoConfig` ile sar ve
 * bu dosyayı eski Sentry.init implementasyonuna döndür.
 */

export function initSentry(): void {
  // no-op
}

export function setSentryUser(_userId: string | null, _email?: string | null): void {
  // no-op
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (__DEV__) {
    // Dev'de en azından console'a düşür ki debug'lanabilsin.
    // eslint-disable-next-line no-console
    console.warn('[sentry-stub] captureException:', err, context);
  }
}

// `Sentry` re-export'u eski tüketiciler için boş stub; çağrılırsa silent.
export const Sentry = {
  captureException: (..._args: unknown[]) => {},
  captureMessage: (..._args: unknown[]) => {},
  setUser: (..._args: unknown[]) => {},
  setTag: (..._args: unknown[]) => {},
  setContext: (..._args: unknown[]) => {},
  addBreadcrumb: (..._args: unknown[]) => {},
  init: (..._args: unknown[]) => {},
  wrap: <T>(component: T): T => component,
};
