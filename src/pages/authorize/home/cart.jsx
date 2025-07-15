/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { Dialog, Input } from '../../../components/ui';
import { AddUserIcon, EditIcon, TrashIcon, UserIcon } from '../../../components/ui/icon';
import useSidebar from '../../../components/ui/sidebar/hook';
import useCart from '../../../services/cart/hook';
import { currencyFormat } from '../../../utils/common';
import useDialogModal from '../../../utils/modal';

const Cart = ({ onUpdate }) => {
  const navigate = useNavigate();
  const CartState = useSelector(state => state?.Cart);
  const Channel = useSelector(state => state?.SalesChannel);
  const { showCustomer } = useSidebar();

  const {
    dialogRef,
    open: openModal,
    close: closeModal,
  } = useDialogModal({
    onClose: () => setTicket(''),
  });

  const { openBill, billResult, reset, remove } = useCart();

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
    const items = CartState?.items?.list?.map(item => {
      const base = {
        catalog_id: item.id,
        quantity: item.quantity,
      };

      if (item?.is_custom === 1) {
        base.description = item?.name;
        base.unit_price = item?.unit_price;
      }

      const flattened = flattenAdditionals(item?.additionals);

      if (flattened?.length > 0) {
        base.additionals = flattened;
      }

      return base;
    });

    const payload = {
      ticket: ticket,
      membership_id: CartState?.meta?.customer?.id,
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

        const childNames = selectedChilds.map(child => {
          const suffix =
            add?.type === 'quantity'
              ? `(${child?.quantity} x ${currencyFormat(child?.unit_price, undefined, 'Free')})`
              : '';
          return (
            <div className="text-base-300 flex place-content-between text-xs font-thin">
              <span>
                + {child?.name} {suffix}
              </span>
              <span>{currencyFormat(child?.quantity * child?.unit_price, undefined, 'Free')}</span>
            </div>
          );
        });

        return (
          <div key={add.id} className="text-sm">
            <div className="text-base-300 text-xs font-semibold uppercase">{add.name}</div>
            <div>{childNames}</div>
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
    <div className="border-base-200 bg-base-100 flex h-screen flex-col border-t border-l">
      <div className="border-base-200 flex h-16 place-content-between border-b">
        <div className="flex-2/3 place-content-center ps-4">
          <h2 className="text-lg font-bold">Order Details</h2>
        </div>
        {CartState?.items?.count > 0 && (
          <div className="bg-error cursor-pointer place-content-center px-6" onClick={reset}>
            <div className="flex place-items-center gap-2 text-center text-lg text-white">
              <TrashIcon className="h-5 w-5" /> Clear
            </div>
          </div>
        )}
      </div>

      {CartState?.meta?.customer ? (
        <div
          className="border-base-200 bg-primary/10 text-primary flex h-[60px] cursor-pointer place-content-center place-items-center gap-2 border-b text-lg font-bold capitalize"
          onClick={showCustomer}
        >
          <UserIcon /> {CartState?.meta?.customer?.name || '-'}
        </div>
      ) : (
        <div
          className="border-base-200 flex h-[60px] cursor-pointer place-content-center place-items-center gap-2 border-b text-lg font-bold"
          onClick={showCustomer}
        >
          <AddUserIcon /> Customers
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {CartState?.items?.list?.map((item, i) => (
          <div key={i} className="border-base-200 border-b py-4">
            <div className="flex place-content-between place-items-center">
              <div>
                <span className="bg-base-content rounded-lg px-3 py-1 text-white">
                  {item?.quantity}
                </span>
                <span className="ps-2 text-base font-semibold uppercase">{item?.name}</span>
              </div>
              <span className="text-base-300 text-xs">
                {currencyFormat(item?.unit_price, undefined, 'Free')}
              </span>
            </div>

            {item?.additionals_flat?.length > 0 && (
              <div className="border-base-200 ms-3.5 border-s py-2 ps-6">
                {renderAdditionals(item).map((line, idx) => (
                  <div key={idx} className="mb-2">
                    {line}
                  </div>
                ))}
              </div>
            )}

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
                {currencyFormat(item?.subtotal, undefined, 'Free')}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-base-200 border-t p-4">
        <div className="mb-3 flex place-content-between place-items-center">
          <div className="text-base">Total</div>
          <div className="text-primary text-xl font-bold">
            {currencyFormat(CartState?.meta?.subtotal)}
          </div>
        </div>

        <div className="mb-4 flex place-items-center gap-1">
          <button
            className={`btn btn-xl btn-primary w-1/2 rounded-none font-thin uppercase ${
              CartState?.items?.list?.length > 0 ? '' : 'btn-disabled'
            }`}
            onClick={openModal}
          >
            Save Bill
          </button>

          <button
            className={`btn btn-xl btn-primary w-1/2 rounded-none font-thin uppercase ${
              CartState?.items?.list?.length > 0 ? '' : 'btn-disabled'
            }`}
            onClick={() => navigate('/checkout', { is_bill: false })}
          >
            Pay
          </button>
        </div>

        <Dialog.Wrapper ref={dialogRef} className="w-md">
          <Dialog.Header onClose={closeModal}>
            <div className="text-lg font-semibold">Save bills</div>
          </Dialog.Header>
          <Dialog.Body>
            <div className="mb-3 py-4">
              <Input label="bill name" value={ticket} onChange={e => setTicket(e?.target?.value)} />
            </div>
          </Dialog.Body>
          <Dialog.Footer>
            <div
              className={`btn btn-block btn-primary btn-lg ${billResult?.isLoading ? 'btn-disabled' : ''}`}
              onClick={onBillCreate}
            >
              Save Bill
              {billResult?.isLoading && (
                <span className="loading loading-spinner loading-sm"></span>
              )}
            </div>
          </Dialog.Footer>
        </Dialog.Wrapper>

        {/* <OrderSummary
            title="Bill confirmation"
            subtitle="Please review the order below before saving it as a bill"
            data={{ ...CartState, ticket }}
            onClose={closeModal}
            onConfirm={onBillCreate}
            isLoading={billResult?.isLoading}
          /> */}
      </div>
    </div>
  );
};

export default Cart;
