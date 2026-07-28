const toIsoNow = () => new Date().toISOString();

const toNumber = value => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const buildCatalogFromItem = item => ({
  id: item?.catalog_id ?? item?.id ?? '',
  category: item?.category || {
    id: item?.category_id ?? '',
    brand_id: item?.category?.brand_id ?? '',
    ref_id: item?.category_id ?? '',
    name: item?.category?.name || 'Unknown',
  },
  brand_id: item?.brand_id ?? '',
  ref_id: item?.ref_id ?? item?.catalog_id ?? item?.id ?? '',
  code: item?.code || '',
  name: item?.name || item?.description || 'Item',
  base_price: toNumber(item?.base_price ?? item?.unit_price),
  image: item?.image || '',
  is_custom: item?.is_custom ?? false,
  is_vatable: item?.is_vatable ?? false,
  is_active: item?.is_active ?? true,
  is_additional: item?.is_additional ?? false,
  is_deleted: item?.is_deleted ?? false,
});

const buildAdditionalsFromItem = item => {
  const rawAdditionals = Array.isArray(item?.addons) ? item.addons : [];

  const groupedFromCart = [];
  rawAdditionals.forEach(group => {
    const childs = Array.isArray(group?.items) ? group.items : [];
    childs.forEach(child => {
      const itemQty = toNumber(item?.quantity) || 1;
      const childQty = toNumber(child?.quantity);
      const selected = Boolean(child?.selected) || childQty > 0;

      if (!selected) return;

      groupedFromCart.push({
        addon_group_id: group?.id ?? null,
        addon_item_id: child?.catalog_id ?? child?.id ?? null,
        quantity: childQty * itemQty,
        unit_nett: toNumber(child?.unit_price),
        addon: {
          id: group?.id ?? null,
          name: group?.name || '',
          type: group?.type || '',
        },
        catalog: {
          id: child?.catalog_id ?? child?.id ?? null,
          name: child?.name || '',
          unit_price: toNumber(child?.unit_price),
        },
      });
    });
  });

  const sourceAdditionals = groupedFromCart;

  return sourceAdditionals.map((addon, idx) => {
    return {
      id: addon?.id ?? `${item?.id ?? item?.addon_item_id ?? 'item'}-addon-${idx}`,
      addon_group_id: addon?.addon_group_id ?? addon?.addon?.id ?? null,
      addon_item_id: addon?.addon_item_id ?? addon?.catalog?.id ?? null,
      quantity: toNumber(addon?.quantity),
      unit_nett: toNumber(addon?.unit_nett ?? addon?.price),
      note: addon?.note || '',
      addon: addon?.addon || null,
      catalog: addon?.catalog || null,
    };
  });
};

const normalizeRequestItem = requestItem => ({
  catalog_id: requestItem?.catalog_id ?? requestItem?.id ?? '',
  id: requestItem?.id,
  quantity: requestItem?.quantity ?? 1,
  unit_price: requestItem?.unit_price ?? requestItem?.unit_nett ?? requestItem?.unit_bill ?? 0,
  description: requestItem?.description || '',
  additionals_flat: Array.isArray(requestItem?.addons) ? requestItem.addons : [],
  addons: Array.isArray(requestItem?.addons) ? requestItem.addons : [],
  additionals_catalog_map: Array.isArray(requestItem?.additionals_catalog_map)
    ? requestItem.additionals_catalog_map
    : [],
  is_custom: requestItem?.is_custom ?? false,
  name: requestItem?.name || requestItem?.description || 'Item',
});

const buildAdditionalsCatalogMapFromCartItem = cartItem => {
  const groups = Array.isArray(cartItem?.addons) ? cartItem.addons : [];
  const map = [];

  groups.forEach(group => {
    const childs = Array.isArray(group?.items) ? group.items : [];
    childs.forEach(child => {
      const qty = toNumber(child?.quantity);
      const selected = Boolean(child?.selected) || qty > 0;
      if (!selected) return;

      map.push({
        addon_group_id: group?.id ?? null,
        addon_item_id: child?.addon_item_id ?? child?.id ?? null,
        addon: group
          ? {
              id: group?.id ?? null,
              name: group?.name || '',
              type: group?.type || '',
            }
          : null,
        catalog: {
          id: child?.catalog_id ?? child?.id ?? null,
          name: child?.name || '',
          unit_price: toNumber(child?.unit_price),
        },
      });
    });
  });

  return map;
};

