import { baseQuery } from '../baseQuery';
import { deleteOpenBills, getCache, setCache } from '../../utils/cache';
import { ensureDB, STORES, setLastSyncTime as setLastSyncTimeMeta } from './queue';
import { triggerQueueRefresh } from './usePendingQueueCount';
import {
  setApiReachable,
  setFailedCount,
  setLastSyncTime,
  setOfflineError,
  setSessionSummary,
  setSyncing,
} from './slice';
import { updateSessionSummary } from '../sales/session/hook';

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

const HISTORY_CACHE_KEY = 'cache_order_history';

// ===== HELPER: map order fields to /sales/sync payload =====

const mapOrderToSync = (order, sessionSyncId) => ({
  sync_id: order?.id ? '' : order?.sync_id,
  id: order?.id,
  code: order?.code,
  bill_name: order?.bill_name,
  origin_session_sync_id: sessionSyncId,
  sales_chnanel_id: order?.sales_chnanel_id,
  membership_id: order?.membership_id,
  service_charge_percentage: order?.service_charge_percentage,
  service_charge_value: order?.service_charge_value,
  discount_percentage: order?.discount_percentage,
  discount_value: order?.discount_value,
  status: order?.status,
  items: mapItemsToSync(order),
  category_discounts: mapCategoryDiscountsToSync(order),
  is_offline_mode: order?.is_offline_mode,

  // fields dibawah ini untuk order yang dibayar atau history
  paid_session_sync_id: sessionSyncId,
  ref_sync_id: order?.ref_sync_id,
  payment_method_id: order?.payment_method_id,
  payment_ref: order?.payment_ref,
  total_payment: order?.total_payment,
  paid_at: order?.paid_at,
});

const mapItemsToSync = order => {
  const sourceItems =
    order.status === 'pending' && (order.original_items || [])?.length > 0
      ? order.original_items || []
      : order.items || [];

  return sourceItems.map(item => ({
    catalog_id: item.catalog_id,
    catalog_name: item.catalog_name || '',
    quantity: item.quantity || 0,
    unit_nett: item.unit_nett || 0,
    addons: (item.addons || []).map(a => ({
      addon_group_id: a.addon_group_id,
      addon_item_id: a.addon_item_id,
      catalog_name: a.catalog_name || '',
      unit_nett: a.unit_nett || 0,
      quantity: a.quantity || 1,
    })),
  }));
};

const mapCategoryDiscountsToSync = order => {
  return order.category_discounts.map(cat => ({
    category_id: cat.category_id,
    discount_percentage: item.discount_percentage,
    discount_value: item.discount_value,
    total_discount: item.total_discount,
    is_discount_percentage: cat.is_discount_percentage,
  }));
};

const mapTopupsToSync = (topups, sessionSyncId) =>
  topups.map(t => ({
    session_sync_id: sessionSyncId,
    card_id: t.card_id,
    nominal: t.nominal || 0,
    payment_type: t.payment_type || '',
    created_at: t.created_at,
  }));

// ===== MAIN SYNC FUNCTION =====

