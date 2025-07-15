import { useDispatch } from 'react-redux';

import { useLoginMutation, useUpdateMutation, useLazyGetUserQuery } from './action';
import { login, logout, session } from './slice';
import { clearCatalogCache, clearSalesCache } from '../../utils/cache';
import { resetCart } from '../cart/slice';
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
    } catch (error) {
      dispatch($failure(error));
    }
  };

  const getUser = async () => {
    try {
      const res = await triggerGetUser().unwrap();
      dispatch(session(res?.data));
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('error:', error);
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
