/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useSelector } from 'react-redux';

import { EmptySection, Kitchen, OrderDetails, Receipt, Refund } from '../../../components/ui';
import { MoneysIcon, PrintIcon, SearchIcon, TrashIcon } from '../../../components/ui/icon';
import useModal from '../../../components/ui/modal/hook';
import useOrder from '../../../services/sales/order/hook';
import { currencyFormat, dateFormat } from '../../../utils/common';
import { usePrintWindow } from '../../../utils/print';

const HistoryScreen = () => {
  const [detail, setDetail] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [data, setData] = React.useState([]);
  const isOnline = useSelector(state => state?.Offline?.isOnline);
  const apiReachable = useSelector(state => state?.Offline?.apiReachable);
  const lastSyncTime = useSelector(state => state?.Offline?.lastSyncTime);
  const sessionAuth = useSelector(state => state?.Auth?.session);

  const [currentPage, setCurrentPage] = React.useState(1);

  const {
    history,
    historyResult,
    historyData,
    show: showOrder,
    showResult: showOrderResult,
  } = useOrder();

  const isOffline = !isOnline || apiReachable === false;

  const meta = historyResult?.data?.meta || {};
  const total = meta?.total || 0;
  const totalPages = meta?.total_pages || 0;

  const { openModal, closeModal } = useModal();

  const { open } = usePrintWindow({ title: 'Print Preview', autoClose: true });

  const handleOpenPrint = () => {
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
          history();
          closeModal();
        }}
      />,
      'w-md'
    );
  };

  // Load list: search online (debounce) / pagination → satu effect, satu request.
  // On mount (search='', page=1) → history() polos — App.jsx prefetch pakai
  // history() juga → RTK Query dedupe. Page change → { page } aja.
  React.useEffect(() => {
    const t = setTimeout(
      () => {
        history(search ? { search } : currentPage === 1 ? undefined : { page: currentPage });
      },
      search ? 1000 : 0
    );
    return () => clearTimeout(t);
  }, [search, currentPage, lastSyncTime]);

  // Re-read cache when offline pending count changes
  const offlinePendingCount = useSelector(state => state?.Offline?.pendingCount);
  React.useEffect(() => {
    if (isOnline && apiReachable !== false) return;
    history();
  }, [offlinePendingCount]);

  // Re-read cache when queue changed (remove from PendingDrawer)
  const isOnlineRef = React.useRef(isOnline);
  const apiReachableRef = React.useRef(apiReachable);
  isOnlineRef.current = isOnline;
  apiReachableRef.current = apiReachable;
  React.useEffect(() => {
    const handler = () => {
      if (isOnlineRef.current && apiReachableRef.current !== false) return;
      history();
    };
    window.addEventListener('pending-queue-changed', handler);
    return () => window.removeEventListener('pending-queue-changed', handler);
  }, []);

  // Sync historyData from hook into local state
  React.useEffect(() => {
    if (historyData || historyResult?.isSuccess) {
      setSelectedIndex(0);
      setDetail(null);
      setData(historyData || historyResult?.data?.data || []);
    }
  }, [historyData, historyResult]);

  // Fetch or resolve detail
  React.useEffect(() => {
    const list = data;
    const selected = list[selectedIndex];
    if (!selected) return;

    // Offline / queue item → render from list data
    if (!isOnline || apiReachable === false) {
      setDetail(selected);
      return;
    }

    // Online → fetch full detail from server
    if (selected?.id) {
      showOrder(selected.id);
    }
  }, [data, selectedIndex]);

  React.useEffect(() => {
    if (showOrderResult?.isSuccess) {
      setDetail(showOrderResult?.data?.data);
    }
  }, [showOrderResult]);

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
          {data.length === 0 && (
            <div className="flex h-full place-content-center place-items-center">
              <div className="text-base-300 text-sm">No history found.</div>
            </div>
          )}
          {data
            ?.filter(item => {
              if (!search) return true;
              const q = search.toLowerCase();
              return (
                (item?.bill_name || '').toLowerCase().includes(q) ||
                (item?.code || '').toLowerCase().includes(q) ||
                (item?.note || '').toLowerCase().includes(q) ||
                (item?.membership?.name || '').toLowerCase().includes(q) ||
                (item?.customer_name || '').toLowerCase().includes(q)
              );
            })
            .map((item, index) => (
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
                      <div className="text-base-300 text-xs">
                        {item?.bill_name
                          ? item?.bill_name
                          : item?.membership
                            ? item?.membership?.name
                            : item?.note
                              ? item?.note
                              : '-'}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col place-content-between">
                    <div className="text-base-300 text-end text-sm">
                      {item?.is_synced === false && (
                        <span className="badge badge-warning badge-xs me-1">pending sync</span>
                      )}
                      {item?.code}
                    </div>

                    <div className="text-base-300 text-end text-xs">
                      {dateFormat(item?.paid_at)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
        {!isOffline && (
          <div className="border-base-200 flex justify-end gap-4 border-t p-4">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="disabled:btn-disabled btn"
            >
              Prev
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || total === 0}
              className="disabled:btn-disabled btn"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Detail View */}
      {detail ? (
        <div className="h-full w-full">
          <div className="bg-base-100 h-16 w-full">
            <div className="flex h-full flex-1/2 place-content-end place-items-center">
              <div
                className="bg-primary text-base-100 flex h-full cursor-pointer place-items-center gap-2 px-4 text-sm capitalize"
                onClick={handleOpenPrint}
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
              {isOnline && apiReachable !== false && sessionAuth?.user?.role === 'manager' && (
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

export default HistoryScreen;
