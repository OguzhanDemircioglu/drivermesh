import { Image, type ImageProps, type ImageSource } from 'expo-image';

/**
 * Backward-compat shim. Eski custom AsyncStorage-based cache + fallback +
 * data-URI swap logic V0.3'te `expo-image` ile değiştirildi: filesystem cache
 * (eviction policy native), decode native, transition built-in, prefetch API.
 *
 * Eski call site'ları kırmamak için aynı prop shape'ini koruyoruz (`uri` +
 * `fallback`); internally expo-image'in `source`/`placeholder`/`cachePolicy`
 * 'memory-disk' kullanılır.
 */
type Props = Omit<ImageProps, 'source' | 'placeholder'> & {
  uri: string | null | undefined;
  /** Static `require()` source rendered while the remote URL hasn't loaded. */
  fallback?: ImageSource | number;
};

export function CachedImage({ uri, fallback, ...rest }: Props) {
  if (!uri && !fallback) return null;
  return (
    <Image
      {...rest}
      source={uri ? { uri } : (fallback as ImageSource)}
      placeholder={uri && fallback ? (fallback as ImageSource) : undefined}
      cachePolicy="memory-disk"
      transition={150}
    />
  );
}
