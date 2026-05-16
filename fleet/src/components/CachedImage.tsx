import { useEffect, useState } from 'react';
import { Image, type ImageProps, type ImageSourcePropType } from 'react-native';
import { cacheRemoteImage, getCachedDataUri, peekImageCache } from '@/lib/imageCache';

type Props = Omit<ImageProps, 'source'> & {
  /** Remote URL to display + cache. null/undefined renders the fallback. */
  uri: string | null | undefined;
  /** Static `require()` source rendered while the cache is empty and the
   * network round-trip hasn't completed yet (or when uri is missing). */
  fallback?: ImageSourcePropType;
};

/**
 * Image that prefers the AsyncStorage cache over the network.
 *
 * Flow on first paint:
 *   1. Show the remote URL immediately so the user sees something.
 *   2. In parallel, peek the cache.
 *   3. If cached → swap to the cached data URI (zero-flicker, same bytes).
 *   4. If not cached → fetch + persist → swap when ready.
 *
 * On every subsequent launch the cache hit short-circuits the network entirely.
 */
export function CachedImage({ uri, fallback, ...rest }: Props) {
  // Synchronous mem-cache peek lets the second-and-onward render of any
  // already-seen image be instantaneous on the first paint of a new screen.
  // This is what stops the vehicles-list slide animation from being followed
  // by a visible 150–200 ms thumb-decode pop.
  const [source, setSource] = useState<ImageSourcePropType | null>(() => {
    if (!uri) return fallback ?? null;
    const mem = peekImageCache(uri);
    return mem ? { uri: mem } : { uri };
  });

  useEffect(() => {
    if (!uri) {
      setSource(fallback ?? null);
      return;
    }
    if (peekImageCache(uri)) {
      // Already serving the cached bytes from the synchronous initializer —
      // no need to re-read disk or fetch.
      setSource({ uri: peekImageCache(uri)! });
      return;
    }
    let cancelled = false;
    // Optimistic render — show the network URL while we resolve the cache
    // path in the background.
    setSource({ uri });

    (async () => {
      const cached = await getCachedDataUri(uri);
      if (cancelled) return;
      if (cached) {
        setSource({ uri: cached });
        return;
      }
      const fresh = await cacheRemoteImage(uri);
      if (cancelled) return;
      if (fresh) setSource({ uri: fresh });
    })();

    return () => {
      cancelled = true;
    };
    // fallback intentionally not a dep — it's a static asset and including
    // it would re-trigger the cache fetch on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);

  return source ? <Image {...rest} source={source} /> : null;
}
