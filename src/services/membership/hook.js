import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

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
import { getCache, setCache } from '../../utils/cache';

const MEMBERSHIP_CACHE_KEY = 'cache_membership';

const useMembership = id => {
  const dispatch = useDispatch();

  const apiReachable = useSelector(state => state?.Offline?.apiReachable);
  const [createMember, createResult] = useCreateMutation();
  const [updateMember, updateResult] = useUpdateMutation();
  const [removeMember, removeResult] = useDeleteMutation();
  const [triggerGet, getMemberResult] = useLazyGetQuery();
  const [triggerShow, showResult] = useLazyShowQuery();
  const [triggerCheck, checkResult] = useLazyCheckSaldoQuery();
  const [triggerSaldoLog, saldoLogResult] = useLazyGetSaldoLogQuery();
  const [topupBalance, topupResult] = useTopupMutation();
  const [mergedMembershipData, setMergedMembershipData] = useState(null);

  const getMember = async params => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const apiDead = apiReachable === false;
    const searchCacheKey = `${MEMBERSHIP_CACHE_KEY}_search`;

    if (!isOffline && !apiDead) {
      try {
        const res = await triggerGet(params).unwrap();
        const serverData = res?.data || [];

        // Online search → simpan di cache search; online no-search → simpan di cache utama
        if (params?.search) {
          setCache(searchCacheKey, serverData);
        } else {
          setCache(MEMBERSHIP_CACHE_KEY, serverData);
        }
        setMergedMembershipData(serverData);
        return;
      } catch (err) {
        // fetch error
      }
    }

    // Offline — selalu baca cache utama, filter client
    const cached = getCache(MEMBERSHIP_CACHE_KEY) || [];
    setMergedMembershipData(cached);
  };

  const show = async id => {
    try {
      await triggerShow(id).unwrap();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('error:', error);
      }
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

  return {
    getMember,
    getMemberResult,
    show,
    showResult,
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
    saldoLog,
    saldoLogResult,
    membershipData: mergedMembershipData,
  };
};

export default useMembership;