export const syncPendingSessions = async () => {
  console.log('[DEBUG] syncPendingSessions');
  console.log('[DEBUG] storeRef', storeRef);
  if (!storeRef) {
    return;
  }
  if (isSyncingInternal) {
    isSyncingInternal = false;
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }

  const userId = getCurrentUserId();
  if (!userId) {
    return;
  }

  isSyncingInternal = true;
  storeRef.dispatch(setSyncing(true));
  storeRef.dispatch(setOfflineError(null));

  const fakeApi = {
    ...storeRef,
    getState: storeRef.getState,
    dispatch: storeRef.dispatch,
  };

  try {
    const db = await ensureDB(userId);
    const now = new Date().toISOString();

    // ===== 1. MEMBERSHIPS → POST /membership/sync =====
    const memberships = await db.getAll(STORES.memberships);
    if (memberships.length > 0) {
      const payload = {
        members: memberships.map(m => ({
          sync_id: m.sync_id || m.card_id,
          card_id: m.card_id || '',
          name: m.name || '',
          reff_code: m.reff_code || '',
        })),
      };

      for (let attempt = 0; attempt < MAX_RETRY; attempt += 1) {
        try {
          const result = await baseQuery(
            { url: '/membership/sync', method: 'POST', body: payload, __skipOfflineQueue: true },
            fakeApi,
            {}
          );

          if (!result?.error) {
            for (const m of memberships) {
              await db.delete(STORES.memberships, m.sync_id);
            }
          }

          if (!result?.error || !shouldRetry(result.error)) break;
          await sleep(BASE_DELAY * 2 ** attempt);
        } catch {
          await sleep(BASE_DELAY * 2 ** attempt);
        }
      }
    }

    // ===== 2. GROUP ORDERS + TOPUPS BY SESSION ID → POST /sales/sync =====
    const allSessions = await db.getAll(STORES.sessions);
    const allBills = await db.getAll(STORES.orderBills);
    const allPayments = await db.getAll(STORES.orderPayments);
    const allTopups = await db.getAll(STORES.topups);

    console.log('[DEBUG] allBills', allBills);

    // Group by session ID (origin_session_id / paid_session_id / session_sync_id / sessions.sync_id)
    const grouped = {};
    for (const session of allSessions) {
      const sid = session.id || session.sync_id;
      if (!sid) continue;
      if (!grouped[sid]) grouped[sid] = { session: null, orders: [], topups: [] };
      const hasReference = !!session.id;
      const isClosed = !!session.close_at;
      if (isClosed || !hasReference) {
        grouped[sid].session = session;
      }
    }
    for (const bill of allBills) {
      const sid = bill.origin_session_sync_id;
      if (!sid) continue;
      if (!grouped[sid]) grouped[sid] = { session: null, orders: [], topups: [] };
      grouped[sid].orders.push({ ...bill, _store: STORES.orderBills });
    }
    for (const pay of allPayments) {
      const sid = pay.paid_session_sync_id;
      if (!sid) continue;
      if (!grouped[sid]) grouped[sid] = { session: null, orders: [], topups: [] };
      grouped[sid].orders.push({ ...pay, _store: STORES.orderPayments });
    }
    for (const topup of allTopups) {
      const sid = topup.session_sync_id;
      if (!sid) continue;
      if (!grouped[sid]) grouped[sid] = { session: null, orders: [], topups: [] };
      grouped[sid].topups.push({ ...topup, _store: STORES.topups });
    }

    for (const [sessionSyncId, group] of Object.entries(grouped)) {
      let success = false;

      for (let attempt = 0; attempt < MAX_RETRY; attempt += 1) {
        try {
          const payload = {};

          // Session — include kalo ada close_at atau start offline (tanpa id)
          if (group.session) {
            const hasRef = !!group.session.id;
            const isClosed = !!group.session.close_at;
            if (isClosed || !hasRef) {
              payload.session = {
                sync_id: group.session.sync_id,
                open_at: group.session.open_at,
                close_at: group.session.close_at,
                cash_started: group.session.cash_started,
                cash_finished: group.session.cash_finished,
                latitude: group.session.latitude,
                longitude: group.session.longitude,
                battery_health: group.session.battery_health,
              };
            }
          }

          payload.orders = group.orders.map(o => mapOrderToSync(o, sessionSyncId));
          payload.topups = group.topups.map(t => mapTopupsToSync(t, sessionSyncId));

          const result = await baseQuery(
            { url: '/sales/sync', method: 'POST', body: payload, __skipOfflineQueue: true },
            fakeApi,
            {}
          );

          consoel.log('[DEBUG] syncPendingSessions Hit', result);

          if (!result?.error) {
            for (const o of group.orders) {
              await db.delete(o._store, o.sync_id);
            }
            for (const t of group.topups) {
              await db.delete(STORES.topups, t.sync_id);
            }
            cleanupLocalStorageCache();
            triggerQueueRefresh();
            success = true;
            break;
          }

          const status = getStatusCode(result.error);
          if (status === 401) {
            break;
          }

          if (!shouldRetry(result.error)) {
            break;
          }

          await sleep(BASE_DELAY * 2 ** attempt);
        } catch (err) {
          await sleep(BASE_DELAY * 2 ** attempt);
        }
      }
    }

    // Update last sync time
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
  }
};

// ===== INIT ======

let prevUserId = null;

export const initSyncManager = async store => {
  storeRef = store;

  startHeartbeat();

  // Subscribe to auth changes
  store.subscribe(() => {
    const state = store.getState();
    const userId = state?.Auth?.session?.user?.id ?? null;
    if (userId !== prevUserId) {
      prevUserId = userId;
      if (userId) {
        syncPendingSessions();
        startHeartbeat();
      } else {
        storeRef.dispatch(setFailedCount(0));
        triggerQueueRefresh();
        stopHeartbeat();
      }
    }
  });

  if (typeof window !== 'undefined') {
    const onOnline = () => {
      const userId = getCurrentUserId();
      if (!userId) return;

      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        syncPendingSessions();
      }, RECONNECT_DELAY);
    };

    window.addEventListener('online', onOnline);
  }
};

