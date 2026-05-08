import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { WelcomeHero } from '@/components/WelcomeHero';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/auth/AuthProvider';
import { theme } from '@/theme';
import { setAppLocale, getAppLocale, type AppLocale } from '@/i18n';

export default function WelcomeScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { signInDemo } = useAuth();
  const toast = useToast();
  const [demoLoading, setDemoLoading] = useState(false);

  const toggleLocale = () => {
    const next: AppLocale = getAppLocale() === 'tr' ? 'en' : 'tr';
    setAppLocale(next);
  };

  const onTryDemo = async () => {
    if (demoLoading) return;
    try {
      setDemoLoading(true);
      await signInDemo();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'demo failed';
      toast.error(t('auth.login.errors.loginFailed'), msg);
      setDemoLoading(false);
    }
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
          <Pressable
            onPress={onTryDemo}
            disabled={demoLoading}
            style={({ pressed }) => [
              styles.demoCard,
              pressed && { opacity: 0.85 },
              demoLoading && { opacity: 0.6 },
            ]}
          >
            <LinearGradient
              colors={['rgba(91,127,255,0.22)', 'rgba(168,85,247,0.14)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.demoIconWrap}>
              <Feather name="play-circle" size={22} color={theme.colors.lavender} />
            </View>
            <View style={styles.demoBody}>
              <View style={styles.demoTitleRow}>
                <Text style={styles.demoTitle}>{t('auth.login.tryDemo')}</Text>
                <View style={styles.demoBadge}>
                  <Text style={styles.demoBadgeText}>
                    {t('auth.login.tryDemoBadge')}
                  </Text>
                </View>
              </View>
            </View>
            <Feather name="arrow-right" size={18} color={theme.colors.textMuted} />
          </Pressable>

          <Button
            title={t('auth.welcome.signIn')}
            variant="secondary"
            onPress={() => router.push('/(auth)/login')}
            style={{ backgroundColor: 'rgb(238, 106, 29)', borderColor: 'rgb(238, 106, 29)' }}
          />
          <Button
            title={t('auth.welcome.startFleet')}
            variant="secondary"
            onPress={() => router.push('/(auth)/register')}
            style={{ backgroundColor: 'rgb(140, 30, 200)', borderColor: 'rgb(140, 30, 200)' }}
          />
          <Button
            title={t('auth.welcome.hasInvite')}
            variant="secondary"
            onPress={() => router.push('/(auth)/redeem')}
          />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(19,24,41,0.55)',
  },
  langText: {
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.bold,
    color: theme.colors.textDim,
    letterSpacing: 1.4,
  },
  langTextActive: {
    color: theme.colors.text,
  },
  langDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.textDim,
  },
  ctaWrap: {
    gap: theme.spacing.sm,
  },

  demoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.4)',
    backgroundColor: theme.colors.bgElevated,
    overflow: 'hidden',
  },
  demoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168,85,247,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.32)',
  },
  demoBody: { flex: 1, gap: 2 },
  demoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  demoTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
    letterSpacing: -0.2,
  },
  demoBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(168,85,247,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.36)',
  },
  demoBadgeText: {
    color: theme.colors.lavender,
    fontSize: 9,
    fontWeight: theme.font.weight.bold,
    letterSpacing: 0.6,
  },
  demoSubtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.xs,
    lineHeight: 16,
  },
});
