import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { flush, type ExecutorMap } from '@/lib/offlineQueue';
import { useOnline } from '@/hooks/useOnline';
import { captureException } from '@/lib/sentry';

/**
 * Mutation registry. Her offline queue item type için RPC/REST executor.
 * Yeni mutation type eklenince burada da kaydedilmeli (offlineQueue.ts
 * MutationType union'ı ile senkron).
 */
const EXECUTORS: ExecutorMap = {
  set_my_status: async (args) => {
    const { error } = await (
      supabase as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      }
    ).rpc('set_my_status', args);
    if (error) throw new Error(error.message);
  },
};

/**
 * Online dönüşünde pending mutation queue'yu otomatik flush eder.
 * Root layout'ta bir kez çağrılması yeterli — internal state offline→online
 * transition'unu yakalar.
 */
export function useOnlineSync() {
  const online = useOnline();
  const prevOnlineRef = useRef<boolean>(online);

  useEffect(() => {
    const wasOffline = !prevOnlineRef.current;
    const nowOnline = online;
    prevOnlineRef.current = online;

    if (wasOffline && nowOnline) {
      // Offline → online transition: flush queue.
      void (async () => {
        try {
          const result = await flush(EXECUTORS);
          if (result.processed > 0 || result.dropped > 0) {
            console.log('[offline-sync] flush result:', result);
          }
        } catch (e) {
          captureException(e, { context: 'online_sync_flush' });
        }
      })();
    }
  }, [online]);
}
