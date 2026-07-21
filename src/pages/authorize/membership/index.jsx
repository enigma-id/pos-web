/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';

import CardContent from './card.content';
import DrawerCreate from './drawer.create';
import DrawerDetail from './drawer.detail';
import createTableConfig from './table.config';
import { Drawer, Modal, NFCField } from '../../../components/ui';
import { CardSearchIcon, PlusIcon } from '../../../components/ui/icon';
import useModal from '../../../components/ui/modal/hook';
import useTable from '../../../components/ui/table';
import useMembership from '../../../services/membership/hook';
import { getCache, getMemberCache, setMemberCache } from '../../../utils/cache';
import useDrawer from '../../../utils/drawer';

const TABLE_CACHE_KEY = 'cache_table_membership';

const MembershipScreen = () => {
  const {  open: openDrawer, isOpen: drawerOpen } = useDrawer();

  const { checkSaldo, checkResult } = useMembership();
  const { openModal, closeModal } = useModal();

  const [type, setType] = React.useState('');
  const [data, setData] = React.useState(null);
  const [cardIdBuffer, setCardIdBuffer] = React.useState('');
  const [offlineMessage, setOfflineMessage] = React.useState('');
  const scanConsumed = React.useRef(false);

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
    scanConsumed.current = false;
    setCardIdBuffer(uid);

    // Offline + cache hit → skip fetch entirely
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const cached = getMemberCache(uid);
      if (cached) {
        setOfflineMessage('');
        onScanSuccess(cached);
        return;
      }
      // No cache → show message, re-open modal so message prop applies
      const msg = 'Member data not available offline. Please scan while online first to cache.';
      setOfflineMessage(msg);
      openModal(
        <NFCField onRead={handleRead} isOpen={true} onClose={closeModal} result={checkResult} message={msg} />,
        'w-md'
      );
      return;
    }

    const params = { card_id: uid };
    checkSaldo(params);
  };

  const onScan = () => {
    openModal(
      <NFCField onRead={handleRead} isOpen={true} onClose={closeModal} result={checkResult} message={offlineMessage} />,
      'w-md'
    );
  };

  const onScanSuccess = data => {
    // Cache member data for offline use
    if (data?.card_id) {
      setMemberCache(data.card_id, data);
    }

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
              setOfflineMessage('')
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

  // Online success → cache + proceed
  React.useEffect(() => {
    if (checkResult?.isSuccess && !scanConsumed.current) {
      scanConsumed.current = true;
      onScanSuccess(checkResult?.data?.data);
    }
  }, [checkResult]);

  // Offline/error fallback → try cache (individual first, then table list)
  React.useEffect(() => {
    if (checkResult?.isError && cardIdBuffer && !scanConsumed.current) {
      scanConsumed.current = true;

      // 1. Try individual cache
      let cached = getMemberCache(cardIdBuffer);

      // 2. Fallback: lookup from cached table list by card_id
      if (!cached) {
        const tableCache = getCache(TABLE_CACHE_KEY);
        const list = Array.isArray(tableCache?.data) ? tableCache.data : [];
        cached = list.find(m => String(m?.card_id) === String(cardIdBuffer));
      }

      if (cached) {
        // closeModal();
        // setOfflineMessage('');
        onScanSuccess(cached);
      }
    }
  }, [checkResult, cardIdBuffer]);

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
