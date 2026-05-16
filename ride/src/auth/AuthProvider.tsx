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
import type { Session } from '@supabase/supabase-js';
import { initialSessionPromise, supabase } from '@/lib/supabase';
import {
  clearPushToken,
  getMyCustomer,
  upsertMyCustomer,
  type Customer,
} from '@/lib/db/customers';
import { registerPushTokenForCustomer } from '@/lib/push';

type SignInPhoneResult = {
  /** Supabase OTP gönderilince true */
  sent: boolean;
};

type AuthState = {
  session: Session | null;
  customer: Customer | null;
  loading: boolean;
  /** Telefon doğrulamasıyla OTP iste */
  signInWithPhone: (phoneE164: string) => Promise<SignInPhoneResult>;
  /** OTP doğrula, session aç */
  verifyPhoneOtp: (phoneE164: string, token: string) => Promise<void>;
  /** Profile setup'tan sonra customers satırını upsert et */
  finalizeProfile: (input: { fullName: string }) => Promise<void>;
  /** Customer satırını yeniden çek */
  refreshCustomer: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Sadece dev/preview build — gerçek test user'la signInWithPassword. Üretimde undefined. */
  devSignIn?: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

// Cold start'ta module load anında initial session'ı çözmeye başla — AuthProvider
// mount olduğunda zaten resolve olmuş olursa splash bekletmeyiz.
let initialSettled: Session | null | undefined;
initialSessionPromise.then((res) => {
  initialSettled = res.data.session;
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(initialSettled ?? null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(initialSettled === undefined);
  const customerFetchToken = useRef(0);

  const fetchCustomer = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setCustomer(null);
      return;
    }
    const my = ++customerFetchToken.current;
    try {
      const row = await getMyCustomer(userId);
      if (my !== customerFetchToken.current) return;
      setCustomer(row);
      // Permission'ı user vermişse her oturumda token tazele (cihaz değişirse).
      if (row?.id) {
        registerPushTokenForCustomer(row.id).catch((e) =>
          console.warn('[push] register failed', e),
        );
      }
    } catch (e) {
      console.warn('[auth] customer fetch error', e);
      if (my === customerFetchToken.current) setCustomer(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    initialSessionPromise.then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
      void fetchCustomer(data.session?.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      void fetchCustomer(next?.user.id);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [fetchCustomer]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      customer,
      loading,
      signInWithPhone: async (phoneE164) => {
        const { error } = await supabase.auth.signInWithOtp({
          phone: phoneE164,
          options: { channel: 'sms' },
        });
        if (error) throw error;
        return { sent: true };
      },
      verifyPhoneOtp: async (phoneE164, token) => {
        const { error } = await supabase.auth.verifyOtp({
          phone: phoneE164,
          token,
          type: 'sms',
        });
        if (error) throw error;
      },
      finalizeProfile: async ({ fullName }) => {
        const uid = session?.user.id;
        // Email-only signUp (dev/preview) → session.user.phone='' (boş string).
        // `??` boş string'i kapsamadığı için `||` ile fallback'e düş: customer
        // satırı önceden seed edilmişse oradan al, yoksa hata at.
        const phone =
          (session?.user.phone && session.user.phone.trim() !== ''
            ? session.user.phone
            : null) ?? customer?.phone;
        if (!uid || !phone) throw new Error('Session yok, finalize çağrılamaz.');
        const row = await upsertMyCustomer({
          authUserId: uid,
          phone,
          fullName,
        });
        setCustomer(row);
      },
      refreshCustomer: async () => {
        await fetchCustomer(session?.user.id);
      },
      signOut: async () => {
        if (customer?.id) {
          clearPushToken(customer.id).catch(() => {});
        }
        // Mock session ise sadece local clear; gerçek session değil.
        if (session?.user.aud === 'dev-mock') {
          setSession(null);
          setCustomer(null);
          return;
        }
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
      // Sadece dev/preview build'lerde sunulur. Release APK __DEV__ false
      // olduğu için devSignIn undefined kalır → string-dump'ta hardcoded
      // credential sızması yok, UI'da da fallback gizlenir.
      devSignIn: __DEV__
        ? async () => {
            const { error } = await supabase.auth.signInWithPassword({
              email: 'dev-customer@drivermeshride.local',
              password: 'devpass1234',
            });
            if (error) console.warn('[dev-signin] error', error.message);
          }
        : undefined,
    }),
    [session, customer, loading, fetchCustomer],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
