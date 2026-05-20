import { useRouter } from 'expo-router';

export type TabKey = 'home' | 'jobs' | 'fleet' | 'account';

/**
 * BottomNav <-> Expo Router glue. Aktif sekme parametre olarak gelir;
 * her sekme tap'inde router.push hedefine yönlendirir. Aynı sekmeye
 * tekrar basmak no-op.
 *
 * Kullanım: `const nav = useBottomNavRouter('jobs'); ... <BottomNav {...nav} />`
 */
export function useBottomNavRouter(active: TabKey) {
  const router = useRouter();
  const onChange = (next: TabKey) => {
    if (next === active) return;
    switch (next) {
      case 'home':
        router.push('/(app)');
        return;
      case 'jobs':
        router.push('/(app)/jobs');
        return;
      case 'fleet':
        router.push('/(app)/vehicles');
        return;
      case 'account':
        router.push('/(app)/account');
        return;
    }
  };
  return { active, onChange };
}
