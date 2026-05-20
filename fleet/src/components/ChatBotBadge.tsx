// ChatBotBadge — Anasayfa "Hızlı Aksiyon" başlığının sağ ucuna inline yerleşir.
//
// Robot resmi + sol tarafında "Bana Sor" speech bubble (her demo açılışında
// görünür, × ile kapatılabilir — kapatma sadece bu session için, sonraki
// demo girişinde yine açılır).
//
// Tap robot → /(app)/chatbot.
// Tap × → bubble gizlenir.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import { theme } from '@/theme';

const BOT_ICON = require('../../assets/chatbot.png');

export function ChatBotBadge() {
  const router = useRouter();
  const { t } = useTranslation();
  // Her mount'ta default true — demo'ya her girişte bubble açılır.
  // Kullanıcı × ile kapatınca bu session için gizlenir, AsyncStorage'a
  // kaydedilmez (bir sonraki demo girişinde yeniden çıksın).
  const [bubbleVisible, setBubbleVisible] = useState(true);

  return (
    <View style={styles.row} pointerEvents="box-none">
      {bubbleVisible ? (
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>{t('chatbot.askMe')}</Text>
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
        <Image source={BOT_ICON} style={styles.icon} contentFit="contain" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    // Başlık ("Hızlı Aksiyon") dikey ortası ile robot dikey ortası hizalansın.
    // Robot 120px tall, başlık ~22px → top = -(120-22)/2 = -49.
    top: -49,
    // Section'ın xl paddingHorizontal'ı içinde olduğumuz için negatif right
    // ile robot'u ekran sağ kenarına iyice yaklaştır.
    right: -28,
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 0,
    zIndex: 10,
    elevation: 10,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    marginBottom: -14,
    zIndex: 2,
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
