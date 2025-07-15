/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';

import { Input } from '../../../components/ui';
import { BackIcon, PrintIcon, TrashIcon } from '../../../components/ui/icon';
import useOrder from '../../../services/sales/order/hook';
import { currencyFormat, dateFormat } from '../../../utils/common';
import useDialogModal from '../../../utils/modal';

const DetailScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const FormState = useSelector(state => state?.Form);

  const { showResult, cancel, cancelResult } = useOrder(id);
  const [pin, setPin] = React.useState('');

  const { dialogRef, open, close } = useDialogModal({
    onClose: () => setPin(''),
  });

  const onCancel = () => {
    const payload = {
      pin,
    };

    cancel({ id, payload });
  };

  React.useEffect(() => {
    if (cancelResult?.isSuccess) {
      close();
      setPin('');
      navigate(-1, { replace: true });
    }
  }, [cancelResult]);

  if (showResult?.isLoading) return <div>loading</div>;

  let data = showResult?.data?.data;

  const ListItem = ({ title, value }) => (
    <div className="border-base-200 mb-3 flex place-content-between place-items-center border-b pb-2">
      <div className="text-sm">{title}</div>
      <div
        className={`text-sm font-semibold ${value === 'completed' ? 'bg-success w-fit rounded-full px-4 py-1 !text-[11px] text-white uppercase' : value === 'pending' ? 'bg-accent w-fit rounded-full px-4 py-1 !text-[11px] text-white uppercase' : ''}`}
      >
        {value}
      </div>
    </div>
  );

  return (
    <div>
      <div className="border-base-200 bg-base-100 flex h-[62px] flex-1 place-content-between place-items-center gap-4 border-t border-b px-4">
        <div className="flex place-items-center">
          <div
            className="btn btn-md btn-outline btn-circle border-base-200"
            onClick={() => navigate(-1)}
          >
            <BackIcon />
          </div>
          <h2 className="border-base-200 border-s ps-4 text-xl font-bold">Order {data?.code}</h2>
        </div>

        <div className="flex place-items-center gap-4">
          <div className="btn btn-md btn-info btn-circle">
            <PrintIcon />
          </div>
          <div className="btn btn-md btn-error btn-circle text-white" onClick={open}>
            <TrashIcon />
          </div>
        </div>
      </div>

      <div className="bg-base-100 flex flex-1 flex-row p-4">
        <div className="flex-1/2 pe-4">
          <div className="text-accent pb-3 text-xs tracking-wide uppercase">Transaction Info</div>
          <ListItem title="Transaction Date" value={dateFormat(data?.ordered_at)} />

          <ListItem title="Transaction" value={`No. ${data?.code}`} />
          <ListItem title="Payment Method" value={data?.payment_method?.name || 'CASH'} />
          {data?.payment_ref !== '' && <ListItem title="REF" value={data?.payment_ref} />}
          <ListItem title="Total Amount" value={currencyFormat(data?.total_charges)} />
          <ListItem title="Status" value={data?.status} />
        </div>
        <div className="flex-1/2 ps-4">
          <div className="text-accent pb-3 text-xs tracking-wide uppercase">Item Info</div>

          <table className="border-base-200 table-striped table w-full border">
            <thead className="border-base-200 border">
              <tr>
                <th className="w-8 px-4 py-2 text-left">no</th>
                <th className="px-4 py-2 text-left">Item Name</th>
                <th className="px-4 py-2 text-center">qty</th>
                <th className="px-4 py-2 text-end">Unit Price</th>
                <th className="px-4 py-2 text-end">Additionals</th>
                <th className="px-4 py-2 text-end">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {data?.items?.map((item, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 text-left text-sm">{i + 1}</td>
                  <td className="px-4 py-2 text-left text-sm">
                    <div>{item?.catalog?.name}</div>
                  </td>
                  <td className="px-4 py-2 text-center text-sm">{item?.quantity}</td>
                  <td className="px-4 py-2 text-end text-sm">
                    {currencyFormat(item?.unit_nett * item?.quantity)}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {item?.additionals?.map((addon, i) => (
                      <div key={i} className="text-xs">
                        {addon?.catalog?.name}
                        {addon?.unit_nett > 0 && ` @${currencyFormat(addon?.unit_nett)}`}
                        {addon?.quantity > 0 && ` x ${addon?.quantity}`}
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-2 text-end text-sm">
                    {currencyFormat(item?.unit_nett * item?.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <dialog ref={dialogRef} className="modal">
        <div className="bg-base-100 w-1/3 rounded px-4 py-6">
          <div className="border-base-200 text-error mb-4 border-b pb-3 text-center text-lg font-semibold tracking-wide uppercase">
            Cancel Order
          </div>
          <div className="mb-4 text-center text-sm">
            <div>Are you sure you want to cancel this transaction?</div>
            <div className="mb-3">Cash amount on hand will be recalculated.</div>

            <Input
              label="Enter PIN"
              value={pin}
              onChange={e => setPin(e?.target?.value)}
              error={FormState?.errors?.pin}
              type="password"
            />
          </div>

          <div className="border-base-200 flex place-content-end place-items-center gap-3 border-t pt-3">
            <div className="btn btn-md px-10" onClick={close}>
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
          </div>
        </div>
      </dialog>
    </div>
  );
};

export default DetailScreen;
