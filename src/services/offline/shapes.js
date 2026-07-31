import { recalculateDiscountCategory } from './helper';

// ── Numbers ──
const toNum = v => (v && !Number.isNaN(Number(v)) ? Number(v) : 0);

// ── Builders ──

export function makeSessionStub(sesh) {
  return {
    id: sesh?.id || '',
    sync_id: sesh?.sync_id || '',
    outlet_id: sesh?.outlet_id || sesh?.outlet?.id || '',
    cashier_id: sesh?.cashier_id || sesh?.cashier?.id || '',
    transaction_date: sesh?.transaction_date || '',
    started_at: sesh?.started_at || '',
    finished_at: sesh?.finished_at || null,
    cash_started: toNum(sesh?.cash_started),
    cash_finished: toNum(sesh?.cash_finished),
    status: sesh?.status || 'opened',
    latitude: sesh?.latitude || 0,
    longitude: sesh?.longitude || 0,
    battery_health: sesh?.battery_health || '',
    is_synced: sesh?.is_synced ?? false,
    created_at: sesh?.created_at || '',
    updated_at: sesh?.updated_at || null,
    outlet: sesh?.outlet || null,
    cashier: sesh?.cashier || { id: '', name: '' },
  };
}

export function makeSalesChannelStub(ch) {
  return ch ? { id: ch.id || '', name: ch.name || '' } : { id: '', name: '' };
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
  }));

  let subtotal = 0;
  cloneItems.forEach(item => {
    subtotal += item.quantity * item.unit_nett;
    (item.addons ?? []).forEach(addon => {
      subtotal += addon.quantity * addon.unit_nett;
    });
  });

  return {
    ...payload,
    items: cloneItems,
    is_synced: false,
    original_items: cloneItems,
    category_discounts: recalculateDiscountCategory(payload.category_discounts, payload.items),
    subtotal_nett: subtotal,
    total_bill: subtotal,
  };
}

// ── Completed order for cache_order_history ──
export function makeCompletedOrder({
  orderId,
  code,
  billName,
  items,
  cartState,
  channel,
  session,
  paymentMethod,
  paymentRef,
  totalPayment,
  paidAt,
  discountCategories,
}) {
  const billing = makePendingBill({
    orderId,
    code,
    billName,
    items,
    cartState,
    channel,
    session,
    discountCategories,
  });

  return {
    ...billing,
    status: 'completed',
    payment_method_id: paymentMethod?.id || '',
    payment_ref: paymentRef || '',
    total_payment: toNum(totalPayment) || billing.total_charges,
    paid_at: paidAt || new Date().toISOString(),
    paid_session_id: session?.sales_session?.id || '',
    is_synced: false,
    payment_method: paymentMethod ? { id: paymentMethod.id, name: paymentMethod.name } : null,
    payment: {
      id: '',
      transaction_id: orderId,
      amount: toNum(totalPayment) || billing.total_charges,
      status: 'settlement',
      method: paymentMethod?.provider || 'cash',
      created_at: paidAt || new Date().toISOString(),
    },
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
