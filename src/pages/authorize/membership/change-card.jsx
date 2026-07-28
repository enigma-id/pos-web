/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { Input } from '../../../components/ui';
import { BackIcon } from '../../../components/ui/icon';
import { useUpdateMutation, useLazyCheckSaldoQuery } from '../../../services/membership/action';
import { updateMembership } from '../../../services/offline/queue';
import { setPendingCount, setWarning } from '../../../services/offline/slice';
import { store } from '../../../services/store';
import { setMemberCache, getCache, setCache } from '../../../utils/cache';

const ChangeCardManual = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const authSession = useSelector(state => state?.Auth?.session);
  const authUser = useSelector(state => state?.Auth?.user);
  const userId = authSession?.user?.id || authUser?.id;
  const [triggerCheck, checkResult] = useLazyCheckSaldoQuery();
  const [updateMember, updateResult] = useUpdateMutation();

  const [cardId, setCardId] = React.useState('');
  const [newCardId, setNewCardId] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [member, setMember] = React.useState(null);
  const [error, setError] = React.useState('');
  const scanConsumed = React.useRef(false);

  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  const handleSearch = () => {
    const uid = cardId.trim();
    if (!uid) return;

    setError('');
    setLoading(true);
    scanConsumed.current = false;

    if (isOffline) {
      const raw = localStorage.getItem('cache_members');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const cached = parsed?.[uid];
          if (cached) {
            setMember(cached);
            setLoading(false);
            return;
          }
        } catch {}
      }
      setError('Member data not available offline. Please scan while online first to cache.');
      setLoading(false);
      return;
    }

    triggerCheck({ card_id: uid });
  };

  React.useEffect(() => {
    if (checkResult?.isSuccess && !scanConsumed.current) {
      scanConsumed.current = true;
      const data = checkResult?.data?.data;
      setMember(data);
      setLoading(false);
    }
  }, [checkResult]);

  React.useEffect(() => {
    if (checkResult?.isError && !scanConsumed.current) {
      scanConsumed.current = true;
      setError('Member not found. Check card ID or try again later.');
      setLoading(false);
    }
  }, [checkResult]);

  const handleChangeCard = async () => {
    const uid = newCardId.trim();
    if (!uid || !member) return;

    const oldCardId = member.card_id;

    if (isOffline) {
      if (!userId) {
        dispatch(setWarning('User not found.'));
        return;
      }

      setLoading(true);

      await updateMembership(oldCardId, { card_id: uid, name: member.name, reff_code: member.reff_code }, userId);

      // Cache baru
      setMemberCache(uid, { ...member, card_id: uid });

      // Hapus cache lama
      const raw = localStorage.getItem('cache_members');
      if (raw && oldCardId && oldCardId !== uid) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.[oldCardId]) {
            delete parsed[oldCardId];
            localStorage.setItem('cache_members', JSON.stringify(parsed));
          }
        } catch {}
      }

      // Update table cache
      const TABLE_CACHE_KEY = 'cache_table_membership';
      const existing = getCache(TABLE_CACHE_KEY);
      const tableData = Array.isArray(existing?.data) ? existing.data : [];
      const updated = tableData.map(m =>
        String(m.card_id) === String(oldCardId)
          ? { ...m, card_id: uid }
          : m
      );
      setCache(TABLE_CACHE_KEY, { ...existing, data: updated });

      dispatch(setPendingCount((store.getState()?.Offline?.pendingCount || 0) + 1));

      dispatch(setWarning('Card changed offline. Will sync when online.'));
      setLoading(false);
      navigate('/membership');
      return;
    }

    // Online
    if (!member?.id) {
      dispatch(setWarning('Member ID not found. Search again.'));
      setLoading(false);
      return;
    }
    try {
      await updateMember({ id: member.id, payload: { card_id: uid } }).unwrap();
      dispatch(setWarning('Card changed successfully.'));
      navigate('/membership');
    } catch (err) {
      setError('Failed to change card. Try again.');
    }
    setLoading(false);
  };

  if (member) {
    return (
      <div className="flex h-screen flex-col">
        <div className="border-base-200 bg-base-100 flex h-16 border-t border-b">
          <div className="border-base-200 flex-1 place-content-center border-r border-l">
            <div className="flex place-items-center gap-6 px-4">
              <div className="btn btn-circle btn-md btn-outline" onClick={() => { setMember(null); setNewCardId(''); }}>
                <BackIcon />
              </div>
              <div className="text-lg font-semibold">Change Card — {member.name}</div>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4 rounded-lg bg-base-200/30 p-4">
            <div className="text-sm text-base-content/50">Current Card ID</div>
            <div className="text-lg font-bold">{member.card_id || '-'}</div>
            <div className="mt-2 text-sm text-base-content/50">Member</div>
            <div className="text-base font-semibold">{member.name} ({member.reff_code || '-'})</div>
          </div>

          <div className="mb-3">
            <div className="text-sm mb-1 font-semibold">New Card ID</div>
            <Input
              value={newCardId}
              onChange={e => setNewCardId(e?.target?.value)}
              placeholder="e.g. 0987654321"
            />
          </div>

          {error && (
            <div className="text-sm text-error bg-error/10 rounded px-3 py-2">{error}</div>
          )}

          <div className="mt-4">
            <div
              className={`btn btn-primary btn-block btn-xl ${loading || !newCardId.trim() ? 'btn-disabled' : ''}`}
              onClick={handleChangeCard}
            >
              {loading ? <span className="loading loading-spinner"></span> : 'Change Card'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="border-base-200 bg-base-100 flex h-16 border-t border-b">
        <div className="border-base-200 flex-1 place-content-center border-r border-l">
          <div className="flex place-items-center gap-6 px-4">
            <div className="btn btn-circle btn-md btn-outline" onClick={() => navigate('/membership')}>
              <BackIcon />
            </div>
            <div className="text-lg font-semibold">Change Card</div>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col place-content-center place-items-center p-8">
        <div className="w-full max-w-md space-y-4">
          <label className="text-sm font-semibold">Current Card ID</label>
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder="e.g. 1234567890"
            value={cardId}
            onChange={e => setCardId(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
            autoFocus
          />

          {error && (
            <div className="text-sm text-error bg-error/10 rounded px-3 py-2">{error}</div>
          )}

          <button
            className={`btn btn-primary btn-block btn-xl ${loading ? 'btn-disabled' : ''}`}
            onClick={handleSearch}
          >
            {loading ? <span className="loading loading-spinner"></span> : 'Search Member'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangeCardManual;
