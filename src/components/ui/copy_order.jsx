import React from 'react';
import { useSelector } from 'react-redux';

import Input from './input';
import Modal from './modal';
import useOrder from '../../services/sales/order/hook';
import { currencyFormat } from '../../utils/common';

const CopyOrder = ({ detail, orders, onClose, onSuccess }) => {
  const FormState = useSelector(state => state?.Form);
  const [pin, setPin] = React.useState('');
  const [targetId, setTargetId] = React.useState('');

  const { copy, copyResult } = useOrder();

  const onSubmit = () => {
    const payload = {
      pin,
      to_id: Number(targetId),
    };

    copy({ id: detail?.id, payload });
  };

  React.useEffect(() => {
    if (copyResult?.isSuccess) {
      onSuccess?.(copyResult?.data?.data);
      setPin('');
      setTargetId('');
    }
  }, [copyResult]);

  return (
    <>
      <Modal.Header onClose={onClose}>
        <div className="text-lg font-semibold">Copy Sales Order</div>
        <p className="text-base-300 text-sm">Salin item dari sales order ke order lain</p>
      </Modal.Header>
      <Modal.Body>
        <div className="py-3">
          <div className="border-base-200 bg-base-100 mb-3 rounded-lg border p-4">
            <div className="text-base-300 text-sm">Source Order</div>
            <div className="mt-1 flex justify-between">
              <div>
                <div className="font-medium">Bills Name: {detail?.ticket || '-'}</div>
                <div className="font-medium">Cashier: {detail?.session?.cashier?.name || '-'}</div>
                <div className="text-base-300 text-xs">{detail?.code}</div>
              </div>
              <div className="font-semibold">{currencyFormat(detail?.total_charges)}</div>
            </div>
          </div>

          <div className="mb-3 flex flex-col gap-2">
            <label className="text-sm font-medium">Pilih Order Tujuan</label>
            <select
              className="select select-bordered w-full"
              value={targetId}
              onChange={e => setTargetId(e.target.value)}
            >
              <option value="">-- Pilih Sales Order --</option>
              {orders
                .filter(o => o.id !== detail?.id)
                .map(o => (
                  <option key={o.id} value={o.id}>
                    {o.ticket || '-'} — {currencyFormat(o.total_charges)}
                  </option>
                ))}
            </select>
            {FormState?.errors?.to_id && (
              <div className="text-error pt-1 text-xs leading-[1.66] font-medium">
                {FormState?.errors?.to_id}
              </div>
            )}

            <div className="alert alert-warning text-xs">
              Item dari source akan <b>ditambahkan</b> ke order tujuan.
            </div>
          </div>

          <Input
            label="Enter PIN"
            value={pin}
            onChange={e => setPin(e?.target?.value)}
            error={FormState?.errors?.pin}
            type="password"
          />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="btn btn-md px-10" onClick={onClose}>
          Cancel
        </div>
        <div
          className={`btn btn-md btn-success px-10 text-white ${copyResult?.isLoading ? 'btn-disabled' : ''}`}
          onClick={onSubmit}
        >
          Confirm{' '}
          {copyResult.isLoading ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : null}
        </div>
      </Modal.Footer>
    </>
  );
};

export default CopyOrder;
