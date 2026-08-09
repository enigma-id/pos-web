/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useSelector } from 'react-redux';
import { getCache, setCache } from '../../../utils/cache';

import {
  Drawer,
  EmptySection,
  Kitchen,
  OrderDetails,
  Receipt,
  Refund,
  Summary,
} from '../../../components/ui';
import {
  ArrowRightIcon,
  MoneysIcon,
  PrintIcon,
  SearchIcon,
  TrashIcon,
  WalletIcon,
} from '../../../components/ui/icon';
import useModal from '../../../components/ui/modal/hook';
import useOrder from '../../../services/sales/order/hook';
import useSession from '../../../services/sales/session/hook';
import { currencyFormat, dateFormat } from '../../../utils/common';
import useDrawer from '../../../utils/drawer';
import { usePrintWindow } from '../../../utils/print';

const ShiftScreen = () => {
  const [detail, setDetail] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [data, setData] = React.useState([]);
  const [orderDetail, setOrderDetail] = React.useState(null);
  const isOnline = useSelector(state => state?.Offline?.isOnline);
  const apiReachable = useSelector(state => state?.Offline?.apiReachable);
  const lastSyncTime = useSelector(state => state?.Offline?.lastSyncTime);

  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 25;

  const {
    session,
    sessionResult,
    show: showSession,
    showResult: showSessionResult,
    sessionData,
  } = useSession();

  const { show: showOrder, showResult: showOrderResult } = useOrder();

  const { drawerRef, open: openDrawer, close: closeDrawer } = useDrawer();
  const { openModal, closeModal } = useModal();

  const isOffline = !isOnline || apiReachable === false;

  const meta = sessionResult?.data?.meta || {};
  const total = meta?.total || 0;
  const totalPages = meta?.total_pages || 0;

  const { open } = usePrintWindow({ title: 'Print Preview', autoClose: true });

  const handleOpenPrint = () => {
    open(<Receipt data={orderDetail} />);
  };

  const handleOpenPrintKitchen = () => {
    open(<Kitchen data={orderDetail} />);
  };

  const handleOpenPrintSummary = () => {
    open(<Summary data={detail} />);
  };

  const openOrder = async v => {
    openDrawer();

    if (isOffline) {
      setOrderDetail(v);
    } else {
      showOrder(v?.id);
    }
  };

  const onRefund = async (id, status) => {
    openModal(
      <Refund
        id={id}
        status={status}
        onClose={() => {
          if (isOffline) {
            // For offline, just close drawer
            closeDrawer();
          } else {
            showSession(sessionResult?.data?.data?.[selectedIndex]?.id);
          }
          closeModal();
          closeDrawer();
        }}
      />,
      'w-md'
    );
  };

  // Load list: search online (debounce) / pagination → satu effect, satu request.
  // On mount (search='', page=1) → session() polos — App.jsx prefetch pakai
  // session() juga → RTK Query dedupe. Page change → { page } aja.
  React.useEffect(() => {
    const t = setTimeout(
      () => {
        session(search ? { search } : currentPage === 1 ? undefined : { page: currentPage });
      },
      search ? 1000 : 0
    );
    return () => clearTimeout(t);
  }, [search, currentPage, lastSyncTime]);

  // Re-read cache ketika queue berubah (remove/sync dari PendingDrawer)
  const isOnlineRef = React.useRef(isOnline);
  const apiReachableRef = React.useRef(apiReachable);
  isOnlineRef.current = isOnline;
  apiReachableRef.current = apiReachable;
  React.useEffect(() => {
    const handler = () => {
      if (isOnlineRef.current && apiReachableRef.current !== false) return;
      session();
    };
    window.addEventListener('pending-queue-changed', handler);
    return () => window.removeEventListener('pending-queue-changed', handler);
  }, []);

  // Sync sessionData from hook into local state
  React.useEffect(() => {
    if (sessionData || sessionResult?.isSuccess) {
      setSelectedIndex(0);
      setDetail(null);
      setData(sessionData || sessionResult?.data?.data || []);
    }
  }, [sessionData, sessionResult]);

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
      showSession(selected.id);
    }
  }, [data, selectedIndex]);

  React.useEffect(() => {
    if (showSessionResult?.isSuccess) {
      setDetail(showSessionResult?.data?.data);
    }
  }, [showSessionResult]);

  React.useEffect(() => {
    if (showOrderResult?.isSuccess) {
      setOrderDetail(showOrderResult?.data?.data);
    }
  }, [showOrderResult]);

  return (
    <Drawer.Wrapper>
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
                onChange={e => {
                  setSearch(e.target.value);
                }}
                className="h-full w-full pl-15 focus-visible:!outline-none"
                disabled={isOffline}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {data.length === 0 && (
              <div className="flex h-full place-content-center place-items-center">
                <div className="text-base-300 text-sm">No sessions found.</div>
              </div>
            )}
            {data
              .filter(item => {
                if (!search) return true;
                const q = search.toLowerCase();
                return (item?.cashier?.name || '').toLowerCase().includes(q);
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
                        <WalletIcon />
                      </div>
                      <div>
                        <div
                          className={`text-base ${selectedIndex === index ? 'text-primary' : ''}`}
                        >
                          {item?.cashier?.name}
                        </div>
                        <div className="text-base-300 text-xs">
                          {dateFormat(item?.transaction_date, 'DD/MM/YYYY')}{' '}
                          {dateFormat(item?.started_at, 'HH:mm')} -{' '}
                          {dateFormat(item?.finished_at, 'HH:mm', '(ongoing)')}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`h-fit w-fit rounded-full px-4 py-1 text-[11px] text-white ${item?.status === 'opened' ? 'bg-primary' : item?.status === 'closed' ? 'bg-success' : 'bg-base-300'}`}
                    >
                      {item?.status}
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
                  className="bg-base-content text-base-100 flex h-full cursor-pointer place-items-center gap-2 px-4 text-sm capitalize"
                  onClick={handleOpenPrintSummary}
                >
                  <PrintIcon />
                  print summary
                </div>
              </div>
            </div>

            <div className="flex h-[calc(100vh-64px)] w-full place-content-center overflow-x-auto py-20">
              <div className="h-fit w-3/4 rounded-xl bg-white p-6 shadow">
                <div className="border-base-200 border-b py-4">
                  <div className="mb-2 text-sm">
                    <span className="font-semibold">Cashier :</span> {detail?.cashier?.name || '-'}
                  </div>
                  <div className="mb-2 text-sm">
                    <span className="font-semibold">Session time :</span>{' '}
                    {dateFormat(detail?.started_at, 'DD MMM YYYY HH:mm')} -{' '}
                    {dateFormat(detail?.finished_at, 'DD MMM YYYY HH:mm', '(ongoing)')}
                  </div>
                  <div className="mb-2 text-sm capitalize">
                    <span className="font-semibold">Outlet :</span> {detail?.outlet?.name || '-'}
                  </div>
                </div>

                <div className="border-base-200 border-b pt-4 pb-2">
                  <div className="mb-2 text-sm font-semibold">Cashflow Summary :</div>
                  <div className="flex place-content-between place-items-center py-2">
                    <div>
                      <span className="text-sm">Starting Cash</span>
                    </div>
                    <span className="text-sm">{currencyFormat(detail?.cash_started)}</span>
                  </div>

                  <div className="flex place-content-between place-items-center py-2">
                    <div>
                      <span className="text-sm">Ending Cash</span>
                    </div>
                    <span className="text-sm">{currencyFormat(detail?.cash_finished)}</span>
                  </div>

                  <div className="flex place-content-between place-items-center py-2">
                    <div>
                      <span className="text-sm">Expected Cash</span>
                    </div>
                    <span className="text-sm">
                      {currencyFormat(detail?.summary?.cash?.expected_cash)}
                    </span>
                  </div>

                  <div className="flex place-content-between place-items-center py-2">
                    <div>
                      <span className="text-sm">Topup Cash</span>
                    </div>
                    <span className="text-sm">
                      {currencyFormat(detail?.summary?.cash?.topup_cash)}
                    </span>
                  </div>

                  <div className="flex place-content-between place-items-center py-2">
                    <div>
                      <span className="text-sm">Outstanding Bills</span>
                    </div>
                    <span className="text-sm">
                      {currencyFormat(detail?.summary?.sales?.outstanding_bill)}
                    </span>
                  </div>

                  <div className="flex place-content-between place-items-center py-2">
                    <div>
                      <span className="text-sm">Outstanding Bill Payments</span>
                    </div>
                    <span className="text-sm">
                      {currencyFormat(detail?.summary?.sales?.outstanding_bill_payment)}
                    </span>
                  </div>

                  <div className="flex place-content-between place-items-center py-2">
                    <div>
                      <span className="text-sm">Total Sales</span>
                    </div>
                    <span className="text-sm">
                      {currencyFormat(detail?.summary?.sales?.total_sales)}
                    </span>
                  </div>
                  <div className="flex place-content-between place-items-center py-2">
                    <div>
                      <span className="text-sm">Total Discount</span>
                    </div>
                    <span className="text-sm">
                      {currencyFormat(detail?.summary?.sales?.total_discount)}
                    </span>
                  </div>
                  <div className="flex place-content-between place-items-center py-2">
                    <div>
                      <span className="text-sm">Total After Discount</span>
                    </div>
                    <span className="text-sm">
                      {currencyFormat(detail?.summary?.sales?.total_after_discount)}
                    </span>
                  </div>
                  <div className="flex place-content-between place-items-center py-2">
                    <div>
                      <span className="text-sm">Total Service</span>
                    </div>
                    <span className="text-sm">
                      {currencyFormat(detail?.summary?.sales?.total_service)}
                    </span>
                  </div>
                  <div className="flex place-content-between place-items-center py-2">
                    <div>
                      <span className="text-sm">Grand Total</span>
                    </div>
                    <span className="text-sm">
                      {currencyFormat(detail?.summary?.sales?.grand_total)}
                    </span>
                  </div>
                </div>

                <div className="border-base-200 border-b pt-4 pb-2">
                  <div className="mb-2 text-sm font-semibold">Topup :</div>
                  {detail?.summary?.topups?.map((item, i) => (
                    <div key={i} className="flex place-content-between place-items-center py-2">
                      <div className="text-sm capitalize">{item?.type}</div>
                      <span className="text-sm">{currencyFormat(item?.total_nominal)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-base-200 border-b pt-4 pb-2">
                  <div className="mb-2 text-sm font-semibold">Payments :</div>
                  {detail?.summary?.payment_methods?.map((item, i) => (
                    <div key={i} className="flex place-content-between place-items-center py-2">
                      <div className="text-sm">{item?.name}</div>
                      <span className="text-sm">{currencyFormat(item?.total_paid)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-base-200 border-b pt-4 pb-2">
                  <div className="mb-2 text-sm font-semibold">Category Sold :</div>
                  {detail?.summary?.category_solds?.map((item, i) => (
                    <div key={i} className="flex place-content-between place-items-center py-2">
                      <div>
                        <span className="bg-base-content rounded-lg px-3 py-1 text-sm text-white">
                          {item?.total_qty}
                        </span>
                        <span className="ps-2 text-sm">{item?.category_name || '-'}</span>
                      </div>
                      <span className="text-sm">{currencyFormat(item?.total_charges)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-base-200 border-b pt-4 pb-2">
                  <div className="mb-2 text-sm font-semibold">Sales Order :</div>

                  <div className="grid grid-cols-2 gap-2">
                    {detail?.orders?.map((oi, i) => (
                      <div
                        key={i}
                        className="border-base-200 hover:border-primary hover:text-primary flex cursor-pointer place-content-between place-items-center gap-4 rounded border p-4"
                        onClick={() => openOrder(oi)}
                      >
                        <div className="flex place-items-center gap-4">
                          <MoneysIcon />

                          <div>
                            <div className="text-base">{currencyFormat(oi?.total_charges)}</div>
                            <div className="text-base-300 text-xs">
                              {dateFormat(oi?.created_at)}
                            </div>
                          </div>
                        </div>

                        <div className="flex place-items-center gap-4">
                          <div className="text-base-300 text-base">{oi?.code}</div>
                          <ArrowRightIcon />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-base-300 flex place-content-between place-items-center py-4 text-base">
                  <div>{dateFormat(detail?.transaction_date, 'DD/MM/YYYY')}</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full w-full">
            <EmptySection />
          </div>
        )}
      </div>

      <Drawer.Content
        drawerRef={drawerRef}
        title="Order Details"
        close={closeDrawer}
        className="!bg-accent w-lg"
      >
        <div className="bg-accent flex h-[calc(100vh-200px)] flex-1 flex-col place-content-center overflow-y-auto p-6">
          <div className="mb-4 h-full w-full flex-1">
            <OrderDetails data={orderDetail} />
          </div>
        </div>

        <div className="border-base-200 bg-base-100 mt-3 flex min-h-15 border-t">
          <div
            className="bg-primary text-base-100 flex flex-1 cursor-pointer place-content-center place-items-center gap-2 px-4 text-sm capitalize"
            onClick={handleOpenPrintKitchen}
          >
            <PrintIcon />
            print kitchen
          </div>
          <div
            className="bg-base-content text-base-100 flex flex-1 cursor-pointer place-content-center place-items-center gap-2 px-4 text-sm capitalize"
            onClick={handleOpenPrint}
          >
            <PrintIcon />
            print receipt
          </div>
          <div
            className="bg-error text-base-100 flex flex-1 cursor-pointer place-content-center place-items-center gap-2 px-4 text-sm capitalize"
            onClick={() => onRefund(orderDetail?.id, orderDetail?.status)}
          >
            <TrashIcon />
            {orderDetail?.status === 'pending' ? 'cancel' : 'refund'}
          </div>
        </div>
      </Drawer.Content>
    </Drawer.Wrapper>
  );
};

export default ShiftScreen;
