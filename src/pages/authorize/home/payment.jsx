import React from 'react';
import { useSelector } from 'react-redux';

import { Input, OrderSummary } from '../../../components/ui';
import { CardIcon, CloseIcon, MoneyIcon } from '../../../components/ui/icon';
import Keypad from '../../../components/ui/keypad';
import useCart from '../../../services/cart/hook';
import { currencyFormat, isActive } from '../../../utils/common';
import useDialogModal from '../../../utils/modal';

const PaymentSection = ({ data, onClose }) => {
  const Channel = useSelector(state => state?.SalesChannel);

  const { getPaymentMethod, checkout, checkoutResult } = useCart();

  const { dialogRef, open: openModal, close: closeModal } = useDialogModal();

  const [paymentMethod, setPaymentMethod] = React.useState([]);
  const [selectedMethodIndex, setSelectedMethodIndex] = React.useState(0);
  const [pay, setPay] = React.useState(0);
  const [paymentRef, setPaymentRef] = React.useState('');
  const [note, setNote] = React.useState('');

  const flattenAdditionals = (additionals = []) => {
    const result = [];

    additionals.forEach(add => {
      const { id: addon_id, type, childs = [] } = add;

      childs.forEach(child => {
        const isSelected = type === 'quantity' ? (child.quantity || 0) > 0 : !!child.selected;

        if (isSelected) {
          const entry = {
            addon_id,
            catalog_id: child.id,
          };

          if (type === 'quantity') {
            entry.quantity = child.quantity;
          }

          result.push(entry);
        }
      });
    });

    return result;
  };

  const handleSubmit = async () => {
    const items = data?.items?.map(item => {
      const base = {
        catalog_id: item.id,
        quantity: item.quantity,
      };

      const flattened = flattenAdditionals(item?.additionals);

      if (flattened?.length > 0) {
        base.additionals = flattened;
      }

      return base;
    });

    const payload = {
      channel_id: Channel?.selectedChannel?.id,
      payment_method_id: selectedMethodIndex,
      payment_ref: selectedMethodIndex === 0 ? '' : paymentRef,
      note: note,
      items: items,
      total_payment: selectedMethodIndex === 0 ? Number(pay) || 0 : data?.subtotal || 0,
    };

    await checkout(payload);
  };

  const handleOpen = async payment => {
    setPay(Number(payment) || 0);
    openModal();
  };

  React.useEffect(() => {
    const getMethod = async () => {
      const res = await getPaymentMethod();
      setPaymentMethod(res);
    };

    getMethod();
  }, []);

  React.useEffect(() => {
    if (checkoutResult?.isSuccess) {
      closeModal();
      onClose();
    }
  }, [checkoutResult]);

  return (
    <div className="menu text-base-content bg-base-100 min-h-full w-120 p-4">
      <div className="bg-base-100 mt-4 mb-4 flex place-content-between place-items-center rounded-xl p-4">
        <div className="text-[16px]">Total Amount</div>
        <div className="text-primary text-xl font-semibold">{currencyFormat(data?.subtotal)}</div>
      </div>

      <div className="mb-4">
        <div className="mb-3 text-[16px] font-semibold">Payment Method</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {paymentMethod?.map((pm, i) => (
            <div
              key={i}
              className={`payment-card ${isActive(selectedMethodIndex, pm?.id)}`}
              onClick={() => {
                setPay(0);
                setPaymentRef('');
                setNote('');
                setSelectedMethodIndex(pm?.id);
              }}
            >
              {i == 0 ? <MoneyIcon /> : <CardIcon />}

              <div className="text-sm font-thin">{pm?.name}</div>
            </div>
          ))}
        </div>
      </div>

      {selectedMethodIndex === 0 ? (
        <Keypad
          payment={selectedMethodIndex}
          onDone={v => handleOpen(v)}
          subtotal={data?.subtotal}
        />
      ) : (
        <div>
          <div className="mb-3">
            <div className="text-[16px] font-semibold">Ref Code</div>
            <Input value={paymentRef} onChange={e => setPaymentRef(e?.target?.value)} />
          </div>

          <div className="mb-3">
            <div className="text-[16px] font-semibold">Catatan</div>
            <Input value={note} onChange={e => setNote(e?.target?.value)} />
          </div>
          <button
            className={`btn btn-block btn-md btn-primary mt-3 rounded-full ${checkoutResult?.isLoading ? 'btn-disabled' : ''}`}
            onClick={openModal}
          >
            {checkoutResult?.isLoading && <span className="loading loading-spinner"></span>}
            Confirm
          </button>
        </div>
      )}

      <dialog ref={dialogRef} className="modal">
        <OrderSummary
          title="Payment confirmation"
          subtitle="Please review the order and confirm the payment"
          data={{
            ...data,
            payment_method: paymentMethod[selectedMethodIndex],
            payment: selectedMethodIndex === 0 ? pay : data?.subtotal,
            payment_ref: paymentRef,
            note,
          }}
          onClose={closeModal}
          onConfirm={handleSubmit}
          isLoading={checkoutResult?.isLoading}
        />
      </dialog>
    </div>
  );
};

export default PaymentSection;
