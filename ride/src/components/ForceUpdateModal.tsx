import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View, AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { checkForceUpdate, openStore, type ForceUpdateState } from '@/utils/forceUpdate';
import { colors, radii, spacing } from '@/theme';

export function ForceUpdateModal() {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState<ForceUpdateState>({ required: false });

  useEffect(() => {
    let alive = true;
    const run = async () => {
      const s = await checkForceUpdate();
      if (alive) setState(s);
    };
    void run();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void run();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  if (!state.required) return null;

  const body =
    i18n.language === 'en'
      ? state.messageEn ?? t('forceUpdate.body')
      : state.messageTr ?? t('forceUpdate.body');

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{t('forceUpdate.title')}</Text>
          <Text style={styles.body}>{body}</Text>
          <Button title={t('forceUpdate.cta')} onPress={() => openStore(state.storeUrl)} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
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
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  body: { color: colors.textMuted, fontSize: 16, lineHeight: 22 },
});
