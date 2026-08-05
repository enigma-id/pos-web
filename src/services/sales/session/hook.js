// services/sales/session/hook.js
import { useDispatch, useSelector } from 'react-redux';

import {
  useStartMutation,
  useEndMutation,
  useLazySummaryQuery,
  useLazySessionQuery,
  useLazyShowSessionQuery,
} from './action';
import { setSummary, updateSummary } from './slice';
import { $failure } from '../../form/action';
import { getCache, setCache, updateShifts } from '../../../utils/cache';
import { useState } from 'react';
import { store } from '../../store';

const SHIFTS_CACHE_KEY = 'cache_shifts';

const useSession = () => {
  const dispatch = useDispatch();
  const apiReachable = useSelector(state => state?.Offline?.apiReachable);
  const sessionSummary = useSelector(state => state?.SalesSession?.sessionSummary);

  const [startMutation, startResult] = useStartMutation();
  const [endMutation, endResult] = useEndMutation();

  const [triggerSummary, summaryResult] = useLazySummaryQuery();
  const [triggerSession, sessionResult] = useLazySessionQuery();
  const [triggerShow, showResult] = useLazyShowSessionQuery();
  const [mergedSessionData, setMergedSessionData] = useState(null);

  const start = async data => {
    try {
      await startMutation(data).unwrap();
    } catch (error) {
      dispatch($failure(error));
    }
  };

  const end = async data => {
    try {
      await endMutation(data).unwrap();
    } catch (error) {
      dispatch($failure(error));
    }
  };

  const summary = async () => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const apiDead = apiReachable === false;

    if (!isOffline && !apiDead) {
      try {
        const res = await triggerSummary().unwrap();

        dispatch(setSummary(res.data));

        return;
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('[SESSION HOOK] summary error:', err);
        }
        // fetch error
      }
    }
  };

  const session = async (params = {}) => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const apiDead = apiReachable === false;
    const searchCacheKey = `${SHIFTS_CACHE_KEY}_search`;

    if (!isOffline && !apiDead) {
      try {
        const res = await triggerSession(params).unwrap();
        const serverData = res?.data || [];

        // Online search → simpan di cache search; online no-search → simpan di cache utama
        if (params?.search) {
          setCache(searchCacheKey, serverData);
        } else {
          setCache(SHIFTS_CACHE_KEY, serverData);
        }
        setMergedSessionData(serverData);
        return;
      } catch (error) {
        // fetch error
      }
    }

    // Offline — selalu baca cache utama, filter client
    const cached = getCache(SHIFTS_CACHE_KEY) || [];
    setMergedSessionData(cached);
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

  const updateSessionSummary = async data => {
    // 🔍 AMBIL STATE TERBARU LANGSUNG DARI STORE REDUX (Menghindari Stale Closure)
    const currentState = store.getState();
    const currentSessionSummary = currentState?.SalesSession?.sessionSummary;

    // 1. Buat clone state lama
    const updatedSummary = JSON.parse(JSON.stringify(currentSessionSummary));

    if (!updatedSummary) {
      return;
    }

    // 2. Handle logika perubahan
    if (data.type === 'bill') {
      updatedSummary.summary.sales.outstanding_bill += data.outstanding_bill;
    }

    if (data.type === 'payment' || data.type === 'deleted_payment') {
      updatedSummary.summary.sales.total_sales += data.total_sales;
      updatedSummary.summary.sales.total_discount += data.total_discount;
      updatedSummary.summary.sales.total_after_discount += data.total_after_discount;
      updatedSummary.summary.sales.total_service += data.total_service;
      updatedSummary.summary.sales.grand_total += data.total_charges;

      updatedSummary.summary.sales.outstanding_bill_payment += data.outstanding_bill_payment;

      if (data?.payment_method?.provider === 'cash') {
        updatedSummary.summary.cash.expected_cash += data.total_charges;
      }

      // --- PAYMENT METHODS ---
      if (!updatedSummary.summary.payment_methods) {
        updatedSummary.summary.payment_methods = [];
      }

      const pmIdx = updatedSummary.summary.payment_methods.findIndex(
        p => p.name === data?.payment_method?.name
      );

      // Gunakan >= 0 karena indeks ke-0 itu valid!
      if (pmIdx >= 0) {
        const newTotalPaid =
          (updatedSummary.summary.payment_methods[pmIdx].total_paid || 0) + data?.total_charges;
        const newCount =
          (updatedSummary.summary.payment_methods[pmIdx].count || 0) +
          (data.type === 'deleted_payment' ? -1 : 1);

        if (newTotalPaid <= 0 || newCount <= 0) {
          // Hapus dari array jika total_paid atau count sudah habis/0
          updatedSummary.summary.payment_methods.splice(pmIdx, 1);
        } else {
          // Update jika masih ada sisa
          updatedSummary.summary.payment_methods[pmIdx] = {
            ...updatedSummary.summary.payment_methods[pmIdx],
            total_paid: newTotalPaid,
            count: newCount,
          };
        }
      } else {
        updatedSummary.summary.payment_methods.push({
          total_paid: data.total_charges,
          count: 1,
          name: data?.payment_method?.name,
        });
      }

      // --- CATEGORY SOLDS ---
      if (data?.order?.items) {
        data.order.items.forEach(item => {
          // Disarankan pakai forEach daripada map kalau tidak mengembalikan array baru
          if (!updatedSummary.summary.category_solds) {
            updatedSummary.summary.category_solds = [];
          }

          const categoryIdx = updatedSummary.summary.category_solds.findIndex(
            p => p.category_name === item.category_name
          );

          // Gunakan >= 0
          if (categoryIdx >= 0) {
            const itemCharges = item.quantity * (item.unit_nett - item.unit_discount);
            const qtyMultiplier = data.type === 'deleted_payment' ? -1 : 1;

            const newTotalCharges =
              (updatedSummary.summary.category_solds[categoryIdx].total_charges || 0) +
              itemCharges * qtyMultiplier;
            const newTotalQty =
              (updatedSummary.summary.category_solds[categoryIdx].total_qty || 0) +
              item.quantity * qtyMultiplier;

            // Jika quantity atau total charges habis (<= 0), hapus dari array category_solds
            if (newTotalQty <= 0 || newTotalCharges <= 0) {
              updatedSummary.summary.category_solds.splice(categoryIdx, 1);
            } else {
              // Update jika masih ada sisa
              updatedSummary.summary.category_solds[categoryIdx] = {
                ...updatedSummary.summary.category_solds[categoryIdx],
                total_charges: newTotalCharges,
                total_qty: newTotalQty,
              };
            }
          } else {
            updatedSummary.summary.category_solds.push({
              category_name: item.category_name,
              total_qty: item.quantity,
              total_charges: item.quantity * (item.unit_nett - item.unit_discount),
            });
          }
        });
      }

      // --- ORDERS ---
      // Perbaikan: Inisialisasi jika belum ada (jangan pakai if (updatedSummary.orders))
      if (!updatedSummary.orders) {
        updatedSummary.orders = [];
      }

      if (data?.type === 'payment') {
        if (data?.order) {
          updatedSummary.orders.push(data.order);
        }
      } else if (data?.type === 'deleted_payment') {
        // --- REMOVE ORDER BERDASARKAN ID ATAU SYNC_ID ---
        const targetId = data?.order?.id;
        const targetSyncId = data?.order?.sync_id;

        updatedSummary.orders = updatedSummary.orders.filter(o => {
          const matchId = targetId && o.id === targetId;
          const matchSyncId = targetSyncId && o.sync_id === targetSyncId;

          // Hapus order jika salah satu cocok (kembalikan false agar terfilter keluar)
          return !(matchId || matchSyncId);
        });
      }
    }

    if (data.type === 'update') {
      if (!(data.id === updatedSummary.id || data.sync_id === updatedSummary.sync_id)) {
        let existing = showShifts(data);

        existing.summary.sales.outstanding_bill += data.outstanding_bill;

        updateShifts(existing);

        return;
      } else {
        updatedSummary.summary.sales.outstanding_bill += data.outstanding_bill;
      }
    }

    if (data.type === 'topup') {
      if (data.topup_method === 'cash') {
        updatedSummary.summary.cash.topup_cash += data.topup_nominal;
      }

      if (!updatedSummary.summary.topups) {
        updatedSummary.summary.topups = [];
      }

      const topupIdx = updatedSummary.summary.topups.findIndex(p => p.type === data?.topup_method);

      // Gunakan >= 0 karena indeks ke-0 itu valid!
      if (topupIdx >= 0) {
        const newTotalNominal =
          (updatedSummary.summary.topups[topupIdx].total_paid || 0) + data?.total_charges;

        if (newTotalPaid <= 0 || newCount <= 0) {
          // Hapus dari array jika total_paid atau count sudah habis/0
          updatedSummary.summary.topups.splice(topupIdx, 1);
        } else {
          // Update jika masih ada sisa
          updatedSummary.summary.topups[topupIdx] = {
            ...updatedSummary.summary.topups[topupIdx],
            total_nominal: newTotalNominal,
          };
        }
      } else {
        updatedSummary.summary.topups.push({
          type: data?.topup_method,
          total_nominal: data.topup_nominal,
        });
      }
    }
    // 3. Dispatch data yang udah jadi ke Redux
    dispatch(updateSummary(updatedSummary));

    // 4. Lempar ke cache/storage pakai data yang sama
    updateShifts(updatedSummary);
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
    sessionData: mergedSessionData, // merged server + offline queue
    updateSessionSummary,
  };
};

export default useSession;
