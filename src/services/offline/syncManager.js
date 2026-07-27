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
  // Hitung total items yg perlu sync (semua offline orders + topups)
  const pendingCount = all.reduce((sum, s) => {
    if (s.syncStatus === 'synced') return sum;
    const itemCount = (s.orders || []).length + (s.topups || []).length;
    return sum + (itemCount > 0 ? itemCount : 1);
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
          // Session payload — hanya kirim kalo bener-bener offline session (no referenceId)
          // atau session udah di-close. Kalo cuma reference (start online, masih open) → null
          const hasReference = !!session.referenceId;
          const isClosed = !!session.session?.close_at;
          const sendSession = isClosed || !hasReference;

          const payload = {
            session: sendSession
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
              sync_id: o.sync_id || '',
              id: o.id || o.serverId || '',
              sales_channel_id: o.salesChannelId || o.sales_channel_id,
              sales_channel_name: o.salesChannelName || o.sales_channel_name || '',
              payment_method_id: o.paymentMethodId || o.payment_method_id || null,
              membership_id: o.membershipId || o.membership_id || null,
              payment_ref: o.paymentRef || o.payment_ref || '',
              bill_name: o.billName || o.bill_name || '',
              cashier_name: o.cashierName || o.cashier_name || '',
              service_charge_value: o.serviceChargeValue || o.service_charge_value || 0,
              service_charge_percentage: o.serviceChargePercentage || o.service_charge_percentage || 0,
              discount_percentage: o.discountPercentage || o.discount_percentage || 0,
              discount_value: o.discountValue || o.discount_value || 0,
              category_discounts: (o.categoryDiscounts || o.category_discounts || []).map(cd => ({
                category_id: cd.category_id || cd.id,
                discount_percentage: cd.discount_percentage,
                discount_value: cd.discount_value,
              })),
              // Pending → kirim originalItems (snapshot asli biar backend dapet item penuh)
              items: ((o.status === 'pending' && o.originalItems?.length > 0) ? o.originalItems : (o.items || [])).map(item => ({
                catalog_id: item.catalog_id,
                catalog_name: item.catalog_name || '',
                quantity: item.quantity || 0,
                unit_price: item.unit_price || 0,
                addons: (item.addons || []).map(a => ({
                  addon_group_id: a.addon_group_id,
                  addon_item_id: a.addon_item_id,
                  catalog_name: a.catalog_name || '',
                  unit_price: a.unit_price || 0,
                  quantity: a.quantity || 1,
                })),
              })),
              code: o.code || '',
              status: o.status || 'pending',
              total_payment: o.totalPayment || o.total_payment || 0,
              paid_at: o.paidAt || o.paid_at || null,
              is_offline_mode: true,
              ref_sync_id: o.refSyncId || o.ref_sync_id || '',
              session_sync_id: session.referenceId || session.sync_id,
              // BARU: origin/paid session tracking + isShow + originalItems
              origin_session_sync_id: o.originSessionSyncId || '',
              paid_session_sync_id: o.paidSessionSyncId || '',
              is_show: o.isShow !== false,
              original_items: (o.originalItems || []).map(oi => ({
                catalog_id: oi.catalog_id,
                catalog_name: oi.catalog_name || '',
                quantity: oi.quantity || 0,
                unit_price: oi.unit_price || 0,
                ...(oi.addons?.length > 0 ? {
                  addons: oi.addons.map(a => ({
                    addon_group_id: a.addon_group_id,
                    addon_item_id: a.addon_item_id,
                    catalog_name: a.catalog_name || '',
                    unit_price: a.unit_price || 0,
                    quantity: a.quantity || 1,
                  }))
                } : {}),
                ...(oi.is_custom ? { is_custom: true } : {}),
              })),
            })),
            memberships: (session.memberships || []).map(m => ({
              sync_id: m.sync_id || m.card_id,
              card_id: m.card_id,
              name: m.name || '',
              reff_code: m.reff_code || '',
            })),
            topups: (session.topups || []).map(t => {
              // Cari membership_sync_id dari session.memberships by card_id
              const matchedMember = (session.memberships || []).find(m => String(m.card_id) === String(t.card_id || t.member_card_id));
              return {
                session_sync_id: session.referenceId || t.session_sync_id || session.sync_id,
                membership_id: t.membership_id,
                membership_sync_id: matchedMember?.sync_id || null,
                nominal: t.nominal || 0,
                payment_type: t.payment_type || 'cash',
                card_id: t.card_id || t.member_card_id || '',
                member_name: t.member_name || '',
                member_code: t.member_code || '',
                created_at: t.created_at,
              };
            }),
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

            // Hapus semua offline entries dari history cache — server udah punya data
            try {
              const HISTORY_CACHE_KEY = 'cache_order_history';
              const existing = JSON.parse(localStorage.getItem(HISTORY_CACHE_KEY) || '[]');
              const cleaned = existing.filter(e => !e?.offline_queued);
              if (cleaned.length !== existing.length) {
                localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(cleaned));
              }
            } catch {}

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

export const retryFailedItem = async (itemId) => {
  if (!storeRef || !itemId) return false;
  const userId = getCurrentUserId();
  if (!userId) return false;

  const sessions = await getAllSessions(userId);

  // Cari di orders
  for (const s of sessions) {
    if ((s.orders || []).some(o => o.sync_id === itemId)) {
      await setSyncStatus(s.sync_id, 'pending', { userId });
      syncPendingSessions();
      return true;
    }
  }

  // Cari di topups/memberships
  const found = sessions.find(s =>
    (s.topups || []).some(t => t.sync_id === itemId) ||
    (s.memberships || []).some(m => m.sync_id === itemId)
  );
  if (found) {
    await setSyncStatus(found.sync_id, 'pending', { userId });
    syncPendingSessions();
    return true;
  }

  // Maybe session-level ID
  if (sessions.find(s => s.sync_id === itemId)) {
    await setSyncStatus(itemId, 'pending', { userId });
    syncPendingSessions();
    return true;
  }

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
        const orders = [...(s.orders || [])];
        orders.splice(orderIdx, 1);
        s.orders = orders;
        const db = await ensureDB(userId);
        await db.put(STORES.offlineSessions, s);
        const fresh = await getAllSessions(userId);
        storeRef.dispatch(setSessions(fresh));
        storeRef.dispatch(setPendingCount(await getOfflinePendingCount(userId)));
        storeRef.dispatch(setFailedCount(fresh.filter(x => x.syncStatus === 'failed').length));
        return true;
      }

      const topupIdx = (s.topups || []).findIndex(t => t.sync_id === itemId);
      if (topupIdx !== -1) {
        const topups = [...(s.topups || [])];
        topups.splice(topupIdx, 1);
        s.topups = topups;
        const db = await ensureDB(userId);
        await db.put(STORES.offlineSessions, s);
        const fresh = await getAllSessions(userId);
        storeRef.dispatch(setSessions(fresh));
        storeRef.dispatch(setPendingCount(await getOfflinePendingCount(userId)));
        storeRef.dispatch(setFailedCount(fresh.filter(x => x.syncStatus === 'failed').length));
        return true;
      }

      const memIdx = (s.memberships || []).findIndex(m => m.sync_id === itemId);
      if (memIdx !== -1) {
        const mems = [...(s.memberships || [])];
        mems.splice(memIdx, 1);
        s.memberships = mems;
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
