// ChatBotBadge — Anasayfada absolute positioned robot ikonu.
//
// Robot resmi + sol tarafında "Bana Sor" speech bubble (her demo açılışında
// görünür, × ile kapatılabilir — kapatma sadece bu session için, sonraki
// demo girişinde yine açılır).
//
// Tap robot → /(app)/chatbot.
// Tap × → bubble gizlenir.

import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { theme } from '@/theme';

const BOT_ICON = require('../../assets/chatbot.webp');

export function ChatBotBadge() {
  const router = useRouter();
  // Her mount'ta default true — demo'ya her girişte bubble açılır.
  // Kullanıcı × ile kapatınca bu session için gizlenir, AsyncStorage'a
  // kaydedilmez (bir sonraki demo girişinde yeniden çıksın).
  const [bubbleVisible, setBubbleVisible] = useState(true);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {bubbleVisible ? (
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>Bana Sor</Text>
          <Pressable
            hitSlop={10}
            onPress={() => setBubbleVisible(false)}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
          >
            <Feather name="x" size={14} color={theme.colors.textMuted} />
          </Pressable>
        </View>
      ) : null}
      <Pressable
        testID="chatbot-badge"
        hitSlop={10}
        onPress={() => router.push('/(app)/chatbot')}
        style={({ pressed }) => [pressed && { opacity: 0.7 }]}
      >
        <Image source={BOT_ICON} style={styles.icon} resizeMode="contain" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 410,
    right: -18,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
    elevation: 10,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: -6, // bubble robot'un kenarına biraz girsin
    borderRadius: 16,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  bubbleText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: theme.font.weight.semibold,
  },
  closeBtn: {
    padding: 2,
  },
  icon: {
    width: 120,
    height: 120,
    backgroundColor: 'transparent',
  },
});
