/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { redirect, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

import { Input } from '../../../components/ui';
import { BackIcon, PlusIcon } from '../../../components/ui/icon';
import useMembership from '../../../services/membership/hook';
import { createMembership } from '../../../services/offline/queue';
import { triggerQueueRefresh } from '../../../services/offline/usePendingQueueCount';
import { saveMembership } from '../../../utils/cache';

const CreateManual = () => {
  const navigate = useNavigate();
  const FormState = useSelector(state => state?.Form);
  const sessionAuth = useSelector(state => state?.Auth?.session);

  const isOnline = useSelector(state => state?.Offline?.isOnline);
  const apiReachable = useSelector(state => state?.Offline?.apiReachable);
  const isOffline = !isOnline || apiReachable === false;

  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [cardId, setCardId] = React.useState('');

  const { create, createResult } = useMembership();

  // Offline — Cache and IDB
  const onCreateOffline = async uid => {
    const payload = {
      sync_id: uuidv4(),
      card_id: uid,
      name,
      reff_code: phone,
      saldo: 0,
    };

    try {
      await createMembership(payload, sessionAuth?.user?.id);
    } catch (err) {
      console.log('[DEBUG] error membership', err);
    }

    triggerQueueRefresh();

    try {
      saveMembership(payload);
    } catch (err) {
      console.log('[DEBUG] error membership', err);
    }

    navigate('/membership');
  };

  // Online — API
  const onCreateOnline = async uid => {
    console.log('[DEBUG] [onCreateOnline]');

    const payload = {
      reff_code: phone,
      name,
      card_id: uid,
    };

    create(payload);
  };

  const handleCreate = () => {
    if (isOffline) {
      onCreateOffline(cardId);
    } else {
      onCreateOnline(cardId);
    }
  };

  React.useEffect(() => {
    if (createResult?.isSuccess) {
      navigate('/membership');
    }
  }, [createResult]);

  return (
    <div className="flex h-screen flex-col">
      <div className="border-base-200 bg-base-100 flex h-16 border-t border-b">
        <div className="border-base-200 flex-1 place-content-center border-r border-l">
          <div className="flex place-items-center gap-6 px-4">
            <div
              className="btn btn-circle btn-md btn-outline"
              onClick={() => navigate('/membership')}
            >
              <BackIcon />
            </div>
            <div className="text-lg font-semibold">New Membership (Manual)</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-3">
          <div className="mb-1 text-sm">Member name</div>
          <Input
            value={name}
            onChange={e => setName(e?.target?.value)}
            error={FormState?.errors?.name}
            placeholder="e.g. John Doe"
          />
        </div>
        <div className="mb-3">
          <div className="mb-1 text-sm">Phone number</div>
          <Input
            value={phone}
            onChange={e => setPhone(e?.target?.value)}
            placeholder="e.g. 08123456789"
          />
        </div>
        <div className="mb-3">
          <div className="mb-1 text-sm">Card ID</div>
          <Input
            value={cardId}
            onChange={e => setCardId(e?.target?.value)}
            placeholder="e.g. 1234567890"
          />
          {!cardId && <small className="text-error">Card ID is required</small>}
        </div>
      </div>

      <div className="border-base-200 min-h-15 border-t">
        <div
          className={`btn btn-primary btn-block h-full rounded-none border-0 ${createResult?.isLoading ? 'btn-disabled' : ''}`}
          onClick={handleCreate}
        >
          {createResult?.isLoading ? (
            <span className="loading loading-spinner"></span>
          ) : (
            <>
              <PlusIcon /> Create Membership
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateManual;
