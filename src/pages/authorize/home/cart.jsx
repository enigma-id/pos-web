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
import { buildOfflineTransactionPayload, setWarning } from '../../../services/offline';
import { updateSessionSummary } from '../../../services/sales/session/hook';
import {
  createOrderBill,
  createOrderPayment,
  updateOrderBill,
} from '../../../services/offline/queue';
import { setPendingCount } from '../../../services/offline/slice';
import { resetCart, selectedBill } from '../../../services/cart/slice';
import { v4 as uuidv4 } from 'uuid';
import { store } from '../../../services/store';
import { $failure } from '../../../services/form/action';
import { useUpdateMutation } from '../../../services/sales/order/action';
import { getCache, setCache } from '../../../utils/cache';
// import useOutlet from '../../../services/outlet/hooks';
import { currencyFormat } from '../../../utils/common';

const Cart = ({ onUpdate }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const CartState = useSelector(state => state?.Cart);
  const FormState = useSelector(state => state?.Form);
  const Channel = useSelector(state => state?.SalesChannel);
  const session = useSelector(s => s.Auth?.session);

  const [updateBillName, setUpdateBillName] = React.useState(false);
  const updateBillNameRef = React.useRef(false);
  const saveBillOfflineDataRef = React.useRef(null);
  const isOfflineSaveRef = React.useRef(false);
  const { showCustomer } = useSidebar();
  const { openModal, closeModal } = useModal();

  const [updateBillNameMutation] = useUpdateMutation();

  const {
    reset,
    remove,
    bill,
    billResult,
    billData,
    cartItems,
    onBillSelected,
    checkout,
    checkoutResult,
    update,
    updateResult,
  } = useCart();

  // const { getServiceCharge } = useOutlet();

  const getMode = () => {
    const isOpen =
      data?.length > 0 && CartState?.items?.list?.length === 0 && CartState?.bill === null;

    return isOpen ? 'open' : 'create';
  };

  const flattenAdditionals = (additionals = []) => {
    const result = [];

    additionals.forEach(add => {
      const { id: addon_group_id, type, items = [] } = add;

      items.forEach(child => {
        const isSelected = type === 'quantity' ? (child.quantity || 0) > 0 : !!child.selected;

        if (isSelected) {
          const entry = { addon_group_id, addon_item_id: child.addon_item_id ?? child.id };

          if (child.addon_item_id) {
            entry.id = child.id;
          }

          if (type === 'quantity') {
            entry.quantity = child.quantity;
          }

          result.push(entry);
        }
      });
    });

    return result;
  };

  const getOrderPayload = () => {
    const allItems = [...(CartState?.items?.list || []), ...(CartState?.items?.bill || [])];
    const orderItems = allItems.map(item => ({
      catalog_id: item.catalog_id || item.id,
      catalog_name: item.name || '',
      quantity: item.quantity,
      unit_price: Number(item.unit_price) || Number(item.unit_nett) || 0,
      addons: (item.additionals_flat || []).map(a => ({
        addon_group_id: a.addon_group_id,
        addon_item_id: a.addon_item_id,
        catalog_name: a.name || '',
        unit_price: a.unit_price || 0,
        quantity: Number(a.quantity || 1) * Number(item.quantity),
      })),
      ...(item.is_custom ? { is_custom: true } : {}),
    }));
    const discountCats = CartState?.discount?.category?.filter(
      (cat) => cat && (cat.discount_value > 0) && ['percentage', 'nominal'].includes(cat?.discount_type)
    )?.map((cat) => ({
      category_id: cat.id,
      ...(cat.discount_type === 'nominal' ? { discount_value: cat.discount_value } : { discount_percentage: cat.discount_value })
    }));
    return { orderItems, discountCats };
  };

  const onUpdateBillName = async ticket => {
    // ⚡ Edit nama — tetep kirim items biar validasi API lolos, tp jangan reset cart
    const { orderItems, discountCats } = getOrderPayload();
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (isOffline) {
      const userId = session?.user?.id;
      const offlineId = CartState?.bill?.id || CartState?.bill?.sync_id;
      if (offlineId) {
        try {
          await updateOrderBill(offlineId, {
            bill_name: ticket,
            items: orderItems,
            original_items: orderItems,
            category_discounts: discountCats || [],
            discount_percentage: CartState?.discount?.cart?.type === 'percentage' ? CartState?.discount?.cart?.value : 0,
            discount_value: CartState?.discount?.cart?.type === 'nominal' ? CartState?.discount?.cart?.value : 0,
            sales_channel_id: Channel?.selectedChannel?.id,
            sales_channel_name: Channel?.selectedChannel?.name,
            membership_id: CartState?.meta?.customer?.id || null,
            cashier_name: session?.user?.name || '',
            service_charge_value: CartState?.meta?.service_charge_value || 0,
            service_charge_percentage: CartState?.meta?.service_charge_percentage || 0,
          }, userId);
        } catch (err) {
          dispatch($failure(err));
          return;
        }
      }
      dispatch(selectedBill({ ...CartState?.bill, bill_name: ticket }));
      setUpdateBillName(false);
      closeModal();
      return;
    }

    // Online
    try {
      const payload = {
        bill_name: ticket,
        items: orderItems,
        category_discounts: discountCats || [],
        discount_percentage: CartState?.discount?.cart?.type === 'percentage' ? CartState?.discount?.cart?.value : 0,
        discount_value: CartState?.discount?.cart?.type === 'nominal' ? CartState?.discount?.cart?.value : 0,
        sales_channel_id: Channel?.selectedChannel?.id,
        membership_id: CartState?.meta?.customer?.id || null,
        cashier_name: session?.user?.name || '',
        status: 'pending',
      };
      const res = await updateBillNameMutation({ id: CartState?.bill?.id, payload }).unwrap();
      if (res?.message === 'success') {
        dispatch(selectedBill({ ...CartState?.bill, bill_name: ticket }));
        setUpdateBillName(false);
        closeModal();
      }
    } catch (err) {
      dispatch($failure(err));
    }
  };

  const onUpdateBill = async (ticket, { isEditName } = {}) => {
    // 👇 Baru: delegasi edit name biar gak reset cart
    if (isEditName) {
      return onUpdateBillName(ticket);
    }

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const userId = session?.user?.id;
    const { orderItems, discountCats } = getOrderPayload();

    if (isOffline) {
      const offlineId = CartState?.bill?.id || CartState?.bill?.sync_id;
      if (offlineId) {
        try {
          await updateOrderBill(offlineId, {
            bill_name: ticket,
            items: orderItems,
            original_items: orderItems,
            category_discounts: discountCats || [],
            discount_percentage: CartState?.discount?.cart?.type === 'percentage' ? CartState?.discount?.cart?.value : 0,
            discount_value: CartState?.discount?.cart?.type === 'nominal' ? CartState?.discount?.cart?.value : 0,
            sales_channel_id: Channel?.selectedChannel?.id,
            sales_channel_name: Channel?.selectedChannel?.name,
            membership_id: CartState?.meta?.customer?.id || null,
            cashier_name: session?.user?.name || '',
            service_charge_value: CartState?.meta?.service_charge_value || 0,
            service_charge_percentage: CartState?.meta?.service_charge_percentage || 0,
          }, userId);
        } catch (err) {
          dispatch($failure(err));
          return;
        }
      }
      dispatch(selectedBill({ ...CartState?.bill, bill_name: ticket }));
      dispatch(setPendingCount((store.getState()?.Offline?.pendingCount || 0) + 1));
      bill();
      setUpdateBillName(false);
      closeModal();
      return;
    }

    // Online — API (confirm save — reset cart OK)
    try {
      const payload = {
        bill_name: ticket,
        items: orderItems,
        category_discounts: discountCats || [],
        discount_percentage: CartState?.discount?.cart?.type === 'percentage' ? CartState?.discount?.cart?.value : 0,
        discount_value: CartState?.discount?.cart?.type === 'nominal' ? CartState?.discount?.cart?.value : 0,
        sales_channel_id: Channel?.selectedChannel?.id,
        membership_id: CartState?.meta?.customer?.id || null,
        cashier_name: session?.user?.name || '',
        status: 'pending',
      };
      const res = await update({ id: CartState?.bill?.id, payload });
      // update() udah resetCart + reset bill. Langsung show success.
      isOfflineSaveRef.current = true; // skip stale effect
      const billData = res?.data || res || {};
      const itemsTotal = orderItems.reduce((s, i) => {
        const it = (i.unit_price || 0) * (i.quantity || 0);
        const at = (i.addons || []).reduce((a, ad) => a + (ad.unit_price || 0) * (ad.quantity || 0), 0);
        return s + it + at;
      }, 0);
      console.log('[CONFIRM SAVE] orderItems:', JSON.stringify(orderItems.map(i => ({ name: i.catalog_name, addons: i.addons }))));
      const newItems = (CartState?.items?.list || []).map(item => ({
        catalog: { name: item.name || '' },
        catalog_name: item.name || '',
        quantity: item.quantity || 0,
        unit_nett: item.unit_price || 0,
        addons: (item.additionals_flat || []).map(a => ({
          catalog_name: a.name || '',
          unit_nett: a.unit_price || 0,
          quantity: Number(a.quantity || 1) * Number(item.quantity),
        })),
      }));
      openModal(<SuccessModal data={{
        bill_name: ticket,
        code: billData.code || '',
        total_charges: billData.total_charges || itemsTotal + (CartState?.meta?.service_charge_value || 0),
        total_payment: 0,
        status: 'pending',
        items: orderItems.map(i => ({
          catalog: { name: i.catalog_name || '' },
          catalog_name: i.catalog_name || '',
          quantity: i.quantity || 0,
          unit_nett: i.unit_price || 0,
          addons: (i.addons || []).map(a => ({
            catalog_name: a.catalog_name || '',
            unit_nett: a.unit_price || 0,
            unit_price: a.unit_price || 0,
            quantity: a.quantity || 1,
          })),
        })),
        new_items: newItems,
        service_charge_value: CartState?.meta?.service_charge_value || 0,
        discount_value: CartState?.discount?.cart?.amount || 0,
        sales_channel: Channel?.selectedChannel?.name ? { name: Channel.selectedChannel.name } : null,
        payment_ref: '',
        session: { cashier: { name: session?.user?.name || '' } },
      }} />, 'w-md');
    } catch (err) {
      dispatch($failure(err));
      handleModalError();
      setUpdateBillName(false);
      return;
    }
    setUpdateBillName(false);
  };

  const onCreateBill = async ticket => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const userId = session?.user?.id;

    if (isOffline) {
      // Re-save existing offline bill
      if (CartState?.bill?.sync_id) {
        const allItems = [...(CartState?.items?.list || []), ...(CartState?.items?.bill || [])];
        const orderItems = allItems.map(item => ({
          catalog_id: item.catalog_id || item.id,
          catalog_name: item.name || '',
          quantity: item.quantity,
          unit_price: Number(item.unit_price) || Number(item.unit_nett) || 0,
          addons: (item.additionals_flat || []).map(a => ({
            addon_group_id: a.addon_group_id,
            addon_item_id: a.addon_item_id,
            catalog_name: a.name || '',
            unit_price: a.unit_price || 0,
            quantity: Number(a.quantity || 1) * Number(item.quantity),
          })),
          ...(item.is_custom ? { is_custom: true } : {}),
        }));

        const orderId = uuidv4();
        const now = new Date();
        const code = `${now.toISOString().slice(2, 8).replace(/-/g, '')}${String(Math.floor(Math.random() * 9000) + 1000)}`;

        try {
          await createOrderBill(
            {
              sync_id: orderId,
              code,
              origin_session_sync_id: originId,
              paid_session_sync_id: null,
              is_show: true,
              original_items: orderItems,
              sales_channel_id: Channel?.selectedChannel?.id,
              sales_channel_name: Channel?.selectedChannel?.name,
              payment_method_id: null,
              membership_id: CartState?.meta?.customer?.id || null,
              payment_ref: '',
              bill_name: ticket,
              cashier_name: session?.user?.name || '',
              service_charge_value: CartState?.meta?.service_charge_value || 0,
              service_charge_percentage: CartState?.meta?.service_charge_percentage || 0,
              discount_percentage:
                CartState?.discount?.cart?.type === 'percentage'
                  ? CartState?.discount?.cart?.value
                  : 0,
              discount_value:
                CartState?.discount?.cart?.type === 'nominal'
                  ? CartState?.discount?.cart?.value
                  : 0,
              category_discounts: [],
              items: orderItems,
              status: 'pending',
              total_payment: 0,
            },
            userId
          );
          console.log('[SAVE BILL] createOrderBill success:', orderId, 'origin:', originId);
        } catch (err) {
          dispatch($failure(err));
          return;
        }
      }

      dispatch(setPendingCount((offlineState?.pendingCount || 0) + 1));
      dispatch(setWarning('Bill saved offline.'));

      // Push ke localStorage bills cache (pake setCache biar format {data: [...]})
      try {
        const BILLS_CACHE_KEY = 'cache_openbills';
        const existing = getCache(BILLS_CACHE_KEY) || [];
        const itemsTotal = orderItems.reduce((s, i) => {
          const itemTotal = (i.unit_price || 0) * (i.quantity || 0);
          const addonsTotal = (i.addons || []).reduce(
            (asum, a) => asum + (a.unit_price || 0) * (a.quantity || 0),
            0
          );
          return s + itemTotal + addonsTotal;
        }, 0);
        const totalCharges = itemsTotal + (Number(CartState?.meta?.service_charge_value) || 0);
        existing.unshift({
          id: orderId,
          bill_name: ticket,
          code: code,
          total_charges: totalCharges,
          items: orderItems.map(i => ({
            catalog: { name: i.catalog_name || '' },
            catalog_name: i.catalog_name || '',
            quantity: i.quantity || 0,
            unit_nett: i.unit_price || 0,
            discount_value: 0,
            addons: (i.addons || []).map(a => ({
              catalog_name: a.catalog_name || '',
              unit_nett: a.unit_price || 0,
              quantity: a.quantity || 1,
            })),
          })),
          sales_channel: Channel?.selectedChannel?.name
            ? { name: Channel.selectedChannel.name }
            : null,
          payment_ref: '',
          session: { cashier: { name: session?.user?.name || '' } },
          is_offline_mode: true,
          is_offline_mode: true,
          needs_sync: true,
        });
        setCache(BILLS_CACHE_KEY, existing);
      } catch (e) {
        console.error('[SAVE BILL] cache error:', e);
      }

      // 🔁 Update sessionSummary incremental
      updateSessionSummary({
        type: 'bill',
        sync_id: orderId,
        items: orderItems,
        billName: ticket,
        serviceChargeValue: CartState?.meta?.service_charge_value || 0,
      });
      console.log('[SAVE BILL] sessionSummary updated');

      const itemsTotal = orderItems.reduce((s, i) => {
        const itemTotal = (i.unit_price || 0) * (i.quantity || 0);
        const addonsTotal = (i.addons || []).reduce(
          (asum, a) => asum + (a.unit_price || 0) * (a.quantity || 0),
          0
        );
        return s + itemTotal + addonsTotal;
      }, 0);
      const totalCharges = itemsTotal + (Number(CartState?.meta?.service_charge_value) || 0);

      const newItems = (CartState?.items?.list || []).map(i => ({
        catalog: { name: i.name || '' },
        catalog_name: i.name || '',
        quantity: i.quantity || 0,
        unit_nett: i.unit_price || 0,
        discount_value: 0,
        addons: (i.additionals_flat || []).map(a => ({
          catalog_name: a.name || '',
          unit_nett: a.unit_price || 0,
          quantity: Number(a.quantity || 1) * Number(i.quantity),
        })),
      }));
      const successData = {
        bill_name: ticket,
        code: code,
        total_charges: totalCharges,
        total_payment: 0,
        is_offline_mode: true,
        needs_sync: true,
        status: 'pending',
        items: orderItems.map(i => ({
          catalog: { name: i.catalog_name || '' },
          catalog_name: i.catalog_name || '',
          quantity: i.quantity || 0,
          unit_nett: i.unit_price || 0,
          discount_value: 0,
          addons: (i.addons || []).map(a => ({
            catalog_name: a.catalog_name || '',
            unit_nett: a.unit_price || 0,
            quantity: a.quantity || 1,
          })),
        })),
        new_items: newItems,
        service_charge_value: CartState?.meta?.service_charge_value || 0,
        discount_value:
          CartState?.discount?.cart?.type === 'nominal' ? CartState?.discount?.cart?.value : 0,
        sales_channel: Channel?.selectedChannel?.name
          ? { name: Channel.selectedChannel.name }
          : null,
        payment_ref: '',
        session: { cashier: { name: session?.user?.name || '' } },
      };

      // ⛔️ Flag: skip stale mutation effect
      isOfflineSaveRef.current = true;

      openModal(<SuccessModal data={successData} />, 'w-md');

      // Refresh bills list biar button jadi Open Bill
      bill();

      dispatch(resetCart());
      return; // ⛔️ skip mutation API
    }

    // ===== ONLINE PATH =====
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

    const billItems = CartState?.items?.bill?.map(bi => {
      const base = {
        id: bi.id,
        catalog_id: bi.catalog_id,
        quantity: bi.quantity,
      };

      if (bi?.is_custom) {
        base.catalog_name = bi.name;
        base.unit_price = bi.unit_price;
      }

      const flattened = flattenAdditionals(bi?.addons);

      if (flattened?.length > 0) {
        base.addons = flattened;
      }

      return base;
    });

    const items = CartState?.items?.list?.map(item => {
      const base = {
        catalog_id: item.id,
        quantity: item.quantity,
      };

      if (item?.is_custom) {
        base.catalog_name = item?.name;
        base.unit_price = item?.unit_price;
      }

      const flattened = flattenAdditionals(item?.addons);

      if (flattened?.length > 0) {
        base.addons = flattened;
      }

      return base;
    });

    const payload = {
      bill_name: ticket,
      membership_id: CartState?.meta?.customer?.id,
      sales_channel_id: Channel?.selectedChannel?.id,
      status: 'pending',
      items,
    };

    if (billItems?.length > 0) {
      payload.items = [...billItems, ...items];
    }

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

    // Online — API
    try {
      await checkout(payload).unwrap();
      dispatch(setWarning('Bill saved.'));
    } catch (err) {
      dispatch($failure(err));
    }
  };

  const renderAdditionals = item => {
    return (item?.addons || [])
      .map(add => {
        const selectedChilds = (add?.items || []).filter(child =>
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
            <div className="text-lg font-semibold capitalize">{FormState?.errors?.ticket}</div>
            <p className="text-base-300 text-xs">Try another bill’s</p>
          </div>
        </Modal.Body>
      </>,

      mode === 'open' ? 'w-lg' : 'w-md'
    );
  };

  const handleModalPrint = data => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    let printData = data;
    if (isOffline && saveBillOfflineDataRef.current) {
      printData = {
        ...saveBillOfflineDataRef.current,
        id: data?.id || saveBillOfflineDataRef.current.id,
      };
    }

    openModal(<SuccessModal data={printData} />, 'w-md');

    if (isOffline && saveBillOfflineDataRef.current) {
      saveBillOfflineDataRef.current = null;
    }
  };

  const handleModalUpdateBillName = data => {
    setUpdateBillName(true);
    updateBillNameRef.current = true;
    openModal(
      <UpdateBillNameModal
        data={data}
        isLoading={billResult?.isLoading}
        onSubmit={v => onUpdateBill(v, { isEditName: true })}
        onClose={() => {
          setUpdateBillName(false);
          updateBillNameRef.current = false;
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
    if (checkoutResult?.isSuccess || updateResult?.isSuccess) {
      // ⛔️ Skip — this is a stale trigger from offline path
      if (isOfflineSaveRef.current) {
        isOfflineSaveRef.current = false;
        checkoutResult?.reset();
        updateResult?.reset();
        return;
      }

      const billData = checkoutResult?.data?.data || updateResult?.data?.data || {};

      if (updateBillNameRef.current) {
        closeModal();
        onBillSelected(billData);
        updateBillNameRef.current = false;
      } else {
        bill();
        handleModalPrint(billData);
        // getServiceCharge();
      }

      checkoutResult?.reset();
      updateResult?.reset();
    }
  }, [checkoutResult, updateResult]);

  React.useEffect(() => {
    if (checkoutResult?.isError) {
      handleModalError();
      checkoutResult?.reset();
    }
  }, [checkoutResult]);

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
              onClick={() => handleModalUpdateBillName(CartState?.bill)}
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
                      {currencyFormat(item?.quantity * item?.unit_price, undefined)}
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
                {currencyFormat(item?.quantity * item?.unit_price, undefined)}
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
