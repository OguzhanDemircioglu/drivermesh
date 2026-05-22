// Supabase client init validateSupabaseUrl çağırıyor + realtime-js Node 22+
// native WebSocket arıyor (Node 20 CI'da yok). Hem env stub hem de
// createClient mock — test'lerde gerçek client init by-pass edilir.
process.env.EXPO_PUBLIC_SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://stub.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'stub-anon-key';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Supabase realtime-js Node < 22'de native WebSocket olmadığı için
// SupabaseClient yaratırken patlar. Pure-logic test'ler client'ı zaten
// kullanmaz — `createClient`'ı stub döndüren bir mock'a indir.
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: jest.fn(() => ({ select: jest.fn(), insert: jest.fn(), update: jest.fn(), delete: jest.fn() })),
    rpc: jest.fn(),
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: jest.fn(),
      signInWithOtp: jest.fn(),
      signOut: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    functions: { invoke: jest.fn() },
    channel: jest.fn(() => ({ on: jest.fn().mockReturnThis(), subscribe: jest.fn() })),
  }),
}));
