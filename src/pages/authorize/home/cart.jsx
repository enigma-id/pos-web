/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import BillModal from './saveBill';
import SuccessModal from './success';
import { Modal } from '../../../components/ui';
import { AddUserIcon, EditIcon, TrashIcon, UserIcon } from '../../../components/ui/icon';
import useModal from '../../../components/ui/modal/hook';
import useSidebar from '../../../components/ui/sidebar/hook';
import useCart from '../../../services/cart/hook';
import { currencyFormat } from '../../../utils/common';

const Cart = ({ onUpdate }) => {
  const navigate = useNavigate();
  const CartState = useSelector(state => state?.Cart);
  const FormState = useSelector(state => state?.Form);
  const Channel = useSelector(state => state?.SalesChannel);
  const { showCustomer } = useSidebar();
  const { openModal, closeModal } = useModal();

  const { reset, remove, onCount, countResult, cartItems, openBill, billResult } = useCart();

  const getMode = () => {
    const isOpen =
      billCount > 0 && CartState?.items?.list?.length === 0 && CartState?.bill === null;

    return isOpen ? 'open' : 'create';
  };

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

  const onBillCreate = async ticket => {
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
      ticket: CartState?.bill ? CartState?.bill?.ticket : ticket,
      membership_id: CartState?.meta?.customer?.id,
      channel_id: Channel?.selectedChannel?.id,
      items: items,
    };

    if (CartState?.bill?.id) {
      payload.id = CartState?.bill?.id;
    }

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
            add?.type === 'quantity' || add?.type === 'checkbox'
              ? `(${item?.quantity} x ${child?.quantity}) x ${currencyFormat(child?.unit_price || 0)}`
              : '';
          return (
            <div className="text-base-300 flex place-content-between text-xs font-thin">
              <span>
                + {child?.name} {suffix}
              </span>
              <span>
                {currencyFormat(item?.quantity * child?.quantity * child?.unit_price || 0)}
              </span>
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

  const handleModal = () => {
    openModal(
      <BillModal mode={mode} count={billCount} onBillCreate={v => onBillCreate(v)} />,
      mode === 'open' ? 'w-lg' : 'w-md'
    );
  };

  const handleModalError = () => {
    openModal(
      <>
        <Modal.Header onClose={closeModal}>
          <div className="text-lg font-semibold">Can't save bill</div>
        </Modal.Header>
        <Modal.Body full>
          <div className="flex place-content-center place-items-center">
            <img src="./error.png" className="h-64" />
          </div>
          <div className="-mt-5 pb-4 text-center">
            <div className="text-lg font-semibold capitalize">{FormState?.errors?.ticket}</div>
            <p className="text-base-300 text-xs">Try another bill’s</p>
          </div>
        </Modal.Body>
      </>,

      mode === 'open' ? 'w-lg' : 'w-md'
    );
  };

  const handleModalPrint = data => {
    openModal(<SuccessModal data={data} />, 'w-md');
  };

  React.useEffect(() => {
    if (billResult?.isSuccess) {
      onCount();
      handleModalPrint(billResult?.data?.data);
    }
  }, [billResult]);

  React.useEffect(() => {
    if (billResult?.isError) {
      handleModalError();
    }
  }, [billResult]);

  React.useEffect(() => {
    onCount();
  }, []);

  const billCount = countResult?.data?.data;

  const mode = getMode();

  return (
    <div className="border-base-200 bg-base-100 flex h-screen flex-col border-t border-l">
      <div className="border-base-200 flex h-16 place-content-between border-b">
        <div className="flex-2/3 place-content-center ps-4">
          <h2 className="text-lg font-bold">Order Details</h2>
        </div>
        {(CartState?.items?.count > 0 || CartState?.bill) && (
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
          onClick={CartState?.bill ? undefined : showCustomer}
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

      {CartState?.bill && (
        <div className="collapse-arrow bg-accent collapse rounded-none">
          <input type="checkbox" name="my-accordion-2" />
          <div className="collapse-title border-base-200 border-b text-base font-semibold">
            <div className="">
              <div className="flex place-content-between place-items-center">
                <div>Bill name: </div>
                <div className="text-base-content font-semibold">{CartState?.bill?.ticket}</div>
              </div>
              <div className="flex place-content-between place-items-center">
                <div>Total bill: </div>
                <div className="text-base-content font-semibold">
                  {currencyFormat(CartState?.bill?.total_bill)}
                </div>
              </div>
            </div>
          </div>
          <div className="collapse-content border-base-200 !max-h-64 !min-h-0 !overflow-auto border-b pb-0">
            {CartState?.items?.bill?.map((item, i) => (
              <div key={i} className="border-base-200 border-b py-4">
                <div className="flex place-content-between place-items-center">
                  <div>
                    <span className="bg-base-content rounded-lg px-3 py-1 text-white">
                      {item?.quantity}
                    </span>
                    <span className="ps-2 text-base font-semibold uppercase">{item?.name}</span>
                  </div>
                  <span className="text-base-300 text-xs">
                    {currencyFormat(item?.quantity * item?.unit_price, undefined)}
                  </span>
                </div>

                {item?.additionals?.length > 0 && (
                  <div className="border-base-200 ms-3.5 border-s py-2 ps-6">
                    {renderAdditionals(item).map((line, idx) => (
                      <div key={idx} className="mb-2">
                        {line}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-2 flex place-content-end place-items-center">
                  <div className="text-primary text-lg font-bold">
                    {currencyFormat(item?.subtotal, undefined, 'Free')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {cartItems?.map((item, i) => (
          <div key={i} className="border-base-200 border-b py-4">
            <div className="flex place-content-between place-items-center">
              <div>
                <span className="bg-base-content rounded-lg px-3 py-1 text-white">
                  {item?.quantity}
                </span>
                <span className="ps-2 text-base font-semibold uppercase">{item?.name}</span>
              </div>
              <span className="text-base-300 text-xs">
                {currencyFormat(item?.quantity * item?.unit_price, undefined)}
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
      <div className="border-base-200 border-t pt-4">
        <div className="mb-3 flex place-content-between place-items-center px-4">
          <div className="text-base">Total Cart</div>
          <div className="text-primary text-xl font-bold">
            {currencyFormat(CartState?.meta?.subtotal_list)}
          </div>
        </div>

        {CartState?.bill && (
          <div className="mb-3 flex place-content-between place-items-center px-4">
            <div className="text-base">Subtotal</div>
            <div className="text-primary text-xl font-bold">
              {currencyFormat(CartState?.meta?.subtotal)}
            </div>
          </div>
        )}

        <div className="flex place-items-center gap-1">
          {mode === 'open' ? (
            <button
              className={`btn btn-xl btn-primary flex-1 rounded-none text-lg font-thin uppercase`}
              onClick={handleModal}
            >
              Open Bill ({billCount})
            </button>
          ) : (
            <button
              className={`btn btn-xl btn-primary flex-1 rounded-none text-lg font-thin uppercase ${
                CartState?.items?.list?.length > 0 ? '' : 'btn-disabled'
              }`}
              onClick={CartState?.bill ? onBillCreate : handleModal}
            >
              Save Bill
            </button>
          )}

          <button
            className={`btn btn-xl btn-primary flex-1 rounded-none text-lg font-thin uppercase ${
              (CartState?.items?.list?.length > 0 && !CartState?.bill) ||
              (CartState?.bill && CartState?.items?.list?.length === 0)
                ? ''
                : 'btn-disabled'
            }`}
            onClick={() =>
              navigate('/checkout', {
                state: {
                  is_bill: CartState?.bill ? true : false,
                },
              })
            }
          >
            Pay
          </button>
        </div>
      </div>
    </div>
  );
};

export default Cart;
