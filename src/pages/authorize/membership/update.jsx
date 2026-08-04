/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useSelector } from 'react-redux';

import CardMockup from '../../../assets/card-mockup.jpg';
import { NFCField, Remove } from '../../../components/ui';
import { PaypassIcon } from '../../../components/ui/icon';
import Input from '../../../components/ui/input';
import useModal from '../../../components/ui/modal/hook';
import useMembership from '../../../services/membership/hook';
import { updateMembership } from '../../../services/offline/queue';
import { triggerQueueRefresh } from '../../../services/offline/usePendingQueueCount';
import { currencyFormat } from '../../../utils/common';
import { perbaharuiMembership } from '../../../utils/cache';

const UpdateSession = ({ id, onClose, isOpen, onRefresh, membership }) => {
  const FormState = useSelector(state => state?.Form);
  const sessionAuth = useSelector(state => state?.Auth?.session);

  const isOnline = useSelector(state => state?.Offline?.isOnline);
  const apiReachable = useSelector(state => state?.Offline?.apiReachable);
  const isOffline = !isOnline || apiReachable === false;

  const { openModal, closeModal } = useModal();

  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const { show, showResult, update, updateResult } = useMembership();

  const handleRead = uid => {
    if (isOffline) {
      onUpdateOffline(uid);
    } else {
      onUpdateOnline(uid);
    }
  };

  const onScan = () => {
    openModal(
      <NFCField onRead={handleRead} isOpen={true} onClose={closeModal} result={updateResult} />,
      'w-md'
    );
  };

  const onUpdate = async () => {
    setSaving(true);

    if (isOffline) {
      onUpdateOffline(data?.card_id);
    } else {
      onUpdateOnline(data?.card_id);
    }

    setSaving(false);
  };

  // Offline — Cache and IDB
  const onUpdateOffline = async uid => {
    const payload = {
      ...membership,
      card_id: uid,
      name,
      reff_code: phone,
    };

    try {
      await updateMembership(payload, sessionAuth?.user?.id);
    } catch (err) {
      console.log('[DEBUG] error membership', err);
    }

    triggerQueueRefresh();

    try {
      perbaharuiMembership(payload);
    } catch (err) {
      console.log('[DEBUG] error membership', err);
    }

    onClose?.();
    onRefresh?.();
    closeModal?.();
  };

  // Online — API
  const onUpdateOnline = async uid => {
    const payload = {
      name,
      reff_code: phone,
      card_id: data?.card_id,
    };

    update({ id, payload });
  };

  const onDeleteOpen = () => {
    openModal(
      <Remove
        id={id}
        onClose={() => {
          closeModal();
          reboot?.();
          onClose?.();
        }}
      />,
      'w-md'
    );
  };

  React.useEffect(() => {
    if (isOpen === false) {
      setName(showResult?.data?.data?.name);
      setPhone(showResult?.data?.data?.reff_code);
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (showResult?.isSuccess) {
      setName(showResult?.data?.data?.name);
      setPhone(showResult?.data?.data?.reff_code);
    }
  }, [showResult]);

  // Offline fallback: populate dari cache
  React.useEffect(() => {
    if (isOffline) {
      setName(membership.name || '');
      setPhone(membership.reff_code || '');
    }
  }, [membership]);

  React.useEffect(() => {
    if (!isOffline) {
      show(id);
    }
  }, []);

  React.useEffect(() => {
    if (updateResult?.isSuccess) {
      onClose?.();
      onRefresh?.();
      closeModal?.();
    }
  }, [updateResult]);

  const data = showResult?.data?.data || membership;

  return (
    <div className="flex h-full w-md min-w-lg flex-1 flex-col">
      <div className="flex-1">
        <div className="h-80 w-full overflow-hidden rounded-lg">
          <div
            className="flex h-full w-full flex-col place-content-center place-items-center bg-center"
            style={{ background: `url(${CardMockup})` }}
          >
            <div
              className="flex h-64 w-7/8 flex-col rounded-lg p-6 text-white shadow shadow-white/45"
              style={{
                background:
                  'linear-gradient(112.91deg, rgba(255,255,255,0.3) 3.51%, rgba(255,255,255,0) 111.71%), rgba(0,0,0,0.1)',
                backdropFilter: 'blur(8.36975px)',
              }}
            >
              <div className="flex flex-1 place-content-between">
                <div className="text-2xl font-semibold tracking-wide">Suka Bread.</div>
                <div>
                  <PaypassIcon />
                </div>
              </div>

              <div className="text-5xl font-semibold tracking-wide">
                {currencyFormat(data?.saldo || 0)}
              </div>
              <div className="mt-2 text-[16px] font-medium tracking-wide uppercase">
                {data?.name || '-'}
              </div>
              <div className="text-xl font-medium tracking-wide uppercase">
                {data?.reff_code || '-'}
              </div>
            </div>
            {sessionAuth?.user?.role === 'manager' && (
              <div className="mt-2">
                <button
                  className={`btn btn-primary h-full flex-1 rounded ${!saving ? '' : 'btn-disabled'}`}
                  onClick={onScan}
                >
                  Ganti Kartu Suka Bread
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="pt-4">
            <Input
              value={name}
              onChange={v => setName(v?.target?.value)}
              label="Name"
              error={FormState?.errors?.name}
            />
          </div>
          <div className="pt-4">
            <Input label="Phone Number" value={phone} onChange={v => setPhone(v?.target?.value)} />
          </div>
        </div>
      </div>
      <div className="border-base-200 flex min-h-15 place-content-center place-items-center border-t">
        <button
          className={`btn btn-primary h-full flex-1 rounded-none ${!saving ? '' : 'btn-disabled'}`}
          onClick={onUpdate}
        >
          Save
        </button>
        {sessionAuth?.user?.role === true && !isOffline && (
          <div
            className={`btn btn-error h-full flex-1 rounded-none text-white ${data?.saldo > 0 ? 'btn-disabled' : ''}`}
            onClick={onDeleteOpen}
          >
            Remove
          </div>
        )}
      </div>
    </div>
  );
};

export default UpdateSession;
