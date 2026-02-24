/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState } from 'react';
import { useSelector } from 'react-redux';

import { CloseIcon, HistoryIcon, PlusIcon, RefreshIcon } from '../../../components/ui/icon';
import { Drawer } from '../../../components/ui';
import HistorySection from './history';
import useDrawer from '../../../utils/drawer';
import { FiSettings } from 'react-icons/fi';
import UpdateSession from './update';

const DrawerDetail = ({ type, membership, onClose }) => {
  const { drawerRef, open: openDrawer, close: closeDrawer, isOpen: drawerOpen } = useDrawer();

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
      {refType === 'history' && <HistorySection id={membership?.id} />}
      {refType === 'update' && <UpdateSession id={membership?.id} />}
    </Drawer.Content>
  );
};

export default DrawerDetail;
