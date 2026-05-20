// Offline write queue — AsyncStorage-backed pending mutations.
//
// Pattern: caller `enqueue({ type, args })` çağırır. Network dönüşünde
// `useOnlineSync` hook'u queue'yu flush eder. Her mutation type için
// kayıtlı executor fonksiyonu RPC/REST/SUPABASE çağrısını yapar.
//
// V0.3 PoC: tek mutation type ('set_my_status'). Sonraki sprint'te genel
// mutation registry: job_complete, vehicle_claim, status_set vs.
//
// Idempotency: queue item bir kez execute edilince remove edilir. Race
// veya double-process'i önlemek için flush() concurrent guard'lı (flag).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureException } from './sentry';

const QUEUE_KEY = 'drivermesh.offline.queue.v1';

export type MutationType = 'set_my_status';

export type PendingMutation = {
  id: string;
  type: MutationType;
  args: Record<string, unknown>;
  enqueuedAt: number;
  attempts: number;
};

export type ExecutorMap = {
  [K in MutationType]: (args: Record<string, unknown>) => Promise<void>;
};

let inFlight = false;

async function readQueue(): Promise<PendingMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as PendingMutation[];
  } catch (e) {
    captureException(e, { context: 'offline_queue_read' });
    return [];
  }
}

async function writeQueue(items: PendingMutation[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch (e) {
    captureException(e, { context: 'offline_queue_write' });
  }
}

/**
 * Add a mutation to the pending queue. Caller'ın UI'da optimistic
 * update yaptıktan sonra çağırması beklenir. Network dönünce `flush`
 * tetiklenir.
 */
export async function enqueue(type: MutationType, args: Record<string, unknown>): Promise<void> {
  const item: PendingMutation = {
    id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    args,
    enqueuedAt: Date.now(),
    attempts: 0,
  };
  const items = await readQueue();
  // Aynı mutation type için sondaki kayıt zaten varsa (örn. status hızlıca
  // 3 kez değiştirildi), eski leakları temizle — sadece SON state'i tut.
  // Bu özellikle 'set_my_status' için kritik (idempotent state).
  const filtered = items.filter((m) => m.type !== type);
  filtered.push(item);
  await writeQueue(filtered);
}

/** Pending queue snapshot — UI'da rozetle göstermek için. */
export async function getPending(): Promise<PendingMutation[]> {
  return readQueue();
}

/**
 * Concurrent-safe flush. Her item için executor[type] çağrılır. Başarılı
 * olursa item remove edilir; başarısız olursa attempts++ ve sıraya geri
 * yazılır (max 5 attempt sonra captureException + drop).
 *
 * Returns: { processed, failed, dropped }
 */
export async function flush(executors: ExecutorMap): Promise<{ processed: number; failed: number; dropped: number }> {
  if (inFlight) return { processed: 0, failed: 0, dropped: 0 };
  inFlight = true;
  try {
    const items = await readQueue();
    if (items.length === 0) return { processed: 0, failed: 0, dropped: 0 };

    let processed = 0;
    let failed = 0;
    let dropped = 0;
    const remaining: PendingMutation[] = [];

    for (const item of items) {
      const executor = executors[item.type];
      if (!executor) {
        // Unknown type — drop with telemetry.
        captureException(new Error(`offlineQueue: unknown mutation type ${item.type}`), {
          extra: { item },
        });
        dropped++;
        continue;
      }
      try {
        await executor(item.args);
        processed++;
      } catch (e) {
        const next = { ...item, attempts: item.attempts + 1 };
        if (next.attempts >= 5) {
          captureException(e, { extra: { item: next, reason: 'max_attempts' } });
          dropped++;
        } else {
          failed++;
          remaining.push(next);
        }
      }
    }

    await writeQueue(remaining);
    return { processed, failed, dropped };
  } finally {
    inFlight = false;
  }
}

/** Tüm queue'yu temizle (logout / dev reset için). */
export async function clear(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