// ===== HEARTBEAT =====

const getSyncingState = () => isSyncingInternal;

const startHeartbeat = () => {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    const state = storeRef?.getState();
    const pendingCount = state?.Offline?.pendingCount || 0;
    if (pendingCount > 0) {
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

// ===== EXPORTS =====

export const syncNow = async () => {
  await syncPendingSessions();
};

export const retryFailedItem = async itemId => {
  if (!storeRef || !itemId) return false;
  const userId = getCurrentUserId();
  if (!userId) return false;

  try {
    const db = await ensureDB(userId);

    // Cari di sessions
    const sessions = await db.getAll(STORES.sessions);
    const found = sessions.find(s => s.sync_id === itemId);
    if (found) {
      found.syncStatus = 'pending';
      await db.put(STORES.sessions, found);
      syncPendingSessions();
      return true;
    }

    // Cari di orders — cek parent session
    const bills = await db.getAll(STORES.orderBills);
    const bill = bills.find(b => b.sync_id === itemId);
    if (bill) {
      const parent = sessions.find(s => s.sync_id === bill.origin_session_sync_id);
      if (parent) {
        parent.syncStatus = 'pending';
        await db.put(STORES.sessions, parent);
        syncPendingSessions();
        return true;
      }
    }

    const payments = await db.getAll(STORES.orderPayments);
    const payment = payments.find(p => p.sync_id === itemId);
    if (payment) {
      const parent = sessions.find(s => s.sync_id === payment.paid_session_sync_id);
      if (parent) {
        parent.syncStatus = 'pending';
        await db.put(STORES.sessions, parent);
        syncPendingSessions();
        return true;
      }
    }
  } catch (e) {
    console.error('[retryFailedItem] error:', e);
  }
  return false;
};

export const removeFailedItem = async itemId => {
  const userId = storeRef?.getState()?.Auth?.session?.user?.id;
  if (!userId || !itemId) return false;

  try {
    const db = await ensureDB(userId);

    // Cek di sessions
    const session = await db.get(STORES.sessions, itemId);
    if (session) {
      // Cascade hapus semua yg terkait
      const bills = await db.getAllFromIndex(STORES.orderBills, 'origin_session_sync_id', itemId);
      for (const b of bills) await db.delete(STORES.orderBills, b.sync_id);
      const payments = await db.getAllFromIndex(
        STORES.orderPayments,
        'paid_session_sync_id',
        itemId
      );
      for (const p of payments) await db.delete(STORES.orderPayments, p.sync_id);
      const topups = await db.getAllFromIndex(STORES.topups, 'session_sync_id', itemId);
      for (const t of topups) await db.delete(STORES.topups, t.sync_id);
      await db.delete(STORES.sessions, itemId);
      return true;
    }

    // Cek di order_bills
    const bill = await db.get(STORES.orderBills, itemId);
    if (bill) {
      await db.delete(STORES.orderBills, itemId);
      // Hapus juga dari cache_openbills kalo ada
      try {
        if (bill?.id) {
          console.log(
            '[DEBUG]: Pikirin gimana cara-nya, karena ini bukan dihapus data-nya, tapi kemablikan ke semua'
          );
        } else {
          deleteOpenBills(itemId);
        }
      } catch (_) {}

      // Recalculate session summary — remove outstanding bill
      try {
        updateSessionSummary({ type: 'bill', outstanding_bill: -1 * bill.total_charges });
      } catch (_) {}

      triggerQueueRefresh();
      return true;
    }

    // Cek di order_payments
    const payment = await db.get(STORES.orderPayments, itemId);
    if (payment) {
      await db.delete(STORES.orderPayments, itemId);
      return true;
    }

    // Cek di topups
    const topup = await db.get(STORES.topups, itemId);
    if (topup) {
      await db.delete(STORES.topups, itemId);
      return true;
    }

    // Cek di memberships
    const membership = await db.get(STORES.memberships, itemId);
    if (membership) {
      await db.delete(STORES.memberships, itemId);
      return true;
    }
  } catch (e) {
    console.error('[removeFailedItem] error:', e);
  }
  return false;
};

export { getSyncingState, startHeartbeat, stopHeartbeat };
