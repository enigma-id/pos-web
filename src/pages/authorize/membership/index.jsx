import React from 'react';

import CardContent from './card.content';
import CreateSection from './create';
import DetailSession from './detail';
import createTableConfig from './table.config';
import { Drawer, NFCField } from '../../../components/ui';
import { CardSearchIcon, CloseIcon, PlusIcon } from '../../../components/ui/icon';
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
    console.log(checkResult);
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
          <div className="me-6 flex h-full place-content-end place-items-center gap-4">
            <div
              className="btn btn-primary btn-sm btn-outline rounded-full px-6"
              onClick={openModal}
            >
              <CardSearchIcon /> Scan Card
            </div>
            <div
              className="btn btn-primary btn-sm rounded-full px-6"
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

        <dialog ref={dialogRef} className="modal">
          <div className="bg-base-100 w-md rounded-lg">
            <div className="border-base-200 flex place-content-between place-items-center border-b px-6 py-4">
              <div className="text-[16px] font-semibold tracking-wide">
                {data ? 'Membership Card' : 'Scan Membership Card'}
              </div>
              <div
                className="btn btn-ghost btn-sm btn-circle"
                onClick={() => {
                  closeModal();
                  setData(null);
                }}
              >
                <CloseIcon />
              </div>
            </div>

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
          </div>
        </dialog>
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
