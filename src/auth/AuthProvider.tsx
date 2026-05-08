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
import type { Profile } from '@/lib/database.types';
import {
  activateDemo,
  deactivateDemo,
  demo,
  isDemoActive as isDemoActiveStore,
} from '@/demo/store';

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

// Eager kick-off: AsyncStorage'tan token okumayı module load anında başlat,
// AuthProvider mount edildiğinde Promise muhtemelen hazır olur.
const initialSessionPromise = supabase.auth.getSession();

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
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
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
    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;
    initialSessionPromise.then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
      fetchProfile(data.session?.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      // Demo mod aktifken Supabase auth event'lerini yok say — yoksa demo
      // session'ı silip kullanıcıyı welcome'a atabilir.
      if (isDemoActiveStore()) return;
      setSession(next);
      fetchProfile(next?.user.id);
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
          return;
        }
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
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
