import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii } from '@/theme';

type Variant = 'success' | 'error' | 'info' | 'warning';
type Toast = { id: number; variant: Variant; message: string };

type Ctx = {
  show: (variant: Variant, message: string) => void;
};

const ToastContext = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(-100)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    Animated.timing(slide, {
      toValue: -100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setToast(null));
  }, [slide]);

  const show = useCallback(
    (variant: Variant, message: string) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setToast({ id: Date.now(), variant, message });
      Animated.spring(slide, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 200,
      }).start();
      hideTimer.current = setTimeout(dismiss, 3000);
    },
    [slide, dismiss],
  );

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast ? (
        <Animated.View
          style={[
            styles.wrap,
            { top: insets.top + 8, transform: [{ translateY: slide }], pointerEvents: 'none' },
          ]}
        >
          <View style={[styles.toast, variantStyles[toast.variant]]}>
            <Text style={styles.text}>{toast.message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'stretch',
    zIndex: 9999,
  },
  toast: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  text: { color: colors.text, fontSize: 15, fontWeight: '500' },
});

const variantStyles = StyleSheet.create({
  success: { backgroundColor: 'rgba(34,197,94,0.18)', borderColor: colors.success },
  error: { backgroundColor: colors.dangerMuted, borderColor: colors.danger },
  info: { backgroundColor: colors.meshMuted, borderColor: colors.mesh },
  warning: { backgroundColor: 'rgba(245,158,11,0.18)', borderColor: colors.warning },
});
