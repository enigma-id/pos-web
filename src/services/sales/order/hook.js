import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import { useCancelMutation, useUpdateMutation, useLazyShowQuery } from './action';
import { $failure } from '../../form/action';

const useOrder = id => {
  const dispatch = useDispatch();
  const [triggerShow, showResult] = useLazyShowQuery();
  const [cancelMutation, cancelResult] = useCancelMutation();
  const [updateMutation, updateResult] = useUpdateMutation();

  const show = async id => {
    try {
      await triggerShow({ id }).unwrap();
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
    cancel,
    cancelResult,
    update,
    updateResult,
  };
};

export default useOrder;
