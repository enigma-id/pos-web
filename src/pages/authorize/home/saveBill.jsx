/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useSelector } from 'react-redux';

import { Input, Modal } from '../../../components/ui';
import { SearchIcon } from '../../../components/ui/icon';
import useModal from '../../../components/ui/modal/hook';
import useCart from '../../../services/cart/hook';
import { currencyFormat, dateFormat } from '../../../utils/common';

const BillModal = ({ mode, count, onBillCreate }) => {
  const FormState = useSelector(state => state?.Form);
  const { closeModal } = useModal();
  const [billName, setBillName] = React.useState('');
  const { bill, billResult, billData, onBillSelected } = useCart();

  React.useEffect(() => {
    if (mode === 'create') return;
    bill();
  }, [mode]);

  const billList = billData || billResult?.data?.data || [];

  return (
    <>
      <Modal.Header onClose={closeModal}>
        <div className="text-lg font-semibold">
          {mode === 'open' ? `Open Bills (${count})` : 'Save Bill'}
        </div>
      </Modal.Header>
      <Modal.Body full={mode === 'open'}>
        {mode === 'open' ? (
          <>
            {/* <div className="border-base-200 relative !min-h-16 w-full place-content-center place-items-center border-b">
              <div className="absolute top-1/3 left-4">
                <SearchIcon />
              </div>

              <input
                name="search"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="!min-h-16 w-full pl-15 focus-visible:!outline-none"
              />
            </div> */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {billList?.map((bill, idx) => (
                <div
                  key={idx}
                  className="border-base-200 flex cursor-pointer place-content-between place-items-center border-b p-4"
                  onClick={() => {
                    onBillSelected(bill);
                    closeModal();
                  }}
                >
                  <div>
                    <div className="font-semibold">
                      {bill?.bill_name || '-'}
                      {bill?.is_synced === false && (
                        <span className="badge badge-warning badge-xs ms-1">pending sync</span>
                      )}
                    </div>
                    <div className="text-xs">{dateFormat(bill?.created_at)}</div>
                  </div>
                  <div className="font-semibold">{currencyFormat(bill?.total_charges)}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="mb-3 py-4">
            <Input
              label="bill name"
              value={billName}
              onChange={e => setBillName(e?.target?.value)}
              error={FormState?.errors?.billName || FormState?.errors?.items}
            />
          </div>
        )}
      </Modal.Body>
      {mode === 'open' ? null : (
        <Modal.Footer>
          <div
            className={`btn btn-block btn-primary btn-lg ${billResult?.isLoading ? 'btn-disabled' : ''}`}
            onClick={() => onBillCreate(billName)}
          >
            Save Bill
            {billResult?.isLoading && <span className="loading loading-spinner loading-sm"></span>}
          </div>
        </Modal.Footer>
      )}
    </>
  );
};

export default BillModal;
