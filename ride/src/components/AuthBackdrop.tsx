import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '@/theme';

const SRC = require('../../assets/drivermesh.webp');

/**
 * Auth ekranlarında (welcome / phone / otp / profile-setup) tam ekran arka plan.
 * Resim contain ile yerleştirilir — kenarlardan kırpılmaz, tam görünür.
 * Arka plan #0A0E1F dolgu; resmin etrafında küçük boşluk kalır.
 */
export function AuthBackdrop({ children }: { children: ReactNode }) {
  return (
    <View style={styles.root}>
      <Image
        source={SRC}
        style={StyleSheet.absoluteFill}
        contentFit="fill"
        cachePolicy="memory-disk"
        priority="high"
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1 },
});
