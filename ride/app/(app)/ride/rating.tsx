import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { StarRating } from '@/components/StarRating';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/auth/AuthProvider';
import { submitRating } from '@/lib/db/rides';
import { colors, spacing } from '@/theme';

const STAR_LABEL_KEYS = [
  null,
  'rating.starLabel1',
  'rating.starLabel2',
  'rating.starLabel3',
  'rating.starLabel4',
  'rating.starLabel5',
] as const;

export default function RatingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ rideId: string }>();
  const { customer } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const close = () => router.back();

  const onSubmit = async () => {
    if (stars === 0 || submitting || !params.rideId) return;
    setSubmitting(true);
    try {
      await submitRating({
        rideId: params.rideId,
        stars,
        comment: comment.trim() || null,
      });
      toast.show('success', t('rating.thanks'));
      await qc.invalidateQueries({ queryKey: ['ride', 'pending-rating', customer?.id] });
      router.replace('/(app)/(tabs)/home');
    } catch (e) {
      toast.show('error', e instanceof Error ? e.message : t('errors.unknown'));
    } finally {
      setSubmitting(false);
    }
  };

  const labelKey = stars > 0 ? STAR_LABEL_KEYS[stars] : null;

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.root}>
          <Pressable onPress={close} hitSlop={12} style={styles.closeBtn}>
            <Feather name="x" size={24} color={colors.text} />
          </Pressable>

          <Text style={styles.title}>{t('rating.title')}</Text>

          <View style={styles.starsWrap}>
            <StarRating value={stars} onChange={setStars} />
            {labelKey ? <Text style={styles.starLabel}>{t(labelKey)}</Text> : null}
          </View>

          <TextField
            label={t('rating.commentLabel')}
            placeholder={t('rating.commentPlaceholder')}
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            style={styles.commentInput as never}
            maxLength={500}
          />

          <View style={{ flex: 1 }} />

          <Button
            title={t('rating.cta')}
            onPress={onSubmit}
            disabled={stars === 0}
            loading={submitting}
          />
          <Pressable onPress={close} style={styles.laterBtn}>
            <Text style={styles.laterText}>{t('common.later')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  closeBtn: { alignSelf: 'flex-end' },
  title: { color: colors.text, fontSize: 25, fontWeight: '700', textAlign: 'center' },
  starsWrap: { gap: spacing.sm, alignItems: 'center', marginVertical: spacing.md },
  starLabel: { color: colors.warning, fontSize: 16, fontWeight: '600' },
  commentInput: { minHeight: 100, textAlignVertical: 'top', paddingTop: 12 },
  laterBtn: { alignSelf: 'center', padding: spacing.sm },
  laterText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
});
