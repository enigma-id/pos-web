/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import DetailScreen from './detail';
import BillModal from './saveBill';
import SuccessModal from './success';
import { Input, Kitchen, Modal, NFCField, Receipt } from '../../../components/ui';
import { changeServiceCharge } from '../../../services/cart/slice';
import {
  BackIcon,
  CardIcon,
  ChevronDownIcon,
  EditIcon,
  MoneyIcon,
  PrintIcon,
  TrashIcon,
  UserCircleIcon,
} from '../../../components/ui/icon';
import Keypad from '../../../components/ui/keypad';
import useModal from '../../../components/ui/modal/hook';
import useCart from '../../../services/cart/hook';
import useMembership from '../../../services/membership/hook';
import { buildOfflineTransactionPayload, setWarning } from '../../../services/offline';
import { appendOrderToSession, getAllSessions, getOrCreateOfflineSession, getOfflinePendingCount } from '../../../services/offline/queue';
import { setSessions, setPendingCount, setOfflineSessionEnded } from '../../../services/offline/slice';
import { resetCart } from '../../../services/cart/slice';
import { $failure } from '../../../services/form/action';
import { v4 as uuidv4 } from 'uuid';
import { getCache, setCache } from '../../../utils/cache';
// import useOutlet from '../../../services/outlet/hooks';
import useOrder from '../../../services/sales/order/hook';
import { currencyFormat, isActive } from '../../../utils/common';
import { getMemberCache } from '../../../utils/cache';
import { usePrintWindow } from '../../../utils/print';


