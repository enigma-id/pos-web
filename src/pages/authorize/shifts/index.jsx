/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useSelector } from 'react-redux';

import { Dialog, Drawer, EmptySection, Input } from '../../../components/ui';
import {
  ArrowRightIcon,
  MoneysIcon,
  PrintIcon,
  SearchIcon,
  TrashIcon,
  WalletIcon,
} from '../../../components/ui/icon';
import useOrder from '../../../services/sales/order/hook';
import useSession from '../../../services/sales/session/hook';
import { currencyFormat, dateFormat } from '../../../utils/common';
import useDrawer from '../../../utils/drawer';
import useDialogModal from '../../../utils/modal';

const ShiftScreen = () => {
  const FormState = useSelector(state => state?.Form);

  const [detail, setDetail] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 25;
  const [orderDetail, setOrderDetail] = React.useState(null);
  const [pin, setPin] = React.useState('');

  const { session, sessionResult, show, showResult } = useSession();

  const { show: showOrder, showResult: showOrderResult, cancel, cancelResult } = useOrder();

  const { drawerRef, open: openDrawer, close: closeDrawer } = useDrawer();

  const {
    dialogRef,
    open: openModal,
    close: closeModal,
  } = useDialogModal({
    onClose: () => {
      setOrderDetail(null);
    },
  });

  const handleOpen = async v => {
    openDrawer();
    showOrder(v);
  };

  const onCancel = () => {
    const payload = {
      pin,
    };

    cancel({ id: orderDetail?.id, payload });
  };

  React.useEffect(() => {
    if (cancelResult?.isSuccess) {
      show(sessionResult?.data?.data?.[selectedIndex]?.id);
      setPin('');
      closeModal();
      closeDrawer();
    }
  }, [cancelResult]);

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
                        {dateFormat(item?.transaction_date)}
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
                <div className="bg-base-content text-base-100 flex h-full cursor-pointer place-items-center gap-2 px-4 text-sm capitalize">
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
                    {dateFormat(detail?.started_at, 'DD MMM YYYY')} -{' '}
                    {dateFormat(detail?.finished_at, 'DD MMM YYYY', '(ongoing)')}
                  </div>
                  <div className="mb-2 text-sm capitalize">
                    <span className="font-semibold">Outlet :</span> {detail?.outlet?.alias || '-'}
                  </div>
                </div>

                <div className="border-base-200 border-b pt-4 pb-2">
                  <div className="mb-2 text-sm font-semibold">Catalog Solds :</div>
                  {detail?.catalog_solds?.map((item, i) => (
                    <div key={i} className="flex place-content-between place-items-center py-2">
                      <div>
                        <span className="bg-base-content rounded-lg px-3 py-1 text-sm text-white">
                          {item?.quantity}
                        </span>
                        <span className="ps-2 text-sm">{item?.catalog_name || '-'}</span>
                      </div>
                      <span className="text-sm">{currencyFormat(item?.subtotal)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-base-200 border-b pt-4 pb-2">
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
                </div>

                <div className="border-base-200 border-b pt-4 pb-2">
                  <div className="mb-2 text-sm font-semibold">Payments :</div>
                  {detail?.cash_payments?.map((item, i) => (
                    <div key={i} className="flex place-content-between place-items-center py-2">
                      <div>
                        <span className="ps-2 text-sm">{item?.payment_name || 'Cash'}</span>
                      </div>
                      <span className="text-sm">{currencyFormat(item?.subtotal)}</span>
                    </div>
                  ))}
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
                      <span className="text-sm">Topup Cash</span>
                    </div>
                    <span className="text-sm">{currencyFormat(detail?.cash_topup)}</span>
                  </div>

                  <div className="flex place-content-between place-items-center py-2">
                    <div>
                      <span className="text-sm">Total Sales</span>
                    </div>
                    <span className="text-sm">{currencyFormat(detail?.subtotal_order)}</span>
                  </div>
                  <div className="flex place-content-between place-items-center py-2">
                    <div>
                      <span className="text-sm">Total Bills</span>
                    </div>
                    <span className="text-sm">{currencyFormat(detail?.subtotal_openbill)}</span>
                  </div>
                </div>

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
                  <div>{dateFormat(detail?.transaction_date)}</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full w-full">
            <EmptySection />
          </div>
        )}

        <Dialog.Wrapper ref={dialogRef} className="w-md">
          <Dialog.Header onClose={closeModal}>
            <div className="text-lg font-semibold">Refund</div>
          </Dialog.Header>
          <Dialog.Body>
            <div className="mb-3 py-4">
              <div>Are you sure you want to refund this transaction?</div>
              <div className="mb-3">Cash amount on hand will be recalculated.</div>

              <Input
                label="Enter PIN"
                value={pin}
                onChange={e => setPin(e?.target?.value)}
                error={FormState?.errors?.pin}
                type="password"
              />
            </div>
          </Dialog.Body>
          <Dialog.Footer>
            <div className="btn btn-md px-10" onClick={closeModal}>
              Cancel
            </div>
            <div
              className={`btn btn-md btn-error px-10 text-white ${cancelResult?.isLoading ? 'btn-disabled' : ''}`}
              onClick={onCancel}
            >
              Confirm{' '}
              {cancelResult.isLoading ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : null}
            </div>
          </Dialog.Footer>
        </Dialog.Wrapper>
      </div>

      <Drawer.Content
        drawerRef={drawerRef}
        title="Order Details"
        close={closeDrawer}
        className="!bg-accent"
      >
        <div className="bg-accent flex h-[calc(100vh-200px)] flex-1 flex-col place-content-center overflow-y-auto p-6">
          <div className="mb-4 h-full w-full flex-1">
            <div className="h-fit w-full rounded-xl bg-white p-6 shadow">
              <div className="border-base-200 border-b">
                <h2 className="mb-4 text-center text-4xl font-bold">
                  {currencyFormat(orderDetail?.total_charges)}
                </h2>
              </div>

              <div className="border-base-200 border-b py-4">
                <div className="mb-2 text-sm">
                  <span className="font-semibold">Bills name :</span> {orderDetail?.ticket || '-'}
                </div>
                <div className="mb-2 text-sm">
                  <span className="font-semibold">Cashier :</span>{' '}
                  {orderDetail?.session?.cashier?.name || '-'}
                </div>
                <div className="mb-2 text-sm">
                  <span className="font-semibold">Session time :</span>{' '}
                  {dateFormat(orderDetail?.session?.started_at, 'DD MMM YYYY')} -{' '}
                  {dateFormat(orderDetail?.session?.finished_at, 'DD MMM YYYY', '(ongoing)')}
                </div>
                <div className="mb-2 text-sm capitalize">
                  <span className="font-semibold">Customer :</span>{' '}
                  {orderDetail?.membership?.name || '-'}
                </div>
              </div>

              <div className="border-base-200 border-b pt-4 pb-2">
                {orderDetail?.items?.map((item, i) => (
                  <div key={i} className="pb-2">
                    <div className="flex place-content-between place-items-center text-base">
                      <div>{item?.catalog?.name}</div>
                      <div>{currencyFormat(item?.unit_nett * item?.quantity)}</div>
                    </div>
                    <div className="pb-2 text-xs">
                      {item?.quantity} x {currencyFormat(item?.unit_nett)}
                    </div>
                    <div>
                      {item?.additionals?.map((addon, i) => (
                        <div className="text-base-300 text-xs font-thin" key={i}>
                          <span>
                            + {addon?.catalog?.name} (
                            {addon?.quantity > 0 && `${addon?.quantity} x `}
                            {`${addon?.unit_nett > 0 ? currencyFormat(addon?.unit_nett) : 'Free'}`})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-base-200 border-b py-4">
                <div className="flex place-content-between place-items-center text-base font-semibold">
                  <div>Total: </div>
                  <div>{currencyFormat(orderDetail?.total_charges)}</div>
                </div>
                <div className="flex place-content-between place-items-center text-base">
                  <div className="capitalize">{orderDetail?.payment_method?.name || 'Cash'}: </div>
                  <div>{currencyFormat(orderDetail?.total_payment)}</div>
                </div>
                {orderDetail?.total_payment - orderDetail?.total_charges > 0 && (
                  <div className="flex place-content-between place-items-center text-base">
                    <div>Total Change: </div>
                    <div>
                      {currencyFormat(orderDetail?.total_payment - orderDetail?.total_charges)}
                    </div>
                  </div>
                )}
                {orderDetail?.payment_ref !== '' && (
                  <div className="flex place-content-between place-items-center text-base">
                    <div>Ref: </div>
                    <div>{orderDetail?.payment_ref}</div>
                  </div>
                )}
              </div>

              <div className="text-base-300 flex place-content-between place-items-center py-4 text-base">
                <div>{dateFormat(orderDetail?.ordered_at)}</div>
                <div>{orderDetail?.code}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-base-200 bg-base-100 mt-3 flex min-h-15 border-t">
          <div className="bg-base-content text-base-100 flex flex-1 cursor-pointer place-content-center place-items-center gap-2 px-4 text-sm capitalize">
            <PrintIcon />
            print receipt
          </div>
          <div
            className="bg-error text-base-100 flex flex-1 cursor-pointer place-content-center place-items-center gap-2 px-4 text-sm capitalize"
            onClick={openModal}
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
