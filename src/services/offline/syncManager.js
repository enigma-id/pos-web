import { baseQuery } from '../baseQuery';
import { ensureDB, STORES, setLastSyncTime as setLastSyncTimeMeta } from './queue';
import {
  setApiReachable,
  setFailedCount,
  setLastSyncTime,
  setNetworkState,
  setOfflineError,
  setSyncing,
} from './slice';
import { triggerQueueRefresh } from './usePendingQueueCount';

const MAX_RETRY = 5;
const BASE_DELAY = 1000;
const RECONNECT_DELAY = 3000;
const HEARTBEAT_INTERVAL = 30000;
const PROBE_TIMEOUT = 10000;

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

// ===== HELPER: map order fields to /sales/sync payload =====

const mapOrderToSync = order => ({
  sync_id: order?.id ? '' : order?.sync_id,
  id: order?.id,
  code: order?.code,
  bill_name: order?.bill_name,
  origin_session_sync_id: order?.session?.id || order?.session?.sync_id,
  sales_channel_id: order?.sales_channel_id,
  membership_id: order?.membership_id,
  membership_sync_id: order?.membership_id ? '' : order?.membership_sync_id,
  service_charge_percentage: order?.service_charge_percentage,
  service_charge_value: order?.service_charge_value,
  discount_percentage: order?.discount_percentage,
  discount_value: order?.discount_value,
  status: order?.status,
  items: mapItemsToSync(order),
  category_discounts: mapCategoryDiscountsToSync(order),
  is_offline_mode: order?.is_offline_mode,

  // fields dibawah ini untuk order yang dibayar atau history
  paid_session_sync_id:
    order?.status === 'completed' ? order?.paid_session?.id || order?.paid_session?.sync_id : '',
  ref_sync_id: order?.status === 'completed' ? order?.ref_sync_id : '',
  payment_method_id: order?.status === 'completed' ? order?.payment_method_id : '',
  payment_ref: order?.status === 'completed' ? order?.payment_ref : '',
  total_payment: order?.status === 'completed' ? order?.total_payment : null,
  paid_at: order?.status === 'completed' ? order?.paid_at : null,
});

const mapItemsToSync = order => {
  return (order?.items || []).map(item => ({
    catalog_id: item.catalog_id,
    category_id: item.category_id,
    catalog_name: item.catalog_name || '',
    category_name: item.category_name || '',
    quantity: item.quantity || 0,
    unit_nett: item.unit_nett || 0,
    addons: (item.addons || []).map(a => ({
      addon_group_id: a.addon_group_id,
      addon_item_id: a.addon_item_id ?? a.catalog_id,
      catalog_name: a.catalog_name || '',
      unit_nett: a.unit_nett || 0,
      quantity: a.quantity || 1,
    })),
  }));
};

const mapCategoryDiscountsToSync = order => {
  return (order?.category_discounts || []).map(cat => ({
    category_id: cat.category_id,
    discount_percentage: cat.discount_percentage,
    discount_value: cat.discount_value,
    total_discount: cat.total_discount,
    is_discount_percentage: cat.is_discount_percentage,
  }));
};

const mapTopupsToSync = (topups, sessionSyncId) =>
  (topups || []).map(t => ({
    session_sync_id: sessionSyncId,
    card_id: t.card_id || '',
    membership_id: t.membership_id || '',
    nominal: t.nominal || 0,
    payment_type: t.payment_type || '',
    reference_code: t.reference_code,
    created_at: t.created_at,
  }));

// ===== MAIN SYNC FUNCTION =====

