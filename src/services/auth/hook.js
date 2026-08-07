import { useDispatch, useSelector } from 'react-redux';

import { useLoginMutation, useUpdateMutation, useLazyGetUserQuery } from './action';
import { login, logout, session } from './slice';
import {
  clearCatalogCache,
  clearSalesCache,
  getSalesCacheValue,
  setSalesCacheValue,
} from '../../utils/cache';
import { resetCart } from '../cart/slice';
import { $failure } from '../form/action';
import { ensureDB, STORES, deleteUserDB } from '../offline/queue';
import { syncPendingSessions } from '../offline/syncManager';
import { clearSelectedChannel } from '../sales/channel/slice';
import { $reset } from '../table/action';
import { resetSummary, setSummary } from '../sales/session/slice';

const useAuth = () => {
  const dispatch = useDispatch();
  const sessionUserId = useSelector(state => state?.Auth?.session?.user?.id);
  const [loginMutation, loginResult] = useLoginMutation();
  const [triggerGetUser, getUserResult] = useLazyGetUserQuery();
  const [updateMutation, updateResult] = useUpdateMutation();

  const signin = async data => {
    try {
      const res = await loginMutation(data).unwrap();
      dispatch(login(res?.data));
      dispatch(setSummary(res?.data?.sales_session));

      getUser();

      // Recover queue for this user (fire-and-forget)
      const userId = res?.data?.user?.id;
      if (userId) {
        syncPendingSessions();
      }
    } catch (error) {
      dispatch($failure(error));
    }
  };

  const getUser = async () => {
    try {
      const res = await triggerGetUser().unwrap();

      if (res?.message === 'success') {
        dispatch(session(res?.data));
      }
    } catch (error) {
      console.log('Error fetching:', error);
    }
  };

  const update = async data => {
    try {
      await updateMutation(data).unwrap();
    } catch (error) {
      dispatch($failure(error));
    }
  };

  const onLogout = async () => {
    // Capture userId before dispatch(logout) clears state
    const userId = sessionUserId;

    // Device tracking removed — no-op
    clearCatalogCache();
    clearSalesCache();
    dispatch(resetCart());
    dispatch(resetSummary());
    dispatch($reset());
    dispatch(clearSelectedChannel());
    dispatch(logout());

    // Clean up queue DB if empty
    if (userId) {
      try {
        const db = await ensureDB(userId);
        const sessions = await db.getAll(STORES.sessions);
        const orders = await db.getAll(STORES.orderBills);
        const payments = await db.getAll(STORES.orderPayments);
        const hasPending = sessions.length > 0 || orders.length > 0 || payments.length > 0;
        if (!hasPending) {
          await deleteUserDB(userId);
        }
        // If pending > 0, leave DB intact for next login
      } catch {
        // Cleanup failure must not block logout
      }
    }
  };

  return {
    signin,
    loginResult,
    getUser,
    getUserResult,
    update,
    updateResult,
    onLogout,
  };
};

export default useAuth;
