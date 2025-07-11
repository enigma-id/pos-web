import React from 'react';
import { useSelector } from 'react-redux';

import PaymentSection from './payment';
import { Drawer, Input, OrderSummary } from '../../../components/ui';
import { EditIcon, TrashIcon } from '../../../components/ui/icon';
import useCart from '../../../services/cart/hook';
import { currencyFormat } from '../../../utils/common';
import useDrawer from '../../../utils/drawer';
import useDialogModal from '../../../utils/modal';

const Cart = ({ onUpdate }) => {
  const CartState = useSelector(state => state?.Cart);
  const Channel = useSelector(state => state?.SalesChannel);
  const { drawerRef, open: openDrawer, close: closeDrawer } = useDrawer();

  const {
    dialogRef,
    open: openModal,
    close: closeModal,
  } = useDialogModal({
    onClose: () => setTicket(''),
  });

  const { openBill, billResult, reset, remove } = useCart();

  const [selected, setSelected] = React.useState('buy');
  const [ticket, setTicket] = React.useState('');

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

  const onBillCreate = async () => {
    const items = CartState?.items?.map(item => {
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
      ticket: ticket,
      channel_id: Channel?.selectedChannel?.id,
      items: items,
    };

    await openBill(payload);
  };

  const renderAdditionals = item => {
    return (item?.additionals || [])
      .map(add => {
        const selectedChilds = (add?.childs || []).filter(child =>
          add.type === 'quantity' ? (child?.quantity || 0) > 0 : !!child?.selected
        );

        if (selectedChilds.length === 0) return null;

        const childNames = selectedChilds
          .map(child => {
            const suffix = add?.type === 'quantity' ? ` x ${child?.quantity}` : '';
            return `${child.name}${suffix}`;
          })
          .join(', ');

        return (
          <div key={add.id} className="text-sm">
            {add.name}: <span className="font-semibold">{childNames}</span>
          </div>
        );
      })
      .filter(Boolean);
  };

  React.useEffect(() => {
    if (billResult?.isSuccess) {
      setTicket('');
      closeModal();
    }
  }, [billResult]);

  return (
    <Drawer.Wrapper>
      <div className="border-secondary flex h-[calc(100vh-116px)] flex-col border-t border-l bg-white py-4 ps-6">
        <div className="mb-5 place-items-center pe-4">
          <div className="flex w-fit rounded-full bg-[#f9fafe] p-1">
            <button
              onClick={() => {
                setTicket('');
                setSelected('buy');
              }}
              className={`min-w-40 cursor-pointer rounded-full px-6 py-2 transition-all ${
                selected === 'buy' ? 'bg-white font-semibold text-black shadow-sm' : 'text-gray-500'
              }`}
            >
              Close Bill
            </button>
            <button
              onClick={() => {
                setTicket('');
                setSelected('bills');
              }}
              className={`min-w-40 cursor-pointer rounded-full px-6 py-2 transition-all ${
                selected === 'bills'
                  ? 'bg-white font-semibold text-black shadow-sm'
                  : 'text-gray-500'
              }`}
            >
              Open Bill
            </button>
          </div>
        </div>

        {selected === 'bills' && (
          <div className="border-secondary me-4 mb-2 border-b pb-2">
            <h2 className="mb-2 text-xl font-bold">Ticket Name</h2>

            <Input value={ticket} onChange={e => setTicket(e?.target?.value)} />
          </div>
        )}

        <h2 className="text-xl font-bold">Order Details</h2>
        <div className="mt-4 flex-1 overflow-y-auto pe-4">
          {CartState?.items?.map((item, i) => (
            <div key={i} className="border-secondary border-b py-4">
              <div className="flex">
                <div className="w-20">
                  <div className="h-[80px] w-[80px]">
                    <img
                      src={item?.image}
                      alt={item?.name}
                      className="bg-secondary h-full w-full rounded-md object-cover"
                    />
                  </div>
                </div>
                <div className="ps-2">
                  <p className="text-[16px] font-semibold">{item?.name}</p>
                  {renderAdditionals(item).map((line, idx) => (
                    <div key={idx} className="text-sm text-gray-700">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex place-content-between place-items-center">
                <div className="flex place-items-center gap-2">
                  <div
                    className="btn btn-sm btn-error btn-circle btn-outline hover:!text-white"
                    onClick={() => remove(i)}
                  >
                    <TrashIcon />
                  </div>
                  <div
                    className="btn btn-sm btn-primary btn-circle btn-outline"
                    onClick={() => onUpdate(item, i)}
                  >
                    <EditIcon />
                  </div>
                </div>

                <div className="text-primary text-lg font-bold">
                  x{item?.quantity} ({currencyFormat(item?.subtotal)})
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-secondary me-4 mb-4 min-h-15 border-t pt-3">
          <div className="mb-3 flex place-content-between place-items-center">
            <div className="text-accent">Total</div>
            <div className="text-primary text-xl font-bold">
              {currencyFormat(CartState?.subtotal)}
            </div>
          </div>

          <div className="mb-4 flex place-items-center gap-1">
            <button
              className={`btn btn-md btn-primary w-2/3 rounded-l-full ${
                (selected === 'buy' && CartState?.items?.length > 0) ||
                (selected === 'bills' && CartState?.items?.length > 0)
                  ? ''
                  : 'btn-disabled'
              }`}
              onClick={selected === 'buy' ? openDrawer : openModal}
            >
              {selected === 'buy' ? 'Pay Now' : 'Save'}
            </button>

            <div className="btn btn-error w-1/3 rounded-r-full text-white" onClick={reset}>
              Clear
            </div>
          </div>

          <dialog ref={dialogRef} className="modal">
            <OrderSummary
              title="Bill confirmation"
              subtitle="Please review the order below before saving it as a bill"
              data={{ ...CartState, ticket }}
              onClose={closeModal}
              onConfirm={onBillCreate}
              isLoading={billResult?.isLoading}
            />
          </dialog>
        </div>
      </div>
      <Drawer.Content drawerRef={drawerRef} title="Order Payment" close={closeDrawer}>
        <PaymentSection data={CartState} onClose={closeDrawer} />
      </Drawer.Content>
    </Drawer.Wrapper>
  );
};

export default Cart;
