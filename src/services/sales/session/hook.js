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
  setActiveSyncId,
  clearActiveSyncId,
  setOfflineStartResult,
  clearOfflineStartResult,
} from './slice';
import {
  setOfflineSummary,
  clearOfflineSummary,
  setOfflineSessionEnded,
  clearOfflineSessionEnded,
  setPendingCount,
  setSessions,
} from '../../offline/slice';
import { resetCart } from '../../cart/slice';
import useCatalog from '../../catalog/hooks';
import { $failure } from '../../form/action';
import {
  createOfflineSession,
  getActiveSession,
  getAllSessions,
  getActiveSessionId,
  updateSessionClose,
} from '../../offline/queue';
import { syncPendingSessions } from '../../offline/syncManager';

// ========== OFFLINE SUMMARY HELPER ==========

const computeOrderItemTotal = (items = []) => {
  return items.reduce((sum, i) => {
    const itemTotal = (Number(i.unit_price) || 0) * (Number(i.quantity) || 0);
    const addonsTotal = (i.addons || []).reduce((asum, a) =>
      asum + (Number(a.unit_price) || 0) * (Number(a.quantity) || 0), 0
    );
    return sum + itemTotal + addonsTotal;
  }, 0);
};

export const computeOfflineSummary = (session, currentSessionSyncId, authUser) => {
  const orders = session.orders || [];
  const topups = session.topups || [];

  const completedOrders = orders.filter(o =>
    o.status === 'completed' && o.paidSessionSyncId === currentSessionSyncId
  );
  const pendingOrders = orders.filter(o =>
    o.status === 'pending' && o.originSessionSyncId === currentSessionSyncId && o.isShow !== false
  );
  const crossSessionOrders = orders.filter(o =>
    o.status === 'completed' && o.originSessionSyncId && o.paidSessionSyncId &&
    o.originSessionSyncId !== o.paidSessionSyncId
  );

  const totalSales = completedOrders.reduce((sum, o) => sum + (o.totalPayment || 0), 0);
  const totalDiscount = completedOrders.reduce((sum, o) => sum + (o.discountValue || 0), 0);
  const totalService = completedOrders.reduce((sum, o) => sum + (o.serviceChargeValue || 0), 0);
  const totalAfterDiscount = totalSales - totalDiscount;
  const grandTotal = totalAfterDiscount + totalService;
  const outstandingBill = pendingOrders.reduce((sum, o) => {
    return sum + (o.totalPayment || computeOrderItemTotal(o.items));
  }, 0);
  const outstandingBillPayment = crossSessionOrders.reduce((sum, o) => sum + (o.totalPayment || 0), 0);

  // Payment methods breakdown
  const pmMap = {};
  completedOrders.forEach(o => {
    const id = o.paymentMethodId || 0;
    if (!pmMap[id]) pmMap[id] = { payment_method_id: id, total_paid: 0, count: 0, name: o.paymentMethodId === 0 ? 'Cash' : '-' };
    pmMap[id].total_paid += o.totalPayment || 0;
    pmMap[id].count += 1;
  });

  // Topup summary
  const topupCash = topups.filter(t => t.payment_type === 'cash').reduce((sum, t) => sum + (t.nominal || 0), 0);

  return {
    started_at: session.session.open_at,
    finished_at: session.session.close_at || new Date().toISOString(),
    cash_started: session.session.cash_started,
    cash_finished: session.session.cash_finished,
    cashier: { name: authUser?.name || '-' },
    summary: {
      sales: {
        total_sales: totalSales,
        total_discount: totalDiscount,
        total_after_discount: totalAfterDiscount,
        total_service: totalService,
        grand_total: grandTotal,
        outstanding_bill: outstandingBill,
        outstanding_bill_payment: outstandingBillPayment,
      },
      cash: {
        expected_cash: (session.session.cash_started || 0) + totalSales + topupCash,
        topup_cash: topupCash,
      },
      payment_methods: Object.values(pmMap),
      category_solds: [],
      topups: topups.map(t => ({
        type: t.payment_type || 'cash',
        total_nominal: t.nominal || 0,
      })),
    },
    orders: orders,
  };
};

