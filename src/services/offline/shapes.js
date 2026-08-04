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
    finished_at: '0001-01-01T00:00:00Z',
    cash_finished: 0,
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
        catalog_id: addon?.addon_item_id, // ini perlu kita copy ke catalog_id
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
    category_discounts: recalculateDiscountCategory(payload.category_discounts, payload.items),
    subtotal_nett: subtotal,
    total_bill: totalBill,
  };
}

// ── Update Pending bill from split bill for cache_openbills ──
export function makeUpdatePendingBillFromSplitBill(bill, pendingItems) {
  let subtotal = 0;
  let totalBill = 0;
  pendingItems.forEach(item => {
    subtotal += item.quantity * item.unit_nett;
    totalBill += item.quantity * (item.unit_nett - (item.unit_discount || 0));
    (item.addons ?? []).forEach(addon => {
      subtotal += addon.quantity * addon.unit_nett;
      totalBill += addon.quantity * addon.unit_nett;
    });
  });

  const billDValue = bill?.is_discount_percentage
    ? Math.ceil(totalBill * (bill?.discount_percentage / 100))
    : bill?.discount_value;

  const scv = Math.ceil((totalBill - billDValue) * (bill?.service_charge_percentage / 100));

  return {
    ...bill,
    items: pendingItems,
    is_synced: false,
    category_discounts: recalculateDiscountCategory(bill.category_discounts, pendingItems),
    subtotal_nett: subtotal,
    total_bill: totalBill,
    service_charge_value: scv,
    discount_value: billDValue,
    total_charges: totalBill - billDValue + scv,
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
        catalog_id: addon?.addon_item_id, // ini perlu kita copy ke catalog_id
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
    category_discounts: recalculateDiscountCategory(payload.category_discounts, payload.items),
    subtotal_nett: subtotal,
    total_bill: totalBill,
  };
}
