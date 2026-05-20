import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

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
  return (
    <View style={[{ width: size, height: size, borderRadius: radius }, styles.wrap, style]}>
      <LinearGradient
        colors={['#5B7FFF', '#B89AF0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      {uri ? (
        // expo-image: filesystem cache + decode native + transition.
        // http(s), file://, data: URI hepsi destekli — eski isRemote dallanmasına
        // gerek yok.
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
        />
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
