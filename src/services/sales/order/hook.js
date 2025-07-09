import { useDispatch } from 'react-redux';
import { useCancelMutation, useLazyOrderQuery, useLazyShowQuery } from './action';
import { $failure } from '../../form/action';
import { useEffect } from 'react';

const useOrder = id => {
  const dispatch = useDispatch();
  const [triggerOrder, orderResult] = useLazyOrderQuery();
  const [triggerShow, showResult] = useLazyShowQuery();
  const [cancelMutation, cancelResult] = useCancelMutation();

  const order = async (params = {}) => {
    try {
      const res = await triggerOrder(params).unwrap();
      return res;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('error:', error);
      }
    }
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

  useEffect(() => {
    if (!id) return;

    triggerShow({ id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return {
    order,
    orderResult,
    showResult,
    cancel,
    cancelResult,
  };
};

export default useOrder;
