import { useEffect, useState } from 'react';
import { checkPermission } from '@/lib/permissions';
import { useAuth } from './AuthProvider';

export type CanResult = {
  allowed: boolean;
  loading: boolean;
  reason: string | null;
};

const REASON_NOT_GRANTED = 'Bu yetki sende yok. Patrondan istemen gerekiyor.';

export function useCan(key: string | null | undefined): CanResult {
  const { profile } = useAuth();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!profile?.id || !key) {
      setAllowed(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    checkPermission(profile.id, key)
      .then((res) => {
        if (cancelled) return;
        setAllowed(res);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        console.warn('[useCan] failed', e);
        setAllowed(false);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.id, key]);

  return { allowed, loading, reason: allowed ? null : REASON_NOT_GRANTED };
}
