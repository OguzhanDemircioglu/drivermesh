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
import { supabase } from '@/lib/supabase';
import { registerForPushNotifications, clearPushToken } from '@/lib/pushNotifications';
import type { Profile } from '@/lib/database.types';
import {
  activateDemo,
  deactivateDemo,
  demo,
  isDemoActive as isDemoActiveStore,
} from '@/demo/store';
import { setSentryUser } from '@/lib/sentry';

type SignUpResult = { requiresConfirmation: boolean };

type FleetSignUpInput = {
  email: string;
  password: string;
  fullName: string;
  companyName: string;
};

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isDemo: boolean;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInDemo: () => Promise<void>;
  signUpFleet: (input: FleetSignUpInput) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

// Eager kick-off: AsyncStorage'tan token okumayı module load anında başlat.
// Promise resolve olur olmaz `initialSessionResolved`'a yazıyoruz; AuthProvider
// mount olduğunda zaten hazırsa loading=false ile başlatıp ekstra splash
// frame'i atlıyoruz.
let initialSessionResolved: { session: Session | null } | null = null;
const initialSessionPromise = supabase.auth.getSession().then((res) => {
  initialSessionResolved = { session: res.data.session };
  return res;
});

// Demo mode'da gerçek bir Supabase session yok — UI'in "session var" branch'ini
// memnun edecek minimum yapıdaki sahte session. AuthGate sadece truthy kontrolü
// yapıyor, içerideki user.id'yi de profile.id ile aynı tutuyoruz.
function fakeDemoSession(profile: Profile): Session {
  return {
    access_token: 'demo-token',
    refresh_token: 'demo-refresh',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: profile.id,
      app_metadata: {},
      user_metadata: { full_name: profile.full_name },
      aud: 'demo',
      created_at: profile.created_at,
      email: profile.email,
    },
  } as unknown as Session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Modül yüklendikten beri yeterince zaman geçtiyse initialSessionResolved
  // dolu olur — o durumda hiç splash göstermeden direkt routing'e geçeriz.
  const [session, setSession] = useState<Session | null>(
    initialSessionResolved?.session ?? null,
  );
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(initialSessionResolved === null);
  const [isDemo, setIsDemo] = useState(isDemoActiveStore());
  const profileFetchToken = useRef(0);

  const fetchProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const myToken = ++profileFetchToken.current;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (myToken !== profileFetchToken.current) return; // stale
    if (error) {
      console.warn('[auth] profile fetch error', error.message);
      setProfile(null);
      return;
    }
    // Profile null durumu birden çok nedenle olabilir: JWT expiry (RLS reddi),
    // network gecikmesi, gerçek orphan (auth.users silinmiş). Otomatik signOut
    // false positive üretiyordu (her restart logout). Bunun yerine profile=null
    // bırakıp UI'in empty-state'ine bırakıyoruz; Hesap ekranından kullanıcı manuel
    // signOut yapabilir. Orphan kullanıcılar zaten profile null nedeniyle org-based
    // query'lerden boş sonuç alır (Bug B fix ile spinner sıkışmaz).
    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;
    initialSessionPromise.then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
      fetchProfile(data.session?.user.id);
      // Sentry user context — crash'lerde anonymous yerine gercek user id.
      setSentryUser(data.session?.user.id ?? null, data.session?.user.email);
      // Push token registration (Android only at the moment) — demo
      // session'larda no-op.
      if (data.session?.user.id) {
        registerForPushNotifications(data.session.user.id).catch((e) =>
          console.warn('[push] register on init failed', e),
        );
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      // Demo mod aktifken Supabase auth event'lerini yok say — yoksa demo
      // session'ı silip kullanıcıyı welcome'a atabilir.
      if (isDemoActiveStore()) return;
      setSession(next);
      fetchProfile(next?.user.id);
      setSentryUser(next?.user.id ?? null, next?.user.email);
      if (next?.user.id) {
        registerForPushNotifications(next.user.id).catch((e) =>
          console.warn('[push] register on auth change failed', e),
        );
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      loading,
      isDemo,
      refreshProfile: async () => {
        if (isDemoActiveStore()) {
          // Read the live profile by the signed-in user id — NOT
          // demo.ownerProfile(), which would point us at whoever currently
          // owns the fleet (after a transferOwnership the demo user is no
          // longer the owner but is still the same person).
          const uid = session?.user.id;
          if (uid) setProfile(demo.profileById(uid) ?? null);
          return;
        }
        await fetchProfile(session?.user.id);
      },
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      signInDemo: async () => {
        // activateDemo loads persisted state from AsyncStorage if present,
        // otherwise seeds + saves. Await it so the UI doesn't flash an
        // empty list before hydration finishes.
        await activateDemo();
        const owner = demo.ownerProfile();
        setProfile(owner);
        setSession(fakeDemoSession(owner));
        setIsDemo(true);
        setLoading(false);
        // Sentry user context — demo session'da bile crash'i kime ait
        // soyleyebilelim. beforeSend hook'u demo:true tag'i ekleyebilir
        // ileride; simdilik en azindan id+email var.
        setSentryUser(owner.id, owner.email);
      },
      signUpFleet: async ({ email, password, fullName, companyName }) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              company_name: companyName,
              role: 'owner',
            },
          },
        });
        if (error) throw error;
        return { requiresConfirmation: !data.session };
      },
      signOut: async () => {
        if (isDemoActiveStore()) {
          deactivateDemo();
          setProfile(null);
          setSession(null);
          setIsDemo(false);
          setSentryUser(null);
          return;
        }
        // Push token'i temizle ki silinen oturuma push gitmesin (best-effort).
        const uid = session?.user.id;
        if (uid) {
          clearPushToken(uid).catch((e) => console.warn('[push] clear failed', e));
        }
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        // Sentry user context'ini temizle — onAuthStateChange yine cagrilir
        // ama signOut hatasinda erken donduk, oraya guvenmeyelim.
        setSentryUser(null);
      },
    }),
    [session, profile, loading, isDemo, fetchProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
