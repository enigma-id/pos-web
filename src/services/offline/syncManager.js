import { baseQuery } from '../baseQuery';
import {
  getPendingSessions,
  getAllSessions,
  getOfflinePendingCount,
  setSyncStatus,
  updateSyncResult,
  deleteOfflineSession,
  setLastSyncTime as setLastSyncTimeMeta,
  STORES,
} from './queue';
import {
  setApiReachable,
  setFailedCount,
  setLastSyncTime,
  setOfflineError,
  setPendingCount,
  setSessions,
  setSyncing,
  setActiveSyncId,
} from './slice';

const MAX_RETRY = 5;
const BASE_DELAY = 1000;
const RECONNECT_DELAY = 3000;
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

const broadcastOfflineState = async () => {
  if (!storeRef) return;

  const userId = getCurrentUserId();
  if (!userId) {
    storeRef.dispatch(setSessions([]));
    storeRef.dispatch(setPendingCount(0));
    storeRef.dispatch(setFailedCount(0));
    return;
  }

  const all = await getAllSessions(userId);
  const failed = all.filter(s => s.syncStatus === 'failed');
  // Hitung total pending items (orders pending + topups)
  const pendingCount = all.reduce((sum, s) => {
    if (s.syncStatus === 'synced') return sum;
    return sum + (s.orders || []).filter(o => o.status === 'pending' || o.status === 'failed').length + (s.topups || []).length;
  }, 0);

  storeRef.dispatch(setSessions(all));
  storeRef.dispatch(setPendingCount(pendingCount));
  storeRef.dispatch(setFailedCount(failed.length));
};

export const syncPendingSessions = async () => {
  if (!storeRef) return;
  if (isSyncingInternal) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  const userId = getCurrentUserId();
  if (!userId) return;

  isSyncingInternal = true;
  storeRef.dispatch(setSyncing(true));
  storeRef.dispatch(setOfflineError(null));

  try {
    const pending = await getPendingSessions(userId);
    const toSync = pending.filter(s => s.syncStatus === 'pending');

    for (const session of toSync) {
      // Prevent duplicate processing
      if (session.syncStatus !== 'pending') continue;

      let success = false;
      await setSyncStatus(session.sync_id, 'syncing', { userId });

      for (let attempt = 0; attempt < MAX_RETRY; attempt += 1) {
        try {
          const sessionId = session.referenceId || session.sync_id;

          const payload = {
            session: session.session.close_at || session.session.open_at
              ? {
                  sync_id: session.sync_id,
                  id: session.referenceId || '',
                  open_at: session.session.open_at,
                  close_at: session.session.close_at,
                  cash_started: session.session.cash_started,
                  cash_finished: session.session.cash_finished,
                  latitude: session.session.latitude,
                  longitude: session.session.longitude,
                  battery_health: session.session.battery_health,
                }
              : null,
            orders: (session.orders || []).map(o => ({
              ...o,     // existing fields (items, catalog_id, quantity, total_payment, etc)
              sync_id: o.sync_id || '',        // client UUID, idempotency key
              id: o.id || o.serverId || '',    // server UUID kalo udah pernah sync
              session_sync_id: o.session_sync_id || sessionId,
            })),
            memberships: session.memberships || [],
            topups: session.topups || [],
          };

          const fakeApi = {
            ...storeRef,
            getState: storeRef.getState,
            dispatch: storeRef.dispatch,
          };

          const result = await baseQuery(
            {
              url: '/sales/sync',
              method: 'POST',
              body: payload,
              __skipOfflineQueue: true,
            },
            fakeApi,
            {}
          );

          if (!result?.error) {
            const response = result?.data?.data || result?.data || {};
            const referenceId = response?.session?.id || response?.id || null;
            const orderMap = {};

            if (Array.isArray(response?.orders)) {
              response.orders.forEach(o => {
                if (o.sync_id && o.id) {
                  orderMap[o.sync_id] = o.id;
                }
              });
            }

            await updateSyncResult(session.sync_id, { referenceId, orderMap }, userId);

            // Hapus dari IndexedDB setelah sync sukses
            await deleteOfflineSession(session.sync_id, userId);

            success = true;
            break;
          }

          const status = getStatusCode(result.error);
          if (status === 401) {
            await setSyncStatus(session.sync_id, 'failed', {
              error: 'Session expired. Please login again.',
              userId,
            });
            break;
          }

          if (!shouldRetry(result.error)) {
            await setSyncStatus(session.sync_id, 'failed', {
              error: result?.error?.data?.message || 'Client error, not retried',
              userId,
            });
            break;
          }

          const delay = BASE_DELAY * 2 ** attempt;
          await sleep(delay);
        } catch (err) {
          const delay = BASE_DELAY * 2 ** attempt;
          await sleep(delay);
        }
      }

      if (!success) {
        await setSyncStatus(session.sync_id, 'failed', {
          error: 'Max retries reached.',
          userId,
        });
      }
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
    await broadcastOfflineState();
  }
};

const syncOfflineState = async () => {
  const userId = getCurrentUserId();
  if (!userId) return;

  const allSessions = await getAllSessions(userId);
  const active = allSessions.find(s => s.syncStatus === 'pending' && !s.session.close_at);

  storeRef.dispatch(setSessions(allSessions));
  storeRef.dispatch(setPendingCount(await getOfflinePendingCount(userId)));
  storeRef.dispatch(setFailedCount(allSessions.filter(s => s.syncStatus === 'failed').length));

  if (active) {
    storeRef.dispatch(setActiveSyncId(active.sync_id));
  }

  if (allSessions.some(s => s.syncStatus === 'pending')) {
    syncPendingSessions();
  }
};

let prevUserId = null;

export const initSyncManager = async store => {
  storeRef = store;

  // Init-time rehydration
  await syncOfflineState();
  await broadcastOfflineState();
  startHeartbeat();

  // Subscribe to auth changes
  store.subscribe(() => {
    const state = store.getState();
    const userId = state?.Auth?.session?.user?.id ?? null;
    if (userId !== prevUserId) {
      prevUserId = userId;
      if (userId) {
        syncOfflineState();
        broadcastOfflineState();
        syncPendingSessions();
        startHeartbeat();
      } else {
        storeRef.dispatch(setSessions([]));
        storeRef.dispatch(setPendingCount(0));
        storeRef.dispatch(setFailedCount(0));
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
        syncPendingSessions();
      }, RECONNECT_DELAY);
    };

    window.addEventListener('online', onOnline);
  }
};

const getSyncingState = () => isSyncingInternal;

// Heartbeat: retry pending/failed sessions
const startHeartbeat = () => {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (!storeRef) return;
    const state = storeRef.getState();
    const pending = state?.Offline?.sessions?.filter(
      s => s.syncStatus === 'pending' || s.syncStatus === 'failed'
    ) || [];
    if (pending.length > 0) {
      syncPendingSessions();
    }
  }, HEARTBEAT_INTERVAL);
};

