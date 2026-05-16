import { Redirect } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';

/**
 * Cold-start gating. AuthProvider initialSession resolve olana kadar
 * RootLayout zaten splash gösteriyor; burada session+customer durumuna göre
 * doğru route'a yönlendir.
 *
 * Kurallar:
 * - session yok                  → /(auth)/welcome
 * - session var ama customer yok → /(auth)/profile-setup  (OTP geçti, profil eksik)
 * - session var + customer var   → /(app)/(tabs)/home
 */
export default function Index() {
  const { session, customer, loading } = useAuth();

  if (loading) return null;

  if (!session) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!customer || !customer.full_name) {
    return <Redirect href="/(auth)/profile-setup" />;
  }

  return <Redirect href="/(app)/(tabs)/home" />;
}
