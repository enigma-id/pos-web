import { recalculateDiscountCategory } from './helper';
import { v4 as uuidv4 } from 'uuid';

// ── Numbers ──
const toNum = v => (v && !Number.isNaN(Number(v)) ? Number(v) : 0);

// ── Builders ──

// ── Start Sales session for cache_session ──
export function makeStartSession(payload) {
  return {
    ...payload,
    is_synced: false,
    summary: {
      sales: {
        total_sales: 0,
        total_discount: 0,
        total_after_discount: 0,
        total_service: 0,
        grand_total: 0,
        outstanding_bill: 0,
        outstanding_bill_payment: 0,
      },
      payment_methods: [],
      category_solds: [],
      topups: [],
      cash: {
        expected_cash: 0,
        topup_cash: 0,
      },
    },
  };
}

// ── End Sales session for cache_session ──
export function makeEndSession(payload) {
  return {
    ...payload,
    is_synced: false,
  };
}

// ── Pending bill for cache_openbills ──
export function makePendingBill(payload) {
  // kita butuh untuk jumlahkan ulang data items addons terhadap
  const cloneItems = payload.items.map(item => ({
    ...item,
    ...(item.addons && {
      addons: item.addons.map(addon => ({
        ...addon,
        addon_group_id: addon?.addon_group?.id,
        catalog_name: addon.name,
        quantity: (addon.quantity || 1) * item.quantity,
      })),
    }),

    discount_value:
      item.discount_percentage > 0
        ? item.unit_nett * (item.discount_percentage / 100)
        : item.discount_value,
    discount_percentage: item.discount_percentage,
  }));

  let subtotal = 0;
  let totalBill = 0;
  cloneItems.forEach(item => {
    subtotal += item.quantity * item.unit_nett;
    totalBill += item.quantity * (item.unit_nett - (item.unit_discount || 0));
    (item.addons ?? []).forEach(addon => {
      subtotal += addon.quantity * addon.unit_nett;
      totalBill += addon.quantity * addon.unit_nett;
    });
  });

  return {
    ...payload,
    items: cloneItems,
    is_synced: false,
    original_items: cloneItems,
    category_discounts: recalculateDiscountCategory(payload.category_discounts, payload.items),
    subtotal_nett: subtotal,
    total_bill: totalBill,
  };
}

// ── Completed order for cache_order_history ──
export function makeCompletedOrder(payload) {
  // kita butuh untuk jumlahkan ulang data items addons terhadap
  const cloneItems = payload.items.map(item => ({
    ...item,
    ...(item.addons && {
      addons: item.addons.map(addon => ({
        ...addon,
        addon_group_id: addon?.addon_group?.id,
        catalog_name: addon.name,
        quantity: (addon.quantity || 1) * item.quantity,
      })),
    }),

    discount_value:
      item.discount_percentage > 0
        ? item.unit_nett * (item.discount_percentage / 100)
        : item.discount_value,
    discount_percentage: item.discount_percentage,
  }));

  let subtotal = 0;
  let totalBill = 0;
  cloneItems.forEach(item => {
    subtotal += item.quantity * item.unit_nett;
    totalBill += item.quantity * (item.unit_nett - (item.unit_discount || 0));
    (item.addons ?? []).forEach(addon => {
      subtotal += addon.quantity * addon.unit_nett;
      totalBill += addon.quantity * addon.unit_nett;
    });
  });

  return {
    ...payload,
    items: cloneItems,
    is_synced: false,
    original_items: cloneItems,
    category_discounts: recalculateDiscountCategory(payload.category_discounts, payload.items),
    subtotal_nett: subtotal,
    total_bill: totalBill,
  };
}

// ── IDB input for createOrderBill / updateOrderBill ──
export function makeIdbBillData({
  orderId,
  code,
  billName,
  items,
  cartState,
  channel,
  session,
  discountCategories,
  originSessionSyncId,
  paidSessionSyncId,
}) {
  const orderItems = Array.isArray(items) ? items : [];
  return {
    sync_id: orderId,
    code: code || '',
    origin_session_sync_id: originSessionSyncId || null,
    paid_session_sync_id: paidSessionSyncId || null,
    is_offline_mode: true,
    is_synced: false,
    sales_channel_id: channel?.id || null,
    sales_channel_name: channel?.name || null,
    payment_method_id: null,
    membership_id: cartState?.meta?.customer?.id || null,
    payment_ref: '',
    bill_name: billName || '',
    cashier_name: session?.user?.name || '',
    service_charge_value: toNum(cartState?.meta?.service_charge_value),
    service_charge_percentage: toNum(cartState?.meta?.service_charge_percentage),
    discount_percentage:
      cartState?.discount?.cart?.type === 'percentage'
        ? toNum(cartState?.discount?.cart?.value)
        : 0,
    discount_value:
      cartState?.discount?.cart?.type === 'nominal' ? toNum(cartState?.discount?.cart?.value) : 0,
    category_discounts: (Array.isArray(discountCategories) ? discountCategories : []).map(
      makeCategoryDiscount
    ),
    items: orderItems.map((it, idx) => makeBillItem(it, orderId, idx)),
    status: 'pending',
    total_payment: 0,
    paid_at: null,
  };
}
