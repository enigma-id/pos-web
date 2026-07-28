// services/sales/session/hook.js
import { useDispatch, useSelector } from 'react-redux';

import {
  useStartMutation,
  useEndMutation,
  useLazySummaryQuery,
  useLazySessionQuery,
  useLazyShowSessionQuery,
} from './action';
import {
  checkSession,
  invalidateSession,
  setOfflineStartResult,
  clearOfflineStartResult,
} from './slice';
import {
  setSessionSummary,
  clearSessionSummary,
  setOfflineSessionEnded,
  clearOfflineSessionEnded,
  setPendingCount,
} from '../../offline/slice';
import { resetCart } from '../../cart/slice';
import { store } from '../../store';
import useCatalog from '../../catalog/hooks';
import { $failure } from '../../form/action';
import {
  createOfflineSession,
  closeSession,
} from '../../offline/queue';
import { syncPendingSessions } from '../../offline/syncManager';
import { getCache, setCache } from '../../../utils/cache';

// ========== UPDATE SESSION SUMMARY (incremental) ==========

/**
 * Update sessionSummary di Redux secara incremental.
 * Panggil abis save bill, pay, topup — gausah query IndexedDB.
 */
export const updateSessionSummary = (newData) => {
  const state = store.getState();
  const existing = state?.Offline?.sessionSummary || {};

  // Deep clone biar mutable (Redux state immutable)
  const summary = {
    ...existing,
    summary: {
      ...(existing.summary || {}),
      sales: { ...(existing.summary?.sales || {}) },
      cash: { ...(existing.summary?.cash || {}) },
      payment_methods: [...(existing.summary?.payment_methods || [])],
      topups: [...(existing.summary?.topups || [])],
    },
    orders: [...(existing.orders || [])],
  };

  const itemsTotal = (newData.items || []).reduce((s, i) => {
    const itemTotal = Number(i.unit_price || 0) * Number(i.quantity || 0);
    const addonsTotal = (i.addons || []).reduce((asum, a) =>
      asum + Number(a.unit_price || 0) * Number(a.quantity || 0), 0);
    return s + itemTotal + addonsTotal;
  }, 0);

  if (newData.type === 'bill') {
    const serviceCharge = newData.serviceChargeValue || newData.service_charge_value || 0;
    const discount = newData.discountValue || newData.discount_value || 0;
    const totalBill = itemsTotal - discount + serviceCharge;
    summary.summary.sales.outstanding_bill = (summary.summary.sales.outstanding_bill || 0) + totalBill;
    summary.orders.push({
      sync_id: newData.sync_id,
      status: 'pending',
      items: newData.items,
      bill_name: newData.billName || newData.bill_name,
      totalPayment: 0,
    });
  } else if (newData.type === 'payment') {
    const totalPayment = newData.totalPayment || newData.total_payment || 0;
    const serviceCharge = newData.serviceChargeValue || newData.service_charge_value || 0;
    const discount = newData.discountValue || newData.discount_value || 0;
    const itemsTotal = totalPayment - serviceCharge + discount;
    summary.summary.sales.total_sales = (summary.summary.sales.total_sales || 0) + itemsTotal;
    summary.summary.sales.total_discount = (summary.summary.sales.total_discount || 0) + (newData.discountValue || newData.discount_value || 0);
    summary.summary.sales.total_service = (summary.summary.sales.total_service || 0) + serviceCharge;
    summary.summary.sales.grand_total = (summary.summary.sales.grand_total || 0) + totalPayment;
    summary.summary.sales.total_after_discount = (summary.summary.sales.total_after_discount || 0) + (totalPayment - serviceCharge);
    summary.summary.cash.expected_cash = (summary.summary.cash.expected_cash || 0) + totalPayment;

    const pmId = newData.paymentMethodId || newData.payment_method_id || 0;
    const pmIdx = summary.summary.payment_methods.findIndex(p => p.payment_method_id === pmId);
    if (pmIdx >= 0) {
      summary.summary.payment_methods[pmIdx] = {
        ...summary.summary.payment_methods[pmIdx],
        total_paid: (summary.summary.payment_methods[pmIdx].total_paid || 0) + totalPayment,
        count: (summary.summary.payment_methods[pmIdx].count || 0) + 1,
      };
    } else {
      summary.summary.payment_methods.push({
        payment_method_id: pmId,
        total_paid: totalPayment,
        count: 1,
        name: newData.paymentMethodName || newData.payment_method_name || (pmId === 0 ? 'Cash' : `#${pmId}`),
      });
    }

    summary.orders.push({
      sync_id: newData.sync_id,
      status: 'completed',
      items: newData.items,
      bill_name: newData.billName || newData.bill_name,
      totalPayment,
    });
  } else if (newData.type === 'topup') {
    const nominal = newData.nominal || 0;
    summary.summary.cash.topup_cash = (summary.summary.cash.topup_cash || 0) + nominal;
    summary.summary.cash.expected_cash = (summary.summary.cash.expected_cash || 0) + nominal;
    summary.summary.topups.push({
      type: newData.payment_type || 'cash',
      total_nominal: nominal,
    });
  }

  store.dispatch(setSessionSummary(summary));

  // Sync ke cache_shifts biar shifts page offline dapet data detail
  try {
    const SHIFTS_CACHE_KEY = 'cache_shifts';
    const id = summary.id || store.getState()?.Offline?.sessionSummary?.id;
    if (id) {
      const existingShifts = getCache(SHIFTS_CACHE_KEY) || [];
      // Cari index shift yg sama, update atau push baru
      const idx = existingShifts.findIndex(s => s.id === id);
      const { orders: _orders, ...summaryNoOrders } = summary;
      const shiftEntry = {
        id,
        cashier: summaryNoOrders.cashier || { name: '' },
        started_at: summaryNoOrders.started_at,
        finished_at: summaryNoOrders.finished_at,
        status: summaryNoOrders.finished_at ? 'closed' : 'open',
        _offline: true,
        ...summaryNoOrders,
      };
      if (idx >= 0) {
        existingShifts[idx] = shiftEntry;
      } else {
        existingShifts.unshift(shiftEntry);
      }
      setCache(SHIFTS_CACHE_KEY, existingShifts);
    }
  } catch {}

  return summary;
};

