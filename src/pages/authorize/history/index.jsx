import React from 'react';
import { useSelector } from 'react-redux';

import { Dialog, Input } from '../../../components/ui';
import { MoneysIcon, PrintIcon, SearchIcon, TrashIcon } from '../../../components/ui/icon';
import useOrder from '../../../services/sales/order/hook';
import { currencyFormat, dateFormat } from '../../../utils/common';
import useDialogModal from '../../../utils/modal';

export default function HistoryScreen() {
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

  // Fetch data when search changes
  React.useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      order({ search });
    }, 1000);

    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  // Reset to first item on new data
  React.useEffect(() => {
    if (orderResult?.isSuccess) {
      setSelectedIndex(0);
      setCurrentPage(1);
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
      order();
      closeModal();
      setPin('');
    }
  }, [cancelResult]);

  const data = orderResult?.data?.data || [];
  const selected = data[selectedIndex];
  const totalPages = Math.ceil(data?.length / itemsPerPage);
  const paginatedData = data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
              placeholder="Search menu ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-full w-full pl-15 focus-visible:!outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {paginatedData?.map((item, index) => {
            const globalIndex = (currentPage - 1) * itemsPerPage + index;

            return (
              <div
                key={item.id}
                onClick={() => setSelectedIndex(globalIndex)}
                className={`border-base-200 cursor-pointer border-b p-4 ${
                  selectedIndex === globalIndex ? 'bg-gray-100' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex place-content-between">
                  <div className="flex place-items-center gap-4">
                    <div
                      className={`text-base ${selectedIndex === globalIndex ? 'text-primary' : ''}`}
                    >
                      <MoneysIcon />
                    </div>
                    <div>
                      <div
                        className={`text-base ${selectedIndex === globalIndex ? 'text-primary' : ''}`}
                      >
                        {currencyFormat(item?.total_charges)}
                      </div>
                      <div className="text-base-300 text-xs">{dateFormat(item?.ordered_at)}</div>
                    </div>
                  </div>
                  <div className="text-base-300 text-base">{item?.code}</div>
                </div>
              </div>
            );
          })}
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
            disabled={currentPage === totalPages}
            className="disabled:btn-disabled btn"
          >
            Next
          </button>
        </div>
      </div>

      {/* Detail View */}
      <div className="w-full">
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

        {detail ? (
          <div className="flex h-full w-full place-content-center py-20">
            <div className="h-fit w-2/4 rounded-xl bg-white p-6 shadow">
              <h2 className="mb-4 text-2xl font-bold">{currencyFormat(detail?.total_charges)}</h2>
              <div className="mb-2 text-sm text-gray-700">Bills name: {selected.total}</div>
              <div className="mb-2 text-sm text-gray-700">Cashier: </div>
              <div className="mb-2 text-sm text-gray-700">Session time:</div>
              <div className="mb-4 text-sm text-gray-700">Customer: </div>

              <div className="mt-4 font-bold">Total: {selected.total}</div>
              <div>Cash: {selected.total}</div>
              <div className="mt-4 text-xs text-gray-400">{selected.date}</div>
              <div className="text-xs text-gray-400">{selected.id}</div>
            </div>
          </div>
        ) : (
          <div className="text-gray-500">No data found.</div>
        )}
      </div>

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
}
