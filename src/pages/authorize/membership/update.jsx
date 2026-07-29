/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import CardMockup from '../../../assets/card-mockup.jpg';
import { NFCField, Remove } from '../../../components/ui';
import { PaypassIcon } from '../../../components/ui/icon';
import Input from '../../../components/ui/input';
import useModal from '../../../components/ui/modal/hook';
import useMembership from '../../../services/membership/hook';
import { createMembership, updateMembership } from '../../../services/offline/queue';
import { triggerQueueRefresh } from '../../../services/offline/usePendingQueueCount';
import { setWarning } from '../../../services/offline/slice';
import { setMemberCache, getCache, setCache } from '../../../utils/cache';
import { currencyFormat } from '../../../utils/common';

const UpdateSession = ({ id, onClose, isOpen, reboot, membership }) => {
  const Session = useSelector(state => state?.Auth?.session);
  const FormState = useSelector(state => state?.Form);

  const User = useSelector(state => state?.Auth?.session?.user);

  const dispatch = useDispatch();
  const authSession = useSelector(state => state?.Auth?.session);
  const authUser = useSelector(state => state?.Auth?.user);
  const userId = authSession?.user?.id || authUser?.id;
  const { showResult, update, updateResult } = useMembership(id);
  const { openModal, closeModal } = useModal();

  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  const handleRead = uid => {
    const payload = {
      name,
      reff_code: phone,
      card_id: uid,
    };

    // ===== OFFLINE PATH =====
    if (isOffline) {
      const handleOffline = async () => {
        // Update in-place: replace card_id lama dengan yang baru
        const oldCardId = data?.card_id;
        await updateMembership(oldCardId, { card_id: uid, name, reff_code: phone }, userId);

        // Cache baru + bersihin cache lama
        setMemberCache(uid, { card_id: uid, name, reff_code: phone, saldo: data?.saldo || 0 });
        // Hapus entry lama dari cache_members
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

        triggerQueueRefresh();

        dispatch(setWarning('Card changed offline. Will sync when online.'));
        closeModal();
        onClose?.();
        reboot?.();
      };

      handleOffline();
      return; // skip mutation API
    }

    // ===== ONLINE PATH =====
    update({ id, payload });
  };

  const onScan = () => {
    openModal(
      <NFCField onRead={handleRead} isOpen={true} onClose={closeModal} result={updateResult} />,
      'w-md'
    );
  };

  const onSave = async () => {
    const payload = {
      name,
      reff_code: phone,
      card_id: data?.card_id,
    };

    setSaving(true);

    // ===== OFFLINE PATH =====
    if (isOffline) {
      if (data?.card_id) {
        // Update cache lokal
        setMemberCache(data.card_id, {
          card_id: data.card_id,
          name,
          reff_code: phone,
          saldo: data?.saldo || 0,
        });

        // Update table cache
        const TABLE_CACHE_KEY = 'cache_table_membership';
        const existing = getCache(TABLE_CACHE_KEY);
        const tableData = Array.isArray(existing?.data) ? existing.data : [];
        const updated = tableData.map(m =>
          String(m.card_id) === String(data.card_id)
            ? { ...m, name, reff_code: phone }
            : m
        );
        setCache(TABLE_CACHE_KEY, { ...existing, data: updated });

        // Update in-place di IndexedDB
        await updateMembership(data.card_id, { name, reff_code: phone }, userId);
        triggerQueueRefresh();
      }

      dispatch(setWarning('Member updated offline.'));
      setSaving(false);
      onClose?.();
      reboot?.();
      return; // ⛔️ skip mutation API
    }

    // ===== ONLINE PATH =====
    await update({ id, payload });
    setSaving(false);
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
    if (!showResult?.isSuccess && membership) {
      setName(membership.name || '');
      setPhone(membership.reff_code || '');
    }
  }, [membership]);

  React.useEffect(() => {
    if (updateResult?.isSuccess) {
      // setName(updateResult?.data?.data?.name);
      // setPhone(updateResult?.data?.data?.reff_code);
      onClose?.();
      reboot?.();
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
            {User?.role === "manager" && (
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
          onClick={onSave}
        >
          Save
        </button>
        {Session?.user?.role === true && (
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
