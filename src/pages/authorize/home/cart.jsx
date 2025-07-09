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

  const { getTable, tableResult, openBill, billResult, reset, remove } = useCart();

  const [selected, setSelected] = React.useState('buy');
  const [toggle, setToggle] = React.useState(false);
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
    getTable();
  }, []);

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
              <h2 className="mb-2 text-xl font-bold">Select Table</h2>

              <div className="grid grid-cols-4 gap-2 rounded-sm py-2">
                {tableResult?.isFetching ? (
                  <div>Loading...</div>
                ) : (
                  tableResult?.data?.data?.map((tab, i) => (
                    <div
                      key={i}
                      onClick={() => setTable(tab)}
                      className={`cursor-pointer rounded-sm border p-1 text-center text-sm ${tab?.id === table?.id ? 'border-primary text-primary font-semibold' : ''} `}
                    >
                      {tab?.name}
                    </div>
                  ))
                )}
              </div>

              {/* <div
                className="border-secondary hover:border-primary flex cursor-pointer place-content-between place-items-center rounded-full border px-4 py-2"
                onClick={() => setToggle(!toggle)}
              >
                <div>Select Table :</div>
                <div>v</div>
              </div>

              {toggle && (
                <div className="border-secondary mt-3 grid grid-cols-4 gap-2 rounded-sm border px-4 py-2">
                  {tableResult?.isFetching ? (
                    <div>Loading...</div>
                  ) : (
                    tableResult?.data?.data?.map((tab, i) => (
                      <div
                        key={i}
                        onClick={() => setTable(tab)}
                        className={`cursor-pointer rounded-sm border p-1 text-center ${tab?.id === table?.id ? 'border-primary text-primary font-semibold' : ''} `}
                      >
                        {tab?.name}
                      </div>
                    ))
                  )}
                </div>
              )} */}

              {/* <select
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
              </select> */}
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
                      onClick={() => remove(item)}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M11.0001 2.98546V3.13665C11.6366 3.19492 12.2678 3.27154 12.8932 3.36599C13.1247 3.40095 13.3555 3.43837 13.5854 3.4782C13.8575 3.52533 14.0399 3.78411 13.9927 4.0562C13.9456 4.32829 13.6868 4.51066 13.4147 4.46352C13.3683 4.45549 13.3219 4.44755 13.2754 4.43971L12.6051 13.1534C12.525 14.1954 11.6561 15 10.611 15H5.38913C4.34406 15 3.47517 14.1954 3.39502 13.1534L2.72474 4.43971C2.67826 4.44755 2.63183 4.45549 2.58542 4.46352C2.31333 4.51066 2.05455 4.32829 2.00742 4.0562C1.96029 3.78411 2.14265 3.52533 2.41474 3.4782C2.64467 3.43837 2.87543 3.40095 3.10699 3.36599C3.73239 3.27154 4.3636 3.19492 5.00008 3.13665V2.98546C5.00008 1.94248 5.80844 1.05212 6.87704 1.01794C7.24994 1.00601 7.62432 1 8.00008 1C8.37585 1 8.75022 1.00601 9.12313 1.01794C10.1917 1.05212 11.0001 1.94248 11.0001 2.98546ZM6.90901 2.01743C7.27126 2.00584 7.63498 2 8.00008 2C8.36518 2 8.7289 2.00584 9.09115 2.01743C9.59423 2.03352 10.0001 2.45596 10.0001 2.98546V3.06055C9.33851 3.02038 8.67164 3 8.00008 3C7.32852 3 6.66166 3.02038 6.00008 3.06055V2.98546C6.00008 2.45596 6.40593 2.03352 6.90901 2.01743ZM6.67248 5.98078C6.66187 5.70484 6.42957 5.48976 6.15364 5.50037C5.8777 5.51098 5.66261 5.74328 5.67322 6.01922L5.90399 12.0192C5.9146 12.2952 6.1469 12.5102 6.42284 12.4996C6.69878 12.489 6.91386 12.2567 6.90325 11.9808L6.67248 5.98078ZM10.3263 6.01922C10.3369 5.74328 10.1219 5.51098 9.84591 5.50037C9.56998 5.48976 9.33768 5.70484 9.32707 5.98078L9.0963 11.9808C9.08568 12.2567 9.30077 12.489 9.57671 12.4996C9.85265 12.5102 10.0849 12.2952 10.0956 12.0192L10.3263 6.01922Z"
                          fill="currentColor"
                        />
                      </svg>
                    </div>
                    <div
                      className="btn btn-sm btn-primary btn-circle btn-outline"
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
                  (selected === 'bills' && table && CartState?.items?.length > 0)
                    ? ''
                    : 'btn-disabled'
                }`}
                onClick={selected === 'buy' ? open : openModal}
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
