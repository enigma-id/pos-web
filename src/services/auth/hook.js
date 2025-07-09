import { useDispatch } from 'react-redux';
import {
  useLoginMutation,
  useUpdateMutation,
  $reset,
  $logout,
  useLazyGetUserQuery,
} from './action';

import { $failure } from '../form/action';
import { login, session } from './slice';

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

  const resetAuth = () => dispatch($reset());
  const logout = () => dispatch($logout());

  return {
    signin,
    loginResult,
    getUser,
    getUserResult,
    update,
    updateResult,
    resetAuth,
    logout,
  };
};

export default useAuth;
