/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';

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
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 25;
  const [orderDetail, setOrderDetail] = React.useState(null);

  const { session, sessionResult, show, showResult } = useSession();

  const { show: showOrder, showResult: showOrderResult } = useOrder();

  const { drawerRef, open: openDrawer, close: closeDrawer } = useDrawer();
  const { openModal, closeModal } = useModal();

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

  const handleOpen = async v => {
    openDrawer();
    showOrder(v);
  };

  const onRefund = async id => {
    openModal(
      <Refund
        id={id}
        onClose={() => {
          show(sessionResult?.data?.data?.[selectedIndex]?.id);
          closeModal();
          closeDrawer();
        }}
      />,
      'w-md'
    );
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  React.useEffect(() => {
    const delayDebounceFn = setTimeout(
      () => {
        session({ search, limit: itemsPerPage, page: currentPage });
      },
      search ? 1000 : 0
    );

    return () => clearTimeout(delayDebounceFn);
  }, [search, currentPage]);

  React.useEffect(() => {
    if (sessionResult?.isSuccess) {
      setSelectedIndex(0);
      setDetail(null);
    }
  }, [sessionResult]);

  React.useEffect(() => {
    if (sessionResult?.isSuccess) {
      show(sessionResult?.data?.data?.[selectedIndex]?.id);
    }
  }, [sessionResult, selectedIndex]);

  React.useEffect(() => {
    if (showResult?.isSuccess) {
      setDetail(showResult?.data?.data);
    }
  }, [showResult]);

  React.useEffect(() => {
    if (showOrderResult?.isSuccess) {
      setOrderDetail(showOrderResult?.data?.data);
    }
  }, [showOrderResult]);

  const data = sessionResult?.data?.data || [];
  const total = sessionResult?.data?.total || 0;
  const totalPages = Math.ceil(total / itemsPerPage);

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
                placeholder="Search session..."
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                }}
                className="h-full w-full pl-15 focus-visible:!outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {data.map((item, index) => (
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
                      <div className={`text-base ${selectedIndex === index ? 'text-primary' : ''}`}>
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
                    className={`${item?.status === 'active' ? 'bg-base-300' : 'bg-success'} h-fit w-fit rounded-full px-4 py-1 text-[11px] text-white`}
                  >
                    {item?.status}
                  </div>
                </div>
              </div>
            ))}
          </div>

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
              disabled={currentPage === totalPages || data.total === 0}
              className="disabled:btn-disabled btn"
            >
              Next
            </button>
          </div>
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
              <div className="h-fit w-2/4 rounded-xl bg-white p-6 shadow">
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
                    <span className="font-semibold">Outlet :</span> {detail?.outlet?.alias || '-'}
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
                    <span className="text-sm">{currencyFormat(detail?.cash_due)}</span>
                  </div>

                  <div className="flex place-content-between place-items-center py-2">
                    <div>
                      <span className="text-sm">Outstanding Bill Payments</span>
                    </div>
                    <span className="text-sm">{currencyFormat(detail?.bill_payment)}</span>
                  </div>

                  <div className="flex place-content-between place-items-center py-2">
                    <div>
                      <span className="text-sm">Total Sales</span>
                    </div>
                    <span className="text-sm">
                      {currencyFormat(detail?.summary_order?.total_nett)}
                    </span>
                  </div>
                  <div className="flex place-content-between place-items-center py-2">
                    <div>
                      <span className="text-sm">Total Discount</span>
                    </div>
                    <span className="text-sm">
                      {currencyFormat(detail?.summary_order?.total_discount)}
                    </span>
                  </div>
                  <div className="flex place-content-between place-items-center py-2">
                    <div>
                      <span className="text-sm">Total After Discount</span>
                    </div>
                    <span className="text-sm">
                      {currencyFormat(
                        detail?.summary_order?.total_charges -
                          detail?.summary_order?.total_service_charge
                      )}
                    </span>
                  </div>
                  <div className="flex place-content-between place-items-center py-2">
                    <div>
                      <span className="text-sm">Total Service</span>
                    </div>
                    <span className="text-sm">
                      {currencyFormat(detail?.summary_order?.total_service_charge)}
                    </span>
                  </div>
                  <div className="flex place-content-between place-items-center py-2">
                    <div>
                      <span className="text-sm">Grand Total</span>
                    </div>
                    <span className="text-sm">
                      {currencyFormat(detail?.summary_order?.total_charges)}
                    </span>
                  </div>
                  <div className="flex place-content-between place-items-center py-2">
                    <div>
                      <span className="text-sm">Outstanding Bills</span>
                    </div>
                    <span className="text-sm">
                      {currencyFormat(detail?.summary_order?.total_openbill)}
                    </span>
                  </div>
                </div>

                <div className="border-base-200 border-b pt-4 pb-2">
                  <div className="mb-2 text-sm font-semibold">Topup :</div>
                  {detail?.topups?.map((item, i) => (
                    <div key={i} className="flex place-content-between place-items-center py-2">
                      <div className="text-sm capitalize">{item?.name}</div>
                      <span className="text-sm">{currencyFormat(item?.nominal)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-base-200 border-b pt-4 pb-2">
                  <div className="mb-2 text-sm font-semibold">Payments :</div>
                  {detail?.cash_payments?.map((item, i) => (
                    <div key={i} className="flex place-content-between place-items-center py-2">
                      <div className="text-sm">{item?.payment_name || 'Cash'}</div>
                      <span className="text-sm">{currencyFormat(item?.subtotal)}</span>
                    </div>
                  ))}
                </div>

                {/* <div className="border-base-200 border-b pt-4 pb-2">
                  <div className="mb-2 text-sm font-semibold">Sales Channels :</div>
                  {detail?.sales_channels?.map((item, i) => (
                    <div key={i} className="flex place-content-between place-items-center py-2">
                      <div>
                        <span className="bg-base-content rounded-lg px-3 py-1 text-sm text-white">
                          {item?.transaction_count}
                        </span>
                        <span className="ps-2 text-sm">{item?.channel_name || '-'}</span>
                      </div>
                      <span className="text-sm">{currencyFormat(item?.subtotal)}</span>
                    </div>
                  ))}
                </div> */}

                <div className="border-base-200 border-b pt-4 pb-2">
                  <div className="mb-2 text-sm font-semibold">Category Sold :</div>
                  {detail?.category_solds?.map((item, i) => (
                    <div key={i} className="flex place-content-between place-items-center py-2">
                      <div>
                        <span className="bg-base-content rounded-lg px-3 py-1 text-sm text-white">
                          {item?.quantity}
                        </span>
                        <span className="ps-2 text-sm">{item?.name || '-'}</span>
                      </div>
                      <span className="text-sm">{currencyFormat(item?.total_charges)}</span>
                    </div>
                  ))}
                </div>

                {/* <div className="border-base-200 border-b pt-4 pb-2">
                  <div className="mb-2 text-sm font-semibold">Catalog Sold :</div>
                  {detail?.catalog_solds?.map((item, i) => (
                    <div key={i} className="flex place-content-between place-items-center py-2">
                      <div>
                        <span className="bg-base-content rounded-lg px-3 py-1 text-sm text-white">
                          {item?.quantity}
                        </span>
                        <span className="ps-2 text-sm">{item?.catalog_name || '-'}</span>
                      </div>
                      <span className="text-sm">{currencyFormat(item?.quantity, false)}</span>
                    </div>
                  ))}
                </div> */}

                <div className="border-base-200 border-b pt-4 pb-2">
                  <div className="mb-2 text-sm font-semibold">Sales Order :</div>

                  <div className="grid grid-cols-2 gap-2">
                    {detail?.sales_orders?.map((data, i) => (
                      <div
                        key={i}
                        className="border-base-200 hover:border-primary hover:text-primary flex cursor-pointer place-content-between place-items-center gap-4 rounded border p-4"
                        onClick={() => handleOpen(data?.id)}
                      >
                        <div className="flex place-items-center gap-4">
                          <MoneysIcon />

                          <div>
                            <div className="text-base">{currencyFormat(data?.total_charges)}</div>
                            <div className="text-base-300 text-xs">
                              {dateFormat(data?.ordered_at)}
                            </div>
                          </div>
                        </div>

                        <div className="flex place-items-center gap-4">
                          <div className="text-base-300 text-base">{data?.code}</div>
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
            onClick={() => onRefund(orderDetail?.id)}
          >
            <TrashIcon />
            refund
          </div>
        </div>
      </Drawer.Content>
    </Drawer.Wrapper>
  );
};

export default ShiftScreen;
