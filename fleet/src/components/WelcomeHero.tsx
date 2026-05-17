import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/theme';
import type { AppLocale } from '@/i18n';

// expo-image RN Image'ten daha güvenilir — dev mode'da require resolve cache
// sorunu yok, WebP/PNG seamless, contentFit native. Ride pattern (AuthBackdrop).
const HERO_TR = require('../../assets/login/loginTR.png');
const HERO_EN = require('../../assets/login/loginEN.png');

type Props = {
  topRight?: ReactNode;
  bottom?: ReactNode;
};

export function WelcomeHero({ topRight, bottom }: Props) {
  const { i18n } = useTranslation();
  const locale = (i18n.language as AppLocale) ?? 'tr';
  const heroSource = locale === 'en' ? HERO_EN : HERO_TR;

  return (
    <View style={styles.root}>
      <Image
        source={heroSource}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        priority="high"
      />
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
