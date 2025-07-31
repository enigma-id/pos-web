// services/sales/session/hook.js
import { useDispatch } from 'react-redux';

import {
  useStartMutation,
  useEndMutation,
  useLazySummaryQuery,
  useLazySessionQuery,
  useLazyShowSessionQuery,
} from './action';
import { checkSession, invalidateSession } from './slice';
import { resetCart } from '../../cart/slice';
import useCatalog from '../../catalog/hooks';
import { $failure } from '../../form/action';

const useSession = () => {
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
