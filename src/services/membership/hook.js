import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import {
  useCreateMutation,
  useUpdateMutation,
  useDeleteMutation,
  useLazyShowQuery,
  useLazyCheckSaldoQuery,
  useLazyGetSaldoLogQuery,
  useTopupMutation,
  useLazyGetQuery,
} from './action';
import { $failure } from '../form/action';

const useMembership = id => {
  const dispatch = useDispatch();

  const [createMember, createResult] = useCreateMutation();
  const [updateMember, updateResult] = useUpdateMutation();
  const [removeMember, removeResult] = useDeleteMutation();
  const [triggerGet, getMemberResult] = useLazyGetQuery();
  const [triggerShow, showResult] = useLazyShowQuery();
  const [triggerCheck, checkResult] = useLazyCheckSaldoQuery();
  const [triggerSaldoLog, saldoLogResult] = useLazyGetSaldoLogQuery();
  const [topupBalance, topupResult] = useTopupMutation();

  const getMember = async params => {
    try {
      await triggerGet(params).unwrap();
    } catch (err) {
      dispatch($failure(err));
    }
  };

  const create = async payload => {
    try {
      await createMember(payload).unwrap();
    } catch (err) {
      dispatch($failure(err));
    }
  };

  const update = async ({ id, payload }) => {
    try {
      await updateMember({ id, payload }).unwrap();
    } catch (err) {
      dispatch($failure(err));
    }
  };

  const remove = async ({ id, payload }) => {
    try {
      await removeMember({ id, payload }).unwrap();
    } catch (err) {
      dispatch($failure(err));
    }
  };

  const checkSaldo = async params => {
    try {
      await triggerCheck(params).unwrap();
    } catch (err) {
      dispatch($failure(err));
    }
  };

  const topup = async ({ id, payload }) => {
    try {
      await topupBalance({ id, payload }).unwrap();
    } catch (err) {
      dispatch($failure(err));
    }
  };

  const saldoLog = async ({ id, params }) => {
    try {
      await triggerSaldoLog({ id, params }).unwrap();
    } catch (err) {
      dispatch($failure(err));
    }
  };

  useEffect(() => {
    if (id) {
      triggerShow(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return {
    getMember,
    getMemberResult,
    create,
    createResult,
    update,
    updateResult,
    remove,
    removeResult,
    checkSaldo,
    checkResult,
    topup,
    topupResult,
    showResult,
    saldoLog,
    saldoLogResult,
  };
};

export default useMembership;