export const syncPendingSessions = async () => {
  if (!storeRef) {
    return;
  }

  const userId = getCurrentUserId();
  if (!userId) {
    return;
  }

  // Anti-reentrant: kalo sync udah jalan, jangan masuk lagi.
  // Beda dengan jalur lain — panggilan kedua ini di-skip dengan pesan jelas,
  // bukan silent return (yang bikin kelihatan "mati").
  if (isSyncingInternal) {
    return;
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }

  isSyncingInternal = true;
  storeRef.dispatch(setSyncing(true));
  storeRef.dispatch(setOfflineError(null));
  const fakeApi = {
    ...storeRef,
    getState: storeRef.getState,
    dispatch: storeRef.dispatch,
    // RTK fetchBaseQuery butuh `api.signal` untuk anySignal(timeout) —
    // store Redux gak punya. Tanpa ini, sync crash: "Cannot read properties
    // of undefined (reading 'aborted')".
    signal: new AbortController().signal,
  };

  try {
    const db = await ensureDB(userId);
    const now = new Date().toISOString();

    let hadSyncFailure = false;

    // Flag: true jika ada data pending yang benar-benar diproses. Dipakai buat
    // ngehindarin `setLastSyncTime` yang gak perlu — kalau queue kosong, jangan
    // advance lastSyncTime (nyebabin re-fetch summary dobel di layout).
    let hadPendingData = false;

    // ===== 1. MEMBERSHIPS → POST /membership/sync =====
    const memberships = await db.getAll(STORES.memberships);
    if (memberships.length > 0) {
      hadPendingData = true;
      const payload = {
        members: memberships.map(m => ({
          id: m.id,
          sync_id: m.id ? '' : m.sync_id,
          card_id: m.card_id,
          name: m.name,
          reff_code: m.reff_code,
        })),
      };

      for (let attempt = 0; attempt < MAX_RETRY; attempt += 1) {
        try {
          const result = await baseQuery(
            {
              url: '/membership/sync',
              method: 'POST',
              body: payload,
              __skipOfflineQueue: true,
              timeout: 30000,
            },
            fakeApi,
            {}
          );
          if (!result?.error) {
            for (const m of memberships) {
              await db.delete(STORES.memberships, m.sync_id);
            }
          }

          if (!result?.error) {
            hadSyncFailure = false;
            break;
          }

          if (!shouldRetry(result.error)) {
            hadSyncFailure = true;
            break;
          }

          // retry habis → anggap gagal
          if (attempt === MAX_RETRY - 1) {
            hadSyncFailure = true;
          }

          await sleep(BASE_DELAY * 2 ** attempt);
        } catch (err) {
          // error non-retryable → gagal
          hadSyncFailure = true;
          await sleep(BASE_DELAY * 2 ** attempt);
        }
      }
    }

    // ===== 2. GROUP ORDERS + TOPUPS BY SESSION ID → POST /sales/sync =====
    const allSessions = await db.getAll(STORES.sessions);
    const allBills = await db.getAll(STORES.orderBills);
    const allPayments = await db.getAll(STORES.orderPayments);
    const allTopups = await db.getAll(STORES.topups);
    if (
      allSessions.length > 0 ||
      allBills.length > 0 ||
      allPayments.length > 0 ||
      allTopups.length > 0
    ) {
      hadPendingData = true;
    }

    // Group by session ID (origin_session_id / paid_session_id / session_sync_id / sessions.sync_id)
    const grouped = {};
    for (const session of allSessions) {
      const sid = session.id || session.sync_id;
      if (!sid) continue;
      if (!grouped[sid]) grouped[sid] = { session: null, orders: [], topups: [] };
      const hasReference = !!session.id;
      // Closed session = status 'closed' ATAU finished_at bukan zero date
      // ("0001-01-01T00:00:00Z"). Stored doc pakai field finished_at, bukan
      // close_at — session yang baru open punya finished_at zero date sentinel
      // dari makeStartSession.
      const isClosed =
        session.status === 'closed' ||
        (!!session.finished_at && session.finished_at !== '0001-01-01T00:00:00Z');
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
      for (let attempt = 0; attempt < MAX_RETRY; attempt += 1) {
        try {
          const payload = {};

          // Session — include kalo ada close_at atau start offline (tanpa id)
          if (group.session) {
            payload.session = {
              id: group?.session?.id,
              sync_id: group.session.sync_id,
            };

            if (group.session.sync_type === 'both' || group.session.sync_type === 'opened') {
              payload.session.open_at = group.session.started_at;
              payload.session.cash_started = group.session.cash_started;
            }

            if (group.session.sync_type === 'both' || group.session.sync_type === 'closed') {
              payload.session.close_at = group.session.finished_at;
              payload.session.cash_finished = group.session.cash_finished;
            }
          }

          payload.orders = group.orders.map(o => mapOrderToSync(o));
          payload.topups = mapTopupsToSync(group.topups, sessionSyncId);
          const result = await baseQuery(
            {
              url: '/sales/sync',
              method: 'POST',
              body: payload,
              __skipOfflineQueue: true,
              timeout: 30000,
            },
            fakeApi,
            {}
          );
          if (!result?.error) {
            hadSyncFailure = false;
            for (const o of group.orders) {
              await db.delete(o._store, o.sync_id);
            }
            for (const t of group.topups) {
              await db.delete(STORES.topups, t.sync_id);
            }
            // Session yang udah synced ga perlu disimpen di IDB —
            // nanti bakal di-fetch ulang dari server pas online.
            if (group.session) {
              await db.delete(STORES.sessions, group.session.sync_id);
            }

            break;
          }

          const status = getStatusCode(result.error);
          if (status === 401) {
            hadSyncFailure = true;
            break;
          }

          if (!shouldRetry(result.error)) {
            hadSyncFailure = true;
            break;
          }

          // retry habis → anggap gagal
          if (attempt === MAX_RETRY - 1) {
            hadSyncFailure = true;
          }

          await sleep(BASE_DELAY * 2 ** attempt);
        } catch (err) {
          await sleep(BASE_DELAY * 2 ** attempt);
        }
      }
    }

    triggerQueueRefresh();

    // Update last sync time — hanya kalau ada data yang diproses. Queue kosong
    // jangan advance (hindari re-fetch summary dobel di layout).
    if (hadPendingData) {
      await setLastSyncTimeMeta(now, userId);
      storeRef.dispatch(setLastSyncTime(now));
    }
    storeRef.dispatch(setFailedCount(hadSyncFailure ? 1 : 0));
  } catch (error) {
    if (storeRef) {
      storeRef.dispatch(setOfflineError(error?.message || 'Sync manager error'));
      storeRef.dispatch(setFailedCount(1));
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

      probeServer();

      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        // Gak reset isSyncingInternal di sini — anti-reentrant harus dijaga.
        // Kalau sync masih jalan beneran, skip via guard (log jelas).
        // Kalau ke-stuck (hang), timeout 30s di baseQuery udah jamin lock lepas.
        syncPendingSessions();
      }, RECONNECT_DELAY);
    };

    window.addEventListener('online', onOnline);
  }
};

