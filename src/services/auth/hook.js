import { useDispatch, useSelector } from 'react-redux';

import { useLoginMutation, useUpdateMutation, useLazyGetUserQuery } from './action';
import { login, logout, session } from './slice';
import {
  clearCatalogCache,
  clearSalesCache,
  getSalesCacheValue,
  setSalesCacheValue,
} from '../../utils/cache';
import { changeServiceCharge, resetCart } from '../cart/slice';
import { $failure } from '../form/action';
import { clearSelectedChannel } from '../sales/channel/slice';
import { invalidateSession } from '../sales/session/slice';
import { stopDeviceTrackingGlobal } from '../sales/session/hook';
import { $reset } from '../table/action';
import { getPendingCount, deleteUserDB, migrateLegacyQueue } from '../offline/queue';
import { syncNow } from '../offline/syncManager';

const useAuth = () => {
  const dispatch = useDispatch();
  const stateUser = useSelector(state => state?.Auth?.session?.user?.id);
  const [loginMutation, loginResult] = useLoginMutation();
  const [triggerGetUser, getUserResult] = useLazyGetUserQuery();
  const [updateMutation, updateResult] = useUpdateMutation();

  const signin = async data => {
    try {
      const res = await loginMutation(data).unwrap();
      dispatch(login(res?.data));
      getUser();

      // Recover queue for this user (fire-and-forget)
      const userId = res?.data?.user?.id;
      if (userId) {
        migrateLegacyQueue(userId).catch(() => {});
        syncNow();
      }
    } catch (error) {
      dispatch($failure(error));
    }
  };

  const getUser = async () => {
    try {
      const res = await triggerGetUser().unwrap();
      dispatch(session(res?.data));

      const charge = res?.data?.sales_session?.outlet?.service_charges;
      setSalesCacheValue('service_charge', charge);
      dispatch(changeServiceCharge(charge));
    } catch (error) {
      const cachedCharge = getSalesCacheValue('service_charge');
      if (cachedCharge !== null && cachedCharge !== undefined) {
        dispatch(changeServiceCharge(cachedCharge));
      } else {
        console.log('Error fetching:', error);
      }
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
    const userId = stateUser;

    stopDeviceTrackingGlobal();
    clearCatalogCache();
    clearSalesCache();
    dispatch(resetCart());
    dispatch($reset());
    dispatch(clearSelectedChannel());
    dispatch(invalidateSession());
    dispatch(logout());

    // Clean up queue DB if empty
    if (userId) {
      try {
        const pending = await getPendingCount(userId);
        if (pending === 0) {
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
