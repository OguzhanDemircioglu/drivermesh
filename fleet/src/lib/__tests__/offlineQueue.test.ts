// AsyncStorage jest.setup.js'de mock'lu. Burada queue davranışını
// pure-logic olarak doğruluyoruz: enqueue → flush → executor başarısı
// remove eder, başarısızlık attempts++; 5 attempt sonra drop.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueue, flush, getPending, clear } from '../offlineQueue';

beforeEach(async () => {
  await AsyncStorage.clear();
  await clear();
});

describe('offlineQueue', () => {
  it('enqueue persists item to AsyncStorage', async () => {
    await enqueue('set_my_status', { status: 'active' });
    const pending = await getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].type).toBe('set_my_status');
    expect(pending[0].args).toEqual({ status: 'active' });
    expect(pending[0].attempts).toBe(0);
  });

  it('enqueue replaces previous mutation of same type (last-writer-wins)', async () => {
    await enqueue('set_my_status', { status: 'active' });
    await enqueue('set_my_status', { status: 'break' });
    const pending = await getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].args).toEqual({ status: 'break' });
  });

  it('flush removes successful items and reports processed count', async () => {
    await enqueue('set_my_status', { status: 'active' });
    const executor = jest.fn().mockResolvedValue(undefined);

    const result = await flush({ set_my_status: executor });

    expect(executor).toHaveBeenCalledWith({ status: 'active' });
    expect(result).toEqual({ processed: 1, failed: 0, dropped: 0 });
    expect(await getPending()).toHaveLength(0);
  });

  it('flush keeps failed items with incremented attempts', async () => {
    await enqueue('set_my_status', { status: 'active' });
    const executor = jest.fn().mockRejectedValue(new Error('network'));

    const result = await flush({ set_my_status: executor });

    expect(result).toEqual({ processed: 0, failed: 1, dropped: 0 });
    const pending = await getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].attempts).toBe(1);
  });

  it('flush drops items after 5 attempts', async () => {
    await enqueue('set_my_status', { status: 'active' });
    const executor = jest.fn().mockRejectedValue(new Error('network'));

    for (let i = 0; i < 5; i++) {
      await flush({ set_my_status: executor });
    }

    const pending = await getPending();
    expect(pending).toHaveLength(0);
  });

  it('flush returns early when queue is empty', async () => {
    const executor = jest.fn();
    const result = await flush({ set_my_status: executor });
    expect(result).toEqual({ processed: 0, failed: 0, dropped: 0 });
    expect(executor).not.toHaveBeenCalled();
  });
});
