/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import DetailScreen from './detail';
import BillModal from './saveBill';
import SuccessModal from './success';
import { Input, Modal, NFCField } from '../../../components/ui';
import { changeServiceCharge } from '../../../services/cart/slice';
import {
  BackIcon,
  CardIcon,
  ChevronDownIcon,
  EditIcon,
  MoneyIcon,
  TrashIcon,
  UserCircleIcon,
} from '../../../components/ui/icon';
import Keypad from '../../../components/ui/keypad';
import useModal from '../../../components/ui/modal/hook';
import useCart from '../../../services/cart/hook';
import useMembership from '../../../services/membership/hook';
import { buildOfflineTransactionPayload, setWarning } from '../../../services/offline';
import {
  createOrderBill,
  createOrderPayment,
  updateOrderBill,
  updateOrderPayment,
  ensureDB,
  STORES,
} from '../../../services/offline/queue';
import { triggerQueueRefresh } from '../../../services/offline/usePendingQueueCount';
import { updateSessionSummary } from '../../../services/sales/session/hook';
import { $failure } from '../../../services/form/action';
import { v4 as uuidv4 } from 'uuid';
import { store } from '../../../services/store';
import {
  makePendingBill,
  makeCompletedOrder,
  makeIdbBillData,
} from '../../../services/offline/shapes';
import { getCache, saveOpenBills, setCache } from '../../../utils/cache';
// import useOutlet from '../../../services/outlet/hooks';
import useOrder from '../../../services/sales/order/hook';
import { currencyFormat, isActive } from '../../../utils/common';
import { getMemberCache } from '../../../utils/cache';

