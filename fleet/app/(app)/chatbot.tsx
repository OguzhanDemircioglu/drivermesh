// Chatbot screen — DriverMesh Fleet AI Asistan
//
// Layout:
//   - Top bar: back arrow + "AI Asistan" başlık + new chat button
//   - Mesaj listesi (FlatList, asistan sol mor / user sağ turuncu)
//   - Quick replies (ilk açılışta önerilen sorular)
//   - Bottom: text input + send
//
// İlk açılış: en son session'ı yükle veya boş başlat.
// Mesaj gönderince optimistic update, sonra backend cevabı eklenir.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { theme } from '@/theme';
import { sendMessage, getOrCreateLatestSession, getMessages } from '@/chatbot/client';
import type { ChatMessage } from '@/chatbot/types';

const BOT_ICON = require('../../assets/chatbot.png');

export default function ChatBotScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();

  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // Load last session on mount
  useEffect(() => {
    (async () => {
      const session = await getOrCreateLatestSession();
      if (session) {
        setSessionId(session.id);
        const msgs = await getMessages(session.id);
        setMessages(msgs);
      }
    })();
  }, []);

  // Auto-scroll on new message
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  const handleSend = useCallback(
    async (text?: string) => {
      const messageText = (text ?? input).trim();
      if (!messageText || sending) return;

      setInput('');
      setSending(true);

      // Optimistic user message
      const optimisticUser: ChatMessage = {
        id: `tmp-user-${Date.now()}`,
        session_id: sessionId ?? 'pending',
        user_id: 'me',
        role: 'user',
        content: messageText,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUser]);

      try {
        const response = await sendMessage(messageText, sessionId);
        if (!sessionId && response.sessionId) {
          setSessionId(response.sessionId);
        }
        const botMessage: ChatMessage = {
          id: `tmp-bot-${Date.now()}`,
          session_id: response.sessionId,
          user_id: 'bot',
          role: 'assistant',
          content: response.reply,
          metadata: { provider: response.provider },
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, botMessage]);
      } finally {
        setSending(false);
      }
    },
    [input, sending, sessionId],
  );

  const startNewChat = useCallback(() => {
    setSessionId(undefined);
    setMessages([]);
  }, []);

  const QUICK_REPLIES = [
    t('chatbot.quickReply1'),
    t('chatbot.quickReply2'),
    t('chatbot.quickReply3'),
  ];

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.topBarBtn}>
            <Feather name="arrow-left" size={24} color={theme.colors.text} />
          </Pressable>
          <View style={styles.topBarTitleWrap}>
            <Image source={BOT_ICON} style={styles.topBarAvatar} />
            <Text style={styles.topBarTitle}>{t('chatbot.title')}</Text>
          </View>
          <Pressable onPress={startNewChat} hitSlop={10} style={styles.topBarBtn}>
            <Feather name="edit-3" size={20} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          // padding her iki platformda da güvenli. Header SafeAreaView içinde,
          // KAV onun altında — offset=0 → klavye geldiğinde input klavyenin
          // tam üstüne gelir, ekstra boşluk bırakmaz.
          behavior="padding"
          keyboardVerticalOffset={0}
        >
          <FlatList
            ref={listRef}
            style={styles.list}
            contentContainerStyle={[
              styles.listContent,
              messages.length === 0 && styles.listContentEmpty,
            ]}
            data={messages}
            keyExtractor={(m) => m.id}
            ListHeaderComponent={
              messages.length === 0 ? (
                <EmptyState
                  onPickQuick={(q) => handleSend(q)}
                  quickReplies={QUICK_REPLIES}
                  greeting={t('chatbot.greeting')}
                />
              ) : null
            }
            renderItem={({ item }) => <MessageBubble message={item} />}
            ListFooterComponent={
              sending ? <TypingIndicator /> : null
            }
          />

          {/* Input bar — paddingBottom sadece insets.bottom (gesture navigation);
              klavye açıkken KAV view'ı yukarı iter, ekstra boşluk gerek yok. */}
          <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <TextInput
              value={input}
              // Multiline TextInput'ta Android'de Enter newline insert eder
              // (RN davranışı, onSubmitEditing çağrılmaz). Burada her platformda
              // newline-ending input'u yakalayıp send tetikleyerek "Enter = gönder"
              // davranışını sağlıyoruz. Shift+Enter newline web'de native çalışır
              // (ama biz son karakter detect ile basit tutuyoruz).
              onChangeText={(text) => {
                if (text.endsWith('\n')) {
                  const clean = text.replace(/\n+$/, '');
                  setInput('');
                  if (clean.trim()) handleSend(clean);
                  return;
                }
                setInput(text);
              }}
              placeholder={t('chatbot.inputPlaceholder')}
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
              multiline
              maxLength={4000}
              editable={!sending}
              onSubmitEditing={() => handleSend()}
              returnKeyType="send"
              blurOnSubmit={false}
            />
            <Pressable
              onPress={() => handleSend()}
              disabled={!input.trim() || sending}
              style={({ pressed }) => [
                styles.sendBtn,
                (!input.trim() || sending) && styles.sendBtnDisabled,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Feather name="send" size={18} color="white" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ============================================================
// Sub-components
// ============================================================

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowBot]}>
      {!isUser && (
        <Image source={BOT_ICON} style={styles.bubbleAvatar} />
      )}
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleBot,
        ]}
      >
        <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextBot]}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

