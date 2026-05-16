import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { colors } from '@/theme';

export default function AppLayout() {
  const { session, customer, loading } = useAuth();

  if (loading) return null;

  if (!session) return <Redirect href="/(auth)/welcome" />;
  if (!customer || !customer.full_name) return <Redirect href="/(auth)/profile-setup" />;

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