const CheckoutScreen = () => {
  const location = useLocation();
  const isBill = location.state?.is_bill;

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const CartState = useSelector(state => state?.Cart);
  const Channel = useSelector(state => state?.SalesChannel);
  const session = useSelector(s => s.Auth?.session);
  const OfflineSummary = useSelector(state => state?.Offline.sessionSummary);

  const dropdownRef = React.useRef(null);

  const {
    getPaymentMethod,
    onChangeDiscount,
    onChangeCartDiscount,
    checkout,
    checkoutResult,
    closeBill,
    closeBillResult,
    update,
    updateResult,
    remove,
    billItems,
  } = useCart();
  const { show, showResult } = useOrder();

  // const { getServiceCharge } = useOutlet();

  const { checkSaldo, checkResult } = useMembership();
  const apiReachable = useSelector(state => state?.Offline?.apiReachable);
  const syncIdOffline = useSelector(state => state?.Offline?.activeSyncId);
  const syncIdServer = useSelector(state => state?.Auth?.session?.sales_session?.id);
  const activeSyncId = syncIdOffline || syncIdServer;
  const { openModal, closeModal } = useModal();

  const [isOpen, setIsOpen] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState([]);
  const [paymentRef, setPaymentRef] = React.useState('');
  const [pay, setPay] = React.useState(0);
  const isOfflineSaveRef = React.useRef(false);
  const [discountInputs, setDiscountInputs] = React.useState({});
  // const [billID, setBillID] = React.useState(null);
  const [billName, setBillName] = React.useState('');

  const [selectedMethod, setSelectedMethod] = React.useState(null);
  const checkoutSnapshotRef = React.useRef(null);
  const isSaveBillFlowRef = React.useRef(false);
  const [isSaveBillFlow, setIsSaveBillFlow] = React.useState(false);
  const [saveBillError, setSaveBillError] = React.useState('');
  const kitchenNewItemsRef = React.useRef(null);
  const billPayloadMetaRef = React.useRef(null);

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
              ? `(${item?.quantity} x ${child?.quantity}) x ${currencyFormat(child?.unit_nett)}`
              : '';
          return (
            <div className="text-base-300 flex place-content-between text-xs font-thin">
              <span>
                + {child?.name} {suffix}
              </span>
              <span>{currencyFormat(item?.quantity * child?.quantity * child?.unit_nett)}</span>
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

  const onShow = (data, index = null, type) => {
    handleModal({ catalog: data, key: index, type });
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
        catalog: {
          id: item.catalog_id,
          category_id: item.category_id,
          code: item.code,
          name: item.name,
          is_custom: item.is_custom,
        },
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
      dispatch($failure(err));
      return;
    }

    triggerQueueRefresh();

    // Push ke localStorage bills cache
    try {
      saveOpenBills(dataOfflineToOnline);
    } catch (e) {
      console.error('[SAVE BILL] cache error:', e);
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

  const handleModal = ({ catalog, key, type }) => {
    openModal(
      <DetailScreen
        catalog={catalog}
        mode={'edit'}
        editKey={key}
        onClose={closeModal}
        type={type}
      />
    );
  };

  const handlePay = async card => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const isCashPayment = selectedMethod?.provider === 'cash';
    const cashTotalPayment = Number(pay) || 0;
    if (isOffline && isCashPayment && cashTotalPayment <= 0) {
      dispatch(setWarning('Please fill total payment first.'));
      return;
    }

    const allItems = [...(CartState?.items?.list || []), ...(CartState?.items?.bill || [])];

    const items = allItems?.map(item => {
      const base = {
        catalog_id: item.catalog_id,
        quantity: item.quantity,
      };

      if (CartState?.bill) {
        base.id = item.id;
      }

      if (item?.additionals_flat?.length > 0) {
        base.addons = item?.additionals_flat?.map(add => ({
          addon_group_id: add?.addon_group?.id,
          addon_item_id: add?.addon_item_id,
          // Only send quantity for type=quantity; addon_group.type set by slice
          ...(add?.addon_group?.type === 'quantity' ? { quantity: add?.quantity ?? 1 } : {}),
        }));
      }

      if (Array.isArray(item?.addons) && item.addons.length > 0) {
        base.additionals_catalog_map = item.addons
          .flatMap((group, groupIndex) => {
            const childs = Array.isArray(group?.items) ? group.items : [];
            return childs
              .filter(child =>
                group?.type === 'quantity' ? (child?.quantity || 0) > 0 : !!child?.selected
              )
              .map((child, childIndex) => ({
                index: `${groupIndex}-${childIndex}`,
                addon_group_id: group?.id ?? null,
                addon_item_id: child?.catalog_id ?? child?.id ?? null,
                addon: {
                  id: group?.id ?? null,
                  name: group?.name || '',
                  type: group?.type || '',
                },
                catalog: {
                  id: child?.catalog_id ?? child?.id ?? null,
                  name: child?.name || '',
                  unit_nett: Number(child?.unit_nett) || 0,
                },
              }));
          })
          .filter(entry => entry.catalog_id != null);
      }

      if (item?.is_custom) {
        base.catalog_name = item?.name;
        base.unit_nett = item?.unit_nett;
      }

      return base;
    });

    const discount_categories = CartState?.discount?.category
      ?.filter(
        cat => cat?.discount_value > 0 && ['percentage', 'nominal'].includes(cat?.discount_type)
      )
      ?.map(cat => ({
        category_id: cat.id,
        name: cat.name || '',
        category: { name: cat.name || '' },
        ...(cat.discount_type === 'percentage'
          ? { discount_percentage: cat.discount_value }
          : { discount_value: cat.discount_value }),
      }));

    const payload = {
      status: 'completed',
      sales_channel_id: Channel?.selectedChannel?.id,
      payment_method_id: selectedMethod?.id,
      payment_ref: paymentRef,
      total_payment:
        selectedMethod?.provider === 'cash' ? Number(pay) || 0 : CartState?.meta?.grand_total || 0,
      items,
    };

    if (billName) {
      payload.bill_name = billName;
    } else if (CartState?.bill?.bill_name) {
      payload.bill_name = CartState.bill.bill_name;
    }

    if (CartState?.meta?.customer) {
      payload.membership_id = CartState?.meta?.customer?.id;
    }

    if (CartState?.discount?.cart?.type === 'percentage') {
      payload.discount_percentage = CartState?.discount?.cart?.value;
    } else if (CartState?.discount?.cart?.type === 'nominal') {
      payload.discount_value = CartState?.discount?.cart?.value;
    }

    if (discount_categories?.length > 0) {
      payload.category_discounts = discount_categories;
    }

    if (card) {
      payload.membership_id = card?.id;
      payload.card_id = card?.card_id;
      payload.payment_ref = card?.reff_code;
    }

    // ===== OFFLINE PATH =====
    if (isOffline) {
      const syncId = store.getState()?.Offline?.sessionSummary?.id || '';
      if (!syncId) {
        dispatch(setWarning('No active session. Please start a session first.'));
        return;
      }
      const checkoutOriginId = syncId;

      const orderId = uuidv4();
      const now = new Date().toISOString();

      // Build items with catalog_name + unit_nett for preview
      const orderItems = allItems.map(item => ({
        catalog_id: item.catalog_id,
        catalog_name: item.name || '',
        quantity: item.quantity,
        unit_nett: Number(item.unit_nett) || 0,
        addons: (item.additionals_flat || []).map(a => ({
          addon_group: a.addon_group || { id: a.addon_group?.id },
          addon_item_id: a.addon_item_id,
          catalog_name: a.name || '',
          unit_nett: a.unit_nett || 0,
          ...(a?.addon_group?.type === 'quantity'
            ? { quantity: Number(a.quantity || 1) * Number(item.quantity) }
            : {}),
        })),
        ...(item.is_custom ? { is_custom: true } : {}),
      }));

      // Determine origin session (from bill or current)
      const originSyncId = CartState?.bill?.origin_session_sync_id || syncId;
      const pendingSyncId = CartState?.bill?.sync_id || CartState?.bill?.id;

      // Compute remaining items for split detection
      const originalItems = CartState?.bill?.originalItems || CartState?.bill?.itemSnapshot || [];
      let remainingItems = [];
      let isFullPayment = true;

      if (originalItems.length > 0) {
        for (const oi of originalItems) {
          const cartItem = orderItems.find(c => c.catalog_id === oi.catalog_id);
          if (!cartItem) {
            // Item dihapus user → sisa qty asli
            remainingItems.push({ ...oi });
            isFullPayment = false;
          } else if ((cartItem.quantity || 0) < (oi.quantity || 0)) {
            // Qty dikurangin → sisa = original.qty - cart.qty
            remainingItems.push({
              catalog_id: oi.catalog_id,
              quantity: (oi.quantity || 0) - (cartItem.quantity || 0),
            });
            isFullPayment = false;
          }
          // qty sama atau lebih → no sisa
        }
      }

      const code = `${new Date().toISOString().slice(2, 8).replace(/-/g, '')}${String(Math.floor(Math.random() * 9000) + 1000)}`;
      const totalPay =
        selectedMethod?.provider === 'cash' ? Number(pay) || 0 : CartState?.meta?.grand_total || 0;
      const completedOrder = makeCompletedOrder({
        orderId,
        code,
        billName: billName || CartState?.bill?.bill_name || '',
        items: orderItems,
        cartState: CartState,
        channel: Channel?.selectedChannel,
        session,
        paymentMethod: selectedMethod,
        paymentRef: selectedMethod?.provider === 'cash' ? '' : paymentRef,
        totalPayment: totalPay,
        paidAt: now,
        discountCategories: discount_categories || [],
      });
      // Cross-session tracking for IDB
      completedOrder.origin_session_sync_id = CartState?.bill ? originSyncId : checkoutOriginId;
      completedOrder.paid_session_sync_id = checkoutOriginId;
      completedOrder.status = 'completed';

      try {
        await createOrderPayment(completedOrder, session?.user?.id);
      } catch (err) {
        dispatch($failure(err));
        return;
      }

      // If this is from a saved bill (pending order exists), update it
      if (originSyncId && pendingSyncId && originSyncId !== pendingSyncId) {
        // Handle both same-session and cross-session updates
        const originSessionId = originSyncId;
        try {
          if (isFullPayment) {
            await updateOrderBill(pendingSyncId, { is_show: false }, session?.user?.id);
          } else {
            await updateOrderBill(pendingSyncId, { items: remainingItems }, session?.user?.id);
          }
          // Sync cache_openbills
          var _cache = getCache('cache_openbills') || [];
          var _idx = _cache.findIndex(function (b) {
            return b.sync_id === pendingSyncId || b.id === pendingSyncId;
          });
          if (_idx >= 0) {
            if (isFullPayment) {
              _cache[_idx].is_show = false;
            } else {
              _cache[_idx].items = remainingItems;
            }
            setCache('cache_openbills', _cache);
          }
        } catch {}
      }

      // Inject history cache
      const HISTORY_CACHE_KEY = 'cache_order_history';
      const existing = getCache(HISTORY_CACHE_KEY) || [];
      const historyEntry = completedOrder;
      historyEntry.bill_name = completedOrder.bill_name;
      historyEntry.is_synced = false;
      historyEntry.payment_method = selectedMethod
        ? { id: selectedMethod.id, name: selectedMethod.name }
        : null;
      historyEntry.payment_ref = selectedMethod?.provider === 'cash' ? '' : paymentRef;
      delete historyEntry.new_items;
      setCache(HISTORY_CACHE_KEY, [historyEntry, ...existing]);

      triggerQueueRefresh();

      // 🔁 Update sessionSummary incremental
      updateSessionSummary({
        type: 'payment',
        sync_id: orderId,
        items: orderItems,
        bill_name: completedOrder.bill_name || billName,
        total_payment: completedOrder.total_payment,
        discount_value: completedOrder.discount_value,
        service_charge_value: completedOrder.service_charge_value,
        payment_method_id: selectedMethod?.id,
        payment_method_name: selectedMethod?.name || selectedMethod?.provider || 'Cash',
      });

      // Receipt items: semua items (bill + list)
      const receiptItems = orderItems.map(i => {
        const ci = allItems.find(ci => ci.catalog_id === i.catalog_id);
        return {
          catalog: {
            name: i.catalog_name || '',
            category_id: ci?.category?.id || ci?.category_id || 0,
          },
          catalog_name: i.catalog_name || '',
          quantity: i.quantity || 0,
          unit_nett: i.unit_nett || 0,
          discount_value: ci?.discount_amount || 0,
          addons: (i.addons || []).map(a => ({
            catalog_name: a.catalog_name || '',
            unit_nett: a.unit_nett || 0,
            quantity: a.quantity || 1,
          })),
        };
      });
      // Build receipt-ready shape
      // Kitchen items: cuma tambahan baru (list-only, bukan bill)
      const payNewItems = (CartState?.items?.list || []).map(i => ({
        catalog: { name: i.name || '' },
        catalog_name: i.name || '',
        quantity: i.quantity || 0,
        unit_nett: i.unit_nett || 0,
        discount_value: i?.discount_amount || 0,
        addons: (i.additionals_flat || []).map(a => ({
          catalog_name: a.name || '',
          unit_nett: a.unit_nett || 0,
          quantity: Number(a.quantity || 1) * Number(i.quantity),
        })),
      }));
      // const paySuccessData = makeSuccessData({
      //   orderId,
      //   code: completedOrder.code,
      //   billName: completedOrder.bill_name,
      //   items: orderItems,
      //   cartState: CartState,
      //   channel: Channel?.selectedChannel,
      //   session,
      //   paymentMethod: selectedMethod,
      //   paymentRef: selectedMethod?.provider === 'cash' ? '' : paymentRef,
      //   totalPayment: completedOrder.total_payment,
      //   paidAt: now,
      //   created_at: now,
      //   discountCategories: discount_categories || [],
      //   isPayment: true,
      // });
      paySuccessData.new_items = payNewItems;

      dispatch(setWarning('Payment saved offline. It will sync when online.'));
      dispatch(resetCart());
      setSelectedMethod(paymentMethod[0]);

      // Show success modal
      // openModal(<SuccessModal data={paySuccessData} backToMenu />, 'w-md');
      return; // ⛔️ skip mutation API
    }

    // ===== ONLINE PATH =====
    // Stash new_items for kitchen print (online — API returns all items)
    kitchenNewItemsRef.current = (CartState?.items?.list || []).map(i => ({
      catalog: { name: i.name || '' },
      catalog_name: i.name || '',
      quantity: i.quantity || 0,
      unit_nett: i.unit_nett || 0,
      discount_value: i?.discount_amount || 0,
      addons: (i.additionals_flat || []).map(a => ({
        catalog_name: a.name || '',
        unit_nett: a.unit_nett || 0,
        quantity: Number(a.quantity || 1) * Number(i.quantity),
      })),
    }));

    checkoutSnapshotRef.current = {
      cartState: JSON.parse(JSON.stringify(CartState || {})),
      selectedChannel: Channel?.selectedChannel ? { ...Channel.selectedChannel } : null,
      paymentMethod: selectedMethod ? { ...selectedMethod } : null,
      paymentRef: selectedMethod?.provider === 'cash' ? '' : paymentRef,
      billName,
      requestBody: payload,
      authSession: session,
    };

    // Build formatted preview for Queue Manager (same shape as PendingDrawer expects)
    const offlinePreview = buildOfflineTransactionPayload({
      cartState: CartState,
      selectedChannel: Channel?.selectedChannel,
      paymentMethod: selectedMethod,
      paymentRef: selectedMethod?.provider === 'cash' ? '' : paymentRef,
      billName: billName,
      authSession: session,
      queueMeta: {
        requestBody: payload,
      },
    });

    if (isBill) {
      await closeBill(CartState?.bill?.id, payload);
    } else {
      await checkout(payload);
    }
  };

  const openBillNameModal = () => {
    openModal(
      <BillModal mode="create" onBillCreate={billName => onCreateBill(billName)} />,
      'w-md'
    );
  };

  const confirmSaveBillModal = () => (
    <>
      <Modal.Header
        onClose={() => {
          setSaveBillError('');
          closeModal();
        }}
      >
        <div className="text-lg font-semibold">Confirm Save Bill</div>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-3 py-4">
          <div>Are you sure?</div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div
          className="btn btn-md px-10"
          onClick={() => {
            setSaveBillError('');
            closeModal();
          }}
        >
          Cancel
        </div>
        <div
          className={`btn btn-md btn-success px-10 text-white ${checkoutResult?.isLoading || updateResult?.isLoading ? 'btn-disabled' : ''}`}
          onClick={() => {
            setSaveBillError('');
            handleUpdateBill(CartState?.bill?.bill_name);
            // ⛔️ Don't closeModal — handleUpdateBill calls openModal internally.
            // closeModal has a 200ms setTimeout that nukes the component,
            // which would override openModal's SuccessModal.
          }}
        >
          Confirm{' '}
          {checkoutResult?.isLoading || updateResult?.isLoading ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : null}
        </div>
      </Modal.Footer>
    </>
  );

  const handleModalPrint = data => {
    openModal(<SuccessModal data={data} />, 'w-md');
  };

  const handleRead = uid => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (isOffline || apiReachable === false) {
      // No connection → skip checkSaldo, ambil dari cache kalo ada
      const cached = getMemberCache(uid);
      handlePay(cached || { card_id: uid });
      return;
    }

    const params = {
      is_checkout: true,
      nominal: CartState?.meta?.grand_total,
      card_id: uid,
    };

    checkSaldo(params);
  };

  const openNFC = async () => {
    openModal(
      <NFCField onRead={handleRead} isOpen={true} onClose={closeModal} result={checkResult} />
    );
  };

  React.useEffect(() => {
    if (checkResult?.isSuccess) {
      // openSuccess()
      const card = checkResult?.data?.data;
      handlePay(card);
    }
  }, [checkResult]);

  React.useEffect(() => {
    if (checkoutResult?.isSuccess && checkoutResult?.data) {
      const data = checkoutResult?.data?.data;
      if (data) {
        show(data?.id);
      }

      setDiscountInputs([]);
    }
  }, [checkoutResult?.isSuccess]);

  React.useEffect(() => {
    if (showResult?.isSuccess && showResult?.data) {
      handleModalPrint(showResult?.data?.data);
    }
  }, [showResult?.isSuccess, showResult?.data]);

  // Cleanup isSaveBillFlowRef on unmount
  React.useEffect(() => {
    return () => {
      isSaveBillFlowRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    const getMethod = async () => {
      const res = await getPaymentMethod();
      setPaymentMethod(res);
      setSelectedMethod(res[0]);
    };

    getMethod();
    // getServiceCharge();
  }, []);

  React.useEffect(() => {
    const inputs = {};

    // Ambil dari diskon cart
    const cartType = CartState?.discount?.cart?.type;
    const cartValue = CartState?.discount?.cart?.value;
    if (cartType && cartValue != null) {
      inputs.cart = cartValue.toString().replace('.', ',');
    }

    // Ambil dari diskon per kategori
    CartState?.discount?.category?.forEach(cat => {
      if (cat.discount_type && cat.discount_value != null) {
        inputs[cat.id] = cat.discount_value.toString().replace('.', ',');
      }
    });

    setDiscountInputs(inputs);
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <div className="border-base-200 bg-base-100 flex h-16 border-t border-b">
        <div className="border-base-200 flex-1 place-content-center border-r border-l">
          <div className="flex place-items-center gap-6 px-4">
            <div className="btn btn-circle btn-md btn-outline" onClick={() => navigate(-1)}>
              <BackIcon />
            </div>

            <div className="text-lg font-semibold">Order payment</div>
          </div>
        </div>
      </div>
      <div className="flex h-[calc(100vh-64px)] p-4">
        <div className="bg-base-100 flex h-full min-h-0 w-1/3 flex-1 flex-col p-4">
          <div className="flex place-content-between place-items-center">
            <div className="py-4 text-base font-semibold">Order details</div>
            {isBill ? (
              <div
                className="btn btn-info btn-sm"
                onClick={() => billItems(CartState?.bill?.items)}
              >
                Reset
              </div>
            ) : (
              ''
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="bg-accent p-4">
              {CartState?.bill
                ? CartState?.items?.bill?.map((item, i) => (
                    <div key={i} className="border-base-200 border-b py-2">
                      <div className="flex place-content-between place-items-center text-base font-semibold">
                        <div>{item?.name}</div>
                        <div className="text-base-300 text-xs">
                          {currencyFormat(
                            item?.quantity * (item?.unit_nett - item?.discount_amount)
                          )}
                        </div>
                      </div>
                      <div className="pb-2 text-xs">
                        {item?.quantity} x {currencyFormat(item?.unit_nett - item?.discount_amount)}
                        {item?.discount_amount > 0 && (
                          <span className="text-base-300 ms-2 line-through">
                            {currencyFormat(item?.unit_nett)}
                          </span>
                        )}
                      </div>
                      <div>
                        {renderAdditionals(item).map((line, idx) => (
                          <div key={idx} className="pb-2">
                            {line}
                          </div>
                        ))}
                      </div>

                      <div className="mt-2 flex place-content-between place-items-center">
                        <div className="flex place-items-center gap-2">
                          <div
                            className="btn btn-sm btn-error btn-circle btn-outline hover:!text-white"
                            onClick={() => remove(i, 'bill')}
                          >
                            <TrashIcon />
                          </div>
                          <div
                            className="btn btn-sm btn-primary btn-circle btn-outline"
                            onClick={() => onShow(item, i, 'bill')}
                          >
                            <EditIcon />
                          </div>
                        </div>
                        <div>
                          {item?.discount_amount > 0 ? (
                            <div className="text-primary text-lg font-bold">
                              <span className="me-2 text-xs !font-thin line-through">
                                {currencyFormat(item?.subtotal)}
                              </span>
                              {currencyFormat(item?.final_total)}
                            </div>
                          ) : (
                            <div className="text-primary text-lg font-bold">
                              {currencyFormat(item?.subtotal)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                : null}

              {CartState?.items?.list?.map((item, i) => (
                <div key={i} className="border-base-200 border-b py-2">
                  <div className="flex place-content-between place-items-center text-base font-semibold">
                    <div>{item?.name}</div>
                    <div className="text-base-300 text-xs">
                      {currencyFormat(
                        item?.quantity * (item?.unit_nett - item?.discount_amount) > 0
                          ? item?.unit_nett - item?.discount_amount
                          : 0
                      )}
                    </div>
                  </div>
                  <div className="pb-2 text-xs">
                    {item?.quantity} x{' '}
                    {currencyFormat(
                      item?.unit_nett - item?.discount_amount > 0
                        ? item?.unit_nett - item?.discount_amount
                        : 0
                    )}
                    {item?.discount_amount > 0 && (
                      <span className="text-base-300 ms-2 line-through">
                        {currencyFormat(item?.unit_nett)}
                      </span>
                    )}
                  </div>
                  <div>
                    {renderAdditionals(item).map((line, idx) => (
                      <div key={idx} className="pb-2">
                        {line}
                      </div>
                    ))}
                  </div>
                  <div className="flex place-content-end place-items-center gap-2">
                    <div>
                      {item?.discount_amount > 0 ? (
                        <div className="text-primary text-lg font-bold">
                          <span className="me-2 text-xs !font-thin line-through">
                            {currencyFormat(item?.subtotal)}
                          </span>
                          {currencyFormat(item?.final_total)}
                        </div>
                      ) : (
                        <div className="text-primary text-lg font-bold">
                          {currencyFormat(item?.subtotal)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="bg-base-100 border-base-200 flex h-full min-h-0 w-1/3 flex-1 flex-col border-r border-l p-4">
          <div>
            {CartState?.meta?.customer ? (
              <div className="border-base-200 border-b pb-4">
                <div className="py-4 text-base font-semibold">Customer </div>
                <div className="flex gap-5">
                  <div>
                    <UserCircleIcon />
                  </div>
                  <div>
                    <div className="text-base font-semibold capitalize">
                      {CartState?.meta?.customer?.name || '-'}
                    </div>
                    <div className="text-base-300 text-xs">
                      {CartState?.meta?.customer?.reff_code || '-'}
                    </div>
                  </div>
                </div>
              </div>
            ) : CartState?.bill?.bill_name ? (
              <div className="border-base-200 border-b pb-4">
                <div className="py-4 text-base font-semibold">Bill Name</div>
                <div className="text-base">{CartState?.bill?.bill_name || '-'}</div>
              </div>
            ) : (
              <div className="pb-4">
                <div className="py-4 text-base font-semibold">Bill Name</div>
                <Input
                  value={billName}
                  onChange={e => {
                    setBillName(e.target.value);
                  }}
                  placeholder="Enter bill name..."
                />
              </div>
            )}
          </div>

          <div className="py-4 text-base font-semibold">Add discount(s)</div>
          <div className="flex-1 overflow-y-auto">
            <div className="collapse-arrow bg-accent collapse mb-2">
              <input type="checkbox" name="my-accordion-1" defaultChecked />
              <div className="collapse-title text-xl font-semibold">Discount category</div>
              <div className="collapse-content">
                {CartState?.discount?.category?.map((cat, i) => (
                  <div className="mb-3 flex place-content-between place-items-center" key={i}>
                    <div>{cat?.name}</div>
                    <div className="flex place-items-center gap-2">
                      <input
                        type="text"
                        inputMode={cat?.discount_type === 'nominal' ? 'numeric' : 'decimal'}
                        pattern={cat?.discount_type === 'nominal' ? '[0-9]*' : '[0-9]*[.,]?[0-9]*'}
                        className="input input-neutral input-md !bg-base-100 !min-h-10 !w-24 !py-0"
                        disabled={cat?.discount_type === null}
                        value={discountInputs[cat.id] ?? ''}
                        onChange={e => {
                          let raw = e.target.value;
                          const isNominal = cat?.discount_type === 'nominal';
                          if (isNominal) {
                            raw = raw.replace(/[.,]/g, '');
                          }
                          setDiscountInputs(prev => ({ ...prev, [cat.id]: raw }));
                          onChangeDiscount(cat.id, 'discount_value', raw);
                        }}
                      />

                      <div
                        className={`cursor-pointer rounded px-2 py-1 ${
                          cat.discount_type === 'percentage'
                            ? 'bg-primary text-white'
                            : 'bg-base-200'
                        }`}
                        onClick={() => {
                          setDiscountInputs(prev => ({ ...prev, [cat.id]: '' }));
                          onChangeDiscount(cat.id, 'discount_type', 'percentage');
                        }}
                      >
                        %
                      </div>
                      <div
                        className={`cursor-pointer rounded px-2 py-1 ${
                          cat.discount_type === 'nominal' ? 'bg-primary text-white' : 'bg-base-200'
                        }`}
                        onClick={() => {
                          setDiscountInputs(prev => ({ ...prev, [cat.id]: '' }));
                          onChangeDiscount(cat.id, 'discount_type', 'nominal');
                        }}
                      >
                        Rp
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="collapse-arrow bg-accent collapse">
              <input type="checkbox" name="my-accordion-2" defaultChecked />
              <div className="collapse-title text-xl font-semibold">Discount All</div>
              <div className="collapse-content">
                <div className="mb-3 flex place-content-between place-items-center">
                  <div>All Items</div>
                  <div className="flex place-items-center gap-2">
                    <input
                      type="text"
                      inputMode={
                        CartState?.discount?.cart?.type === 'nominal' ? 'numeric' : 'decimal'
                      }
                      pattern={
                        CartState?.discount?.cart?.type === 'nominal'
                          ? '[0-9]*'
                          : '[0-9]*[.,]?[0-9]*'
                      }
                      className="input input-neutral input-md !bg-base-100 !min-h-10 !w-24 !py-0"
                      value={discountInputs['cart'] ?? ''}
                      disabled={CartState?.discount?.cart?.type === null}
                      onChange={e => {
                        let raw = e.target.value;
                        const isNominal = CartState?.discount?.cart?.type === 'nominal';
                        if (isNominal) {
                          raw = raw.replace(/[.,]/g, '');
                        }
                        setDiscountInputs(prev => ({ ...prev, cart: raw }));
                        onChangeCartDiscount('discount_value', raw);
                      }}
                    />

                    <div
                      className={`cursor-pointer rounded px-2 py-1 ${
                        CartState?.discount?.cart?.type === 'percentage'
                          ? 'bg-primary text-white'
                          : 'bg-base-200'
                      }`}
                      onClick={() => {
                        setDiscountInputs(prev => ({ ...prev, cart: '' }));
                        onChangeCartDiscount('discount_type', 'percentage');
                      }}
                    >
                      %
                    </div>
                    <div
                      className={`cursor-pointer rounded px-2 py-1 ${
                        CartState?.discount?.cart?.type === 'nominal'
                          ? 'bg-primary text-white'
                          : 'bg-base-200'
                      }`}
                      onClick={() => {
                        setDiscountInputs(prev => ({ ...prev, cart: '' }));
                        onChangeCartDiscount('discount_type', 'nominal');
                      }}
                    >
                      Rp
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="py-4 text-base font-semibold">Payment summary</div>
          <div className="bg-accent flex flex-col rounded-lg px-4 py-4 text-base">
            {(CartState?.meta?.service_charge_percentage > 0 ||
              CartState?.meta?.service_charge_value > 0) && (
              <div className="mb-3 flex place-content-between place-items-center text-xs">
                <div>Service </div>
                <div>{currencyFormat(CartState?.meta?.service_charge_value)}</div>
              </div>
            )}

            <div className="flex place-content-between place-items-center font-semibold">
              <div>Total Amount</div>
              <div>
                {CartState?.discount?.cart?.value || CartState?.discount?.cart?.amount > 0 ? (
                  <div className="text-base">
                    <span className="me-2 text-xs !font-thin line-through">
                      {currencyFormat(CartState?.meta?.subtotal)}
                    </span>
                    {currencyFormat(CartState?.meta?.grand_total)}
                  </div>
                ) : (
                  currencyFormat(CartState?.meta?.grand_total)
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-base-100 flex h-full min-h-0 w-1/3 flex-1 flex-col p-4">
          <div className="py-4 text-base font-semibold">Select payment method</div>

          <div
            ref={dropdownRef}
            tabIndex={0}
            className="dropdown border-base-200 dropdown-end cursor-pointer place-content-center rounded border px-4 py-4"
          >
            <div
              className="hover:text-primary flex place-content-between place-items-center"
              onClick={() => setIsOpen(prev => !prev)}
            >
              <div className="flex place-items-center">
                {selectedMethod?.provider === 'cash' ? (
                  <MoneyIcon className="h-8" />
                ) : (
                  <CardIcon className="h-8" />
                )}
                <div className="text-left !text-lg font-semibold">{selectedMethod?.name}</div>
              </div>
              <ChevronDownIcon
                className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
              />
            </div>
            {isOpen && (
              <ul className="menu dropdown-content rounded-box bg-base-100 z-1 mt-4 w-full p-2 shadow-sm">
                {paymentMethod?.map(method => (
                  <li key={method.id}>
                    <a
                      className={`category ${isActive(selectedMethod?.id, method?.id)}`}
                      onClick={() => {
                        setSelectedMethod(method);
                        setIsOpen(false);
                      }}
                    >
                      {method?.provider === 'cash' ? (
                        <MoneyIcon className="h-8" />
                      ) : (
                        <CardIcon className="h-8" />
                      )}
                      {method?.name}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex-1">
            {selectedMethod?.provider === 'cash' ? (
              <Keypad
                payment={selectedMethod?.provider}
                onChange={v => setPay(v)}
                subtotal={CartState?.meta?.grand_total}
              />
            ) : (
              <div className="my-3">
                <div className="text-[16px] font-semibold">Ref Code</div>
                <Input
                  className="input-xl"
                  value={paymentRef}
                  onChange={e => setPaymentRef(e?.target?.value)}
                />
              </div>
            )}
          </div>

          <div className="flex gap-1">
            <div
              className={`btn btn-default btn-xl btn-block flex-1 ${CartState?.items?.list?.count === 0 || checkoutResult?.isLoading || updateResult?.isLoading ? 'btn-disabled' : ''}`}
              onClick={
                CartState?.bill
                  ? () => {
                      openModal(confirmSaveBillModal());
                    }
                  : () => openBillNameModal()
              }
            >
              Save Bill
              {(checkoutResult?.isLoading || updateResult?.isLoading) && (
                <span className="loading loading-spinner"></span>
              )}
            </div>

            <div
              className={`btn btn-primary btn-xl btn-block flex-1 ${CartState?.items?.list?.count === 0 || checkoutResult?.isLoading || closeBillResult?.isLoading ? 'btn-disabled' : ''}`}
              onClick={
                selectedMethod?.is_member_payment || selectedMethod?.is_nfc
                  ? openNFC
                  : () => handlePay()
              }
            >
              Pay now
              {(checkoutResult?.isLoading || closeBillResult?.isLoading) && (
                <span className="loading loading-spinner"></span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutScreen;