function TypingIndicator() {
  const dots = [0, 1, 2];
  const anims = useRef(dots.map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    const loops = anims.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(v, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [anims]);

  return (
    <View style={[styles.row, styles.rowBot]}>
      <Image source={BOT_ICON} style={styles.bubbleAvatar} />
      <View style={[styles.bubble, styles.bubbleBot, styles.typingBubble]}>
        {dots.map((i) => (
          <Animated.View
            key={i}
            style={[styles.typingDot, { opacity: anims[i] }]}
          />
        ))}
      </View>
    </View>
  );
}

function EmptyState({
  greeting,
  quickReplies,
  onPickQuick,
}: {
  greeting: string;
  quickReplies: string[];
  onPickQuick: (q: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.emptyState}>
      <Image source={BOT_ICON} style={styles.emptyAvatar} />
      <Text style={styles.emptyGreeting}>{greeting}</Text>
      <Text style={styles.emptyHint}>{t('chatbot.quickReplyHint')}</Text>
      <View style={styles.quickRepliesWrap}>
        {quickReplies.map((q) => (
          <Pressable
            key={q}
            onPress={() => onPickQuick(q)}
            style={({ pressed }) => [
              styles.quickReply,
              pressed && { opacity: 0.75 },
            ]}
          >
            <Text style={styles.quickReplyText}>{q}</Text>
            <Feather name="arrow-up-right" size={14} color={theme.colors.accent} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  safe: { flex: 1 },
  flex: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  topBarBtn: { padding: 6, minWidth: 32 },
  topBarTitleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  topBarAvatar: { width: 28, height: 28, borderRadius: 14 },
  topBarTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.semibold,
  },

  list: { flex: 1 },
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    gap: 10,
  },
  listContentEmpty: { flexGrow: 1, justifyContent: 'center' },

  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  rowUser: { justifyContent: 'flex-end' },
  rowBot: { justifyContent: 'flex-start' },

  bubbleAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: theme.colors.bg,
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleUser: {
    backgroundColor: theme.colors.accent,
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor: theme.colors.surface,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: theme.font.size.md, lineHeight: 22 },
  bubbleTextUser: { color: 'white' },
  bubbleTextBot: { color: theme.colors.text },

  typingBubble: { flexDirection: 'row', gap: 4, alignItems: 'center', paddingVertical: 14 },
  typingDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: theme.colors.textMuted,
  },

  emptyState: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  emptyAvatar: { width: 80, height: 80, borderRadius: 40 },
  emptyGreeting: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.semibold,
    textAlign: 'center',
  },
  emptyHint: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    textAlign: 'center',
  },
  quickRepliesWrap: {
    width: '100%',
    gap: 8,
    marginTop: theme.spacing.md,
  },
  quickReply: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  quickReplyText: {
    color: theme.colors.text,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.medium,
    flex: 1,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    fontSize: theme.font.size.md,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
});
