/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

import { Input } from '../../../components/ui';
import { BackIcon, PlusIcon } from '../../../components/ui/icon';
import useMembership from '../../../services/membership/hook';
import { createMembership } from '../../../services/offline/queue';
import { setPendingCount, setWarning } from '../../../services/offline/slice';
import { store } from '../../../services/store';
import { getCache, setCache, setMemberCache } from '../../../utils/cache';

const CreateManual = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const FormState = useSelector(state => state?.Form);
  const activeSyncId = useSelector(state => state?.Offline?.activeSyncId);
  const authSession = useSelector(state => state?.Auth?.session);
  const authUser = useSelector(state => state?.Auth?.user);
  const userId = authSession?.user?.id || authUser?.id;
  const { create, createResult } = useMembership();

  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [cardId, setCardId] = React.useState('');

  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  const handleCreate = () => {
    if (!cardId.trim() || !name.trim()) return;

    const payload = {
      reff_code: phone,
      name,
      card_id: cardId.trim(),
    };

    // ===== OFFLINE PATH =====
    if (isOffline) {
      const handleOffline = async () => {
        const membershipItem = {
          sync_id: uuidv4(),
          card_id: cardId.trim(),
          name,
          reff_code: phone,
        };

        await createMembership(membershipItem, userId);

        // Cache immediately
        setMemberCache(cardId.trim(), {
          card_id: cardId.trim(),
          name,
          reff_code: phone,
          saldo: 0,
        });

        // Update table cache untuk offline fallback
        const TABLE_CACHE_KEY = 'cache_table_membership';
        const existing = getCache(TABLE_CACHE_KEY);
        const tableData = Array.isArray(existing?.data) ? existing.data : [];
        setCache(TABLE_CACHE_KEY, {
          ...existing,
          data: [{ card_id: cardId.trim(), name, reff_code: phone, saldo: 0 }, ...tableData],
        });

        dispatch(setPendingCount((store.getState()?.Offline?.pendingCount || 0) + 1));

        dispatch(setWarning('Member created offline. Will sync when online.'));
        navigate('/membership');
      };

      handleOffline();
      return; // skip mutation API
    }

    // ===== ONLINE PATH =====
    create(payload);
  };

  React.useEffect(() => {
    if (createResult?.isSuccess) {
      navigate('/membership');
    }
  }, [createResult]);

  const isValid = name.trim() && cardId.trim();

  return (
    <div className="flex h-screen flex-col">
      <div className="border-base-200 bg-base-100 flex h-16 border-t border-b">
        <div className="border-base-200 flex-1 place-content-center border-r border-l">
          <div className="flex place-items-center gap-6 px-4">
            <div className="btn btn-circle btn-md btn-outline" onClick={() => navigate('/membership')}>
              <BackIcon />
            </div>
            <div className="text-lg font-semibold">New Membership (Manual)</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-3">
          <div className="text-sm mb-1">Member name</div>
          <Input
            value={name}
            onChange={e => setName(e?.target?.value)}
            error={FormState?.errors?.name}
            placeholder="e.g. John Doe"
          />
        </div>
        <div className="mb-3">
          <div className="text-sm mb-1">Phone number</div>
          <Input
            value={phone}
            onChange={e => setPhone(e?.target?.value)}
            placeholder="e.g. 08123456789"
          />
        </div>
        <div className="mb-3">
          <div className="text-sm mb-1">Card ID</div>
          <Input
            value={cardId}
            onChange={e => setCardId(e?.target?.value)}
            placeholder="e.g. 1234567890"
          />
          {!cardId && createResult?.isError && (
            <small className="text-error">Card ID is required</small>
          )}
        </div>
      </div>

      <div className="border-base-200 min-h-15 border-t">
        <div
          className={`btn btn-primary btn-block h-full rounded-none border-0 ${!isValid || createResult?.isLoading ? 'btn-disabled' : ''}`}
          onClick={handleCreate}
        >
          {createResult?.isLoading ? (
            <span className="loading loading-spinner"></span>
          ) : (
            <><PlusIcon /> Create Membership</>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateManual;
