import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CachedImage } from '@/components/CachedImage';

type Props = {
  name: string;
  size?: number;
  /** Profil resmi URL'i. http(s)://, file://, ya da data: URI. Boş/null ise
   * gradient + harf rozeti gösterilir. http(s) URL'ler `CachedImage` üzerinden
   * offline cache'li, lokal/file/data URI'ler ise direkt `<Image>` ile çizilir
   * (bunları cache'lemenin anlamı yok — cache key'i içeriği kadar büyür). */
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
};

export function Avatar({ name, size = 44, uri, style }: Props) {
  const initials = getInitials(name);
  const radius = size / 2;
  const isRemote = !!uri && /^https?:\/\//i.test(uri);
  return (
    <View style={[{ width: size, height: size, borderRadius: radius }, styles.wrap, style]}>
      <LinearGradient
        colors={['#5B7FFF', '#B89AF0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      {uri ? (
        isRemote ? (
          <CachedImage
            uri={uri}
            style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
            resizeMode="cover"
          />
        ) : (
          <Image
            source={{ uri }}
            style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
            resizeMode="cover"
          />
        )
      ) : (
        <Text style={[styles.text, { fontSize: size * 0.38 }]}>{initials}</Text>
      )}
    </View>
  );
}

function getInitials(name: string) {
  const cleaned = name.trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || cleaned[0].toUpperCase();
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  text: {
    color: '#0A0E1F',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
