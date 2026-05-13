/**
 * Force / soft update modal.
 *
 * Hard mode (status='force'):
 *   - Tam ekran modal, kapatilamaz (no-op back button)
 *   - Sadece "Simdi Guncelle" butonu (store deep-link)
 *
 * Soft mode (status='soft'):
 *   - Banner-stili modal, "Daha Sonra" + "Guncelle" butonlari
 *   - Daha Sonra basinca 24 saatlik dismiss
 *
 * Apple/Google policy: hard update sadece kritik durumlarda kullanilmali.
 * Her sürumde force update = store reddi.
 */
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '@/theme';
import {
  type VersionCheckResult,
  dismissSoftUpdate,
  openStoreUrl,
} from '@/lib/forceUpdate';

type Props = {
  result: VersionCheckResult | null;
  onDismiss: () => void;
};

export function ForceUpdateModal({ result, onDismiss }: Props) {
  const { i18n } = useTranslation();
  if (!result || result.status === 'ok') return null;

  const isForce = result.status === 'force';
  const lang = (i18n.language as string)?.toLowerCase().startsWith('en') ? 'en' : 'tr';
  const message = lang === 'en' ? result.messageEn : result.messageTr;

  const handleUpdate = () => {
    openStoreUrl(result.storeUrl);
  };
  const handleLater = async () => {
    await dismissSoftUpdate();
    onDismiss();
  };

  return (
    <Modal
      visible
      transparent
      animationType={isForce ? 'fade' : 'slide'}
      onRequestClose={isForce ? undefined : handleLater /* Android back: hard'da no-op */}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: isForce ? '#EF444422' : theme.colors.accentMuted },
            ]}
          >
            <Feather
              name={isForce ? 'alert-triangle' : 'download-cloud'}
              size={28}
              color={isForce ? '#EF4444' : theme.colors.accent}
            />
          </View>
          <Text style={styles.title}>
            {lang === 'en'
              ? isForce
                ? 'Update Required'
                : 'New Version Available'
              : isForce
                ? 'Guncelleme Gerekli'
                : 'Yeni Surum Var'}
          </Text>
          <Text style={styles.body}>{message}</Text>
          <Text style={styles.version}>v{result.latest}</Text>
          <View style={styles.actions}>
            {!isForce ? (
              <Pressable
                onPress={handleLater}
                style={({ pressed }) => [styles.btnSecondary, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.btnSecondaryText}>
                  {lang === 'en' ? 'Later' : 'Daha Sonra'}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={handleUpdate}
              style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.btnPrimaryText}>
                {lang === 'en' ? 'Update Now' : 'Simdi Guncelle'}
              </Text>
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
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  body: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  version: {
    color: theme.colors.textDim,
    fontSize: theme.font.size.xs,
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    width: '100%',
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: theme.colors.accent,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: theme.colors.bg,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.bold,
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  btnSecondaryText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.medium,
  },
});