const CheckoutScreen = () => {
  const location = useLocation();
  const isBill = location.state?.is_bill;

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const CartState = useSelector(state => state?.Cart);
  const Channel = useSelector(state => state?.SalesChannel);
  const session = useSelector((s) => s.Auth?.session)

  const dropdownRef = React.useRef(null);

  const {
    getPaymentMethod,
    onChangeDiscount,
    onChangeCartDiscount,
    checkout,
    checkoutResult,
    closeBill,
    closeBillResult,
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
  const { open: openPrint } = usePrintWindow({ title: 'Print Preview', autoClose: true });
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
              ? `(${item?.quantity} x ${child?.quantity}) x ${currencyFormat(child?.unit_price)}`
              : '';
          return (
            <div className="text-base-300 flex place-content-between text-xs font-thin">
              <span>
                + {child?.name} {suffix}
              </span>
              <span>{currencyFormat(item?.quantity * child?.quantity * child?.unit_price)}</span>
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

  const handlePay = async (card) => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const isCashPayment = selectedMethod?.provider === "cash";
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
       base.addons = item?.additionals_flat?.map((add) => ({
          addon_group_id: add?.addon_group_id,
          addon_item_id: add?.addon_item_id,
          ...(add?.quantity ? { quantity: add.quantity } : {}),
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
                  unit_price: Number(child?.unit_price) || 0,
                },
              }));
          })
          .filter(entry => entry.catalog_id != null);
      }

      if (item?.is_custom) {
        base.catalog_name = item?.name;
        base.unit_price = item?.unit_price;
      }

      return base;
    });

    const discount_categories = CartState?.discount?.category
      ?.filter(
        cat => cat?.discount_value > 0 && ['percentage', 'nominal'].includes(cat?.discount_type)
      )
      ?.map(cat => ({
        category_id: cat.id,
        ...(cat.discount_type === 'percentage'
          ? { discount_percentage: cat.discount_value }
          : { discount_value: cat.discount_value }),
      }));

    const payload = {
      status: "completed",
      sales_channel_id: Channel?.selectedChannel?.id,
      payment_method_id: selectedMethod?.id,
      payment_ref: paymentRef,
      total_payment:
        selectedMethod?.provider === "cash" ? Number(pay) || 0 : CartState?.meta?.grand_total || 0,
      items,
    };

    if (CartState?.bill?.ticket) {
      payload.ticket = CartState.bill.ticket;
    }

    if (billName) {
      payload.bill_name = billName;
    }

    if (CartState?.meta?.customer) {
      payload.membership_id = CartState?.meta?.customer?.id;
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

    if (card) {
      payload.membership_id = card?.id;
      payload.card_id = card?.card_id;
      payload.payment_ref = card?.reff_code;
    }

    // ===== OFFLINE PATH =====
    if (isOffline) {
      const sessionDoc = await getOrCreateOfflineSession(session?.user?.id, session);
      const syncId = sessionDoc?.sync_id;
      if (!syncId) {
        dispatch(setWarning('No active session. Please start a session first.'));
        return;
      }
      dispatch(setSessions([sessionDoc]));

      const orderSyncId = uuidv4();
      const now = new Date().toISOString();

      // Build items with catalog_name + unit_price for preview
      const orderItems = allItems.map(item => ({
        catalog_id: item.catalog_id,
        catalog_name: item.name || '',
        quantity: item.quantity,
        unit_price: item.unit_price || 0,
        addons: (item.additionals_flat || []).map(a => ({
          addon_group_id: a.addon_group_id,
          addon_item_id: a.addon_item_id,
          catalog_name: a.name || '',
          unit_price: a.unit_price || 0,
          quantity: a.quantity || 1,
        })),
        ...(item.is_custom ? { is_custom: true } : {}),
      }));

      const now2 = new Date();
      const code = `${now2.toISOString().slice(2, 8).replace(/-/g, '')}${String(Math.floor(Math.random() * 9000) + 1000)}`;
      const order = {
        sync_id: orderSyncId,
        code,
        sessionSyncId: syncId,
        salesChannelId: Channel?.selectedChannel?.id,
        salesChannelName: Channel?.selectedChannel?.name,
        paymentMethodId: selectedMethod?.id,
        membershipId: CartState?.meta?.customer?.id || null,
        paymentRef: selectedMethod?.provider === 'cash' ? '' : paymentRef,
        billName: billName || CartState?.bill?.bill_name || '',
        cashierName: session?.user?.name || '',
        discountPercentage: CartState?.discount?.cart?.type === 'percentage' ? CartState?.discount?.cart?.value : 0,
        discountValue: CartState?.discount?.cart?.type === 'nominal' ? CartState?.discount?.cart?.value : 0,
        categoryDiscounts: discount_categories || [],
        serviceChargeValue: CartState?.meta?.service_charge_value || 0,
        serviceChargePercentage: CartState?.meta?.service_charge_percentage || 0,
        items: orderItems,
        status: 'completed',
        totalPayment: selectedMethod?.provider === 'cash' ? Number(pay) || 0 : CartState?.meta?.grand_total || 0,
        paidAt: now,
        isOfflineMode: true,
        refSyncId: '',
      };

      try {
        await appendOrderToSession(syncId, order, session?.user?.id);
      } catch (err) {
        dispatch($failure(err));
        return;
      }

      // Inject history cache
      const HISTORY_CACHE_KEY = 'cache_order_history';
      const existing = getCache(HISTORY_CACHE_KEY) || [];
      const historyEntry = {
        id: orderSyncId,
        code: `OFF-${orderSyncId.slice(0, 8)}`,
        total_charges: order.totalPayment,
        bill_name: order.billName,
        created_at: now,
        status: 'completed',
        payment_method: selectedMethod ? { id: selectedMethod.id, name: selectedMethod.name } : null,
        total_payment: order.totalPayment,
        payment_ref: selectedMethod?.provider === 'cash' ? '' : paymentRef,
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
        membership: null,
        discount_value: order.discountValue,
        service_charge_value: CartState?.meta?.service_charge_value || 0,
        subtotal_nett: order.totalPayment,
        session: { cashier: { name: session?.user?.name || '' } },
        from_queue: true,
        offline_queued: true,
        offline_meta: { order_sync_id: orderSyncId },
      };
      setCache(HISTORY_CACHE_KEY, [historyEntry, ...existing]);

      // Refresh Redux sessions
      try {
        const fresh = await getAllSessions(session?.user?.id);
        dispatch(setSessions(fresh));
        dispatch(setPendingCount(await getOfflinePendingCount(session?.user?.id)));
      } catch {}

      // Build receipt-ready shape
      const paySuccessData = {
        ...order,
        total_charges: order.totalPayment,
        total_payment: order.totalPayment,
        code: `OFF-${order.sync_id.slice(0, 8)}`,
        paid_at: now,
        bill_name: order.billName,
        sales_channel: Channel?.selectedChannel?.name ? { name: Channel.selectedChannel.name } : null,
        payment_method: selectedMethod ? { id: selectedMethod.id, name: selectedMethod.name } : null,
        payment_ref: selectedMethod?.provider === 'cash' ? '' : paymentRef,
        session: { cashier: { name: session?.user?.name || '' } },
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
        service_charge_value: CartState?.meta?.service_charge_value || 0,
        discount_value: order.discountValue,
      };

      dispatch(setWarning('Payment saved offline. It will sync when online.'));
      dispatch(resetCart());
      setSelectedMethod(paymentMethod[0]);

      // Show success modal
      openModal(<SuccessModal data={paySuccessData} backToMenu />, 'w-md');
      return; // ⛔️ skip mutation API
    }

    // ===== ONLINE PATH =====
    checkoutSnapshotRef.current = {
      cartState: JSON.parse(JSON.stringify(CartState || {})),
      selectedChannel: Channel?.selectedChannel ? { ...Channel.selectedChannel } : null,
      paymentMethod: selectedMethod ? { ...selectedMethod } : null,
      paymentRef: selectedMethod?.provider === "cash" ? '' : paymentRef,
      billName,
      requestBody: payload,
      authSession: session,
    };

    // Build formatted preview for Queue Manager (same shape as PendingDrawer expects)
    const offlinePreview = buildOfflineTransactionPayload({
      cartState: CartState,
      selectedChannel: Channel?.selectedChannel,
      paymentMethod: selectedMethod,
      paymentRef: selectedMethod?.provider === "cash" ? '' : paymentRef,
      billName: billName,
      authSession: session,
      queueMeta: {
        requestBody: payload,
      },
    });

    if (isBill) {
      await closeBill(CartState?.bill?.id, { ...payload, __offlinePreview: offlinePreview });
    } else {
      await checkout({ ...payload, __offlinePreview: offlinePreview });
    }
  };

  const openTicket = () => {
    openModal(<BillModal mode="create" onBillCreate={ticket => handleSaveBill(ticket)} />, 'w-md');
  };

  const handleSaveBill = async ticket => {

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
        base.addons = item?.additionals_flat?.map((add) => ({
          addon_group_id: add?.addon_group_id,
          addon_item_id: add?.addon_item_id,
          ...(add?.quantity ? { quantity: add.quantity } : {}),
        }));
      }

      if (item?.is_custom) {
        base.catalog_name = item?.name;
        base.unit_price = item?.unit_price;
      }

      return base;
    });

    const discount_categories = CartState?.discount?.category
      ?.filter(
        cat => cat?.discount_value > 0 && ['percentage', 'nominal'].includes(cat?.discount_type)
      )
      ?.map(cat => ({
        category_id: cat.id,
        ...(cat.discount_type === 'percentage'
          ? { discount_percentage: cat.discount_value }
          : { discount_value: cat.discount_value }),
      }));

    const payload = {
      sales_channel_id: Channel?.selectedChannel?.id,
      items,
      status: 'pending'
    };

    if (billName) {
      payload.bill_name = billName;
    }

    if (CartState?.meta?.customer) {
      payload.membership_id = CartState?.meta?.customer?.id;
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

    payload.bill_name = ticket;

    // ===== OFFLINE PATH =====
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (isOffline) {
      const sessionDoc = await getOrCreateOfflineSession(session?.user?.id, session);
      const syncId = sessionDoc?.sync_id;
      if (!syncId) {
        dispatch(setWarning('No active session. Please start a session first.'));
        return;
      }
      dispatch(setSessions([sessionDoc]));

      const orderSyncId = uuidv4();
      const orderItems = (allItems || []).map(item => ({
        catalog_id: item.catalog_id,
        catalog_name: item.name || '',
        quantity: item.quantity,
        unit_price: item.unit_price || 0,
        addons: (item.additionals_flat || []).map(a => ({
          addon_group_id: a.addon_group_id,
          addon_item_id: a.addon_item_id,
          catalog_name: a.name || '',
          unit_price: a.unit_price || 0,
          quantity: a.quantity || 1,
        })),
        ...(item.is_custom ? { is_custom: true } : {}),
      }));

      const order = {
        sync_id: orderSyncId,
        code: `${new Date().toISOString().slice(2, 8).replace(/-/g, '')}${String(Math.floor(Math.random() * 9000) + 1000)}`,
        sessionSyncId: syncId,
        salesChannelId: Channel?.selectedChannel?.id,
        salesChannelName: Channel?.selectedChannel?.name,
        paymentMethodId: null,
        membershipId: CartState?.meta?.customer?.id || null,
        paymentRef: '',
        billName: ticket,
        cashierName: session?.user?.name || '',
        serviceChargeValue: CartState?.meta?.service_charge_value || 0,
        serviceChargePercentage: CartState?.meta?.service_charge_percentage || 0,
        discountPercentage: CartState?.discount?.cart?.type === 'percentage' ? CartState?.discount?.cart?.value : 0,
        discountValue: CartState?.discount?.cart?.type === 'nominal' ? CartState?.discount?.cart?.value : 0,
        categoryDiscounts: discount_categories || [],
        items: orderItems,
        status: 'pending',
        totalPayment: 0,
        paidAt: null,
        isOfflineMode: true,
        offline_queued: true,
        refSyncId: '',
      };

      try {
        await appendOrderToSession(syncId, order, session?.user?.id);
      } catch (err) {
        dispatch($failure(err));
        return;
      }

      // Refresh Redux sessions
      try {
        const fresh = await getAllSessions(session?.user?.id);
        dispatch(setSessions(fresh));
        dispatch(setPendingCount(await getOfflinePendingCount(session?.user?.id)));
      } catch {}

      dispatch(setWarning('Bill saved offline.'));

      // Build receipt-ready shape
      const successData = {
        ...order,
        total_charges: order.totalPayment || orderItems.reduce((s, i) => s + (i.unit_price || 0) * (i.quantity || 0), 0),
        total_payment: order.totalPayment || 0,
        code: `OFF-${order.sync_id.slice(0, 8)}`,
        paid_at: order.paidAt || new Date().toISOString(),
        bill_name: order.billName,
        sales_channel: Channel?.selectedChannel?.name ? { name: Channel.selectedChannel.name } : null,
        payment_method: { id: selectedMethod?.id, name: selectedMethod?.name },
        payment_ref: selectedMethod?.provider === 'cash' ? '' : paymentRef,
        session: { cashier: { name: session?.user?.name || '' } },
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
        service_charge_value: CartState?.meta?.service_charge_value || 0,
        discount_value: order.discountValue,
      };

      // ⛔️ Flag: skip stale mutation effect
      isOfflineSaveRef.current = true;

      dispatch(resetCart());
      setSelectedMethod(paymentMethod[0]);
      openModal(<SuccessModal data={successData} backToMenu />, 'w-md');
      return; // ⛔️ skip mutation API
    }

    // ===== ONLINE PATH =====
    checkoutSnapshotRef.current = {
      cartState: JSON.parse(JSON.stringify(CartState || {})),
      selectedChannel: Channel?.selectedChannel ? { ...Channel.selectedChannel } : null,
      paymentMethod: selectedMethod ? { ...selectedMethod } : null,
      paymentRef: selectedMethod?.provider === "cash" ? '' : paymentRef,
      billName,
      requestBody: payload,
      authSession: session,
    };

    await checkout({
      ...payload,
      __offlinePreview: checkoutSnapshotRef.current,
    });
  };

  // React.useEffect(() => {
  //   if (checkoutResult?.isSuccess) {
  //     show(checkoutResult?.data?.data?.id);
  //   }
  // }, [checkoutResult?.isSuccess, show]);

  // useEffect(() => {
  //   if (showResult?.isSuccess) {
  //     openModal(<SuccessModal data={showResult?.data?.data} backToMenu />, 'w-md');
  //   }
  // }, [showResult?.isSuccess, showResult?.data?.data, openModal]);

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

  const handleOpenPrint = data => {
    openPrint(<Receipt data={data} />);
  };

  const handleOpenPrintKitchen = data => {
    openPrint(<Kitchen data={data} />);
  };

  const openNFC = async () => {
    openModal(
      <NFCField onRead={handleRead} isOpen={true} onClose={closeModal} result={checkResult} />
    );
  };

  const openSuccess = async data => {
    openModal(
      <>
        <Modal.Header
          onClose={() => {
            closeModal();
            navigate('/');
          }}
        >
          <div className="text-lg font-semibold tracking-wide uppercase">Payment success</div>
        </Modal.Header>
        <Modal.Body>
          <div className="flex place-content-center place-items-center">
            <img src="./print.png" className="h-64" />
          </div>

          <div className="flex h-16 place-items-center">
            <div className="flex flex-1 flex-col place-content-center place-items-center">
              <div className="text-xl font-semibold">{currencyFormat(data?.total_payment)}</div>
              <div className="text-base-300 text-base font-thin capitalize">total paid</div>
            </div>
            {data?.payment_method?.provider === "cash" && data?.total_payment - data?.total_charges > 0 && (
              <div className="border-base-200 flex flex-1 flex-col place-content-center place-items-center border-l">
                <div className="text-xl font-semibold">
                  {currencyFormat(data?.total_payment - data?.total_charges)}
                </div>
                <div className="text-base-300 text-base font-thin capitalize">change</div>
              </div>
            )}
          </div>
          <div className="mt-4">
            <div className="flex h-16 gap-4">
              <div
                className="btn btn-lg btn-soft btn-primary mb-3 flex-1 rounded-none"
                onClick={() => handleOpenPrint(data)}
              >
                <PrintIcon /> Print Receipt
              </div>
              <div
                className="btn btn-lg btn-soft btn-primary mb-3 flex-1 rounded-none"
                onClick={() => handleOpenPrintKitchen(data)}
              >
                <PrintIcon /> Print Kitchen
              </div>
            </div>

            <div
              className="btn btn-block btn-lg btn-primary mb-3"
              onClick={() => {
                closeModal();
                navigate('/');
              }}
            >
              Back to menu
            </div>
          </div>
        </Modal.Body>
      </>
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
    // ⛔️ Skip stale mutation trigger from offline path
    if (isOfflineSaveRef.current) {
      isOfflineSaveRef.current = false;
      return;
    }

    const checkoutData = checkoutResult?.data?.data || {};
    const closeBillData = closeBillResult?.data?.data || {};

    if (checkoutResult?.isSuccess || closeBillResult?.isSuccess) {
      setSelectedMethod(paymentMethod[0]);
      const id = checkoutData?.id || closeBillData?.id;
      if (id) {
        show(id);
      }
    }
  }, [checkoutResult?.isSuccess, closeBillResult?.isSuccess]);

  React.useEffect(() => {
    // ⛔️ Skip stale mutation trigger from offline path
    if (isOfflineSaveRef.current) return;

    if ((closeBillResult?.isSuccess || checkoutResult?.isSuccess) && showResult?.isSuccess) {
      openSuccess(showResult?.data?.data);
    }
  }, [
    checkoutResult?.isSuccess,
    closeBillResult?.isSuccess,
    showResult?.isSuccess,
    showResult?.data?.data,
  ]);

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

  React.useEffect(() => {
    if (checkoutResult?.isSuccess || closeBillResult?.isSuccess) {
      setDiscountInputs([]);
    }
  }, [checkoutResult, closeBillResult]);

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
                            item?.quantity * (item?.unit_price - item?.discount_amount)
                          )}
                        </div>
                      </div>
                      <div className="pb-2 text-xs">
                        {item?.quantity} x{' '}
                        {currencyFormat(item?.unit_price - item?.discount_amount)}
                        {item?.discount_amount > 0 && (
                          <span className="text-base-300 ms-2 line-through">
                            {currencyFormat(item?.unit_price)}
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
                        item?.quantity * (item?.unit_price - item?.discount_amount) > 0
                          ? item?.unit_price - item?.discount_amount
                          : 0
                      )}
                    </div>
                  </div>
                  <div className="pb-2 text-xs">
                    {item?.quantity} x{' '}
                    {currencyFormat(
                      item?.unit_price - item?.discount_amount > 0
                        ? item?.unit_price - item?.discount_amount
                        : 0
                    )}
                    {item?.discount_amount > 0 && (
                      <span className="text-base-300 ms-2 line-through">
                        {currencyFormat(item?.unit_price)}
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
            {(CartState?.meta?.service_charge_percentage > 0 || CartState?.meta?.service_charge_value > 0) && (
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
                      {method?.provider === "cash" ? (
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
            {selectedMethod?.provider === "cash" ? (
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
              className={`btn btn-default btn-xl btn-block flex-1 ${CartState?.items?.list?.count === 0 || checkoutResult?.isLoading ? 'btn-disabled' : ''}`}
              onClick={
                CartState?.bill ? () => handleSaveBill(CartState?.bill?.ticket) : () => openTicket()
              }
            >
              Save Bill
              {checkoutResult?.isLoading && <span className="loading loading-spinner"></span>}
            </div>

            <div
              className={`btn btn-primary btn-xl btn-block flex-1 ${CartState?.items?.list?.count === 0 || checkoutResult?.isLoading || closeBillResult?.isLoading ? 'btn-disabled' : ''}`}
              onClick={selectedMethod?.is_member_payment ? openNFC : () => handlePay()}
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
