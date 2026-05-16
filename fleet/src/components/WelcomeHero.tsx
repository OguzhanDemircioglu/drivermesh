import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/theme';

type Props = {
  topRight?: ReactNode;
  bottom?: ReactNode;
};

// Welcome layout — bg image RootLayout'tan geliyor (drivermesh-splash.webp).
// Bu component sadece SafeArea + topRight + bottom slot iskeleti sağlar.
// Eski dil-bazlı loginTR/EN.jpg dependency'si kaldırıldı: artık tek splash
// görseli native splash → welcome → login arası kesintisiz görünür.
export function WelcomeHero({ topRight, bottom }: Props) {
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>{topRight}</View>
        <View style={styles.flexFill} />
        <View style={styles.bottomSlot}>{bottom}</View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  safe: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: theme.spacing.sm,
    minHeight: 40,
  },
  flexFill: {
    flex: 1,
  },
  bottomSlot: {
    paddingBottom: theme.spacing.sm,
  },
});
