import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { supabase } from '@/lib/supabase';
import { colors, radii, spacing } from '@/theme';

const FAQ_KEYS = [
  { q: 'Şoförüm gelmedi, ne yapmalıyım?', a: 'Yolculuğunu iptal edip yakındaki başka bir aracı çağırabilirsin. Şoför iletişim için aktif yolculuk sırasında "Ara" butonunu kullan.' },
  { q: 'Ücret yanlış mı?', a: 'Tahmini ücret mesafe ve süreye göre hesaplanır. Kapıda nakit ödüyorsan şoförle anlaşma kesindir. İtirazını destek formundan iletebilirsin.' },
  { q: 'Eşyamı arabada unuttum', a: 'Aktif yolculuğun ekranındaki "Ara" butonu ile şoföre direkt ulaş. Yolculuk geçmişinden de detaya ulaşabilirsin.' },
  { q: 'Hesabımı silmek istiyorum', a: 'Destek formundan ileterek hesabın silinme talebini başlatabilirsin. 7 gün içinde geri dönüş yaparız.' },
  { q: 'Telefon numaramı değiştirmek istiyorum', a: 'Şu anda telefon numarası değiştirme self-service mevcut değil. Destek formuyla bize ulaş.' },
];

type Subject = 'general' | 'ride_complaint' | 'payment' | 'other';

export default function HelpScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();

  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [subject, setSubject] = useState<Subject>('general');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const send = async () => {
    if (message.trim().length < 5 || submitting) return;
    setSubmitting(true);
    try {
      await supabase.functions.invoke('send-support-message', {
        body: {
          subject,
          message: message.trim(),
          source: 'drivermeshride',
        },
      });
      toast.show('success', t('help.sent'));
      setMessage('');
    } catch (e) {
      toast.show('error', e instanceof Error ? e.message : t('errors.unknown'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Feather name="chevron-left" size={28} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t('help.title')}</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>{t('help.heroTitle')}</Text>
            <Text style={styles.heroBody}>{t('help.heroBody')}</Text>
          </View>

          <View style={styles.faqGroup}>
            {FAQ_KEYS.map((item, i) => {
              const open = openIdx === i;
              return (
                <View key={i} style={styles.faqItem}>
                  <Pressable
                    onPress={() => setOpenIdx(open ? null : i)}
                    style={({ pressed }) => [styles.faqHeader, pressed && { opacity: 0.85 }]}
                  >
                    <Text style={styles.faqQ}>{item.q}</Text>
                    <Feather
                      name={open ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={colors.textMuted}
                    />
                  </Pressable>
                  {open ? <Text style={styles.faqA}>{item.a}</Text> : null}
                </View>
              );
            })}
          </View>

          <Text style={styles.formTitle}>Mesaj gönder</Text>

          <View style={styles.subjectRow}>
            {(['general', 'ride_complaint', 'payment', 'other'] as Subject[]).map((s) => (
              <Pressable
                key={s}
                onPress={() => setSubject(s)}
                style={[styles.subjectChip, subject === s && styles.subjectChipActive]}
              >
                <Text style={[styles.subjectText, subject === s && styles.subjectTextActive]}>
                  {s === 'general'
                    ? 'Genel'
                    : s === 'ride_complaint'
                      ? 'Yolculuk'
                      : s === 'payment'
                        ? 'Ödeme'
                        : 'Diğer'}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextField
            placeholder="Sorununu yaz..."
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
            style={styles.textarea as never}
            maxLength={1000}
          />

          <Button
            title={t('help.sendCta')}
            onPress={send}
            disabled={message.trim().length < 5}
            loading={submitting}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  title: { color: colors.text, fontSize: 19, fontWeight: '700' },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['2xl'] },
  hero: { gap: 4 },
  heroTitle: { color: colors.text, fontSize: 21, fontWeight: '700' },
  heroBody: { color: colors.textMuted, fontSize: 15 },
  faqGroup: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  faqItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  faqQ: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1, paddingRight: spacing.sm },
  faqA: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  formTitle: { color: colors.text, fontSize: 17, fontWeight: '600', marginTop: spacing.sm },
  subjectRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  subjectChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subjectChipActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  subjectText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  subjectTextActive: { color: colors.text },
  textarea: { minHeight: 100, textAlignVertical: 'top', paddingTop: 12 },
});
