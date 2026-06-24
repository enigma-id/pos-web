import { useDispatch } from 'react-redux';

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
import { $reset } from '../table/action';

const useAuth = () => {
  const dispatch = useDispatch();
  const [loginMutation, loginResult] = useLoginMutation();
  const [triggerGetUser, getUserResult] = useLazyGetUserQuery();
  const [updateMutation, updateResult] = useUpdateMutation();

  const signin = async data => {
    try {
      const res = await loginMutation(data).unwrap();
      dispatch(login(res?.data));
      getUser();
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

  const onLogout = () => {
    clearCatalogCache();
    clearSalesCache();
    dispatch(resetCart());
    dispatch($reset());
    dispatch(clearSelectedChannel());
    dispatch(invalidateSession());
    dispatch(logout());
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
