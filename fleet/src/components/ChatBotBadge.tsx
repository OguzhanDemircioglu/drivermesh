// ChatBotBadge — Home header'da Bell'in SOLUNDA görünür pill.
//
// İkon + "AI Asistan" yazısı. Tap → /(app)/chatbot.
// Guided tour son adımda bu badge'i highlight eder (testID="chatbot-badge").

import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { theme } from '@/theme';

const BOT_ICON = require('../../assets/chatbot.webp');

export function ChatBotBadge() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <Pressable
      testID="chatbot-badge"
      hitSlop={8}
      onPress={() => router.push('/(app)/chatbot')}
      style={({ pressed }) => [styles.badge, pressed && { opacity: 0.75 }]}
    >
      <View style={styles.iconWrap}>
        <Image source={BOT_ICON} style={styles.icon} resizeMode="cover" />
      </View>
      <Text style={styles.label}>{t('chatbot.badge')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(255,122,26,0.32)',
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: theme.colors.bg,
  },
  icon: {
    width: 28,
    height: 28,
  },
  label: {
    color: theme.colors.accent,
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
    letterSpacing: 0.2,
  },
});
