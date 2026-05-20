// Supabase client init validateSupabaseUrl çağırıyor; test sırasında env yok →
// stub env injekte et, gerçek network gitmez (test'ler mock'lu çalışır).
process.env.EXPO_PUBLIC_SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://stub.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'stub-anon-key';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  addBreadcrumb: jest.fn(),
  withScope: jest.fn(),
}));
