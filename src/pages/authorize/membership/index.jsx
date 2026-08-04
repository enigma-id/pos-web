/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useNavigate } from 'react-router-dom';

import CardContent from './card.content';
import DrawerCreate from './drawer.create';
import DrawerDetail from './drawer.detail';
import createTableConfig from './table.config';
import { Drawer, Modal, NFCField } from '../../../components/ui';
import {
  CardSearchIcon,
  PlusIcon,
  EditIcon,
  SearchIcon,
  WalletIcon,
} from '../../../components/ui/icon';
import useModal from '../../../components/ui/modal/hook';
import useTable from '../../../components/ui/table';
import useMembership from '../../../services/membership/hook';
import { showMembership } from '../../../utils/cache';
import useDrawer from '../../../utils/drawer';
import { useSelector } from 'react-redux';
import { currencyFormat } from '../../../utils/common';

const MembershipScreen = () => {
  const navigate = useNavigate();
  const isOnline = useSelector(state => state?.Offline?.isOnline);
  const apiReachable = useSelector(state => state?.Offline?.apiReachable);
  const lastSyncTime = useSelector(state => state?.Offline?.lastSyncTime);

  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 200;

  const isOffline = !isOnline || apiReachable === false;

  const { open: openDrawer, isOpen: drawerOpen } = useDrawer();
  const { openModal, closeModal } = useModal();

  const [search, setSearch] = React.useState('');

  const [type, setType] = React.useState('');
  const [memberships, setMemberships] = React.useState([]);
  const [data, setData] = React.useState(null);

  const { checkSaldo, checkResult, getMember, getMemberResult, membershipData } = useMembership();

  React.useEffect(() => {
    getMember({ limit: itemsPerPage, page: 1 });
  }, [lastSyncTime]);

  // Search online → panggil endpoint; kosong → baca cache
  React.useEffect(() => {
    const t = setTimeout(
      () => {
        getMember(search ? { search } : {});
      },
      search ? 1000 : 0
    );
    return () => clearTimeout(t);
  }, [search]);

  // Re-read cache ketika queue berubah (remove/sync dari PendingDrawer)
  const isOnlineRef = React.useRef(isOnline);
  const apiReachableRef = React.useRef(apiReachable);
  isOnlineRef.current = isOnline;
  apiReachableRef.current = apiReachable;
  React.useEffect(() => {
    const handler = () => {
      if (isOnlineRef.current && apiReachableRef.current !== false) return;
      getMember({ limit: itemsPerPage, page: 1 });
    };
    window.addEventListener('pending-queue-changed', handler);
    return () => window.removeEventListener('pending-queue-changed', handler);
  }, []);

  // Sync sessionData from hook into local state
  React.useEffect(() => {
    if (membershipData || getMemberResult?.isSuccess) {
      setMemberships(membershipData || getMemberResult?.data?.data || []);
    }
  }, [membershipData, getMemberResult]);

  const handleRead = uid => {
    if (isOffline) {
      const membership = showMembership(uid);
      onScanSuccess(membership);
    } else {
      const params = { card_id: uid };
      checkSaldo(params);
    }
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
              setOfflineMessage('');
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
        {/* Header */}
        <div className="border-base-200 bg-base-100 flex h-[62px] border-t border-b">
          <div className="border-base-200 flex-1 border-r">
            <div className="relative flex h-full w-full items-center">
              <div className="absolute left-4">
                <SearchIcon />
              </div>
              <input
                name="search"
                placeholder="Search..."
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                }}
                className="h-full w-full pl-15 focus-visible:!outline-none"
              />
            </div>
          </div>
          <div className="flex-1 overflow-x-auto">
            <div className="flex h-full place-content-end place-items-center gap-2">
              <div
                className="btn bg-primary/15 text-primary h-full rounded-none border-0 px-4"
                onClick={() => navigate('/membership/create-manual')}
              >
                <EditIcon /> Create (Manual)
              </div>
              <div
                className="btn bg-primary/15 text-primary h-full rounded-none border-0 px-4"
                onClick={() => navigate('/membership/topup-manual')}
              >
                <CardSearchIcon /> Topup (Manual)
              </div>
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
          </div>
        </div>

        {/* Card */}
        <div>
          <div className="flex h-[calc(100vh-160px)] flex-col">
            <div className="flex-1 overflow-auto">
              <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {memberships
                  .filter(item => {
                    if (!search) return true;
                    const q = search.toLowerCase();
                    return (
                      (item?.name || '').toLowerCase().includes(q) ||
                      (item?.reff_code || '').toLowerCase().includes(q)
                    );
                  })
                  .map((item, index) => (
                    <div
                      key={index}
                      className="border-base-200 bg-base-100 h-50 cursor-pointer overflow-auto rounded-xl border p-4"
                    >
                      <div className="text-2xl font-semibold tracking-wide capitalize">
                        {item?.name}
                      </div>
                      <div className="text-base-300 mt-2 text-[16px] font-thin tracking-wide">
                        {item?.reff_code}
                      </div>
                      <div className="text-primary mt-2 flex place-items-center gap-2 text-[16px] font-semibold tracking-wide">
                        <WalletIcon />
                        {currencyFormat(item?.saldo)}
                      </div>
                      <div
                        className="btn btn-block btn-soft btn-primary mt-4"
                        onClick={() => {
                          setData(item);
                          setType('detail');
                          openDrawer();
                        }}
                      >
                        See details
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <DrawerCreate type={type} onClose={() => setType('')} onRefresh={() => getMember()} />

      <DrawerDetail
        membership={data}
        type={type}
        onClose={() => setType('')}
        onRefresh={() => getMember()}
      />
    </Drawer.Wrapper>
  );
};

export default MembershipScreen;