const getDeviceInfo = async () => {
  const info = {};

  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 300000,
      });
    });
    info.latitude = pos.coords.latitude;
    info.longitude = pos.coords.longitude;
  } catch (e) {
    // Geolocation unavailable or permission denied
    console.log(e);
  }

  try {
    const battery = await navigator.getBattery();
    info.battery_level = `${Math.round(battery.level * 100)}`;
  } catch (e) {
    // Battery API unavailable
    console.log(e);
  }

  return info;
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
    const deviceInfo = await getDeviceInfo();

    if (!networkOk) {
      // ===== OFFLINE START =====
      const doc = await createOfflineSession(
        {
          cash_started: data?.cash_started || 0,
          latitude: deviceInfo.latitude,
          longitude: deviceInfo.longitude,
          battery_health: deviceInfo.battery_level,
        },
        userId
      );

      dispatch(clearOfflineSummary());
      dispatch(checkSession());
      dispatch(setActiveSyncId(doc.sync_id));
      dispatch(
        setOfflineStartResult({
          sync_id: doc.sync_id,
          is_offline_session: true,
          created_at: doc.createdAt,
          cash_started: doc.session.cash_started,
        })
      );
      dispatch(resetCart());

      // Sync ke Redux biar PendingDrawer — Tab Shift kebaca
      const allSess = await getAllSessions(userId);
      dispatch(setSessions(allSess));
      dispatch(setPendingCount(allSess.filter(s => s.syncStatus !== 'synced').length));
      return;
    }

    // ===== ONLINE START =====
    try {
      const res = await startMutation({ ...data, ...deviceInfo }).unwrap();
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
      const activeId = await getActiveSessionId(authSession, userId);

      if (!activeId) {
        // No active session found — just dispatch cleanup
        dispatch(invalidateSession());
        dispatch(clearActiveSyncId());
        return;
      }

      let computedSummary = {};

      if (activeId.source === 'server') {
        // Start online → close offline (BE Case 1): create offlineSession with referenceId
        // syncManager sends POST /sales/sync { session.id: server-uuid, close_at, cash_finished }
        const deviceInfo = await getDeviceInfo();
        const { createOfflineSession } = await import('../../offline/queue');

        // Use REAL API data from summaryResult if available (start was online)
        const apiData = summaryResult?.data?.data;

        // Buat offline session untuk tracking close, tapi summary pake data real dari API
        const doc = await createOfflineSession(
          {
            cash_started: apiData?.cash_started || 0,
            latitude: deviceInfo.latitude,
            longitude: deviceInfo.longitude,
            battery_health: deviceInfo.battery_level,
          },
          userId
        );

        // Set referenceId = server UUID + close data, keep syncStatus = pending
        // syncManager akan kirim { session.id: referenceId, close_at, cash_finished }
        const { setSyncStatus } = await import('../../offline/queue');
        const { updateSyncResult } = await import('../../offline/queue');
        await updateSyncResult(doc.sync_id, { referenceId: activeId.id }, userId);
        await updateSessionClose(
          doc.sync_id,
          {
            cash_finished: data?.cash_finished || 0,
            latitude: deviceInfo.latitude,
            longitude: deviceInfo.longitude,
            battery_health: deviceInfo.battery_level,
          },
          userId
        );
        // Reset syncStatus to pending so syncManager picks it up
        await setSyncStatus(doc.sync_id, 'pending', { userId });

        const closedAt = new Date().toISOString();
        computedSummary = {
          id: apiData?.id,
          started_at: apiData?.started_at || doc.session.open_at,
          finished_at: closedAt,
          cash_started: apiData?.cash_started || doc.session.cash_started,
          cash_finished: data?.cash_finished || 0,
          cashier: apiData?.cashier || { name: authUser?.name || '-' },
          outlet: apiData?.outlet,
          summary: apiData?.summary || {
            sales: {
              total_sales: 0,
              total_discount: 0,
              total_after_discount: 0,
              total_service: 0,
              grand_total: 0,
              outstanding_bill: 0,
              outstanding_bill_payment: 0,
            },
            cash: { expected_cash: doc.session.cash_started, topup_cash: 0 },
            payment_methods: [],
            category_solds: [],
            topups: [],
          },
          orders: apiData?.orders || [],
        };
      } else {
        // Start was offline → update existing session close
        const deviceInfo = await getDeviceInfo();
        await updateSessionClose(
          activeId.id,
          {
            cash_finished: data?.cash_finished || 0,
            latitude: deviceInfo.latitude,
            longitude: deviceInfo.longitude,
            battery_health: deviceInfo.battery_level,
          },
          userId
        );

        // Read updated session for summary
        const allSessions = await getAllSessions(userId);
        const updated = allSessions.find(s => s.sync_id === activeId.id);

        if (updated) {
          const summarySessionId = updated.referenceId || updated.sync_id;
          console.log('[OFFLINE END SESSION] session:', updated.sync_id, 'summarySessionId:', summarySessionId, 'orders:', updated.orders?.length);
          computedSummary = computeOfflineSummary(updated, summarySessionId, authUser);
        }
      }

      dispatch(setOfflineSummary(computedSummary));
      dispatch(setOfflineSessionEnded(true));
      dispatch(invalidateSession());
      dispatch(clearActiveSyncId());
      refreshCatalog();
      dispatch(resetCart());

      // Update Redux pending count + sessions biar Sync Indicator kebaca
      const updatedAll = await getAllSessions(userId);
      dispatch(setSessions(updatedAll));
      dispatch(
        setPendingCount(updatedAll.filter(s => s.syncStatus !== 'synced').length)
      );
      return;
    }

    // ===== ONLINE END =====
    try {
      // Sync any pending sessions first
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
    // Skip API call kalo offline — langsung compute dari IndexedDB
    if (!networkOk) {
      console.log('[FETCH SUMMARY] offline — skip API, compute from cache');
      const activeId = await getActiveSessionId(authSession, userId);
      if (activeId) {
        const allSessions = await getAllSessions(userId);
        let sessionData = allSessions.find(s => s.sync_id === activeId.id);
        if (!sessionData) {
          sessionData = allSessions.find(s => s.referenceId === activeId.id);
        }
        if (sessionData) {
          const currentSyncId = sessionData.referenceId || sessionData.sync_id;
          console.log('[SUMMARY OFFLINE] sessionData:', { sync_id: sessionData.sync_id, referenceId: sessionData.referenceId, currentSyncId, orders: sessionData.orders?.length });
          const computedSummary = computeOfflineSummary(sessionData, currentSyncId, authSession?.user || authUser);
          console.log('[SUMMARY OFFLINE] computedSummary:', computedSummary?.summary?.sales);
          dispatch(setOfflineSummary(computedSummary));
          return;
        }
      }
      dispatch(invalidateSession());
      return;
    }

    console.log('[FETCH SUMMARY] calling /sales/session/summary');
    try {
      const res = await triggerSummary().unwrap();
      console.log('[FETCH SUMMARY] response data:', JSON.stringify(res?.data, null, 2));
      if (res?.data) {
        // Cache ke offlineSummary (dipakai render, fallback offline, & print)
        dispatch(setOfflineSummary(res.data));
        dispatch(checkSession());
        return;
      } else {
        dispatch(invalidateSession());
      }
    } catch (err) {
      // API gagal — coba offline cache
      const activeId = await getActiveSessionId(authSession, userId);
      if (activeId) {
        const allSessions = await getAllSessions(userId);
        let sessionData = allSessions.find(s => s.sync_id === activeId.id);
        if (!sessionData && activeId.source === 'reference') {
          sessionData = allSessions.find(s => s.referenceId === activeId.id);
        }
        if (sessionData) {
          const currentSyncId = sessionData.referenceId || sessionData.sync_id || activeId.id;
          console.log('[SUMMARY CATCH] sessionData:', { sync_id: sessionData.sync_id, referenceId: sessionData.referenceId, currentSyncId, open_at: sessionData.session?.open_at, cash_started: sessionData.session?.cash_started, orders: sessionData.orders?.length });
          const computedSummary = computeOfflineSummary(sessionData, currentSyncId, authSession?.user || authUser);
          console.log('[SUMMARY CATCH] computedSummary:', computedSummary?.summary?.sales);

          dispatch(setOfflineSummary(computedSummary));
          return;
        }
      }

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
