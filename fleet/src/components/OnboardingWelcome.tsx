// OnboardingWelcome — İlk açılış modal'ı.
//
// AsyncStorage'da `chatbot.firstLaunch` flag yoksa açılır.
// "Hadi başlayalım" → tourActive=true set + Welcome ekranına yönlendir
// (kullanıcı sign-in değilse) veya direkt demo'yu başlat.

import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { theme } from '@/theme';

const BOT_ICON = require('../../assets/chatbot.webp');
const FIRST_LAUNCH_KEY = 'chatbot.firstLaunch';
export const TOUR_ACTIVE_KEY = 'chatbot.tourActive';

export function OnboardingWelcome() {
  const [visible, setVisible] = useState(false);
  const { t } = useTranslation();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
        if (!seen) {
          // İlk açılışta hemen göster
          setVisible(true);
        }
      } catch {
        /* swallow — first launch detection best-effort */
      }
    })();
  }, []);

  const dismiss = async (startTour: boolean) => {
    try {
      await AsyncStorage.setItem(FIRST_LAUNCH_KEY, 'seen');
      if (startTour) {
        await AsyncStorage.setItem(TOUR_ACTIVE_KEY, 'true');
      }
    } catch {
      /* ignore */
    }
    setVisible(false);
    if (startTour) {
      // Welcome ekranına yönlendir — orada Demo App butonunu highlight edeceğiz
      router.replace('/(auth)/welcome');
    }
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Image source={BOT_ICON} style={styles.avatar} />
          <Text style={styles.title}>{t('chatbot.onboarding.title')}</Text>
          <Text style={styles.body}>{t('chatbot.onboarding.body')}</Text>

          <View style={styles.buttons}>
            <Pressable
              onPress={() => dismiss(true)}
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.primaryBtnText}>{t('chatbot.onboarding.ctaStart')}</Text>
            </Pressable>
            <Pressable
              onPress={() => dismiss(false)}
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.75 }]}
            >
              <Text style={styles.secondaryBtnText}>{t('chatbot.onboarding.ctaLater')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius['2xl'],
    padding: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 4 },
  title: {
    color: theme.colors.text,
    fontSize: theme.font.size['2xl'],
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  body: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.md,
    lineHeight: 22,
    textAlign: 'center',
  },
  buttons: { width: '100%', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  primaryBtn: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 14,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: 'white',
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
  },
  secondaryBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.medium,
  },
});
