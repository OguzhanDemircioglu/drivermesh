// ============================================================================
// PhotoPicker — single-photo picker with action sheet (camera / gallery)
// ----------------------------------------------------------------------------
// Upload yapmaz; sadece local URI verir parent'a. Parent upload akışını yönetir.
// Cloudinary entegrasyonu için: parent submit'te `cloudinary.uploadImage(uri, ...)`
// çağırır.
// ============================================================================
import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/Toast';
import { isDemoActive } from '@/demo/store';
import { theme } from '@/theme';

export type PhotoPickerProps = {
  uri: string | null;
  onPick: (uri: string, mimeType?: string) => void;
  onRemove?: () => void;
  /** [width, height] ratio. Default 16:10 — araç fotoları için. */
  aspect?: [number, number];
  disabled?: boolean;
  /** Yer tutucu ikon — foto yokken görünür. Default 'camera'. */
  placeholderIcon?: keyof typeof Feather.glyphMap;
  /** Foto yokken altta gösterilecek yardım metni. Default i18n key:
   * 'photoPicker.addHint' (varsa) veya literal 'Tap to add photo'. */
  emptyLabel?: string;
};

export function PhotoPicker({
  uri,
  onPick,
  onRemove,
  aspect = [16, 10],
  disabled = false,
  placeholderIcon = 'camera',
  emptyLabel,
}: PhotoPickerProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const ratio = aspect[0] / Math.max(aspect[1], 1);

  const open = () => {
    if (disabled || busy) return;
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
        allowsEditing: true,
        aspect,
        quality: 0.7,
        base64: isDemoActive(),
      };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(opts)
          : await ImagePicker.launchImageLibraryAsync(opts);
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      // Demo'da Cloudinary'ye gitmiyoruz — data URI'yi parent'a verelim ki
      // store/UI direkt persist etsin (avatar pattern'i ile uyumlu).
      if (isDemoActive()) {
        if (!asset.base64) {
          toast.error(t('photoPicker.errorTitle'), t('errors.generic'));
          return;
        }
        const mime = asset.mimeType ?? 'image/jpeg';
        onPick(`data:${mime};base64,${asset.base64}`, mime);
        return;
      }
      onPick(asset.uri, asset.mimeType ?? 'image/jpeg');
    } catch {
      toast.error(t('photoPicker.errorTitle'), t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Pressable
        onPress={open}
        disabled={disabled}
        style={({ pressed }) => [
          styles.container,
          { aspectRatio: ratio },
          pressed && { opacity: 0.85 },
        ]}
      >
        {uri ? (
          <>
            <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
            {onRemove ? (
              <Pressable
                onPress={onRemove}
                hitSlop={10}
                style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.7 }]}
              >
                <Feather name="x" size={16} color="#FFFFFF" />
              </Pressable>
            ) : null}
            <View style={styles.replaceBadge}>
              <Feather name="refresh-cw" size={12} color="#FFFFFF" />
              <Text style={styles.replaceText}>{t('photoPicker.replace')}</Text>
            </View>
          </>
        ) : (
          <View style={styles.empty}>
            <Feather name={placeholderIcon} size={28} color={theme.colors.accent} />
            <Text style={styles.emptyText}>{emptyLabel ?? t('photoPicker.addHint')}</Text>
          </View>
        )}
      </Pressable>

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
  container: {
    width: '100%',
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: { width: '100%', height: '100%' },
  removeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replaceBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
  },
  replaceText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: theme.font.weight.semibold,
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
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
  sheetItemPressed: {
    backgroundColor: theme.colors.accentMuted,
  },
  sheetItemText: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
  },
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
