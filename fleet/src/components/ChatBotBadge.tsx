// ChatBotBadge — Home header'da Bell'in SOLUNDA görünür robot ikonu.
//
// Sadece chatbot.webp resmi — yazı yok, çerçeve yok. Tap → /(app)/chatbot.
// Guided tour son adımda bu badge'i highlight eder (testID="chatbot-badge").

import { Image, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    padding: 2,
  },
  icon: {
    width: 48,
    height: 48,
    backgroundColor: 'transparent',
  },
});
