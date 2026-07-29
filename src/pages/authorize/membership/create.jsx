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
import { setWarning } from '../../../services/offline/slice';
import { setMemberCache, getCache, setCache } from '../../../utils/cache';

const CreateSection = ({ onClose }) => {
  const dispatch = useDispatch();
  const FormState = useSelector(state => state?.Form);
  const authSession = useSelector(state => state?.Auth?.session);
  const authUser = useSelector(state => state?.Auth?.user);
  const userId = authSession?.user?.id || authUser?.id;
  const { create, createResult } = useMembership();
  const { openModal, closeModal } = useModal();

  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');

  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  const handleRead = uid => {
    const payload = {
      reff_code: phone,
      name,
      card_id: uid,
    };

    // ===== OFFLINE PATH =====
    if (isOffline) {
      const handleOffline = async () => {
        const membershipItem = {
          sync_id: uuidv4(),
          card_id: uid,
          name,
          reff_code: phone,
        };

        await createMembership(membershipItem, userId);
        setMemberCache(uid, { card_id: uid, name, reff_code: phone, saldo: 0 });

        // Update table cache untuk offline fallback
        const TABLE_CACHE_KEY = 'cache_table_membership';
        const existing = getCache(TABLE_CACHE_KEY);
        const tableData = Array.isArray(existing?.data) ? existing.data : [];
        setCache(TABLE_CACHE_KEY, {
          ...existing,
          data: [{ card_id: uid, name, reff_code: phone, saldo: 0 }, ...tableData],
        });

        triggerQueueRefresh();

        closeModal();
        onClose();
      };

      handleOffline();
      return; // skip mutation API
    }

    // ===== ONLINE PATH =====
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
            error={FormState?.errors?.name}
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
