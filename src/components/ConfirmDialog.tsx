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
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '@/theme';

type ConfirmKind = 'default' | 'destructive' | 'warning';

type ConfirmRequest = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  kind?: ConfirmKind;
  /** Lucide icon name shown in the kind-tinted circle. Defaults per kind. */
  icon?: keyof typeof Feather.glyphMap;
};

type PendingPromise = {
  request: ConfirmRequest;
  resolve: (ok: boolean) => void;
};

type ConfirmApi = {
  /** Show the dialog. Resolves true on confirm, false on cancel/dismiss. */
  confirm: (req: ConfirmRequest) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmApi | null>(null);

/**
 * Branded confirmation dialog — drop-in replacement for `Alert.alert(...)`
 * yes/no prompts. Pair with `useToast()` for one-shot notifications.
 *
 * Usage:
 *   const { confirm } = useConfirm();
 *   const ok = await confirm({
 *     title: 'Aracı sil',
 *     message: 'Bu işlem geri alınamaz.',
 *     confirmText: 'Sil',
 *     kind: 'destructive',
 *   });
 *   if (ok) doDelete();
 */
export function useConfirm(): ConfirmApi {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
}

const KIND_CFG: Record<
  ConfirmKind,
  { iconBg: string; iconFg: string; defaultIcon: keyof typeof Feather.glyphMap; cta: string }
> = {
  default: {
    iconBg: theme.colors.accentMuted,
    iconFg: theme.colors.accent,
    defaultIcon: 'help-circle',
    cta: theme.colors.accent,
  },
  destructive: {
    iconBg: 'rgba(239,68,68,0.14)',
    iconFg: theme.colors.danger,
    defaultIcon: 'alert-triangle',
    cta: theme.colors.danger,
  },
  warning: {
    iconBg: 'rgba(245,158,11,0.14)',
    iconFg: theme.colors.warning,
    defaultIcon: 'alert-circle',
    cta: theme.colors.warning,
  },
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingPromise | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (pending) {
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(lift, {
          toValue: 0,
          stiffness: 220,
          damping: 22,
          mass: 0.6,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fade.setValue(0);
      lift.setValue(20);
    }
  }, [pending, fade, lift]);

  const close = useCallback(
    (result: boolean) => {
      const p = pending;
      if (!p) return;
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(lift, {
          toValue: 20,
          duration: 140,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setPending(null);
        p.resolve(result);
      });
    },
    [pending, fade, lift],
  );

  const confirm = useCallback(
    (request: ConfirmRequest) =>
      new Promise<boolean>((resolve) => {
        // If a previous one is still up, dismiss it as cancelled.
        setPending((prev) => {
          if (prev) prev.resolve(false);
          return { request, resolve };
        });
      }),
    [],
  );

  const api = useMemo<ConfirmApi>(() => ({ confirm }), [confirm]);

  const cfg = pending ? KIND_CFG[pending.request.kind ?? 'default'] : KIND_CFG.default;
  const iconName =
    pending?.request.icon ?? cfg.defaultIcon;

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      <Modal
        visible={!!pending}
        transparent
        animationType="none"
        onRequestClose={() => close(false)}
      >
        <Animated.View style={[styles.backdrop, { opacity: fade }]}>
          <Pressable style={styles.backdropPress} onPress={() => close(false)} />
        </Animated.View>
        {pending ? (
          <View style={styles.center} pointerEvents="box-none">
            <Animated.View
              style={[
                styles.sheet,
                { opacity: fade, transform: [{ translateY: lift }] },
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: cfg.iconBg }]}>
                <Feather name={iconName} size={26} color={cfg.iconFg} />
              </View>
              <Text style={styles.title}>{pending.request.title}</Text>
              {pending.request.message ? (
                <Text style={styles.message}>{pending.request.message}</Text>
              ) : null}
              <View style={styles.row}>
                <Pressable
                  onPress={() => close(false)}
                  style={({ pressed }) => [
                    styles.btn,
                    styles.btnGhost,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={styles.btnGhostText}>
                    {pending.request.cancelText ?? 'Vazgeç'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => close(true)}
                  style={({ pressed }) => [
                    styles.btn,
                    styles.btnSolid,
                    { backgroundColor: cfg.cta },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.btnSolidText}>
                    {pending.request.confirmText ?? 'Onayla'}
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          </View>
        ) : null}
      </Modal>
    </ConfirmContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,12,24,0.7)',
  },
  backdropPress: { flex: 1 },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.xl,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  message: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
    width: '100%',
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  btnGhostText: {
    color: theme.colors.text,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
  },
  btnSolid: {},
  btnSolidText: {
    color: '#0A0E1F',
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.bold,
  },
});
