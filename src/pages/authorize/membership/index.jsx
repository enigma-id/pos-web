/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';

import CardContent from './card.content';
import CreateSection from './create';
import DetailSession from './detail';
import createTableConfig from './table.config';
import { Dialog, Drawer, NFCField } from '../../../components/ui';
import { CardSearchIcon, PlusIcon } from '../../../components/ui/icon';
import useTable from '../../../components/ui/table';
import useMembership from '../../../services/membership/hook';
import useDrawer from '../../../utils/drawer';
import useDialogModal from '../../../utils/modal';

const MembershipScreen = () => {
  const { drawerRef, open: openDrawer, close: closeDrawer, isOpen: drawerOpen } = useDrawer();

  const {
    dialogRef,
    open: openModal,
    close: closeModal,
    isOpen,
  } = useDialogModal({
    onClose: () => {
      setData(null);
    },
  });

  const { checkSaldo, checkResult } = useMembership();

  const [type, setType] = React.useState('detail');
  const [data, setData] = React.useState(null);

  const tableConfig = React.useMemo(() => {
    return createTableConfig({
      onClick: v => {
        setData(v);
        setType('detail');
        openDrawer();
      },
    });
  }, []);

  const Table = useTable('membership', tableConfig);

  const handleRead = uid => {
    const params = {
      card_id: uid,
    };

    checkSaldo(params);
  };

  React.useEffect(() => {
    if (checkResult?.isSuccess) {
      setData(checkResult?.data?.data);
    }
  }, [checkResult]);

  React.useEffect(() => {
    if (!drawerOpen) {
      setData(null);
    }
  }, [drawerOpen]);

  return (
    <Drawer.Wrapper>
      <div>
        <Table.Tools>
          <div className="flex h-full place-content-end place-items-center">
            <div
              className="btn bg-primary/15 text-primary h-full rounded-none border-0 px-6"
              onClick={openModal}
            >
              <CardSearchIcon /> Scan Card
            </div>
            <div
              className="btn btn-primary h-full rounded-none border-0 px-6"
              onClick={() => {
                setType('create');
                openDrawer();
              }}
            >
              <PlusIcon /> New Membership
            </div>
          </div>
        </Table.Tools>
        <Table.Card />
        <Table.Pagination />

        <Dialog.Wrapper ref={dialogRef}>
          <Dialog.Header
            onClose={() => {
              closeModal();
              setData(null);
            }}
          >
            <div className="text-[16px] font-semibold tracking-wide">
              {data ? 'Membership Card' : 'Scan Membership Card'}
            </div>
          </Dialog.Header>
          <Dialog.Body>
            {data ? (
              <CardContent
                data={data}
                onClose={() => {
                  closeModal();
                  setData(null);
                }}
              />
            ) : (
              <NFCField onRead={handleRead} isOpen={isOpen} onClose={closeModal} />
            )}
          </Dialog.Body>
        </Dialog.Wrapper>
      </div>

      <Drawer.Content
        drawerRef={drawerRef}
        title={type === 'create' ? 'Create New Member' : 'Membership Details'}
        close={closeDrawer}
      >
        {type === 'create' && (
          <CreateSection
            onClose={() => {
              closeDrawer();
              Table.boot();
            }}
          />
        )}

        {type === 'detail' && data && (
          <DetailSession
            id={data?.id}
            onClose={() => {
              closeDrawer();
              Table.boot();
            }}
            reboot={() => {
              Table.boot();
            }}
            isOpen={drawerOpen}
          />
        )}
      </Drawer.Content>
    </Drawer.Wrapper>
  );
};

export default MembershipScreen;
