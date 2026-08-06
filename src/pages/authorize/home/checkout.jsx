/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import DetailScreen from './detail';
import BillModal from './saveBill';
import SuccessModal from './success';
import { Input, Modal, NFCField } from '../../../components/ui';
import { resetCart } from '../../../services/cart/slice';
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
import { setWarning } from '../../../services/offline';
import {
  createOrderBill,
  createOrderPayment,
  deleteOrderBill,
  updateOrderBill,
} from '../../../services/offline/queue';
import { triggerQueueRefresh } from '../../../services/offline/usePendingQueueCount';
import { $failure } from '../../../services/form/action';
import { v4 as uuidv4 } from 'uuid';
import {
  makePendingBill,
  makeCompletedOrder,
  makeUpdatePendingBillFromSplitBill,
} from '../../../services/offline/shapes';
import {
  deleteOpenBills,
  perbaharuiMembership,
  saveOpenBills,
  saveOrderHistory,
  showMembership,
  updateOpenBills,
} from '../../../utils/cache';
import useOrder from '../../../services/sales/order/hook';
import { currencyFormat, isActive } from '../../../utils/common';
import useSession from '../../../services/sales/session/hook';
import { checkPartialPaid } from '../../../services/offline/helper';
import useMaster from '../../../services/master/hook';

