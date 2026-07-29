import { UUID_ZERO, DATE_ZERO } from './constants';

// ── Numbers ──
const toNum = v => (v && !Number.isNaN(Number(v)) ? Number(v) : 0);

// ── Builders ──

export function makeBillItem(item, orderId, index) {
  const qty = toNum(item.quantity) || 1;
  const unitNett = toNum(item.unit_nett ?? 0);
  const unitGross = toNum(item.unit_gross ?? unitNett);
  const unitBase = toNum(item.unit_base ?? unitGross);
  const unitTax = toNum(item.unit_tax ?? 0);
  const unitTaxed = toNum(item.unit_taxed ?? unitNett);
  const unitBill = toNum(item.unit_bill ?? unitNett);
  const discountVal = toNum(item.discount_value ?? item.discount_amount ?? 0);
  const discountPct = toNum(item.discount_percentage ?? 0);
  const isDiscPct = !!(item.is_discount_percentage ?? false);

  return {
    id: item.id || UUID_ZERO,
    order_id: orderId || UUID_ZERO,
    additional_id: item.additional_id || null,
    addon_group_id: item.addon_group_id || null,
    catalog_id: item.catalog_id || item.catalog?.id || UUID_ZERO,
    catalog_name: item.catalog_name || '',
    category_name: item.category_name || '',
    unit_base: unitBase,
    unit_gross: unitGross,
    discount_percentage: discountPct,
    discount_value: discountVal,
    is_discount_percentage: isDiscPct,
    unit_nett: unitNett,
    unit_tax: unitTax,
    unit_taxed: unitTaxed,
    unit_bill: unitBill,
    quantity: qty,
    catalog: item.catalog || {
      id: item.catalog_id || UUID_ZERO,
      name: item.catalog_name || '',
      category_id: item.category_id || 0,
    },
    addons: makeBillAddons(item.addons || [], orderId, qty),
  };
}

export function makeBillAddons(addons, orderId, itemQty) {
  if (!Array.isArray(addons)) return [];
  return addons.map(a => {
    const qty = toNum(a.quantity) || 1;
    return {
      order_id: orderId || UUID_ZERO,
      addon_group: a.addon_group || { id: a.addon_group_id || UUID_ZERO, name: '', type: '' },
      addon_group_id: a.addon_group_id || a.addon_group?.id || UUID_ZERO,
      quantity: qty,
      unit_nett: toNum(a.unit_nett ?? 0),
      unit_bill: toNum(a.unit_bill ?? a.unit_nett ?? 0),
      catalog_name: a.catalog?.name || a.catalog_name || '',
      catalog_id: a.catalog_id || a.catalog?.id || UUID_ZERO,
    };
  });
}

export function makeCategoryDiscount(d) {
  return {
    category_id: d.category_id || d.id || '',
    is_discount_percentage: d.discount_type === 'percentage' || !!d.is_discount_percentage,
    discount_percentage: d.discount_type === 'percentage' ? toNum(d.discount_value) : toNum(d.discount_percentage || 0),
    discount_value: d.discount_type === 'nominal' ? toNum(d.discount_value) : toNum(d.discount_value || 0),
    category: d.category || { name: d.name || '' },
  };
}

export function makeSessionStub(sesh) {
  return {
    id: sesh?.id || UUID_ZERO,
    sync_id: sesh?.sync_id || UUID_ZERO,
    outlet_id: sesh?.outlet_id || sesh?.outlet?.id || UUID_ZERO,
    cashier_id: sesh?.cashier_id || sesh?.cashier?.id || UUID_ZERO,
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
    updated_at: sesh?.updated_at || DATE_ZERO,
    outlet: sesh?.outlet || null,
    cashier: sesh?.cashier || { id: UUID_ZERO, name: '' },
  };
}

export function makeSalesChannelStub(ch) {
  return ch
    ? { id: ch.id || UUID_ZERO, name: ch.name || '' }
    : { id: UUID_ZERO, name: '' };
}

// ── Pending bill for cache_openbills ──
export function makePendingBill({ orderId, code, billName, items, cartState, channel, session, discountCategories }) {
  const allItems = Array.isArray(items) ? items : [];
  const orderItems = allItems.map((it, idx) => makeBillItem(it, orderId, idx));

  const itemsTotal = orderItems.reduce((s, i) => {
    const it = i.unit_nett * i.quantity;
    const at = (i.addons || []).reduce((a, ad) => a + ad.unit_nett * ad.quantity, 0);
    return s + it + at;
  }, 0);
  const tax = orderItems.reduce((s, i) => s + i.unit_tax * i.quantity, 0);
  const taxed = orderItems.reduce((s, i) => s + i.unit_taxed * i.quantity, 0);
  const gross = orderItems.reduce((s, i) => s + i.unit_gross * i.quantity, 0);
  const discPct = cartState?.discount?.cart?.type === 'percentage' ? toNum(cartState?.discount?.cart?.value) : 0;
  const discVal = cartState?.discount?.cart?.type === 'nominal' ? toNum(cartState?.discount?.cart?.value) : 0;
  const svcPct = toNum(cartState?.meta?.service_charge_percentage);
  const svcVal = toNum(cartState?.meta?.service_charge_value);
  const totalCharges = itemsTotal + svcVal;
  const hasCatDisc = Array.isArray(discountCategories) && discountCategories.length > 0;

  return {
    id: UUID_ZERO,
    sync_id: orderId,
    ref_id: UUID_ZERO,
    session_id: UUID_ZERO,
    sales_channel_id: channel?.id || UUID_ZERO,
    payment_method_id: UUID_ZERO,
    membership_id: cartState?.meta?.customer?.id || UUID_ZERO,
    code: code || '',
    payment_ref: '',
    bill_name: billName || '',
    subtotal_tax: tax,
    subtotal_taxed: taxed,
    subtotal_gross: gross,
    subtotal_nett: itemsTotal,
    total_bill: itemsTotal,
    discount_percentage: discPct,
    discount_value: discVal,
    service_charge_percentage: svcPct,
    service_charge_value: svcVal,
    total_charges: totalCharges,
    total_payment: 0,
    cost_goods: 0,
    status: 'pending',
    is_discount_percentage: cartState?.discount?.cart?.type === 'percentage',
    cancelled_reason: '',
    cancelled_by: '',
    cancelled_at: DATE_ZERO,
    paid_at: DATE_ZERO,
    paid_session_id: UUID_ZERO,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_category_discount: hasCatDisc,
    is_offline_mode: true,
    is_synced: false,
    session: {
      id: UUID_ZERO,
      sync_id: UUID_ZERO,
      cashier: { id: UUID_ZERO, name: session?.user?.name || '' },
      outlet: session?.sales_session?.outlet
        ? { id: session.sales_session.outlet.id, name: session.sales_session.outlet.name }
        : null,
    },
    sales_channel: makeSalesChannelStub(channel),
    items: orderItems,
    category_discounts: (Array.isArray(discountCategories) ? discountCategories : []).map(makeCategoryDiscount),
  };
}

