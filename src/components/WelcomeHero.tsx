import { type ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/theme';
import type { AppLocale } from '@/i18n';

const HERO_TR = require('../../assets/login/loginTR.jpg');
const HERO_EN = require('../../assets/login/loginEN.jpg');

type Props = {
  topRight?: ReactNode;
  bottom?: ReactNode;
};

export function WelcomeHero({ topRight, bottom }: Props) {
  // i18n.language'e bağlı — kullanıcı TR/EN toggle'a bastığında resim de
  // butonlarla birlikte değişir.
  const { i18n } = useTranslation();
  const locale = (i18n.language as AppLocale) ?? 'tr';
  const heroSource = locale === 'en' ? HERO_EN : HERO_TR;

  return (
    <View style={styles.root}>
      <Image
        source={heroSource}
        style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
        resizeMode="cover"
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
    backgroundColor: theme.colors.bg,
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