const enrichRequestItemsFromCartSnapshot = (requestItems, snapshotItems) => {
  if (!Array.isArray(requestItems) || requestItems.length === 0) return requestItems;
  if (!Array.isArray(snapshotItems) || snapshotItems.length === 0) return requestItems;

  const usedIndices = new Set();

  return requestItems.map(reqItem => {
    const reqCatalogId = reqItem?.catalog_id ?? reqItem?.id;
    const reqQty = toNumber(reqItem?.quantity) || 1;

    let matchedIndex = -1;
    for (let i = 0; i < snapshotItems.length; i += 1) {
      if (usedIndices.has(i)) continue;
      const snap = snapshotItems[i];
      const snapCatalogId = snap?.catalog_id ?? snap?.id;
      const snapQty = toNumber(snap?.quantity) || 1;
      if (snapCatalogId === reqCatalogId && snapQty === reqQty) {
        matchedIndex = i;
        break;
      }
    }

    if (matchedIndex === -1) {
      for (let i = 0; i < snapshotItems.length; i += 1) {
        if (usedIndices.has(i)) continue;
        const snap = snapshotItems[i];
        const snapCatalogId = snap?.catalog_id ?? snap?.id;
        if (snapCatalogId === reqCatalogId) {
          matchedIndex = i;
          break;
        }
      }
    }

    if (matchedIndex === -1) return reqItem;

    usedIndices.add(matchedIndex);
    const matched = snapshotItems[matchedIndex];
    const generatedMap = buildAdditionalsCatalogMapFromCartItem(matched);

    if (!generatedMap.length) return reqItem;

    const currentMap = Array.isArray(reqItem?.additionals_catalog_map)
      ? reqItem.additionals_catalog_map
      : [];

    return {
      ...reqItem,
      additionals_catalog_map: currentMap.length > 0 ? currentMap : generatedMap,
    };
  });
};

const buildOrderItem = (item, index, orderId) => {
  const unitNett = toNumber(item?.unit_nett ?? item?.unit_price ?? item?.price);
  const qty = toNumber(item?.quantity) || 1;
  const discountValue = toNumber(item?.discount_value ?? item?.discount_amount);
  const unitBill = Math.max(0, unitNett - discountValue);

  return {
    id: Date.now() + index,
    order_id: orderId,
    catalog: buildCatalogFromItem(item),
    additional_id: null,
    description: item?.description || '',
    quantity: qty,
    unit_base: toNumber(item?.base_price ?? unitNett),
    unit_gross: unitBill,
    unit_taxed: unitBill,
    unit_tax: 0,
    unit_nett: unitNett,
    discount_percentage: 0,
    discount_value: discountValue,
    unit_bill: unitBill,
    is_discount_percentage: false,
    addons: buildAdditionalsFromItem(item),
  };
};

