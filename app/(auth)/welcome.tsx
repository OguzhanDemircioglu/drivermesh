import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { WelcomeHero } from '@/components/WelcomeHero';
import { theme } from '@/theme';
import { setAppLocale, getAppLocale, type AppLocale } from '@/i18n';

export default function WelcomeScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();

  const toggleLocale = () => {
    const next: AppLocale = getAppLocale() === 'tr' ? 'en' : 'tr';
    setAppLocale(next);
  };

  const currentLocale = (i18n.language as AppLocale) ?? 'tr';

  return (
    <WelcomeHero
      topRight={
        <Pressable
          onPress={toggleLocale}
          hitSlop={10}
          style={({ pressed }) => [styles.langPill, pressed && { opacity: 0.7 }]}
        >
          <Text
            style={[styles.langText, currentLocale === 'tr' && styles.langTextActive]}
          >
            TR
          </Text>
          <View style={styles.langDot} />
          <Text
            style={[styles.langText, currentLocale === 'en' && styles.langTextActive]}
          >
            EN
          </Text>
        </Pressable>
      }
      bottom={
        <View style={styles.ctaWrap}>
          <Button
            title={t('auth.welcome.signIn')}
            onPress={() => router.push('/(auth)/login')}
          />
          <Button
            title={t('auth.welcome.startFleet')}
            variant="secondary"
            onPress={() => router.push('/(auth)/register')}
          />
          <Pressable
            onPress={() => router.push('/(auth)/redeem')}
            hitSlop={10}
            style={({ pressed }) => [styles.inviteRow, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.inviteLink}>{t('auth.welcome.hasInvite')}</Text>
          </Pressable>
          <Text style={styles.footnote}>{t('auth.welcome.footnote')}</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(19,24,41,0.55)',
  },
  langText: {
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
    color: theme.colors.textDim,
    letterSpacing: 1.2,
  },
  langTextActive: {
    color: theme.colors.text,
  },
  langDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.textDim,
  },
  ctaWrap: {
    gap: theme.spacing.md,
  },
  inviteRow: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  inviteLink: {
    color: theme.colors.lavender,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
    letterSpacing: 0.2,
  },
  footnote: {
    color: theme.colors.textDim,
    fontSize: theme.font.size.xs,
    textAlign: 'center',
    letterSpacing: 1,
    marginTop: theme.spacing.sm,
  },
});
