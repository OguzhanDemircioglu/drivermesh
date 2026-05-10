// ============================================================================
// MultiPhotoPicker — multiple photos with thumbnails + add/remove
// ----------------------------------------------------------------------------
// Bakim talebinde birden fazla foto secebilmek icin. Foto upload yapmaz,
// sadece local URI listesi tutar; parent submit'te uploadImage cagrir.
// ============================================================================
import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/Toast';
import { isDemoActive } from '@/demo/store';
import { theme } from '@/theme';

export type MultiPhotoItem = { uri: string; mime?: string };

export type MultiPhotoPickerProps = {
  items: MultiPhotoItem[];
  onAdd: (item: MultiPhotoItem) => void;
  onRemove: (index: number) => void;
  max?: number;
  disabled?: boolean;
};

const THUMB = 84;

export function MultiPhotoPicker({
  items,
  onAdd,
  onRemove,
  max = 5,
  disabled = false,
}: MultiPhotoPickerProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const reachedLimit = items.length >= max;

  const open = () => {
    if (disabled || busy || reachedLimit) return;
    setSheetOpen(true);
  };

  const handle = async (source: 'camera' | 'gallery') => {
    setSheetOpen(false);
    if (disabled || busy) return;
    setBusy(true);
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast.error(
          t('photoPicker.errorTitle'),
          source === 'camera' ? t('photoPicker.cameraPermission') : t('photoPicker.galleryPermission'),
        );
        return;
      }
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
        base64: isDemoActive(),
      };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(opts)
          : await ImagePicker.launchImageLibraryAsync(opts);
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (isDemoActive()) {
        if (!asset.base64) {
          toast.error(t('photoPicker.errorTitle'), t('errors.generic'));
          return;
        }
        const mime = asset.mimeType ?? 'image/jpeg';
        onAdd({ uri: `data:${mime};base64,${asset.base64}`, mime });
        return;
      }
      onAdd({ uri: asset.uri, mime: asset.mimeType ?? 'image/jpeg' });
    } catch {
      toast.error(t('photoPicker.errorTitle'), t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {items.map((it, idx) => (
          <View key={idx} style={[styles.thumb, { width: THUMB, height: THUMB }]}>
            <Image source={{ uri: it.uri }} style={styles.thumbImage} resizeMode="cover" />
            {!disabled ? (
              <Pressable
                onPress={() => onRemove(idx)}
                hitSlop={8}
                style={({ pressed }) => [styles.thumbRemove, pressed && { opacity: 0.7 }]}
              >
                <Feather name="x" size={12} color="#FFFFFF" />
              </Pressable>
            ) : null}
          </View>
        ))}
        {!reachedLimit && !disabled ? (
          <Pressable
            onPress={open}
            style={({ pressed }) => [
              styles.addButton,
              { width: THUMB, height: THUMB },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Feather name="plus" size={22} color={theme.colors.accent} />
            <Text style={styles.addText}>
              {t('photoPicker.addCount', { count: items.length, max })}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={sheetOpen}
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setSheetOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>{t('photoPicker.sheetTitle')}</Text>
            <Pressable
              onPress={() => handle('camera')}
              style={({ pressed }) => [styles.sheetItem, pressed && styles.sheetItemPressed]}
            >
              <Feather name="camera" size={18} color={theme.colors.text} />
              <Text style={styles.sheetItemText}>{t('photoPicker.fromCamera')}</Text>
            </Pressable>
            <Pressable
              onPress={() => handle('gallery')}
              style={({ pressed }) => [styles.sheetItem, pressed && styles.sheetItemPressed]}
            >
              <Feather name="image" size={18} color={theme.colors.text} />
              <Text style={styles.sheetItemText}>{t('photoPicker.fromGallery')}</Text>
            </Pressable>
            <Pressable
              onPress={() => setSheetOpen(false)}
              style={({ pressed }) => [styles.sheetCancel, pressed && styles.sheetItemPressed]}
            >
              <Text style={styles.sheetCancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: { gap: 10, paddingVertical: 4 },
  thumb: {
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  thumbImage: { width: '100%', height: '100%' },
  thumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
  },
  addText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
  },

  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 12,
    gap: 4,
  },
  sheetTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
  },
  sheetItemPressed: { backgroundColor: theme.colors.accentMuted },
  sheetItemText: { color: theme.colors.text, fontSize: theme.font.size.md },
  sheetCancel: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    marginTop: 4,
    alignItems: 'center',
  },
  sheetCancelText: {
    color: theme.colors.accent,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
  },
});
