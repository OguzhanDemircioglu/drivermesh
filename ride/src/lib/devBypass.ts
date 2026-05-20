// Dev bypass switch — auth OTP atlama, Galata mock konum, devSignIn.
//
// Default: `__DEV__` true ise açık (mevcut geliştirme akışı korunur).
// Production build'de `__DEV__` false, bu fonksiyon her zaman false döner.
//
// V1 release prep / "prod gibi davran" testleri için dev makinesinde
// EXPO_PUBLIC_DEV_BYPASS=off ile manuel kapatılabilir. Çift katmanlı koruma:
// Hermes release'de `__DEV__` bazen yanlış kalsa bile env explicit off ise
// bypass devre dışı.

export function isDevBypassEnabled(): boolean {
  if (!__DEV__) return false;
  const v = process.env.EXPO_PUBLIC_DEV_BYPASS;
  if (v === 'off' || v === 'false' || v === '0') return false;
  return true;
}
