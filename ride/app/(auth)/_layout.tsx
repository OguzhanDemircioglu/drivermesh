import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { colors } from '@/theme';

export default function AuthLayout() {
  const { session, customer, loading } = useAuth();

  if (loading) return null;

  // Oturum + profil tamamsa (app)'a yönlen.
  if (session && customer?.full_name) {
    return <Redirect href="/(app)/(tabs)/home" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
