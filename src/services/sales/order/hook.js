import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { useCancelMutation, useUpdateMutation, useLazyShowQuery, useLazyHistoryQuery } from './action';
import { $failure } from '../../form/action';
import { getCache, setCache } from '../../../utils/cache';

const HISTORY_CACHE_KEY = 'cache_order_history';

const useOrder = id => {
  const dispatch = useDispatch();
  const apiReachable = useSelector(state => state?.Offline?.apiReachable);
  const [triggerShow, showResult] = useLazyShowQuery();
  const [triggerHistory, historyResult] = useLazyHistoryQuery();
  const [cancelMutation, cancelResult] = useCancelMutation();
  const [updateMutation, updateResult] = useUpdateMutation();
  const [mergedHistoryData, setMergedHistoryData] = useState(null);

  const show = async id => {
    try {
      await triggerShow({ id }).unwrap();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('error:', error);
      }
    }
  };

  const history = async (params = {}) => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const apiDead = apiReachable === false;

    if (!isOffline && !apiDead) {
      try {
        const res = await triggerHistory(params).unwrap();
        const serverData = res?.data || [];

        // After sync, server already has all data — no need to merge offline entries
        setCache(HISTORY_CACHE_KEY, serverData);
        setMergedHistoryData(serverData);
        return;
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('[useOrder.history] fetch error', error);
        }
      }
    }

    // Offline or dead API — read cache
    const cached = getCache(HISTORY_CACHE_KEY) || [];
    setMergedHistoryData(cached);
  };

  const cancel = async ({ id, payload }) => {
    try {
      const result = await cancelMutation({ id, ...payload }).unwrap();
      return result;
    } catch (error) {
      dispatch($failure(error));
      throw error;
    }
  };

  const update = async ({ id, payload }) => {
    try {
      const result = await updateMutation({ id, payload }).unwrap();
      return result;
    } catch (error) {
      dispatch($failure(error));
      throw error;
    }
  };

  useEffect(() => {
    if (!id) return;

    triggerShow({ id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return {
    show,
    showResult,
    history,
    historyResult,
    historyData: mergedHistoryData,
    cancel,
    cancelResult,
    update,
    updateResult,
  };
};

export default useOrder;
