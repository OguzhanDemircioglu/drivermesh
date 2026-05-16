import { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { getPushPermission, requestPushPermission, registerPushTokenForCustomer } from '@/lib/push';
import { colors, radii, spacing } from '@/theme';

type Props = {
  customerId: string;
  /** Kullanıcı izin verirse veya reddederse modal kapanır. */
  onResolved: () => void;
};

/**
 * Contextual push permission modal. "Çağır" basıldıktan sonra önce
 * permission undetermined ise gösterilir; user "İzin ver" veya "Şimdi değil".
 */
export function PushPermissionGate({ customerId, onResolved }: Props) {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);

  const onAllow = async () => {
    setSubmitting(true);
    try {
      const next = await requestPushPermission();
      if (next === 'granted') {
        await registerPushTokenForCustomer(customerId);
      }
    } finally {
      setSubmitting(false);
      onResolved();
    }
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onResolved}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{t('permissions.pushTitle')}</Text>
          <Text style={styles.body}>{t('permissions.pushBody')}</Text>
          <Button
            title={t('permissions.pushAllow')}
            onPress={onAllow}
            loading={submitting}
          />
          <Button
            title={t('permissions.pushDeny')}
            onPress={onResolved}
            variant="ghost"
          />
        </View>
      </View>
    </Modal>
  );
}

/**
 * Push permission durumu için basit helper — call-modal'da kullanılır.
 */
export async function ensurePushPermission(customerId: string): Promise<void> {
  const cur = await getPushPermission();
  if (cur === 'granted') {
    await registerPushTokenForCustomer(customerId).catch(() => {});
  }
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.text, fontSize: 21, fontWeight: '700' },
  body: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
});
