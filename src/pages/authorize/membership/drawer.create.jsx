/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { Drawer } from '../../../components/ui';
import CreateSection from './create';
import useDrawer from '../../../utils/drawer';

const DrawerCreate = ({ type, onClose, onRefresh }) => {
  const { drawerRef, open: openDrawer, close: closeDrawer } = useDrawer();

  const handleClose = () => {
    closeDrawer();
    onClose?.();
  };

  React.useEffect(() => {
    if (type === 'create') {
      openDrawer();
    }
  }, [type]);

  return (
    <Drawer.Content drawerRef={drawerRef} title="Create New Member" close={handleClose}>
      <CreateSection
        onClose={() => {
          handleClose();
          onRefresh();
        }}
      />
    </Drawer.Content>
  );
};

export default DrawerCreate;