// ===== API REACHABILITY PROBE =====

// navigator.onLine cuma bilang device punya interface jaringan (mis. WiFi nyambung),
// bukan internet yang beneran nyala. Probe ringan ke API tiap heartbeat biar
// Offline.apiReachable akurat walau user lagi idle di page (gak ada request lain).
const classifyProbeResult = result => {
  if (!result?.error) return { reachable: true, isNetworkError: false };
  const status = result.error.status;
  const isNetworkError =
    status == null ||
    status === 'TIMEOUT_ERROR' ||
    status === 'FETCH_ERROR' ||
    status === 'PARSING_ERROR';
  const isServerError = typeof status === 'number' && status >= 500;

  // reachable: buat Offline.apiReachable (network error / 5xx = gak reachable).
  // isNetworkError: buat Offline.isOnline — 5xx/4xx tetep online, server nyaut.
  return {
    reachable: !(isNetworkError || isServerError),
    isNetworkError,
  };
};

const probeServer = async () => {
  if (!storeRef) return;
  const state = storeRef.getState();
  if (!state?.Auth?.session?.user?.id) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  const fakeApi = {
    ...storeRef,
    getState: storeRef.getState,
    dispatch: storeRef.dispatch,
    signal: new AbortController().signal,
  };

  try {
    const result = await baseQuery(
      { url: '/payment-method', method: 'GET', __skipOfflineQueue: true, timeout: PROBE_TIMEOUT },
      fakeApi,
      {}
    );

    const { reachable, isNetworkError } = classifyProbeResult(result);
    storeRef.dispatch(setApiReachable(reachable));

    // navigator.onLine gak ngasih tau kalo koneksi beneran putus (mis. WiFi nyambung
    // tapi internet mati). Network error = offline; reducer slice yang jagain
    // invariant-nya: isOnline=false ⇒ apiReachable=false, dan sebaliknya
    // apiReachable=true (waktu probe sukses lagi) ⇒ isOnline=true.
    if (isNetworkError) {
      storeRef.dispatch(setNetworkState({ isOnline: false, wasOffline: false }));
    }
  } catch {
    // baseQuery udah handle error detection; biarkan state terakhir.
  }
};

// ===== HEARTBEAT =====

const getSyncingState = () => isSyncingInternal;

const startHeartbeat = () => {
  stopHeartbeat();
  probeServer();
  heartbeatTimer = setInterval(() => {
    const state = storeRef?.getState();
    const pendingCount = state?.Offline?.pendingCount || 0;
    probeServer();
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

/**
 * Force sync — dipakai tombol Retry (layout banner) & PendingDrawer refresh.
 * Reset lock dulu biar sync bener-bener jalan, walau `isSyncingInternal`
 * ke-stuck `true` dari sync sebelumnya yang hang (timeout 30s biar gak hang selamanya).
 */
export const syncNow = async () => {
  if (isSyncingInternal) {
    isSyncingInternal = false;
  }
  await syncPendingSessions();
};

export { getSyncingState, startHeartbeat, stopHeartbeat };
