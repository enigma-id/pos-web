/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { FaCopy } from 'react-icons/fa';
import { useSelector } from 'react-redux';

import {
  EmptySection,
  Kitchen,
  Receipt,
  OrderDetails,
  Refund,
  CopyOrder,
} from '../../../components/ui';
import { MoneysIcon, PrintIcon, SearchIcon, TrashIcon } from '../../../components/ui/icon';
import useModal from '../../../components/ui/modal/hook';
import useCart from '../../../services/cart/hook';
import useOrder from '../../../services/sales/order/hook';
import { currencyFormat, dateFormat } from '../../../utils/common';
import { usePrintWindow } from '../../../utils/print';

const BillScreen = () => {
  const [detail, setDetail] = React.useState(null);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [search, setSearch] = React.useState('');
  const isOnline = useSelector(state => state?.Offline?.isOnline);
  const apiReachable = useSelector(state => state?.Offline?.apiReachable);
  const lastSyncTime = useSelector(state => state?.Offline?.lastSyncTime);
  const offlinePendingCount = useSelector(state => state?.Offline?.pendingCount);

  const { show, showResult } = useOrder();
  const { bill, billResult, billData } = useCart();
  const { openModal, closeModal } = useModal();

  const { open } = usePrintWindow({ title: 'Print Preview', autoClose: true });

  const handleOpenPrintReceipt = () => {
    open(<Receipt data={detail} />);
  };

  const handleOpenPrintKitchen = () => {
    open(<Kitchen data={detail} />);
  };

  const onRefund = (id, status) => {
    openModal(
      <Refund
        id={id}
        status={status}
        onClose={() => {
          bill();
          closeModal();
        }}
      />,
      'w-md'
    );
  };

  React.useEffect(() => {
    bill(search);
  }, [lastSyncTime]);

  // Re-read cache when offline pending count changes
  React.useEffect(() => {
    if (isOnline && apiReachable !== false) return;
    bill();
  }, [offlinePendingCount]);

  // Search online → fetch; kosong → baca cache (online/offline sama)
  React.useEffect(() => {
    const t = setTimeout(
      () => {
        bill(search);
      },
      search ? 1000 : 0
    );
    return () => clearTimeout(t);
  }, [search]);

  // Reset to first item on new data
  React.useEffect(() => {
    if (billData || billResult?.isSuccess) {
      setSelectedIndex(0);
      setDetail(null);
    }
  }, [billData]);

  // Fetch or resolve detail when selected index changes
  React.useEffect(() => {
    const list = billData || billResult?.data?.data || [];
    const selected = list[selectedIndex];
    if (!selected) return;

    // Offline → render from list data (already has items from /openbill)
    if (selected?.from_queue || !isOnline || apiReachable === false) {
      setDetail(selected);
      return;
    }

    // Online → fetch full detail from server
    if (selected?.id) {
      show(selected.id);
    }
  }, [billData, selectedIndex]);

  React.useEffect(() => {
    if (showResult?.isSuccess) {
      const detailData = showResult?.data?.data;
      setDetail(detailData);
    }
  }, [showResult]);

  const data = (billData || billResult?.data?.data || []).filter(item => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (item?.bill_name || '').toLowerCase().includes(q) ||
      (item?.code || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="border-base-200 flex w-100 flex-col overflow-y-auto border-r border-l bg-white">
        <div className="h-16">
          <div className="border-base-200 relative flex h-full w-full items-center border-b border-l">
            <div className="absolute left-4">
              <SearchIcon />
            </div>
            <input
              name="search"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-full w-full pl-15 focus-visible:outline-none!"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {data
            ?.filter(item => {
              if (!search) return true;
              const q = search.toLowerCase();
              return (
                (item?.bill_name || '').toLowerCase().includes(q) ||
                (item?.code || '').toLowerCase().includes(q)
              );
            })
            ?.map((item, index) => (
              <div
                key={item.id}
                onClick={() => setSelectedIndex(index)}
                className={`border-base-200 cursor-pointer border-b p-4 ${
                  selectedIndex === index ? 'bg-gray-100' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex place-content-between">
                  <div className="flex place-items-center gap-4">
                    <div className={`text-base ${selectedIndex === index ? 'text-primary' : ''}`}>
                      <MoneysIcon />
                    </div>
                    <div>
                      <div className={`text-base ${selectedIndex === index ? 'text-primary' : ''}`}>
                        {currencyFormat(item?.total_charges)}
                      </div>
                      <div className="text-base-300 text-xs">{item?.bill_name || '-'}</div>
                    </div>
                  </div>
                  <div className="flex flex-col place-content-between">
                    <div className="text-base-300 text-end text-sm">
                      {item?.needs_sync && (
                        <span className="badge badge-warning badge-xs me-1">pending sync</span>
                      )}
                      {item?.code}
                    </div>

                    <div className="text-base-300 text-end text-xs">
                      {dateFormat(item?.ordered_at)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Detail View */}
      {detail ? (
        <div className="h-full w-full">
          <div className="bg-base-100 h-16 w-full">
            <div className="flex h-full flex-1/2 place-content-end place-items-center">
              {/* <div
                className="bg-success text-base-100 flex h-full cursor-pointer place-items-center gap-2 px-4 text-sm capitalize"
                onClick={onCopyOrder}
              >
                <FaCopy />
                copy order
              </div> */}
              <div
                className="bg-primary text-base-100 flex h-full cursor-pointer place-items-center gap-2 px-4 text-sm capitalize"
                onClick={handleOpenPrintReceipt}
              >
                <PrintIcon />
                print receipt
              </div>
              <div
                className="bg-base-content text-base-100 flex h-full cursor-pointer place-items-center gap-2 px-4 text-sm capitalize"
                onClick={handleOpenPrintKitchen}
              >
                <PrintIcon />
                print kitchen
              </div>
              {isOnline && apiReachable !== false && (
                <div
                  className="bg-error text-base-100 flex h-full cursor-pointer place-items-center gap-2 px-4 text-sm capitalize"
                  onClick={() => onRefund(detail?.id, detail?.status)}
                >
                  <TrashIcon />
                  {detail?.status === 'pending' ? 'cancel' : 'refund'}
                </div>
              )}
            </div>
          </div>

          <div className="flex h-[calc(100vh-64px)] w-full place-content-center overflow-x-auto py-20">
            <div className="w-2/4">
              <OrderDetails data={detail} />
            </div>
          </div>
        </div>
      ) : (
        <div className="h-full w-full">
          <EmptySection />
        </div>
      )}
    </div>
  );
};

export default BillScreen;
