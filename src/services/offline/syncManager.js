import { baseQuery } from '../baseQuery';
import {
  getQueue,
  getQueueByStatus,
  removeFromQueue,
  setLastSyncTime as setLastSyncTimeMeta,
  updateQueueItem,
} from './queue';
import {
  setFailedCount,
  setLastSyncTime,
  setOfflineError,
  setPendingCount,
  setQueueItems,
  setSyncing,
  setWarning,
} from './slice';

const MAX_RETRY = 3;
const BASE_DELAY = 1000;
const RECONNECT_DELAY = 3000;
const REMOVE_DELAY = 5000;

let isSyncingInternal = false;
let reconnectTimer = null;
let storeRef = null;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const getStatusCode = error => {
  if (!error) return null;
  if (typeof error?.status === 'number') return error.status;
  if (typeof error?.originalStatus === 'number') return error.originalStatus;
  return null;
};

const shouldRetry = error => {
  const code = getStatusCode(error);
  if (code == null) return true;
  if (code >= 500) return true;
  return false;
};

const broadcastQueueState = async () => {
  if (!storeRef) return;

  const all = await getQueue();
  const pending = all.filter(item => item.status === 'pending');
  const failed = all.filter(item => item.status === 'failed');

  storeRef.dispatch(setQueueItems(all));
  storeRef.dispatch(setPendingCount(pending.length));
  storeRef.dispatch(setFailedCount(failed.length));

  if (pending.length >= 100) {
    storeRef.dispatch(setWarning('Many pending transactions. Contact support.'));
  } else {
    storeRef.dispatch(setWarning(null));
  }
};

const executeQueuedRequest = async item => {
  const args = {
    url: item.url,
    method: item.method,
    body: item.body,
    params: item.params,
    headers: {
      ...(item.headers || {}),
      ...(item.token ? { Authorization: `Bearer ${item.token}` } : {}),
    },
    __skipOfflineQueue: true,
  };

  const fakeApi = {
    ...storeRef,
    getState: storeRef.getState,
    dispatch: storeRef.dispatch,
  };

  return baseQuery(args, fakeApi, {});
};

const markFailed = async (item, message) => {
  await updateQueueItem(item.id, {
    status: 'failed',
    lastError: message || 'Sync failed',
  });
};

// 1. Add a Set to track items currently being synced
const syncingItems = new Set();

// ... existing code ...

const processItem = async item => {
  // 2. Check if this specific item is already being processed
  if (syncingItems.has(item.id)) {
    console.log(`Sync already in progress for item: ${item.id}`);
    return { ok: false };
  }

  // 3. Add to lock
  syncingItems.add(item.id);

  try {
    await updateQueueItem(item.id, { status: 'syncing' });

    for (let attempt = item.retryCount || 0; attempt < MAX_RETRY; attempt += 1) {
      const result = await executeQueuedRequest(item);

      if (!result?.error) {
        await updateQueueItem(item.id, { status: 'completed', retryCount: attempt });
        await sleep(REMOVE_DELAY);
        await removeFromQueue(item.id);
        return { ok: true };
      }

      const status = getStatusCode(result.error);
      if (status === 401) {
        await markFailed(item, 'Authentication expired. Please login again.');
        if (storeRef) {
          storeRef.dispatch(setOfflineError('Session expired during sync. Please login again.'));
        }
        return { ok: false, stop: true };
      }

      if (!shouldRetry(result.error)) {
        await markFailed(item, result?.error?.data?.message || 'Client error, not retried');
        return { ok: false };
      }

      const nextRetryCount = attempt + 1;
      await updateQueueItem(item.id, {
        retryCount: nextRetryCount,
        status: 'pending',
        lastError: result?.error?.data?.message || 'Retrying due to server/network issue',
      });

      const delay = BASE_DELAY * 2 ** attempt;
      await sleep(delay);
    }

    await markFailed(item, 'Max retries reached');
    return { ok: false };
  } finally {
    // 4. Always remove from lock in finally block
    syncingItems.delete(item.id);
  }
};

const sortPendingQueue = items => {
  return [...items].sort((a, b) => {
    const isStartA =
      String(a.url).includes('/sales/session') && !String(a.url).includes('/sales/session/close');
    const isStartB =
      String(b.url).includes('/sales/session') && !String(b.url).includes('/sales/session/close');
    const isEndA = String(a.url).includes('/sales/session/close');
    const isEndB = String(b.url).includes('/sales/session/close');

    if (isStartA && !isStartB) return -1;
    if (!isStartA && isStartB) return 1;
    if (isEndA && !isEndB) return 1;
    if (!isEndA && isEndB) return -1;

    // Maintain FIFO for items with same priority
    const aTime = a?.createdAt || 0;
    const bTime = b?.createdAt || 0;
    return aTime - bTime;
  });
};

export const syncNow = async () => {
  if (!storeRef) return;
  if (isSyncingInternal) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  isSyncingInternal = true;
  storeRef.dispatch(setSyncing(true));
  storeRef.dispatch(setOfflineError(null));

  try {
    let pending = await getQueueByStatus('pending');

    while (pending.length > 0) {
      // Prioritize: Start Session > Transactions > End Session
      const sorted = sortPendingQueue(pending);
      const current = sorted[0];

      const result = await processItem(current);

      const isStartSession =
        String(current.url).includes('/sales/session') &&
        !String(current.url).includes('/sales/session/close');
      if (isStartSession && !result?.ok) {
        if (storeRef) {
          storeRef.dispatch(setOfflineError('Start session failed. Sync halted.'));
        }
        break;
      }

      if (result?.stop) {
        break;
      }

      pending = await getQueueByStatus('pending');
    }

    const now = new Date().toISOString();
    await setLastSyncTimeMeta(now);
    storeRef.dispatch(setLastSyncTime(now));
  } catch (error) {
    if (storeRef) {
      storeRef.dispatch(setOfflineError(error?.message || 'Sync manager error'));
    }
  } finally {
    isSyncingInternal = false;
    if (storeRef) {
      storeRef.dispatch(setSyncing(false));
    }
    await broadcastQueueState();
  }
};

export const retryFailedItem = async id => {
  const all = await getQueue();
  const item = all.find(x => x.id === id);
  if (!item) return false;

  await updateQueueItem(id, { status: 'pending', retryCount: 0, lastError: null });
  await broadcastQueueState();
  await syncNow();
  return true;
};

export const removeFailedItem = async id => {
  await removeFromQueue(id);
  await broadcastQueueState();
  return true;
};

export const initSyncManager = async store => {
  storeRef = store;

  await broadcastQueueState();

  if (typeof window !== 'undefined') {
    const onOnline = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      reconnectTimer = setTimeout(() => {
        syncNow();
      }, RECONNECT_DELAY);
    };

    window.addEventListener('online', onOnline);

    if (typeof navigator === 'undefined' || navigator.onLine) {
      setTimeout(() => {
        syncNow();
      }, RECONNECT_DELAY);
    }
  }
};

export const getSyncingState = () => isSyncingInternal;
