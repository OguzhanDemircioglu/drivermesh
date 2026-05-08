/**
 * Tiny remote-image cache backed by AsyncStorage.
 *
 * Strategy: when the UI receives a remote URL we fetch it once, encode the
 * blob as a data URI, and stash it under `imgcache:v1:<url>`. On the next
 * render the same URL resolves from local storage instantly — no network
 * round-trip. Generic `cacheable(url)` and `cachedRead(url)` helpers let
 * the rest of the app reuse this for any other media (avatars, signed
 * documents, etc.) without coupling to images specifically.
 *
 * Why AsyncStorage and not the file system: expo-file-system would be a
 * cleaner long-term home (no string size ceiling, native binary blobs)
 * but it's a new dep + native rebuild. AsyncStorage gives us the same
 * "cache wins over network" behaviour for tens of small assets without
 * leaving JS land. Swap it for `expo-file-system` later — only the two
 * functions below need to change.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'imgcache:v1:';

// Process-lifetime memory cache. AsyncStorage hits cost ~50–150 ms each on
// Android (read + base64 decode), which is enough to push a list-screen first
// paint past the 250 ms slide-animation budget and make the screen visibly
// reflow after the transition finishes. Mirroring the disk hit in memory
// makes every subsequent CachedImage render in this app session synchronous.
const memCache = new Map<string, string>();

/** Synchronous peek into the memory cache. CachedImage uses this to render
 * the cached bytes on the first paint — no async dance, no flicker. */
export function peekImageCache(url: string | null | undefined): string | null {
  if (!url) return null;
  return memCache.get(url) ?? null;
}

/** Read the cached data URI for a remote URL, or null if not cached. */
export async function getCachedDataUri(url: string): Promise<string | null> {
  if (!url) return null;
  const mem = memCache.get(url);
  if (mem) return mem;
  try {
    const disk = await AsyncStorage.getItem(PREFIX + url);
    if (disk) memCache.set(url, disk);
    return disk ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch the remote URL, encode it as a data URI, persist it, and return
 * the data URI. Returns null on network failure — caller falls back to
 * the live URL in that case so the user still sees something.
 */
export async function cacheRemoteImage(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUri = reader.result;
        if (typeof dataUri !== 'string') {
          resolve(null);
          return;
        }
        memCache.set(url, dataUri);
        // Fire-and-forget persist — the value is what we return regardless
        // of whether AsyncStorage actually finishes writing it.
        AsyncStorage.setItem(PREFIX + url, dataUri).catch(() => {});
        resolve(dataUri);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Clear every entry in this cache namespace (no-op on failure). */
export async function clearImageCache(): Promise<void> {
  memCache.clear();
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(PREFIX));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch {
    // ignore
  }
}

/** How many entries the cache currently holds (for diagnostics / debug UI). */
export async function imageCacheSize(): Promise<number> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    return keys.filter((k) => k.startsWith(PREFIX)).length;
  } catch {
    return 0;
  }
}
