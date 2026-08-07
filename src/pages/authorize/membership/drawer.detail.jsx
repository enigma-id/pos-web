/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState } from 'react';
import { FiSettings } from 'react-icons/fi';

import HistorySection from './history';
import UpdateSession from './update';
import { Drawer } from '../../../components/ui';
import { CloseIcon, HistoryIcon, PlusIcon, RefreshIcon } from '../../../components/ui/icon';
import useDrawer from '../../../utils/drawer';

const DrawerDetail = ({ type, membership, onClose, onRefresh }) => {
  const { drawerRef, open: openDrawer, close: closeDrawer } = useDrawer();

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

  return (
    <Drawer.Content
      drawerRef={drawerRef}
      title={membership?.name}
      headerAction={
        <div className="gap-2">
          {refType === 'history' ? (
            <div className="btn btn-ghost btn-sm btn-circle" onClick={() => setRefType('update')}>
              <FiSettings className="h-5 w-5" />
            </div>
          ) : (
            <div className="btn btn-ghost btn-sm btn-circle" onClick={() => setRefType('history')}>
              <HistoryIcon className="h-5 w-5" />
            </div>
          )}

          <div className="btn btn-ghost btn-sm btn-circle" onClick={handleClose}>
            <CloseIcon />
          </div>
        </div>
      }
    >
      {refType === 'history' && <HistorySection id={membership?.id} membership={membership} />}
      {refType === 'update' && (
        <UpdateSession
          id={membership?.id}
          membership={membership}
          onClose={() => {
            closeDrawer();
            onClose?.();
          }}
          onRefresh={() => onRefresh?.()}
        />
      )}
    </Drawer.Content>
  );
};

export default DrawerDetail;
