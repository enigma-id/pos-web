import { useDispatch } from 'react-redux';

import { useCancelTopupMutation, useLazyGetSaldoLogsQuery } from './action';
import { $failure } from '../form/action';

const useTopup = () => {
  const dispatch = useDispatch();

  const [triggerGetLogs, getLogsResult] = useLazyGetSaldoLogsQuery();
  const [triggerCancel, cancelResult] = useCancelTopupMutation();

  const getLogs = async params => {
    try {
      await triggerGetLogs(params).unwrap();
    } catch (err) {
      dispatch($failure(err));
    }
  };

  const cancel = async ({ id, payload }) => {
    try {
      await triggerCancel({ id, payload }).unwrap();
    } catch (err) {
      dispatch($failure(err));
    }
  };

  return {
    getLogs,
    getLogsResult,
    cancel,
    cancelResult,
  };
};

export default useTopup;