const useSession = () => {
  const dispatch = useDispatch();
  const isOnline = useSelector(state => state?.Offline?.isOnline !== false);
  const apiReachable = useSelector(state => state?.Offline?.apiReachable !== false);
  const authSession = useSelector(state => state?.Auth?.session);
  const authUser = useSelector(state => state?.Auth?.user);
  const userId = authSession?.user?.id || authUser?.id;

  const networkOk = isOnline && apiReachable;

  const [startMutation, startResult] = useStartMutation();
  const [endMutation, endResult] = useEndMutation();

  const [triggerSummary, summaryResult] = useLazySummaryQuery();
  const [triggerSession, sessionResult] = useLazySessionQuery();
  const [triggerShow, showResult] = useLazyShowSessionQuery();

  const { refreshCatalog } = useCatalog();

  const start = async data => {
    if (!networkOk) {
      // ===== OFFLINE START =====
      const doc = await createOfflineSession(
        {
          cash_started: data?.cash_started || 0,
        },
        userId
      );

      dispatch(checkSession());
      dispatch(
        setOfflineStartResult({
          sync_id: doc.sync_id,
          is_offline_session: true,
          created_at: doc.createdAt,
          cash_started: doc.cash_started,
        })
      );
      dispatch(resetCart());

      // Set sessionSummary biar bisa dipake close session nanti
      dispatch(setSessionSummary({
        id: doc.sync_id,
        started_at: doc.open_at || doc.createdAt,
        cash_started: doc.cash_started,
        cashier: { name: authUser?.name || '-' },
        summary: {
          sales: { total_sales: 0, total_discount: 0, total_service: 0, grand_total: 0, outstanding_bill: 0, outstanding_bill_payment: 0 },
          cash: { expected_cash: doc.cash_started || 0, topup_cash: 0 },
          payment_methods: [],
          topups: [],
        },
        orders: [],
      }));

      // Set pendingCount incremental
      dispatch(setPendingCount(1));

      // Push ke shifts cache biar muncul di list offline
      try {
        const SHIFTS_CACHE_KEY = 'cache_shifts';
        const existingShifts = getCache(SHIFTS_CACHE_KEY) || [];
        existingShifts.unshift({
          id: doc.sync_id,
          cashier: { name: authUser?.name || '-' },
          started_at: doc.open_at || doc.createdAt,
          finished_at: null,
          status: 'open',
          _offline: true,
        });
        setCache(SHIFTS_CACHE_KEY, existingShifts);
      } catch {}

      return;
    }

    // ===== ONLINE START =====
    try {
      const res = await startMutation(data).unwrap();
      if (res?.message === 'success') {
        dispatch(clearOfflineStartResult());
        refreshCatalog();
        dispatch(resetCart());

        if (res?.data?.is_offline_session) {
          dispatch(checkSession());
        } else {
          summary();
        }
      }
    } catch (err) {
      dispatch($failure(err));
    }
  };

  const end = async data => {

    if (!networkOk) {
      // ===== OFFLINE END =====
      const sessionId = store.getState()?.Offline?.sessionSummary?.id || null;

      if (!sessionId) {
        dispatch(invalidateSession());
        return;
      }

      // Buat session di IndexedDB untuk tracking sync + set close data
      const { ensureDB, STORES } = await import('../../offline/queue');
      const db = await ensureDB(userId);
      const doc = await createOfflineSession(
        {
          cash_started: 0,
        },
        userId
      );

      // Update session dengan close data
      const existing = await db.get(STORES.sessions, doc.sync_id);
      if (existing) {
        existing.close_at = new Date().toISOString();
        existing.cash_finished = data?.cash_finished || 0;
        existing.syncStatus = 'pending';
        await db.put(STORES.sessions, existing);
      }

      // Ambil summary dari Redux cache (udah diupdate incremental)
      const currentSummary = store.getState()?.Offline?.sessionSummary || {};
      currentSummary.finished_at = new Date().toISOString();
      currentSummary.cash_finished = data?.cash_finished || 0;

      dispatch(setSessionSummary(currentSummary));
      dispatch(setOfflineSessionEnded(true));
      dispatch(invalidateSession());
      refreshCatalog();
      dispatch(resetCart());
      dispatch(setPendingCount((store.getState()?.Offline?.pendingCount || 0) + 1));

      // Push ke shifts cache
      try {
        const SHIFTS_CACHE_KEY = 'cache_shifts';
        const existingShifts = getCache(SHIFTS_CACHE_KEY) || [];
        existingShifts.unshift({
          id: sessionId,
          cashier: { name: authUser?.name || '-' },
          started_at: currentSummary?.started_at || new Date().toISOString(),
          finished_at: currentSummary?.finished_at || new Date().toISOString(),
          status: 'closed',
          _offline: true,
        });
        setCache(SHIFTS_CACHE_KEY, existingShifts);
      } catch {}

      return;
    }

    // ===== ONLINE END =====
    try {
      await syncPendingSessions();

      const res = await endMutation(data).unwrap();

      if (res?.message === 'success') {
        refreshCatalog();
        dispatch(resetCart());
      }
    } catch (err) {
      dispatch($failure(err));
    }
  };

  const summary = async () => {
    if (!networkOk) {
      return;
    }

    console.log('[FETCH SUMMARY] calling /sales/session/summary');
    try {
      const res = await triggerSummary().unwrap();
      if (res?.data) {
        dispatch(setSessionSummary(res.data));
        dispatch(checkSession());
        return;
      } else {
        dispatch(invalidateSession());
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[SESSION HOOK] summary error:', err);
      }
    }
  };

  const session = async (params = {}) => {
    try {
      await triggerSession(params).unwrap();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('error:', error);
      }
    }
  };

  const show = async id => {
    try {
      await triggerShow({ id }).unwrap();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('error:', error);
      }
    }
  };

  return {
    start,
    startResult,
    end,
    endResult,
    summary,
    summaryResult,
    session,
    sessionResult,
    show,
    showResult,
  };
};

export default useSession;