export const buildOfflineTransactionPayload = ({
  cartState,
  selectedChannel,
  paymentMethod,
  paymentRef,
  note,
  queueMeta,
  authSession,
}) => {
  const now = toIsoNow();
  const localId = Date.now();
  const orderId = localId;

  const listItems = cartState?.items?.list || [];
  const billItems = cartState?.items?.bill || [];
  const snapshotItems = [...listItems, ...billItems];
  const requestItemsRaw = Array.isArray(queueMeta?.requestBody?.items)
    ? queueMeta.requestBody.items.map(normalizeRequestItem)
    : [];
  const requestItems = enrichRequestItemsFromCartSnapshot(requestItemsRaw, snapshotItems);
  const allItems = snapshotItems.length > 0 ? snapshotItems : requestItems;

  const normalizedItems = allItems.map((item, idx) => buildOrderItem(item, idx, orderId));

  const totalsFromItems = normalizedItems.reduce(
    (acc, item) => {
      const qty = toNumber(item?.quantity) || 1;
      acc.subtotal_tax += toNumber(item?.unit_tax) * qty;
      acc.subtotal_taxed += toNumber(item?.unit_taxed) * qty;
      acc.subtotal_gross += toNumber(item?.unit_gross) * qty;
      acc.subtotal_nett += toNumber(item?.unit_nett) * qty;
      acc.total_bill += toNumber(item?.unit_bill) * qty;
      acc.discount_value += toNumber(item?.discount_value) * qty;
      return acc;
    },
    {
      subtotal_tax: 0,
      subtotal_taxed: 0,
      subtotal_gross: 0,
      subtotal_nett: 0,
      total_bill: 0,
      discount_value: 0,
    }
  );

  const discountValue = toNumber(cartState?.discount?.cart?.amount);
  const serviceChargeValue = toNumber(cartState?.meta?.service_charge_value);
  const subtotalTax = toNumber(cartState?.meta?.subtotal_tax) || totalsFromItems.subtotal_tax;
  const subtotalTaxed = toNumber(cartState?.meta?.subtotal_taxed) || totalsFromItems.subtotal_taxed;
  const subtotalGross = toNumber(cartState?.meta?.subtotal_gross) || totalsFromItems.subtotal_gross;
  const subtotalNett = toNumber(cartState?.meta?.subtotal) || totalsFromItems.subtotal_nett;
  const totalBill =
    toNumber(cartState?.meta?.total_bill) || totalsFromItems.total_bill || subtotalNett;
  const totalCharges = toNumber(cartState?.meta?.grand_total) || totalBill + serviceChargeValue;
  const totalPayment =
    toNumber(queueMeta?.requestBody?.total_payment) ||
    toNumber(cartState?.meta?.grand_total) ||
    totalCharges;
  const session = authSession?.user;

  const category_discounts = cartState?.discount?.category?.map(d => ({
    category_id: d?.id,
    is_discount_percentage: d?.discount_type === 'nominal' ? false : true,
    discount_percentage: d?.discount_type === 'nominal' ? 0 : d?.discount_value,
    discount_value: d?.discount_type === 'nominal' ? d?.discount_value : 0,
    id: '',
    order_id: '',
  }));

  // category_id: 'f391ae77-c393-4170-bde0-1707fbd79e91';
  // discount_percentage: 0;
  // discount_value: 5000;
  // id: '9930ee69-1aa2-4498-b856-5c168f3ef8d0';
  // is_discount_percentage: false;
  // order_id: 'c6a5cf80-5b4d-41b8-8b95-9c2d66742226';

  return {
    id: orderId,
    paid_session_sync_id: session?.id || null,
    session,
    channel: selectedChannel,
    code: `OFF-${localId}`,
    payment_ref: paymentRef || '',
    payment_method: paymentMethod || { id: 0, name: 'Cash', is_nfc: 0 },
    membership: cartState?.membership || null,
    category_discounts,
    bill_name:
      queueMeta?.requestBody?.bill_name ||
      cartState?.meta?.bill_name ||
      cartState?.bill?.bill_name ||
      '',
    status: queueMeta?.requestBody?.status || 'completed',
    subtotal_tax: subtotalTax,
    subtotal_taxed: subtotalTaxed,
    subtotal_gross: subtotalGross,
    subtotal_nett: subtotalNett,
    total_bill: totalBill,
    discount_percentage: cartState?.discount?.cart?.type === 'percentage' ? discountValue : 0,
    discount_value: cartState?.discount?.cart?.type === 'nominal' ? discountValue : 0,
    is_discount_percentage: cartState?.discount?.cart?.type === 'percentage' ? true : false,
    is_category_discount: category_discounts?.length > 0 ? true : false,
    service_charge: toNumber(cartState?.meta?.service_charge_percentage),
    service_charge_value: serviceChargeValue,
    total_charges: totalCharges,
    total_payment: totalPayment,
    cost_goods: 0,
    note: note || '',
    ordered_at: now,
    paid_at: now,
    items: normalizedItems,
    is_offline_mode: true,
    offline_meta: {
      sync_id: queueMeta?.id || null,
      local_created_at: now,
      sync_status: 'pending',
    },
  };
};
