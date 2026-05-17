// ChatBotBadge — Home header'da Bell'in SOLUNDA görünür robot ikonu.
//
// Robot resmi + altında küçük "AI" yazısı. Tap → /(app)/chatbot.
// Guided tour son adımda bu badge'i highlight eder (testID="chatbot-badge").

import { Image, Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/theme';

const BOT_ICON = require('../../assets/chatbot.webp');

export function ChatBotBadge() {
  const router = useRouter();

  return (
    <Pressable
      testID="chatbot-badge"
      hitSlop={10}
      onPress={() => router.push('/(app)/chatbot')}
      style={({ pressed }) => [styles.badge, pressed && { opacity: 0.7 }]}
    >
      <Image source={BOT_ICON} style={styles.icon} resizeMode="contain" />
      <Text style={styles.label}>AI</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 460, // biraz yukarı (Kişi Ekle'nin sağ üst çaprazı)
    right: -14,
    alignItems: 'center',
    padding: 2,
    zIndex: 10,
    elevation: 10,
  },
  icon: {
    width: 100,
    height: 100,
    backgroundColor: 'transparent',
  },
  label: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: theme.font.weight.bold,
    letterSpacing: 1,
    marginTop: -4,
  },
});
