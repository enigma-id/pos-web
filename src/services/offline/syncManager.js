import { baseQuery } from '../baseQuery';
import {
  getQueue,
  getQueueByStatus,
  removeFromQueue,
  setLastSyncTime as setLastSyncTimeMeta,
  updateQueueItem,
} from './queue';
import {
  setApiReachable,
  setFailedCount,
  setLastSyncTime,
  setOfflineError,
  setPendingCount,
  setQueueItems,
  setSyncing,
  setWarning,
} from './slice';

const MAX_RETRY = 5;
const BASE_DELAY = 1000;
const RECONNECT_DELAY = 3000;
const REMOVE_DELAY = 5000;
const HEARTBEAT_INTERVAL = 30000;

let isSyncingInternal = false;
let reconnectTimer = null;
let heartbeatTimer = null;
let storeRef = null;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const getCurrentUserId = () => {
  if (!storeRef) return null;
  const state = storeRef.getState();
  return state?.Auth?.session?.user?.id ?? null;
};

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

  const userId = getCurrentUserId();
  if (!userId) {
    storeRef.dispatch(setQueueItems([]));
    storeRef.dispatch(setPendingCount(0));
    storeRef.dispatch(setFailedCount(0));
    storeRef.dispatch(setWarning(null));
    return;
  }

  const all = await getQueue(userId);
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
  const isOrder = String(item?.url || '').toLowerCase().includes('/sales/order');

  const body = isOrder && item?.body && typeof item.body === 'object'
    ? { ...item.body, is_offline_mode: true }
    : item.body;

  const args = {
    url: item.url,
    method: item.method,
    body,
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

const markFailed = async (item, message, userId) => {
  await updateQueueItem(item.id, {
    status: 'failed',
    lastError: message || 'Sync failed',
  }, userId);
};

// Tracks items currently being synced to prevent duplicate processing
const syncingItems = new Set();

const processItem = async (item, userId) => {
  // Prevent duplicate processing of the same item
  if (syncingItems.has(item.id)) {
    console.log(`Sync already in progress for item: ${item.id}`);
    return { ok: false };
  }

  // Add to lock
  syncingItems.add(item.id);

  try {
    await updateQueueItem(item.id, { status: 'syncing' }, userId);

    for (let attempt = item.retryCount || 0; attempt < MAX_RETRY; attempt += 1) {
      const result = await executeQueuedRequest(item);

      if (!result?.error) {
        await updateQueueItem(item.id, { status: 'completed', retryCount: attempt }, userId);
        await sleep(REMOVE_DELAY);
        await removeFromQueue(item.id, userId);
        return { ok: true };
      }

      const status = getStatusCode(result.error);
      if (status === 401) {
        await markFailed(item, 'Session expired. Please login again.', userId);
        return { ok: false };
      }

      if (!shouldRetry(result.error)) {
        await markFailed(item, result?.error?.data?.message || 'Client error, not retried', userId);
        return { ok: false };
      }

      const nextRetryCount = attempt + 1;
      await updateQueueItem(item.id, {
        retryCount: nextRetryCount,
        status: 'pending',
        lastError: result?.error?.data?.message || 'Retrying due to server/network issue',
      }, userId);

      const delay = BASE_DELAY * 2 ** attempt;
      await sleep(delay);
    }

    // All retries exhausted — mark failed, require manual retry
    const lastError = 'Max retries reached. Tap to retry manually.';
    await updateQueueItem(item.id, { status: 'failed', lastError, retryCount: MAX_RETRY }, userId);
    return { ok: false };
  } finally {
    // Always remove from lock in finally block
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

  const userId = getCurrentUserId();
  if (!userId) return;

  isSyncingInternal = true;
  storeRef.dispatch(setSyncing(true));
  storeRef.dispatch(setOfflineError(null));

  try {
    let pending = await getQueueByStatus('pending', userId);

    while (pending.length > 0) {
      // Prioritize: Start Session > Transactions > End Session
      const sorted = sortPendingQueue(pending);
      const current = sorted[0];

      const result = await processItem(current, userId);

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

      pending = await getQueueByStatus('pending', userId);
    }

    const now = new Date().toISOString();
    await setLastSyncTimeMeta(now, userId);
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
  const userId = getCurrentUserId();
  if (!userId) return false;

  const all = await getQueue(userId);
  const item = all.find(x => x.id === id);
  if (!item) return false;

  await updateQueueItem(id, { status: 'pending', retryCount: 0, lastError: null }, userId);
  await broadcastQueueState();
  await syncNow();
  return true;
};

export const removeFailedItem = async id => {
  const userId = getCurrentUserId();
  if (!userId) return false;

  await removeFromQueue(id, userId);
  await broadcastQueueState();
  return true;
};

let prevUserId = null;

export const initSyncManager = async store => {
  storeRef = store;

  // Try broadcast immediately (user may already be rehydrated)
  await broadcastQueueState();
  startHeartbeat();

  // Subscribe to auth changes — rehydrate queue state when user logs in/out
  store.subscribe(() => {
    const state = store.getState();
    const userId = state?.Auth?.session?.user?.id ?? null;
    if (userId !== prevUserId) {
      prevUserId = userId;
      broadcastQueueState();
      if (userId) {
        syncNow();
        startHeartbeat();
      } else {
        stopHeartbeat();
      }
    }
  });

  if (typeof window !== 'undefined') {
    const onOnline = () => {
      const userId = getCurrentUserId();
      if (!userId) return;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      reconnectTimer = setTimeout(() => {
        syncNow();
      }, RECONNECT_DELAY);
    };

    window.addEventListener('online', onOnline);
  }
};

const getSyncingState = () => isSyncingInternal;

// Heartbeat: retry pending queue when API is marked dead but browser is online
const startHeartbeat = () => {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (!storeRef) return;
    const state = storeRef.getState();
    if (state?.Offline?.apiReachable === false && state?.Offline?.pendingCount > 0) {
      syncNow();
    }
  }, HEARTBEAT_INTERVAL);
};

const stopHeartbeat = () => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
};

export { getSyncingState, startHeartbeat, stopHeartbeat };
