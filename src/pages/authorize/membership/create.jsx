/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { v4 as uuidv4 } from 'uuid';

import { Input, NFCField } from '../../../components/ui';
import { PlusIcon } from '../../../components/ui/icon';
import useModal from '../../../components/ui/modal/hook';
import useMembership from '../../../services/membership/hook';
import { createMembership } from '../../../services/offline/queue';
import { triggerQueueRefresh } from '../../../services/offline/usePendingQueueCount';
import { saveMembership } from '../../../utils/cache';

const CreateSection = ({ onClose }) => {
  const FormState = useSelector(state => state?.Form);
  const sessionAuth = useSelector(state => state?.Auth?.session);

  const isOnline = useSelector(state => state?.Offline?.isOnline);
  const apiReachable = useSelector(state => state?.Offline?.apiReachable);
  const isOffline = !isOnline || apiReachable === false;

  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');

  const [errorName, setErrorName] = React.useState(null);

  const { openModal, closeModal } = useModal();

  const { create, createResult } = useMembership();

  const handleRead = uid => {
    if (isOffline) {
      onCreateOffline(uid);
    } else {
      onCreateOnline(uid);
    }
  };

  // Offline — Cache and IDB
  const onCreateOffline = async uid => {
    if (name === '') {
      setErrorName('name is required.');
      return;
    }

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

    closeModal();
    onClose();
  };

  // Online — API
  const onCreateOnline = async uid => {
    const payload = {
      reff_code: phone,
      name,
      card_id: uid,
    };

    create(payload);
  };

  const onScan = () => {
    openModal(
      <NFCField
        onRead={handleRead}
        isOpen={true}
        onClose={closeModal}
        result={createResult}
        isReg={true}
      />,
      'w-md'
    );
  };

  React.useEffect(() => {
    if (createResult?.isSuccess) {
      closeModal();
      onClose();
    }
  }, [createResult]);

  React.useEffect(() => {
    if (createResult?.isError && FormState?.errors?.name) {
      closeModal();
    }
  }, [createResult, FormState]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-3">
          <div className="text-sm">Member name</div>
          <Input
            value={name}
            onChange={e => setName(e?.target?.value)}
            error={FormState?.errors?.name || errorName}
          />
        </div>
        <div>
          <div className="text-sm">Phone number</div>
          <Input value={phone} onChange={e => setPhone(e?.target?.value)} />
        </div>
      </div>

      <div className="border-base-200 min-h-15 border-t">
        <div className="btn btn-primary btn-block h-full rounded-none border-0" onClick={onScan}>
          <PlusIcon /> Create new membership
        </div>
      </div>
    </div>
  );
};

export default CreateSection;
