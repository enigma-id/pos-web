/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useSelector } from 'react-redux';

import { Dialog, EmptySection, Input } from '../../../components/ui';
import { MoneysIcon, PrintIcon, SearchIcon, TrashIcon } from '../../../components/ui/icon';
import useOrder from '../../../services/sales/order/hook';
import { currencyFormat, dateFormat } from '../../../utils/common';
import useDialogModal from '../../../utils/modal';

const BillScreen = () => {
  const FormState = useSelector(state => state?.Form);

  const [detail, setDetail] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 25;

  const { order, orderResult, show, showResult, cancel, cancelResult } = useOrder();
  const [pin, setPin] = React.useState('');

  const {
    dialogRef,
    open: openModal,
    close: closeModal,
  } = useDialogModal({
    onClose: () => setPin(''),
  });

  const onCancel = () => {
    const payload = {
      pin,
    };

    cancel({ id: detail?.id, payload });
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  React.useEffect(() => {
    const delayDebounceFn = setTimeout(
      () => {
        order({ status: 'pending', search, page: currentPage, limit: itemsPerPage });
      },
      search ? 1000 : 0
    );

    return () => clearTimeout(delayDebounceFn);
  }, [search, currentPage]);

  // Reset to first item on new data
  React.useEffect(() => {
    if (orderResult?.isSuccess) {
      setSelectedIndex(0);
      setDetail(null);
    }
  }, [orderResult]);

  React.useEffect(() => {
    if (orderResult?.isSuccess) {
      show(orderResult?.data?.data?.[selectedIndex]?.id);
    }
  }, [orderResult, selectedIndex]);

  React.useEffect(() => {
    if (showResult?.isSuccess) {
      setDetail(showResult?.data?.data);
    }
  }, [showResult]);

  React.useEffect(() => {
    if (cancelResult?.isSuccess) {
      order({ status: 'pending', search, page: currentPage, limit: itemsPerPage });
      closeModal();
      setPin('');
    }
  }, [cancelResult]);

  const data = orderResult?.data?.data || [];
  const total = orderResult?.data?.total || 0;
  const totalPages = Math.ceil(total / itemsPerPage);

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
              onChange={e => {
                setSearch(e.target.value);
              }}
              className="h-full w-full pl-15 focus-visible:!outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {data?.map((item, index) => (
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
                    <div className="text-base-300 text-xs">{dateFormat(item?.ordered_at)}</div>
                  </div>
                </div>
                <div className="text-base-300 text-base">{item?.code}</div>
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
            disabled={currentPage === totalPages || data?.length === 0}
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
                print receipt
              </div>
              <div
                className="bg-error text-base-100 flex h-full cursor-pointer place-items-center gap-2 px-4 text-sm capitalize"
                onClick={openModal}
              >
                <TrashIcon />
                refund
              </div>
            </div>
          </div>

          <div className="flex h-[calc(100vh-64px)] w-full place-content-center overflow-x-auto py-20">
            <div className="h-fit w-2/4 rounded-xl bg-white p-6 shadow">
              <div className="border-base-200 border-b">
                <h2 className="mb-4 text-center text-4xl font-bold">
                  {currencyFormat(detail?.total_charges)}
                </h2>
              </div>

              <div className="border-base-200 border-b py-4">
                <div className="mb-2 text-sm">
                  <span className="font-semibold">Bills name :</span> {detail?.ticket || '-'}
                </div>
                <div className="mb-2 text-sm">
                  <span className="font-semibold">Cashier :</span>{' '}
                  {detail?.session?.cashier?.name || '-'}
                </div>
                <div className="mb-2 text-sm">
                  <span className="font-semibold">Session time :</span>{' '}
                  {dateFormat(detail?.session?.started_at, 'DD MMM YYYY')} -{' '}
                  {dateFormat(detail?.session?.finished_at, 'DD MMM YYYY', '(ongoing)')}
                </div>
                <div className="mb-2 text-sm capitalize">
                  <span className="font-semibold">Customer :</span>{' '}
                  {detail?.membership?.name || '-'}
                </div>
              </div>

              <div className="border-base-200 border-b pt-4 pb-2">
                {detail?.items?.map((item, i) => (
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
                  <div>{currencyFormat(detail?.total_charges)}</div>
                </div>
              </div>

              <div className="text-base-300 flex place-content-between place-items-center py-4 text-base">
                <div>{dateFormat(detail?.ordered_at)}</div>
                <div>{detail?.code}</div>
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
  );
};

export default BillScreen;
