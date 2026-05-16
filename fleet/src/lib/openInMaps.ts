import { Linking, Platform } from 'react-native';

/**
 * Open the device's native maps app at the given coordinate. iOS opens
 * Apple Maps, Android opens Google Maps (or whatever the user has set as
 * the geo: handler). Web fallback uses Google Maps in the browser.
 */
export function openInMaps(
  lat: number | null | undefined,
  lng: number | null | undefined,
  label?: string | null,
): void {
  if (lat == null || lng == null) return;
  const q = label ? encodeURIComponent(label) : `${lat},${lng}`;
  const url = Platform.select({
    ios: `maps://?q=${q}&ll=${lat},${lng}`,
    android: `geo:${lat},${lng}?q=${lat},${lng}(${q})`,
    default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
  });
  if (!url) return;
  Linking.openURL(url).catch(() => {
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    ).catch(() => {});
  });
}
