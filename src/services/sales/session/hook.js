// services/sales/session/hook.js
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import {
  useStartMutation,
  useEndMutation,
  useLazySummaryQuery,
  useLazySessionQuery,
  useLazyShowSessionQuery,
} from './action';

import { checkSession, invalidateSession } from './slice';
import { $failure } from '../../form/action';

import { getOrFetchSales } from '../../../utils/cache';
import { resetCart } from '../../cart/slice';
import useCatalog from '../../catalog/hooks';

const useSession = id => {
  const dispatch = useDispatch();

  const [startMutation, startResult] = useStartMutation();
  const [endMutation, endResult] = useEndMutation();

  const [triggerSummary, summaryResult] = useLazySummaryQuery();
  const [triggerSession, sessionResult] = useLazySessionQuery();
  const [triggerShow, showResult] = useLazyShowSessionQuery();

  const { refreshCatalog } = useCatalog();

  const start = async data => {
    try {
      const res = await startMutation(data).unwrap();
      if (res?.status === 'success') {
        refreshCatalog();
        dispatch(resetCart());
        // dispatch(clearSelectedChannel());
        summary();
      }
    } catch (err) {
      dispatch($failure(err));
    }
  };

  const end = async data => {
    try {
      const res = await endMutation(data).unwrap();

      if (res?.status === 'success') {
        summary();
        refreshCatalog();
        dispatch(resetCart());
      }
    } catch (err) {
      dispatch($failure(err));
    }
  };

  const summary = async () => {
    try {
      await triggerSummary().unwrap();
      dispatch(checkSession());
    } catch (err) {
      dispatch(invalidateSession());
      if (import.meta.env.DEV) {
        console.error('error:', err);
      }
    }
  };

  const session = async params => {
    const res = await getOrFetchSales('session', async () => {
      const res = await triggerSession(params).unwrap();
      return res?.data || {};
    });

    return res;
  };

  useEffect(() => {
    if (id) {
      triggerShow({ id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return {
    start,
    startResult,
    end,
    endResult,
    summary,
    summaryResult,
    session,
    sessionResult,
    showResult,
  };
};

export default useSession;
