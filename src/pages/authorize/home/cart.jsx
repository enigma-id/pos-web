import React from 'react';
import { useSelector } from 'react-redux';
import { currencyFormat } from '../../../utils/common';
import useDrawer from '../../../utils/drawer';
import PaymentSection from './payment';
import useCart from '../../../services/cart/hook';
import useDialogModal from '../../../utils/modal';
import { OrderSummary } from '../../../components/ui';

const Cart = ({ onUpdate }) => {
  const CartState = useSelector(state => state?.Cart);
  const Channel = useSelector(state => state?.SalesChannel);

  const { drawerRef, open, close } = useDrawer();
  const {
    dialogRef,
    open: openModal,
    close: closeModal,
  } = useDialogModal({
    onClose: () => setTable(''),
  });

  const { getTable, tableResult, openBill, billResult } = useCart();

  const [selected, setSelected] = React.useState('buy');
  const [table, setTable] = React.useState(null);

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

  const onTableChange = async e => {
    const selectedId = parseInt(e.target.value, 10);
    const found = tableResult?.data?.data?.find(opt => opt.id === selectedId);
    setTable(found);
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
      table_id: table?.id,
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
      setTable();
      closeModal();
    }
  }, [billResult]);

  return (
    <div className="drawer drawer-end">
      <input id="my-drawer" type="checkbox" className="drawer-toggle" ref={drawerRef} />
      <div className="drawer-content">
        <div className="border-secondary flex h-[calc(100vh-116px)] flex-col border-t border-l bg-white py-4 ps-6">
          <div className="mb-5 place-items-center pe-4">
            <div className="flex w-fit rounded-full bg-[#f9fafe] p-1">
              <button
                onClick={() => {
                  setTable();
                  setSelected('buy');
                }}
                className={`min-w-40 cursor-pointer rounded-full px-6 py-2 transition-all ${
                  selected === 'buy'
                    ? 'bg-white font-semibold text-black shadow-sm'
                    : 'text-gray-500'
                }`}
              >
                Close Bill
              </button>
              <button
                onClick={() => {
                  setTable();
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
            <div className="border-secondary mb-2 border-b pe-4 pb-2">
              <h2 className="text-xl font-bold">Table Information</h2>
              <select
                defaultValue="Select Table"
                className="select select-md focus:!border-primary my-4 w-full rounded-full focus:!shadow-none focus:!outline-0"
                onMouseDown={getTable}
                onChange={e => onTableChange(e)}
              >
                <option disabled>Select Table</option>
                {tableResult?.isFetching ? (
                  <option>Loading...</option>
                ) : (
                  tableResult?.data?.data?.map((tab, i) => (
                    <option key={i} value={tab?.id}>
                      {tab?.name}
                    </option>
                  ))
                )}
              </select>
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
                  <div
                    className="btn btn-sm text-primary border-primary !bg-[var(--color-base-100)] px-7 !text-sm font-semibold"
                    onClick={() => onUpdate(item)}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M18.1093 1.8907C17.255 1.03643 15.87 1.03643 15.0157 1.8907L14.0514 2.85499L17.145 5.94859L18.1093 4.9843C18.9636 4.13002 18.9636 2.74498 18.1093 1.8907Z"
                        fill="currentColor"
                      />
                      <path
                        d="M16.2611 6.83247L13.1675 3.73888L6.16683 10.7396C5.65284 11.2536 5.27501 11.8875 5.0675 12.5842L4.40101 14.8216C4.3355 15.0415 4.39579 15.2797 4.55806 15.4419C4.72034 15.6042 4.95849 15.6645 5.17843 15.599L7.41584 14.9325C8.11248 14.725 8.74644 14.3472 9.26043 13.8332L16.2611 6.83247Z"
                        fill="currentColor"
                      />
                      <path
                        d="M4.375 4.37499C2.99429 4.37499 1.875 5.49428 1.875 6.87499V15.625C1.875 17.0057 2.99429 18.125 4.375 18.125H13.125C14.5057 18.125 15.625 17.0057 15.625 15.625V11.25C15.625 10.9048 15.3452 10.625 15 10.625C14.6548 10.625 14.375 10.9048 14.375 11.25V15.625C14.375 16.3154 13.8154 16.875 13.125 16.875H4.375C3.68464 16.875 3.125 16.3154 3.125 15.625V6.87499C3.125 6.18464 3.68464 5.62499 4.375 5.62499H8.75C9.09518 5.62499 9.375 5.34517 9.375 4.99999C9.375 4.65482 9.09518 4.37499 8.75 4.37499H4.375Z"
                        fill="currentColor"
                      />
                    </svg>
                    QTY: {item?.quantity}
                  </div>
                  <div className="text-primary text-lg font-bold">
                    @{currencyFormat(item?.subtotal)}
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

            <div className="mb-4">
              <button
                className={`btn btn-block btn-md btn-primary rounded-full ${
                  (selected === 'buy' && CartState?.items?.length > 0) ||
                  (selected === 'bills' && table)
                    ? ''
                    : 'btn-disabled'
                }`}
                onClick={selected === 'buy' ? open : openModal}
              >
                {selected === 'buy' ? 'Pay Now' : 'Save'}
              </button>
            </div>

            <dialog ref={dialogRef} className="modal">
              <OrderSummary
                title="Bill confirmation"
                subtitle="Please review the order below before saving it as a bill"
                data={{ ...CartState, table }}
                onClose={closeModal}
                onConfirm={onBillCreate}
                isLoading={billResult?.isLoading}
              />
            </dialog>
          </div>
        </div>
      </div>

      <div className="drawer-side">
        <div className="drawer-overlay" onClick={close} />
        <PaymentSection data={CartState} onClose={close} />
      </div>
    </div>
  );
};

export default Cart;
