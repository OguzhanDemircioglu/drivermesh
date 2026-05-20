// AsyncStorage mock — testlerde gerçek native storage'a dokunmaz.
// Supabase init validateSupabaseUrl çağırıyor; test env'inde stub değer
process.env.EXPO_PUBLIC_SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://stub.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'stub-anon-key';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Sentry no-op — captureException test loglarında patlamasın.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  addBreadcrumb: jest.fn(),
  withScope: jest.fn(),
}));