// ── Completed order for cache_order_history ──
export function makeCompletedOrder({ orderId, code, billName, items, cartState, channel, session, paymentMethod, paymentRef, totalPayment, paidAt, discountCategories }) {
  const billing = makePendingBill({ orderId, code, billName, items, cartState, channel, session, discountCategories });

  return {
    ...billing,
    status: 'completed',
    payment_method_id: paymentMethod?.id || UUID_ZERO,
    payment_ref: paymentRef || '',
    total_payment: toNum(totalPayment) || billing.total_charges,
    paid_at: paidAt || new Date().toISOString(),
    paid_session_id: session?.sales_session?.id || UUID_ZERO,
    is_synced: false,
    payment_method: paymentMethod ? { id: paymentMethod.id, name: paymentMethod.name } : null,
    payment: {
      id: UUID_ZERO,
      transaction_id: orderId,
      amount: toNum(totalPayment) || billing.total_charges,
      status: 'settlement',
      method: paymentMethod?.provider || 'cash',
      created_at: paidAt || new Date().toISOString(),
    },
  };
}

// ── IDB input for createOrderBill / updateOrderBill ──
export function makeIdbBillData({ orderId, code, billName, items, cartState, channel, session, discountCategories, originSessionSyncId, paidSessionSyncId }) {
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
    discount_percentage: cartState?.discount?.cart?.type === 'percentage' ? toNum(cartState?.discount?.cart?.value) : 0,
    discount_value: cartState?.discount?.cart?.type === 'nominal' ? toNum(cartState?.discount?.cart?.value) : 0,
    category_discounts: (Array.isArray(discountCategories) ? discountCategories : []).map(makeCategoryDiscount),
    items: orderItems.map((it, idx) => makeBillItem(it, orderId, idx)),
    status: 'pending',
    total_payment: 0,
    paid_at: null,
  };
}

// ── SuccessModal data ──
export function makeSuccessData({ orderId, code, billName, items, cartState, channel, session, paymentMethod, paymentRef, totalPayment, paidAt, discountCategories, isPayment }) {
  const allItems = Array.isArray(items) ? items : [];
  const orderItems = allItems.map((it, idx) => makeBillItem(it, orderId, idx));

  const itemsTotal = orderItems.reduce((s, i) => {
    const it = i.unit_nett * i.quantity;
    const at = (i.addons || []).reduce((a, ad) => a + ad.unit_nett * ad.quantity, 0);
    return s + it + at;
  }, 0);
  const svcVal = toNum(cartState?.meta?.service_charge_value);
  const discVal = toNum(cartState?.discount?.cart?.amount || (cartState?.discount?.cart?.type === 'nominal' ? cartState?.discount?.cart?.value : 0));
  const totalCharges = isPayment ? (toNum(totalPayment) || itemsTotal + svcVal) : itemsTotal + svcVal;

  return {
    sync_id: orderId,
    code: code || '',
    bill_name: billName || '',
    total_charges: totalCharges,
    total_payment: isPayment ? (toNum(totalPayment) || totalCharges) : 0,
    status: isPayment ? 'completed' : 'pending',
    paid_at: isPayment ? (paidAt || new Date().toISOString()) : DATE_ZERO,
    subtotal_nett: itemsTotal,
    subtotal_tax: 0,
    subtotal_taxed: 0,
    subtotal_gross: itemsTotal,
    service_charge_value: svcVal,
    discount_value: discVal,
    is_discount_percentage: cartState?.discount?.cart?.type === 'percentage',
    is_offline_mode: true,
    is_synced: false,
    payment_ref: paymentRef || '',
    payment_method: paymentMethod ? { id: paymentMethod.id, name: paymentMethod.name, provider: paymentMethod.provider } : null,
    sales_channel: channel?.name ? { id: channel.id, name: channel.name } : null,
    session: { id: UUID_ZERO, cashier: { name: session?.user?.name || '' } },
    items: orderItems.map(i => ({
      catalog: { name: i.catalog_name || '', category_id: i.catalog?.category_id || 0 },
      catalog_name: i.catalog_name || '',
      quantity: i.quantity,
      unit_nett: i.unit_nett,
      discount_value: i.discount_value,
      addons: (i.addons || []).map(a => ({
        catalog_name: a.catalog_name || '',
        unit_nett: a.unit_nett,
        quantity: a.quantity,
      })),
    })),
    new_items: [],
    category_discounts: (Array.isArray(discountCategories) ? discountCategories : []).map(makeCategoryDiscount),
  };
}