const stopHeartbeat = () => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
};

export {
  getSyncingState,
  startHeartbeat,
  stopHeartbeat,
};

// ========== BACKWARD COMPAT — retained for UI components (layout, PendingDrawer) ==========
// These no longer operate on individual queue items but are kept as no-ops so existing
// imports don't break. Will be removed in Phase 2 when checkout is refactored.

export const syncNow = async () => {
  await syncPendingSessions();
};

export const retryFailedItem = async () => {
  // Backward compat — no-op in Phase 1
  return false;
};

export const removeFailedItem = async (itemId) => {
  const userId = storeRef?.getState()?.Auth?.session?.user?.id;
  if (!userId || !itemId) return false;

  try {
    const { ensureDB } = await import('./queue');
    const sessions = await getAllSessions(userId);

    for (const s of sessions) {
      const orderIdx = (s.orders || []).findIndex(o => o.sync_id === itemId);
      if (orderIdx !== -1) {
        s.orders.splice(orderIdx, 1);
        const db = await ensureDB(userId);
        await db.put(STORES.offlineSessions, s);
        const fresh = await getAllSessions(userId);
        storeRef.dispatch(setSessions(fresh));
        storeRef.dispatch(setPendingCount(await getOfflinePendingCount(userId)));
        storeRef.dispatch(setFailedCount(fresh.filter(x => x.syncStatus === 'failed').length));
        return true;
      }
    }

    // Maybe session-level ID
    const session = sessions.find(s => s.sync_id === itemId);
    if (session) {
      await deleteOfflineSession(itemId, userId);
      const fresh = await getAllSessions(userId);
      storeRef.dispatch(setSessions(fresh));
      storeRef.dispatch(setPendingCount(await getOfflinePendingCount(userId)));
      storeRef.dispatch(setFailedCount(fresh.filter(x => x.syncStatus === 'failed').length));
      return true;
    }
  } catch (e) {
    console.error('[removeFailedItem] error:', e);
  }
  return false;
};
