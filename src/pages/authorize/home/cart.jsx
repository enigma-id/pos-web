/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import BillModal from './saveBill';
import SuccessModal from './success';
import UpdateBillNameModal from './updateBillName';
import { Modal } from '../../../components/ui';
import { AddUserIcon, EditIcon, TrashIcon, UserIcon } from '../../../components/ui/icon';
import useModal from '../../../components/ui/modal/hook';
import useSidebar from '../../../components/ui/sidebar/hook';
import useCart from '../../../services/cart/hook';
import { setWarning } from '../../../services/offline';
import { updateSessionSummary } from '../../../services/sales/session/hook';
import { createOrderBill, updateOrderBill } from '../../../services/offline/queue';
import { triggerQueueRefresh } from '../../../services/offline/usePendingQueueCount';
import { resetCart } from '../../../services/cart/slice';
import { v4 as uuidv4 } from 'uuid';
import { makePendingBill } from '../../../services/offline/shapes';
import { $failure } from '../../../services/form/action';
import { saveOpenBills, updateOpenBills } from '../../../utils/cache';
import { currencyFormat } from '../../../utils/common';

const Cart = ({ onUpdate }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const CartState = useSelector(state => state?.Cart);
  const FormState = useSelector(state => state?.Form);
  const Channel = useSelector(state => state?.SalesChannel);
  const session = useSelector(s => s.Auth?.session);
  const OfflineSummary = useSelector(state => state?.Offline.sessionSummary);

  const dataModalSuccess = React.useRef(null);
  const hasChangeBillName = React.useRef(false);

  const { showCustomer } = useSidebar();
  const { openModal, closeModal } = useModal();

  const {
    reset,
    remove,
    bill,
    billResult,
    billData,
    cartItems,
    checkout,
    checkoutResult,
    update,
    updateResult,
    onUpdateBillName,
  } = useCart();

  // const { getServiceCharge } = useOutlet();

  const getMode = () => {
    const isOpen =
      data?.length > 0 && CartState?.items?.list?.length === 0 && CartState?.bill === null;

    return isOpen ? 'open' : 'create';
  };

  // Offline — Cache and IDB
  const onCreateBillOffline = async billName => {
    if (!OfflineSummary) {
      dispatch(setWaring('Please open session.'));
      return;
    }

    const discount_categories = CartState?.discount?.category
      ?.filter(
        cat =>
          cat && cat.discount_value > 0 && ['percentage', 'nominal'].includes(cat?.discount_type)
      )
      ?.map(cat => ({
        category_id: cat.id,
        category: cat,
        ...(cat.discount_type === 'nominal'
          ? { discount_value: cat.discount_value }
          : { discount_percentage: cat.discount_value }),
      }));

    const items = CartState?.items?.list?.map(item => {
      const base = {
        catalog_id: item.catalog_id,
        category_id: item.category_id,
        quantity: item.quantity,
        unit_nett: item.unit_nett,
        catalog_name: item.name,
      };

      if (item?.is_custom) {
        base.catalog_name = item?.name;
        base.unit_nett = item?.unit_nett;
      }

      if (item?.additionals_flat?.length > 0) {
        base.addons = item?.additionals_flat;
      }

      return base;
    });

    const orderId = uuidv4();
    const now = new Date();
    const code = `${now.toISOString().slice(2, 8).replace(/-/g, '')}${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const payload = {
      code: code,
      sync_id: orderId,
      bill_name: billName,
      membership_id: CartState?.meta?.customer?.id,
      sales_channel_id: Channel?.selectedChannel?.id,
      status: 'pending',
      is_offline_mode: true,
      items,

      // ini untuk kebutuhan standarisasi data Offline to Online
      created_at: now,
      session: OfflineSummary,
      membership: CartState?.meta?.customer,
      sales_channel: Channel?.selectedChannel,
      is_discount_percentage: CartState?.discount?.cart?.type === 'percentage' ? true : false,
      discount_value: CartState?.discount?.cart?.amount,
      service_charge_percentage: CartState?.meta?.service_charge_percentage,
      service_charge_value: CartState?.meta?.service_charge_value,
      total_charges: CartState?.meta?.grand_total,
    };

    if (CartState?.discount?.cart?.type) {
      if (CartState?.discount?.cart?.type === 'percentage') {
        payload.discount_percentage = CartState?.discount?.cart?.value;
      }
    }

    if (discount_categories?.length > 0) {
      payload.category_discounts = discount_categories;
    }

    const dataOfflineToOnline = makePendingBill(payload);
    try {
      await createOrderBill(dataOfflineToOnline, session?.user?.id);
    } catch (err) {
      handleModalError();
      dispatch($failure(err));
      return;
    }

    triggerQueueRefresh();

    // Push ke localStorage bills cache
    try {
      saveOpenBills(dataOfflineToOnline);
    } catch (e) {
      handleModalError();
    }

    // 🔁 Update sessionSummary incremental
    updateSessionSummary({
      type: 'bill',
      outstanding_bill: CartState?.meta?.grand_total,
    });

    handleModalPrint(dataOfflineToOnline);

    // Refresh bills list biar button jadi Open Bill
    bill();

    dispatch(resetCart());
  };

  // Online — API
  const onCreateBillOnline = async billName => {
    const discount_categories = CartState?.discount?.category
      ?.filter(
        cat =>
          cat && cat.discount_value > 0 && ['percentage', 'nominal'].includes(cat?.discount_type)
      )
      ?.map(cat => ({
        category_id: cat.id,
        ...(cat.discount_type === 'nominal'
          ? { discount_value: cat.discount_value }
          : { discount_percentage: cat.discount_value }),
      }));

    const items = CartState?.items?.list?.map(item => {
      const base = {
        catalog_id: item.catalog_id,
        quantity: item.quantity,
      };

      if (item?.is_custom) {
        base.catalog_name = item?.name;
        base.unit_nett = item?.unit_nett;
      }

      if (item?.additionals_flat?.length > 0) {
        base.addons = item?.additionals_flat?.map(addon => {
          return {
            ...addon,
            addon_group_id: addon?.addon_group?.id,
          };
        });
      }

      return base;
    });

    const payload = {
      bill_name: billName,
      membership_id: CartState?.meta?.customer?.id,
      sales_channel_id: Channel?.selectedChannel?.id,
      status: 'pending',
      items,
    };

    if (CartState?.discount?.cart?.type) {
      if (CartState?.discount?.cart?.type === 'percentage') {
        payload.discount_percentage = CartState?.discount?.cart?.value;
      }

      if (CartState?.discount?.cart?.type === 'nominal') {
        payload.discount_value = CartState?.discount?.cart?.value;
      }
    }

    if (discount_categories?.length > 0) {
      payload.category_discounts = discount_categories;
    }

    // kenapa gua pakai ini karena kita saat sukses API tidak ambil data ulang, jadi kita perlu masukan ke data modal ini bro
    dataModalSuccess.current = {
      total_charges: CartState?.meta?.grand_total || 0,
      paid_at: new Date(),
      sales_channel: Channel?.selectedChannel,
      membership: CartState?.meta?.customer,
      session: session.sales_session,
    };

    try {
      await checkout(payload).unwrap();
      dispatch(setWarning('Bill saved.'));
    } catch (err) {
      dispatch($failure(err));
    }
  };

  const onCreateBill = async billName => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (isOffline) {
      onCreateBillOffline(billName);
    } else {
      onCreateBillOnline(billName);
    }
  };

  console.log('[DEBUG]', CartState);

  // Offline — Cache and IDB
  const onUpdateBillOffline = async billName => {
    const discount_categories = CartState?.discount?.category
      ?.filter(
        cat =>
          cat && cat.discount_value > 0 && ['percentage', 'nominal'].includes(cat?.discount_type)
      )
      ?.map(cat => ({
        category_id: cat.id,
        category: cat,
        ...(cat.discount_type === 'nominal'
          ? { discount_value: cat.discount_value }
          : { discount_percentage: cat.discount_value }),
      }));

    // kalo hanya update bill name saja tidak perlu update yang di list CartState items list bro
    let allItems = [...(CartState?.items?.bill || []), ...(CartState?.items?.list || [])];
    if (hasChangeBillName.current) {
      allItems = CartState?.items?.bill;
    }

    const items = allItems?.map(item => {
      const base = {
        catalog_id: item.catalog_id,
        category_id: item.category_id,
        quantity: item.quantity,
        unit_nett: item.unit_nett,
        catalog_name: item.name,
      };

      if (item?.is_custom) {
        base.catalog_name = item?.name;
        base.unit_nett = item?.unit_nett;
      }

      if (item?.additionals_flat?.length > 0) {
        base.addons = item?.additionals_flat;
      }

      return base;
    });

    const now = new Date();

    const payload = {
      // kenapa gua tidak pakai sync_id - karena data-nya sudah ada di server bukan lagi di IDB
      id: CartState?.bill?.id || null,
      sync_id: CartState?.bill?.sync_id,
      code: CartState?.bill?.code,
      bill_name: billName,
      membership_id: CartState?.meta?.customer?.id,
      sales_channel_id: Channel?.selectedChannel?.id,
      status: 'pending',
      items,

      // ini untuk kebutuhan standarisasi data Offline to Online
      created_at: now,
      session: OfflineSummary,
      membership: CartState?.meta?.customer,
      sales_channel: Channel?.selectedChannel,
      is_discount_percentage: CartState?.discount?.cart?.type === 'percentage' ? true : false,
      discount_value: CartState?.discount?.cart?.amount,
      service_charge_percentage: CartState?.meta?.service_charge_percentage,
      service_charge_value: CartState?.meta?.service_charge_value,
      total_charges: CartState?.meta?.grand_total,
    };

    if (CartState?.discount?.cart?.type) {
      if (CartState?.discount?.cart?.type === 'percentage') {
        payload.discount_percentage = CartState?.discount?.cart?.value;
      }
    }

    if (discount_categories?.length > 0) {
      payload.category_discounts = discount_categories;
    }

    const dataOfflineToOnline = makePendingBill(payload);

    console.log('===================dataOfflineToOnline===================', dataOfflineToOnline);

    console.log(
      '[DEBUG] [CART] GT-TC',
      CartState?.meta?.grand_total - CartState?.bill?.total_charges
    );

    try {
      await updateOrderBill(dataOfflineToOnline, session?.user?.id);
    } catch (err) {
      handleModalError();
      dispatch($failure(err));
      return;
    }

    triggerQueueRefresh();

    // Push ke localStorage bills cache
    try {
      updateOpenBills(dataOfflineToOnline);
    } catch (err) {
      handleModalError();
    }

    // 🔁 Update sessionSummary incremental
    updateSessionSummary({
      type: 'bill',
      outstanding_bill: CartState?.meta?.grand_total - CartState?.bill?.total_charges,
    });

    if (!hasChangeBillName) {
      handleModalPrint(dataOfflineToOnline);

      // Refresh bills list biar button jadi Open Bill
      bill();
      dispatch(resetCart());
    } else {
      onUpdateBillName(billName);
      closeModal();
      hasChangeBillName.current = false;
    }
  };

  // Online — API
  const onUpdateBillOnline = async billName => {
    const discount_categories = CartState?.discount?.category
      ?.filter(
        cat =>
          cat && cat.discount_value > 0 && ['percentage', 'nominal'].includes(cat?.discount_type)
      )
      ?.map(cat => ({
        category_id: cat.id,
        ...(cat.discount_type === 'nominal'
          ? { discount_value: cat.discount_value }
          : { discount_percentage: cat.discount_value }),
      }));

    // kalo hanya update bill name saja tidak perlu update yang di list CartState items list bro
    let allItems = [...(CartState?.items?.bill || []), ...(CartState?.items?.list || [])];
    if (hasChangeBillName.current) {
      allItems = CartState?.items?.bill;
    }

    const items = allItems?.map(item => {
      const base = {
        catalog_id: item.catalog_id,
        quantity: item.quantity,
      };

      if (item?.is_custom) {
        base.catalog_name = item?.name;
        base.unit_nett = item?.unit_nett;
      }

      if (item?.additionals_flat?.length > 0) {
        base.addons = item?.additionals_flat?.map(addon => {
          return {
            ...addon,
            addon_group_id: addon?.addon_group?.id,
          };
        });
      }

      return base;
    });

    const payload = {
      bill_name: billName,
      membership_id: CartState?.meta?.customer?.id,
      sales_channel_id: Channel?.selectedChannel?.id,
      status: 'pending',
      items,
    };

    if (CartState?.discount?.cart?.type) {
      if (CartState?.discount?.cart?.type === 'percentage') {
        payload.discount_percentage = CartState?.discount?.cart?.value;
      }

      if (CartState?.discount?.cart?.type === 'nominal') {
        payload.discount_value = CartState?.discount?.cart?.value;
      }
    }

    if (discount_categories?.length > 0) {
      payload.category_discounts = discount_categories;
    }

    // newItems ini hanya untuk tampilan print kitchen bro
    const newItems = CartState?.items?.list?.map(item => {
      const base = {
        catalog_id: item.catalog_id,
        quantity: item.quantity,
        catalog_name: item?.name,
      };

      if (item?.is_custom) {
        base.catalog_name = item?.name;
        base.unit_nett = item?.unit_nett;
      }

      if (item?.additionals_flat?.length > 0) {
        base.addons = item?.additionals_flat?.map(addon => {
          return {
            ...addon,
            addon_group_id: addon?.addon_group?.id,
            catalog_name: addon.name,
            quantity: (addon.quantity || 1) * item.quantity,
          };
        });
      }

      return base;
    });

    // kenapa gua pakai ini karena kita saat sukses API tidak ambil data ulang, jadi kita perlu masukan ke data modal ini bro
    dataModalSuccess.current = {
      total_charges: CartState?.meta?.grand_total || 0,
      paid_at: new Date(),
      sales_channel: Channel?.selectedChannel,
      membership: CartState?.meta?.customer,
      session: session.sales_session,
      new_items: newItems,
      bill_name: billName,
    };

    try {
      await update({ id: CartState?.bill?.id, payload }).unwrap();
      dispatch(setWarning('Bill saved.'));
    } catch (err) {
      dispatch($failure(err));
    }
  };

  const onUpdateBill = async billName => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (isOffline) {
      onUpdateBillOffline(billName);
    } else {
      onUpdateBillOnline(billName);
    }
  };

  const renderAdditionals = item => {
    return (item?.addons || [])
      .map(add => {
        const selectedChilds = (add?.items || []).filter(child =>
          add.type === 'quantity' ? (child?.quantity || 0) > 0 : !!child?.selected
        );

        if (selectedChilds.length === 0) return null;

        const childNames = selectedChilds.map(child => (
          <div
            key={child.id}
            className="text-base-300 flex place-content-between text-xs font-thin"
          >
            <span>
              + {child?.name}{' '}
              {(add?.type === 'quantity' || add?.type === 'checkbox') &&
                `(${item?.quantity} x ${child?.quantity}) x ${currencyFormat(child?.unit_nett || child?.unit_nett || 0)}`}
            </span>
            <span>
              {currencyFormat(
                item?.quantity * child?.quantity * (child?.unit_nett || child?.unit_nett || 0)
              )}
            </span>
          </div>
        ));

        return (
          <div key={add.id} className="text-sm">
            <div className="text-base-300 text-xs font-semibold uppercase">{add.name}</div>
            <div>{childNames}</div>
          </div>
        );
      })
      .filter(Boolean);
  };

  const confirmSaveBil = () => {
    openModal(
      <>
        <Modal.Header onClose={closeModal}>
          <div className="text-lg font-semibold">Confirm Save Bill</div>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3 py-4">
            <div>Are you sure?</div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <div className="btn btn-md px-10" onClick={closeModal}>
            Cancel
          </div>
          <div
            className={`btn btn-md btn-success px-10 text-white ${billResult?.isLoading ? 'btn-disabled' : ''}`}
            onClick={() => onUpdateBill(CartState?.bill?.bill_name)}
          >
            Confirm{' '}
            {billResult.isLoading ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : null}
          </div>
        </Modal.Footer>
      </>,

      mode === 'open' ? 'w-lg' : 'w-md'
    );
  };

  const handleModal = () => {
    openModal(
      <BillModal mode={mode} count={data?.length} onBillCreate={v => onCreateBill(v)} />,
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
            <div className="text-lg font-semibold capitalize">{FormState?.errors?.billName}</div>
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

  const handleModalUpdateBillName = () => {
    hasChangeBillName.current = true;
    openModal(
      <UpdateBillNameModal
        data={CartState?.bill}
        isLoading={billResult?.isLoading}
        onSubmit={v => onUpdateBill(v)}
        onClose={() => {
          hasChangeBillName.current = false;
        }}
      />,
      'w-md'
    );
  };

  const handleReset = () => {
    reset();
    // getServiceCharge();
  };

  React.useEffect(() => {
    if (checkoutResult?.isError || updateResult?.isError) {
      handleModalError();
      checkoutResult?.reset();
    }
  }, [checkoutResult, updateResult]);

  React.useEffect(() => {
    if (checkoutResult?.isSuccess && checkoutResult?.data) {
      const metaRef = dataModalSuccess.current;

      const data = {
        ...checkoutResult?.data?.data,
        ...metaRef,
      };

      dataModalSuccess.current = null;

      handleModalPrint(data);
      bill();
      checkoutResult?.reset();
    }
  }, [checkoutResult]);

  React.useEffect(() => {
    if (updateResult?.isSuccess && updateResult?.data) {
      if (hasChangeBillName.current) {
        onUpdateBillName(dataModalSuccess.current.bill_name);
        closeModal();
        hasChangeBillName.current = false;
      } else {
        const metaRef = dataModalSuccess.current;

        const data = {
          ...updateResult?.data?.data,
          ...metaRef,
        };

        dataModalSuccess.current = null;

        handleModalPrint(data);
        dispatch(resetCart());
        updateResult?.reset();
      }
    }
  }, [updateResult]);

  React.useEffect(() => {
    bill();
    // getServiceCharge();
  }, []);

  const data = billData || billResult?.data?.data;

  const mode = getMode();

  return (
    <div className="border-base-200 bg-base-100 flex h-screen flex-col border-t border-l">
      <div className="border-base-200 flex h-16 place-content-between border-b">
        <div className="flex-2/3 place-content-center ps-4">
          <h2 className="text-lg font-bold">Order Details</h2>
        </div>
        {(CartState?.items?.count > 0 || CartState?.bill) && (
          <div
            className="bg-error cursor-pointer place-content-center px-6"
            onClick={() => handleReset()}
          >
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
        <>
          <div className="border-base-200 bg-accent relative grid w-full grid-cols-[1fr_auto] place-items-center overflow-hidden p-[16px] pb-0">
            <div className="grid w-full grid-cols-[1fr_1fr] font-semibold">
              <div>Bill name: </div>
              <div className="text-base-content text-end">{CartState?.bill?.bill_name}</div>
            </div>

            <div
              className="btn btn-xs btn-primary btn-circle btn-outline ms-2"
              onClick={() => handleModalUpdateBillName()}
            >
              <EditIcon className="h-4 w-4" />
            </div>
          </div>

          <div className="collapse-arrow bg-accent collapse rounded-none">
            <input type="checkbox" name="my-accordion-2" />
            <div className="collapse-title border-base-200 border-b text-base font-semibold">
              <div className="">
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
                      {currencyFormat(item?.quantity * item?.unit_nett, undefined)}
                    </span>
                  </div>

                  {item?.addons?.length > 0 && (
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
                      {CartState?.items?.bill?.length > 1 && (
                        <div
                          className="btn btn-sm btn-error btn-circle btn-outline hover:!text-white"
                          onClick={() => remove(i, 'bill_item')}
                        >
                          <TrashIcon />
                        </div>
                      )}
                    </div>

                    <div className="text-primary text-lg font-bold">
                      {currencyFormat(item?.subtotal, undefined, 'Free')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
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
                {currencyFormat(item?.quantity * item?.unit_nett, undefined)}
              </span>
            </div>

            {item?.addons?.length > 0 && (
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
        {(CartState?.meta?.subtotal_list > 0 || CartState?.bill?.total_bill > 0) && (
          <div className="mb-3 flex place-content-between place-items-center px-4">
            <div className="text-base">Subtotal</div>
            <div className="text-md font-semibold">
              {currencyFormat(CartState?.meta?.subtotal_list + (CartState?.bill?.total_bill || 0))}
            </div>
          </div>
        )}

        {CartState?.meta?.service_charge_value > 0 && (
          <div className="mb-3 flex place-content-between place-items-center px-4">
            <div className="text-base">Service</div>
            <div className="text-md font-semibold">
              {currencyFormat(CartState?.meta?.service_charge_value)}
            </div>
          </div>
        )}

        <div className="mb-3 flex place-content-between place-items-center px-4">
          <div className="text-base font-semibold">Total</div>
          <div className="text-primary text-xl font-bold">
            {currencyFormat(CartState?.meta?.grand_total)}
          </div>
        </div>

        <div className="flex place-items-center gap-1">
          {mode === 'open' ? (
            <button
              className={`btn btn-xl btn-primary flex-1 rounded-none text-lg font-thin uppercase`}
              onClick={handleModal}
            >
              Open Bill ({data?.length})
            </button>
          ) : (
            <button
              className={`btn btn-xl btn-primary flex-1 rounded-none text-lg font-thin uppercase ${
                CartState?.items?.list?.length > 0 ||
                (CartState?.bill &&
                  CartState?.bill?.items?.length != CartState?.items?.bill?.length)
                  ? ''
                  : 'btn-disabled'
              }`}
              onClick={CartState?.bill ? confirmSaveBil : handleModal}
            >
              Save Bill
            </button>
          )}

          <button
            className={`btn btn-xl btn-primary flex-1 rounded-none text-lg font-thin uppercase ${
              (!CartState?.bill && CartState?.items?.list?.length > 0) ||
              (CartState?.bill?.items?.length == CartState?.items?.bill?.length &&
                CartState?.items?.list?.length === 0)
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
            Checkout
          </button>
        </div>
      </div>
    </div>
  );
};

export default Cart;
