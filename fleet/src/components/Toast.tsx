import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/theme';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

type ToastItem = {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
};

type ToastApi = {
  show: (kind: ToastKind, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  dismissAll: () => void;
};

const ToastContext = createContext<ToastApi | null>(null);

/**
 * Custom toast provider — drop-in replacement for `Alert.alert` notices.
 *
 * Use for INFORMATIONAL feedback (success/error/info/warning). Keep
 * `Alert.alert` for confirmation dialogs that need a yes/no response.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success('Araç filoya eklendi');
 *   toast.error('Kayıt başarısız', 'İnternet bağlantını kontrol et.');
 */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const KIND_CFG: Record<
  ToastKind,
  { bg: string; border: string; iconColor: string; icon: keyof typeof Feather.glyphMap }
> = {
  success: {
    bg: 'rgba(34,197,94,0.14)',
    border: 'rgba(34,197,94,0.45)',
    iconColor: theme.colors.success,
    icon: 'check-circle',
  },
  error: {
    bg: 'rgba(239,68,68,0.14)',
    border: 'rgba(239,68,68,0.45)',
    iconColor: theme.colors.danger,
    icon: 'alert-circle',
  },
  info: {
    bg: 'rgba(91,127,255,0.14)',
    border: 'rgba(91,127,255,0.45)',
    iconColor: theme.colors.mesh,
    icon: 'info',
  },
  warning: {
    bg: 'rgba(245,158,11,0.14)',
    border: 'rgba(245,158,11,0.45)',
    iconColor: theme.colors.warning,
    icon: 'alert-triangle',
  },
};

const TOAST_DURATION = 3000;
const ENTER_MS = 220;
const EXIT_MS = 180;
const ITEM_GAP = 8;
const ITEM_MIN_HEIGHT = 56;

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const insets = useSafeAreaInsets();

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const show = useCallback(
    (kind: ToastKind, title: string, message?: string) => {
      const id = ++counter;
      setItems((prev) => [...prev, { id, kind, title, message }]);
      setTimeout(() => dismiss(id), TOAST_DURATION);
    },
    [dismiss],
  );

  const dismissAll = useCallback(() => setItems([]), []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (t, m) => show('success', t, m),
      error: (t, m) => show('error', t, m),
      info: (t, m) => show('info', t, m),
      warning: (t, m) => show('warning', t, m),
      dismissAll,
    }),
    [show, dismissAll],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <View
        pointerEvents="box-none"
        style={[styles.layer, { top: insets.top + 12 }]}
      >
        {items.map((it, i) => (
          <ToastBubble
            key={it.id}
            item={it}
            offset={i * (ITEM_MIN_HEIGHT + ITEM_GAP)}
            onPress={() => dismiss(it.id)}
          />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

function ToastBubble({
  item,
  offset,
  onPress,
}: {
  item: ToastItem;
  offset: number;
  onPress: () => void;
}) {
  const cfg = KIND_CFG[item.kind];
  const slide = useRef(new Animated.Value(-12)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, {
        toValue: 0,
        duration: ENTER_MS,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: ENTER_MS,
        useNativeDriver: true,
      }),
    ]).start();
    const exitTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slide, {
          toValue: -12,
          duration: EXIT_MS,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: EXIT_MS,
          useNativeDriver: true,
        }),
      ]).start();
    }, TOAST_DURATION - EXIT_MS);
    return () => clearTimeout(exitTimer);
  }, [slide, opacity]);

  return (
    <Animated.View
      style={[
        styles.itemWrap,
        {
          top: offset,
          opacity,
          transform: [{ translateY: slide }],
        },
      ]}
      pointerEvents="auto"
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.item,
          {
            backgroundColor: cfg.bg,
            borderColor: cfg.border,
          },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Feather name={cfg.icon} size={20} color={cfg.iconColor} />
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          {item.message ? (
            <Text style={styles.message} numberOfLines={3}>
              {item.message}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 9999,
  },
  itemWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    backgroundColor: theme.colors.bgElevated,
    minHeight: ITEM_MIN_HEIGHT,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  body: { flex: 1 },
  title: {
    color: theme.colors.text,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
  },
  message: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.xs,
    marginTop: 2,
    lineHeight: 18,
  },
});
