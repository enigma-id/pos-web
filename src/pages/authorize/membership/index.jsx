/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';

import CardContent from './card.content';
import createTableConfig from './table.config';
import { Drawer, Modal, NFCField } from '../../../components/ui';
import { CardSearchIcon, PlusIcon } from '../../../components/ui/icon';
import useModal from '../../../components/ui/modal/hook';
import useTable from '../../../components/ui/table';
import useMembership from '../../../services/membership/hook';
import useDrawer from '../../../utils/drawer';
import DrawerCreate from './drawer.create';
import DrawerDetail from './drawer.detail';

const MembershipScreen = () => {
  const { drawerRef, open: openDrawer, close: closeDrawer, isOpen: drawerOpen } = useDrawer();

  const { checkSaldo, checkResult } = useMembership();
  const { openModal, closeModal } = useModal();

  const [type, setType] = React.useState('');
  const [data, setData] = React.useState(null);

  const tableConfig = React.useMemo(() => {
    return createTableConfig({
      onShow: v => {
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

  const onScan = () => {
    openModal(
      <NFCField onRead={handleRead} isOpen={true} onClose={closeModal} result={checkResult} />,
      'w-md'
    );
  };

  const onScanSuccess = data => {
    openModal(
      <>
        <Modal.Header
          onClose={() => {
            closeModal();
            setData(null);
          }}
        >
          <div className="text-[16px] font-semibold tracking-wide">Membership Card</div>
        </Modal.Header>
        <Modal.Body full>
          <CardContent
            data={data}
            onClose={() => {
              closeModal();
              setData(null);
              Table.boot();
            }}
          />
        </Modal.Body>
      </>,
      'w-md'
    );
  };

  React.useEffect(() => {
    if (checkResult?.isSuccess) {
      onScanSuccess(checkResult?.data?.data);
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
              onClick={onScan}
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
      </div>

      <DrawerCreate type={type} onClose={() => setType('')} onRefresh={() => Table.boot()} />

      <DrawerDetail membership={data} type={type} onClose={() => setType('')} />
    </Drawer.Wrapper>
  );
};

export default MembershipScreen;