const CheckoutScreen = () => {
  const location = useLocation();
  const isBill = location.state?.is_bill;

  const FormState = useSelector(state => state?.Form);

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const CartState = useSelector(state => state?.Cart);
  const Channel = useSelector(state => state?.SalesChannel);
  const session = useSelector(s => s.Auth?.session);
  const sessionSummary = useSelector(state => state?.SalesSession?.sessionSummary);

  const isOnline = useSelector(state => state?.Offline?.isOnline);
  const apiReachable = useSelector(state => state?.Offline?.apiReachable);

  const isOffline = !isOnline || apiReachable === false;

  const dropdownRef = React.useRef(null);

  const { getPaymentMethods } = useMaster();

  const {
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

  const { updateSessionSummary } = useSession();

  // const { getServiceCharge } = useOutlet();

  const { checkSaldo, checkResult } = useMembership();
  const { openModal, closeModal } = useModal();

  const [isOpen, setIsOpen] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState([]);
  const [paymentRef, setPaymentRef] = React.useState('');
  const [pay, setPay] = React.useState(0);
  const [discountInputs, setDiscountInputs] = React.useState({});
  const [billName, setBillName] = React.useState('');

  const [selectedMethod, setSelectedMethod] = React.useState(null);

  const renderAdditionals = item => {
    return (item?.addons || [])
      .map(add => {
        const selectedChilds = (add?.items || []).filter(child =>
          add.type === 'quantity' ? (child?.quantity || 0) > 0 : !!child?.selected
        );

        if (selectedChilds.length === 0) return null;

        const childNames = selectedChilds.map((child, key) => {
          const suffix =
            add?.type === 'quantity' || add?.type === 'checkbox'
              ? `(${item?.quantity} x ${child?.quantity}) x ${currencyFormat(child?.unit_nett)}`
              : '';
          return (
            <div className="text-base-300 flex place-content-between text-xs font-thin" key={key}>
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

  // Create Bill Offline — Cache and IDB
  const onCreateBillOffline = async billName => {
    if (!sessionSummary) {
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
        id: uuidv4(), // --- ini untuk mengikuti backend, karena backend mempunyai id
        catalog_id: item.catalog_id,
        category_id: item.category_id,
        quantity: item.quantity,
        unit_nett: item.unit_nett,
        catalog_name: item.name,
        category_name: item.category_name,
        catalog: {
          id: item.catalog_id,
          category_id: item.category_id,
          code: item.code,
          name: item.name,
          is_custom: item.is_custom,
        },
        is_discount_percentage: item.is_discount_percentage,
        discount_percentage: item.discount_percentage,
        discount_value: item.discount_value,
        unit_discount: item.unit_discount,
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
      sales_channel_id: Channel?.selectedChannel?.id,
      status: 'pending',
      is_offline_mode: true,
      items,

      // ini untuk kebutuhan standarisasi data Offline to Online
      created_at: now,
      session: sessionSummary,
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
      payload.is_category_discount = true;
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

    dispatch(resetCart());
    setDiscountInputs([]);
  };

  // Create Bill Online — API
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
    if (isOffline) {
      onCreateBillOffline(billName);
    } else {
      onCreateBillOnline(billName);
    }
  };

  // Update Bill Offline — Cache and IDB
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

    let allItems = [...(CartState?.items?.bill || []), ...(CartState?.items?.list || [])];

    const items = allItems?.map(item => {
      const base = {
        id: item?.order_item_id || uuidv4(), // --- ini untuk mengikuti backend, karena backend mempunyai id. tapi kenapa ada item?.order_item_id (apabila dari create mempunyai itu - kita tidak boleh merubah-nya)
        catalog_id: item.catalog_id,
        category_id: item.category_id,
        quantity: item.quantity,
        unit_nett: item.unit_nett,
        catalog_name: item.name,
        category_name: item.category_name,
        catalog: {
          id: item.catalog_id,
          category_id: item.category_id,
          code: item.code,
          name: item.name,
          is_custom: item.is_custom,
        },
        is_discount_percentage: item.is_discount_percentage,
        discount_percentage: item.discount_percentage,
        discount_value: item.discount_value,
        unit_discount: item.unit_discount,
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

    const payload = {
      // kenapa gua tidak pakai sync_id - karena data-nya sudah ada di server bukan lagi di IDB
      id: CartState?.bill?.id || null,
      sync_id: CartState?.bill?.sync_id,
      code: CartState?.bill?.code,
      bill_name: billName,
      sales_channel_id: Channel?.selectedChannel?.id,
      status: 'pending',
      items,

      // ini untuk kebutuhan standarisasi data Offline to Online
      created_at: CartState?.bill?.created_at,
      session: sessionSummary,
      membership: CartState?.meta?.customer,
      sales_channel: Channel?.selectedChannel,
      is_discount_percentage: CartState?.discount?.cart?.type === 'percentage' ? true : false,
      discount_percentage: 0,
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
      payload.is_category_discount = true;
    }

    const dataOfflineToOnline = makePendingBill(payload);

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
      type: 'update',
      outstanding_bill: CartState?.meta?.grand_total - CartState?.bill?.total_charges,
    });

    handleModalPrint(dataOfflineToOnline);

    dispatch(resetCart());
    setDiscountInputs([]);
  };

  // Update Bill Online — API
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

    let allItems = [...(CartState?.items?.bill || []), ...(CartState?.items?.list || [])];

    const items = allItems?.map(item => {
      const base = {
        id: item?.order_item_id,
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
      await update({ id: CartState?.bill?.id, payload }).unwrap();
      dispatch(setWarning('Bill saved.'));
    } catch (err) {
      dispatch($failure(err));
    }
  };

  const onUpdateBill = async billName => {
    if (isOffline) {
      onUpdateBillOffline(billName);
    } else {
      onUpdateBillOnline(billName);
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

  // Pay Offline — Cache and IDB
  const onPayOffline = async card => {
    let required = true;

    if (!selectedMethod) {
      handleModalError('Pembayaran belum dipilih');
      required = false;
    } else {
      if (selectedMethod?.provider === 'cash' && (pay === 0 || pay === '')) {
        handleModalError('Nominal dibayar harus diisi');

        required = false;
      }
    }

    if (required) {
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

      let allItems = [...(CartState?.items?.bill || []), ...(CartState?.items?.list || [])];

      const items = allItems?.map(item => {
        const base = {
          id: item?.order_item_id || uuidv4(), // --- ini untuk mengikuti backend, karena backend mempunyai id. tapi kenapa ada item?.order_item_id (apabila dari create mempunyai itu - kita tidak boleh merubah-nya)
          catalog_id: item.catalog_id,
          category_id: item.category_id,
          quantity: item.quantity,
          unit_nett: item.unit_nett,
          catalog_name: item.name,
          category_name: item.category_name,
          catalog: {
            id: item.catalog_id,
            category_id: item.category_id,
            code: item.code,
            name: item.name,
            is_custom: item.is_custom,
          },
          is_discount_percentage: item.is_discount_percentage,
          discount_percentage: item.discount_percentage,
          discount_value: item.discount_value,
          unit_discount: item.unit_discount,
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

      let payload = {
        sales_channel_id: Channel?.selectedChannel?.id,
        payment_method_id: selectedMethod?.id,
        payment_ref: paymentRef,
        status: 'completed',
        is_offline_mode: true,
        total_payment:
          selectedMethod?.provider === 'cash'
            ? Number(pay) || 0
            : CartState?.meta?.grand_total || 0,
        items,

        // ini untuk kebutuhan standarisasi data Offline to Online
        paid_at: now,
        membership: CartState?.meta?.customer,
        sales_channel: Channel?.selectedChannel,
        payment_method: selectedMethod,
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
        payload.is_category_discount = true;
      }

      if (card) {
        payload.membership_id = card?.id;
        payload.card_id = card?.card_id;
        payload.payment_ref = card?.reff_code;
        payload.membership = card;
      }

      let outstandingBillPayment = 0;

      // untuk payload dibawah ini adalah tambahan payload yang berdasarkan dari savebill
      if (CartState?.bill) {
        payload = {
          ...payload,
          code: CartState?.bill?.code,
          id: CartState?.bill?.id,
          sync_id: CartState?.bill?.sync_id,
          bill_name: CartState?.bill?.bill_name,
          session: CartState?.bill?.session,
          paid_session: sessionSummary,
          created_at: CartState?.bill?.created_at,
        };

        if (
          !(
            CartState?.bill?.session?.id === sessionSummary?.id ||
            CartState?.bill?.session?.sync_id === sessionSummary?.sync_id
          )
        ) {
          outstandingBillPayment = CartState?.meta?.grand_total;
        }
      } else {
        const orderId = uuidv4();

        const code = `${now.toISOString().slice(2, 8).replace(/-/g, '')}${String(Math.floor(Math.random() * 9000) + 1000)}`;

        // jika tidak dari save bill maka dibawah ini payload tambahan-nya
        payload = {
          ...payload,
          code: code,
          sync_id: orderId,
          bill_name: billName,
          session: sessionSummary,
          paid_session: sessionSummary,
          created_at: now,
        };
      }

      const dataOfflineToOnline = makeCompletedOrder(payload);

      if (CartState?.bill) {
        let { itemsPending, isPending } = checkPartialPaid(payload.items, CartState?.bill?.items);

        if (!isPending) {
          onPayOfflinePayAndDeleteBill(dataOfflineToOnline);
        } else {
          onPayOfflineSplit(dataOfflineToOnline, itemsPending);
        }
      } else {
        onPayOfflineDirectPay(dataOfflineToOnline);
      }

      try {
        // 🔁 Update sessionSummary incremental
        updateSessionSummary({
          type: 'payment',
          order: dataOfflineToOnline,
          payment_method: dataOfflineToOnline?.payment_method,
          total_sales: dataOfflineToOnline?.subtotal_nett,
          total_discount:
            dataOfflineToOnline?.subtotal_nett -
            dataOfflineToOnline?.total_bill +
            dataOfflineToOnline?.discount_value,
          total_after_discount:
            dataOfflineToOnline?.total_bill - dataOfflineToOnline?.discount_value,
          total_service: dataOfflineToOnline?.service_charge_value,
          total_charges: dataOfflineToOnline?.total_charges,
          outstanding_bill_payment: outstandingBillPayment,
        });
      } catch (err) {
        return;
      }

      console.log('[DEBUG] paymentMethod?.is_member_payment', selectedMethod?.is_member_payment);

      if (selectedMethod?.is_member_payment) {
        const cloneMembership = JSON.parse(JSON.stringify(payload?.membership));

        console.log('[DEBUG] cloneMembership', cloneMembership);

        cloneMembership.saldo -= dataOfflineToOnline?.total_charges;
        cloneMembership.saldo_logs.unshift({
          nominal: -1 * dataOfflineToOnline?.total_charges,
          membership_id: payload?.membership?.id,
          reference_type: 'Sales',
          reference_code: dataOfflineToOnline?.code,
          created_at: new Date(),
        });

        try {
          perbaharuiMembership(cloneMembership);
        } catch (err) {
          console.log('[DEBUG] onPayOfflineSplit perbaharuiMembership', err);
        }
      }

      handleModalPrint(dataOfflineToOnline);
      dispatch(resetCart());
      setDiscountInputs([]);
    }
  };

  const onPayOfflineDirectPay = async dataOfflineToOnline => {
    try {
      await createOrderPayment(dataOfflineToOnline, session?.user?.id);
    } catch (err) {
      handleModalError();
      dispatch($failure(err));
      return;
    }
    triggerQueueRefresh();

    // Push ke localStorage order history cache
    try {
      saveOrderHistory(dataOfflineToOnline);
    } catch (err) {
      handleModalError();
      console.error('[SAVE ON PAY] cache error:', err);
    }
  };

  const onPayOfflinePayAndDeleteBill = async dataOfflineToOnline => {
    try {
      await createOrderPayment(dataOfflineToOnline, session?.user?.id);

      // kita hapus delete order bill jika ada di IDB
      await deleteOrderBill(CartState?.bill?.sync_id, session?.user?.id);
    } catch (err) {
      handleModalError();
      dispatch($failure(err));
      return;
    }

    // Push ke localStorage order history cache
    try {
      await saveOrderHistory(dataOfflineToOnline);
    } catch (err) {
      handleModalError();
      console.error('[SAVE ON PAY AND Delete Bill] cache error:', err);
    }

    // delete open bill ke localStorage delete bill cache
    try {
      await deleteOpenBills(dataOfflineToOnline);
    } catch (err) {
      handleModalError();
      console.error('[SAVE ON PAY AND Delete Bill] cache error:', err);
    }

    triggerQueueRefresh();

    let kurangiBill = dataOfflineToOnline?.total_charges;

    if (CartState?.bill?.total_charges != dataOfflineToOnline?.total_charges) {
      kurangiBill = CartState?.bill?.total_charges;
    }

    // 🔁 Update sessionSummary incremental
    updateSessionSummary({
      type: 'update',
      id: CartState?.bill?.session?.id,
      sync_id: CartState?.bill?.session?.sync_id,
      outstanding_bill: -1 * kurangiBill,
    });
  };

  const onPayOfflineSplit = async (dataOfflineToOnline, itemsPending) => {
    try {
      // ini dibutuhkan untuk split bill, karena data sync_id adalah id tsb
      // ref_sync_id ini dibutuhkan untuk split id dari sync_id
      dataOfflineToOnline.ref_sync_id = dataOfflineToOnline?.id || dataOfflineToOnline.sync_id;
      dataOfflineToOnline.sync_id = uuidv4();
      dataOfflineToOnline.id = '';

      await createOrderPayment(dataOfflineToOnline, session?.user?.id);
    } catch (err) {
      handleModalError();
      dispatch($failure(err));
      return;
    }

    // Push ke localStorage order history cache
    try {
      saveOrderHistory(dataOfflineToOnline);
    } catch (err) {
      handleModalError();
      console.error('[SAVE ON PAY AND Update Bill] cache error:', err);
    }

    const dataOfflineToOnlineUpdated = makeUpdatePendingBillFromSplitBill(
      CartState?.bill,
      itemsPending
    );

    try {
      await updateOrderBill(dataOfflineToOnlineUpdated, session?.user?.id);
    } catch (err) {
      handleModalError();
      dispatch($failure(err));

      return;
    }

    triggerQueueRefresh();

    // Push ke localStorage bills cache
    try {
      updateOpenBills(dataOfflineToOnlineUpdated);
    } catch (err) {
      console.log('[DEBUG] onPayOfflineSplit 3:', err);

      handleModalError();
    }

    // 🔁 Update sessionSummary incremental
    updateSessionSummary({
      type: 'update',
      id: CartState?.bill?.session?.id,
      sync_id: CartState?.bill?.session?.sync_id,
      outstanding_bill:
        -1 * (CartState?.bill?.total_charges - dataOfflineToOnlineUpdated?.total_charges || 0),
    });
  };

  // Pay Online — API
  const onPayOnline = async card => {
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

    let allItems = [...(CartState?.items?.bill || []), ...(CartState?.items?.list || [])];

    const items = allItems?.map(item => {
      const base = {
        id: item.order_item_id,
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
      bill_name: billName ? billName : CartState?.bill?.bill_name,
      membership_id: CartState?.meta?.customer?.id,
      sales_channel_id: Channel?.selectedChannel?.id,
      payment_method_id: selectedMethod?.id,
      payment_ref: paymentRef,
      status: 'completed',
      total_payment:
        selectedMethod?.provider === 'cash' ? Number(pay) || 0 : CartState?.meta?.grand_total || 0,
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

    if (CartState?.meta?.customer) {
      payload.membership_id = CartState?.meta?.customer?.id;
    }

    if (card) {
      payload.membership_id = card?.id;
      payload.card_id = card?.card_id;
      payload.payment_ref = card?.reff_code;
    }

    try {
      if (CartState?.bill?.id) {
        await closeBill(CartState?.bill?.id, payload);
      } else {
        await checkout(payload).unwrap();
      }
    } catch (err) {
      dispatch($failure(err));
    }
  };

  const onPay = async card => {
    if (isOffline) {
      onPayOffline(card);
    } else {
      onPayOnline(card);
    }
  };

  const openBillNameModal = () => {
    openModal(
      <BillModal mode="create" onBillCreate={billName => onCreateBill(billName)} />,
      'w-md'
    );
  };

  const confirmSaveBillModal = () => {
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
            className={`btn btn-md btn-success px-10 text-white ${updateResult?.isLoading ? 'btn-disabled' : ''}`}
            onClick={() => onUpdateBill(CartState?.bill?.bill_name)}
          >
            Confirm{' '}
            {updateResult?.isLoading ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : null}
          </div>
        </Modal.Footer>
      </>,

      'w-md'
    );
  };

  const handleModalError = customError => {
    openModal(
      <>
        <Modal.Header onClose={closeModal}>
          <div className="text-lg font-semibold">Can't save</div>
        </Modal.Header>
        <Modal.Body full>
          <div className="flex place-content-center place-items-center">
            <img src="./error.png" className="h-64" />
          </div>
          <div className="-mt-5 pb-4 text-center">
            <div className="text-lg font-semibold capitalize">
              {FormState?.errors?.billName || customError}
            </div>
            <p className="text-base-300 text-xs">Try another</p>
          </div>
        </Modal.Body>
      </>,

      'w-md'
    );
  };

  const handleModalPrint = data => {
    openModal(<SuccessModal data={data} backToMenu />, 'w-md');
  };

  const openScan = result => {
    openModal(
      <NFCField onRead={handleRead} isOpen={true} onClose={closeModal} result={result} />,
      'w-md'
    );
  };

  const handleRead = uid => {
    if (isOffline) {
      // No connection → skip checkSaldo, ambil dari cache kalo ada
      const membership = showMembership(uid);

      let readyCard = false;
      if (membership) {
        if (membership?.saldo >= CartState?.meta?.grand_total) {
          readyCard = true;
        }
      }

      if (readyCard) {
        onPay(membership || { card_id: uid });
      } else {
        // Re-open modal → NFCField reconcile (bukan remount), result isError → status 'failed'
        openScan({ isError: true, message: 'Saldo anda kurang, silahkan topup terlebih dahulu' });
      }

      return;
    }

    const params = {
      is_checkout: true,
      nominal: CartState?.meta?.grand_total,
      card_id: uid,
    };

    checkSaldo(params);
  };

  const openNFC = () => {
    openScan(checkResult);
  };

  React.useEffect(() => {
    if (checkResult?.isSuccess) {
      // openSuccess()
      const card = checkResult?.data?.data;
      onPay(card);
    } else if (checkResult?.isError) {
      // Tanpa re-open, modal via openScan() menampilkan result yang dibekukan (stale)
      // → error scan tidak pernah terlihat.
      openScan(checkResult);
    }
  }, [checkResult]);

  React.useEffect(() => {
    if (checkoutResult?.isError || updateResult?.isError || closeBillResult?.isError) {
      handleModalError();
      checkoutResult?.reset();
      updateResult?.reset();
      closeBillResult?.reset();
    }
  }, [checkoutResult, updateResult, closeBillResult]);

  React.useEffect(() => {
    const isCheckoutSuccess = checkoutResult?.isSuccess;
    const isClosebillSuccess = closeBillResult?.isSuccess;

    if (isCheckoutSuccess || isClosebillSuccess) {
      // Ambil data berdasarkan mana yang sukses
      const data = isCheckoutSuccess ? checkoutResult?.data?.data : closeBillResult?.data?.data;

      // Cek QRIS khusus untuk checkout yang sukses
      if (selectedMethod?.provider === 'qris') {
        setTimeout(() => {
          // Sesuaikan durasi timeout dengan komentar (misal 1 detik -> 1000)
          show(data?.id);
        }, 1000);
      } else {
        show(data?.id);
      }

      setDiscountInputs([]);
      closeBillResult?.reset();
      checkoutResult?.reset();
    }
  }, [checkoutResult?.isSuccess, closeBillResult?.isSuccess]);

  React.useEffect(() => {
    if (updateResult?.isSuccess && updateResult?.data) {
      // Ambil data berdasarkan mana yang sukses
      const data = updateResult?.data?.data;

      if (data) {
        show(data?.id);
        dispatch(resetCart());
        setDiscountInputs([]);
      }

      updateResult?.reset();
    }
  }, [updateResult?.isSuccess]);

  React.useEffect(() => {
    if (showResult?.isSuccess && showResult?.data) {
      handleModalPrint(showResult?.data?.data);
    }
  }, [showResult?.isSuccess, showResult?.data]);

  React.useEffect(() => {
    const getMethod = async () => {
      const res = await getPaymentMethods();

      setPaymentMethod(res);
      setSelectedMethod(res[0]);
    };

    getMethod();
  }, [isOffline]);

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
                          {currencyFormat(item?.quantity * (item?.unit_nett - item?.unit_discount))}
                        </div>
                      </div>
                      <div className="pb-2 text-xs">
                        {item?.quantity} x {currencyFormat(item?.unit_nett - item?.unit_discount)}
                        {item?.unit_discount > 0 && (
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
                          {item?.unit_discount > 0 ? (
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
                        item?.quantity * (item?.unit_nett - item?.unit_discount) > 0
                          ? item?.unit_nett - item?.unit_discount
                          : 0
                      )}
                    </div>
                  </div>
                  <div className="pb-2 text-xs">
                    {item?.quantity} x{' '}
                    {currencyFormat(
                      item?.unit_nett - item?.unit_discount > 0
                        ? item?.unit_nett - item?.unit_discount
                        : 0
                    )}
                    {item?.unit_discount > 0 && (
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
                      {item?.unit_discount > 0 ? (
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
              onClick={CartState?.bill ? confirmSaveBillModal : openBillNameModal}
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
                  : () => onPay()
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
