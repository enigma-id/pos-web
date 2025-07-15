import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import {
  useCreateMutation,
  useUpdateMutation,
  useDeleteMutation,
  useLazyShowQuery,
  useLazyCheckSaldoQuery,
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

  const remove = async id => {
    try {
      await removeMember(id).unwrap();
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

  const topup = async payload => {
    try {
      await topupBalance(payload).unwrap();
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
  };
};

export default useMembership;
