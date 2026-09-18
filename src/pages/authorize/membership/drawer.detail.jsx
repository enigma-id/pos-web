/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState } from 'react';
import { FiSettings } from 'react-icons/fi';
import { LuStar, LuWallet } from 'react-icons/lu';
import { useSelector } from 'react-redux';

import HistorySection from './history';
import PointHistorySection from './point-history';
import UpdateSession from './update';
import { Drawer } from '../../../components/ui';
import { CloseIcon, HistoryIcon } from '../../../components/ui/icon';
import useMembership from '../../../services/membership/hook';
import { currencyFormat, dateFormat } from '../../../utils/common';
import useDrawer from '../../../utils/drawer';

const DrawerDetail = ({ type, membership, onClose, onRefresh }) => {
  const { drawerRef, open: openDrawer, close: closeDrawer } = useDrawer();
  const { show, showResult } = useMembership();

  const isOnline = useSelector(state => state?.Offline?.isOnline);
  const apiReachable = useSelector(state => state?.Offline?.apiReachable);

  const isOffline = !isOnline || apiReachable === false;

  const [refType, setRefType] = useState('');

  const handleClose = () => {
    closeDrawer();
    onClose?.();
  };

  React.useEffect(() => {
    if (type === 'detail') {
      openDrawer();
      setRefType('history');
    }
  }, [type]);

  // Detail member di-fetch sekali di drawer — dipakai bareng header + kedua tab ledger.
  // Semantik mengikuti HistorySection sebelumnya: skip saat offline (show() tidak punya
  // guard offline, dan request gagal akan menandai apiReachable=false), dan refetch saat
  // card_id berubah (mis. setelah "Ganti Kartu Suka Bread", id tetap tapi card_id berubah).
  React.useEffect(() => {
    if (!isOffline && membership?.id) show(membership.id);
  }, [membership?.card_id]);

  const data = showResult?.data?.data || membership;

  return (
    <Drawer.Content
      drawerRef={drawerRef}
      title={membership?.name}
      headerAction={
        <div className="gap-2">
          {refType === 'update' ? (
            <div className="btn btn-ghost btn-sm btn-circle" onClick={() => setRefType('history')}>
              <HistoryIcon className="h-5 w-5" />
            </div>
          ) : (
            <div className="btn btn-ghost btn-sm btn-circle" onClick={() => setRefType('update')}>
              <FiSettings className="h-5 w-5" />
            </div>
          )}

          <div className="btn btn-ghost btn-sm btn-circle" onClick={handleClose}>
            <CloseIcon />
          </div>
        </div>
      }
    >
      {refType === 'update' ? (
        <UpdateSession
          id={membership?.id}
          membership={membership}
          onClose={() => {
            closeDrawer();
            onClose?.();
          }}
          onRefresh={() => onRefresh?.()}
        />
      ) : (
        <>
          <div className="px-4 py-2">
            <div className="flex items-center gap-2">
              <LuWallet className="h-6 w-6" />
              <span className="text-lg font-bold text-green-600">
                {currencyFormat(data?.saldo || 0)}
              </span>
            </div>

            <div className="mt-1 flex items-center gap-2">
              <LuStar className="h-6 w-6" />
              <span className="text-lg font-bold text-amber-500">
                {currencyFormat(data?.point || 0, false)}
              </span>
              <span className="text-sm text-gray-500">Point</span>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-gray-500">No Tel</span>
              <span className="">:</span>
              <span className="text-gray-900">{data?.reff_code || '-'}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-gray-500">Member No</span>
              <span className="">:</span>
              <span className="text-gray-900">{data?.card_id || '-'}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-gray-500">Member Since</span>
              <span className="">:</span>
              <span className="text-gray-900">{dateFormat(data?.created_at, 'DD/MM/YYYY')}</span>
            </div>
          </div>

          <div className="px-2 pb-2">
            <div role="tablist" className="tabs tabs-box w-full">
              <button
                role="tab"
                className={`tab flex-1 ${refType === 'history' ? 'tab-active' : ''}`}
                onClick={() => setRefType('history')}
              >
                Saldo
              </button>
              <button
                role="tab"
                className={`tab flex-1 ${refType === 'point' ? 'tab-active' : ''}`}
                onClick={() => setRefType('point')}
              >
                Point
              </button>
            </div>
          </div>

          {refType === 'history' && <HistorySection id={membership?.id} membership={membership} />}
          {refType === 'point' && (
            <PointHistorySection id={membership?.id} membership={membership} />
          )}
        </>
      )}
    </Drawer.Content>
  );
};

export default DrawerDetail;
