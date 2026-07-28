import { createSlice } from '@reduxjs/toolkit';
import _ from 'underscore';

// Helpers
function removingZero(items) {
  return items.filter(item => item.quantity >= 1);
}

function flattenAdditionals(additionals = []) {
  const result = [];

  additionals.forEach(add => {
    const { id: addon_group_id, type, name: addon_group_name, items = [] } = add;

    items.forEach(child => {
      const isSelected = type === 'quantity' ? (child.quantity || 0) > 0 : !!child.selected;

      if (isSelected) {
        const entry = {
          addon_group_id,
          addon_group_name: addon_group_name || '',
          addon_group_type: type || '',
          addon_item_id: child.catalog_id ?? child.addon_item_id ?? child.id,
          name: child.catalog_name ?? child.name,
          unit_price: Number(child.unit_price) || 0,
        };

        if (child.addon_item_id) {
          entry.id = child.id;
        }

        if (type === 'quantity') entry.quantity = child.quantity;
        result.push(entry);
      }
    });
  });

  return _.sortBy(result, ['addon_group_id', 'addon_item_id']);
}

function extractUniqueCategories(items) {
  const map = new Map();

  items.forEach(item => {
    const cat = { id: item.category_id, name: item.category_name };

    const discountType =
      item?.discount_amount > 0 ? (item.is_discount_percentage ? 'percentage' : 'nominal') : null;

    const discoutnValue =
      discountType === null
        ? null
        : discountType === 'percentage'
          ? item?.discount_percentage
          : item?.discount_amount;

    if (cat?.id !== null) {
      if (!map.has(cat.id)) {
        map.set(cat.id, {
          ...cat,
          discount_type: discountType,
          discount_value: discoutnValue,
        });
      } else {
        const existing = map.get(cat.id);
        if (existing.discount_type !== discountType || existing.discount_value !== discoutnValue) {
          map.set(cat.id, {
            ...existing,
            discount_type: discountType,
            discount_value: discoutnValue,
          });
        }
      }
    }
  });

  return Array.from(map.values());
}

function getCategoryDiscount(item, itemCategories) {
  const cat = { id: item.category_id, name: item.category_name };
  const found = itemCategories.find(c => c.id === cat?.id);
  if (!found) return 0;

  const { discount_type, discount_value } = found;
  if (!discount_type || !discount_value) return 0;

  if (discount_type === 'percentage') {
    return Math.ceil(item.unit_price * (discount_value / 100));
  }

  if (discount_type === 'nominal') {
    return Math.ceil(discount_value > item?.unit_price ? item?.unit_price : discount_value);
  }

  return 0;
}

function calculateCartLevelDiscount(subtotal, type, value) {
  if (!type || !value) return 0;

  if (type === 'percentage') {
    return Math.ceil((subtotal * value) / 100);
  }

  if (type === 'nominal') {
    return Math.min(subtotal, value);
  }

  return 0;
}

function getAllItems(state) {
  return [...state.items.list, ...state.items.bill];
}

function recalculateTotals(state) {
  const allItems = getAllItems(state);

  const itemWithDiscounts = allItems.map(item => {
    const discount = getCategoryDiscount(item, state.discount.category);

    return {
      ...item,
      discount_amount: discount,
      final_total: Math.max(0, item.subtotal - discount * item?.quantity),
    };
  });

  // Cek apakah item ini dari bill atau list via .from_bill
  const updatedList = itemWithDiscounts.filter(item => !item.from_bill);
  const updatedBill = itemWithDiscounts.filter(item => item.from_bill);

  state.items.list = updatedList;
  state.items.bill = updatedBill;

  const subtotalList = updatedList.reduce((sum, item) => sum + item.final_total, 0);
  const subtotalAll = [...updatedList, ...updatedBill].reduce(
    (sum, item) => sum + item.final_total,
    0
  );

  const cartDiscount = calculateCartLevelDiscount(
    subtotalAll,
    state.discount.cart.type,
    state.discount.cart.value
  );

  state.meta.subtotal_list = subtotalList;
  state.meta.subtotal = subtotalAll;
  state.discount.cart.amount = cartDiscount;
  state.meta.grand_total = Math.max(0, subtotalAll - cartDiscount);

  recalculateGrandTotalWithServiceCharge(state);
}

function convertApiOrderToCartItem(item) {
  const groupedAdditionals = {};

  for (const add of item.addons || []) {
    // Prefer addon_group (API), fallback addon (legacy / offline synthetic)
    const group = add.addon_group || add.addon || {};
    const addonId = group.id || add.addon_group_id;

    // Flat order response (no group metadata) → group under shared sentinel
    if (!addonId) {
      if (!groupedAdditionals._flat_addons_) {
        groupedAdditionals._flat_addons_ = {
          id: '_flat_addons_',
          name: 'Add-ons',
          type: 'options',
          items: [],
        };
      }
      const qty = add.quantity > 0 ? add.quantity / item.quantity : 1;
      groupedAdditionals._flat_addons_.items.push({
        id: add.id || add.catalog_id,
        catalog_id: add.catalog_id,
        name: add.catalog_name || '',
        unit_price: add.unit_nett || add.unit_price || 0,
        quantity: qty,
        selected: true,
      });
      continue;
    }

    if (!groupedAdditionals[addonId]) {
      groupedAdditionals[addonId] = {
        id: addonId,
        name: group.name || add.name || '',
        type: group.type || add.addon_type || '',
        items: [],
      };
    }

    const qty = add.quantity > 0 ? add.quantity / item.quantity : 0;
    const addCatalog = add.catalog || {};

    groupedAdditionals[addonId].items.push({
      id: add.id,
      catalog_id: addCatalog.id || add.catalog_id,
      name: addCatalog.name || add.name || add.catalog_name || '',
      unit_price: addCatalog.unit_price || add.unit_nett || add.unit_price || 0,
      quantity: qty,
      selected: true,
    });
  }

  const additionalsGrouped = Object.values(groupedAdditionals);

  const additionalsFlat = (item.addons || []).map(add => ({
    id: add.id,
    addon_group_id: add.addon?.id || add.addon_group_id || add.id,
    addon_item_id: add.catalog?.id || add.catalog_id || add.addon_item_id,
    name: add.catalog?.name || add.name || '',
    unit_price: Number(add.catalog?.unit_price) || Number(add.unit_price) || 0,
    quantity: add.quantity > 0 ? add.quantity / item.quantity : 1,
  }));

  const additionalPerItem = calculateAdditionalsPerItem(additionalsGrouped);
  const subtotal = (item.unit_nett + additionalPerItem) * item.quantity;

  return {
    id: item.id,
    category_id: item.catalog?.category_id,
    category_name: item?.category_name,
    brand_id: item.catalog.brand_id,
    ref_id: item.catalog.ref_id,
    code: item.catalog.code,
    name: item.catalog.name || item?.description,
    base_price: item.catalog.base_price,
    image: item.catalog.image,
    is_custom: item.catalog.is_custom,
    is_vatable: item.catalog.is_vatable,
    is_active: item.catalog.is_active,
    is_additional: item.catalog.is_additional,
    is_deleted: item.catalog.is_deleted,
    unit_price: item.unit_nett,
    quantity: item.quantity,
    subtotal,
    catalog_id: item.catalog.id,
    addons: additionalsGrouped,
    additionals_flat: additionalsFlat,
    discount_amount: item.discount_value || 0,
    discount_percentage: item.discount || 0,
    final_total: item.unit_bill * item.quantity,
    from_bill: true,
    is_discount_percentage: item.is_discount_percentage,
  };
}

function calculateAdditionalsPerItem(additionals = []) {
  return additionals.reduce((total, add) => {
    const { items = [] } = add;

    return (
      total +
      items.reduce((sum, child) => {
        return sum + (child.unit_price || 0) * (child.quantity || 0);
      }, 0)
    );
  }, 0);
}

function recalculateGrandTotalWithServiceCharge(state) {
  const baseGrandTotal = Math.max(0, state.meta.subtotal - state.discount.cart.amount);

  if (state.meta.service_charge_percentage > 0) {
    state.meta.service_charge_value = Math.ceil(
      baseGrandTotal * (state.meta.service_charge_percentage / 100)
    );
  } else {
    // If percentage is 0, preserve existing value if it was set manually from preview
    // but only if it's already there. Otherwise reset to 0.
    if (!state.meta.service_charge_value) {
      state.meta.service_charge_value = 0;
    }
  }

  state.meta.grand_total = baseGrandTotal + state.meta.service_charge_value;
}

// Convert offline queue item (open-bill) to cart item format
function convertOfflineQueueItemToCartItem(item) {
  const additionalsGrouped = {};
  const rawAdditionals = Array.isArray(item?.addons) ? item.addons : [];

  rawAdditionals.forEach(add => {
    const addon = add.addon || {};
    const addonId = addon.id || add.addon_group_id;
    if (!addonId) return;

    if (!additionalsGrouped[addonId]) {
      additionalsGrouped[addonId] = {
        id: addonId,
        name: add.addon_group_name || addon.name || add.name || 'Add-ons',
        type: add.addon_group_type || addon.type || add.addon_type || 'checkbox',
        items: [],
      };
    }

    const addCatalog = add.catalog || {};
    additionalsGrouped[addonId].items.push({
      id: add?.id,
      catalog_id: addCatalog.id || add?.catalog_id,
      name: addCatalog.name || add?.name || '',
      unit_price: addCatalog.unit_price || add?.unit_nett || 0,
      quantity: add?.quantity || 1,
      selected: true,
    });
  });

  const additionalsFlat = rawAdditionals.map(add => ({
    addon_group_id: add.addon?.id || add?.addon_group_id,
    addon_group_name: add.addon_group_name || add.addon?.name || add.name || '',
    addon_group_type: add.addon_group_type || add.addon?.type || add.addon_type || '',
    addon_item_id: add.catalog?.id || add?.addon_item_id,
    name: add.catalog?.name || add.name || '',
    unit_price: Number(add.catalog?.unit_price) || Number(add.unit_price) || 0,
    quantity: add?.quantity || 1,
  }));

  const unitPrice = Number(item?.unit_price ?? item?.unit_nett) || 0;
  const qty = Number(item?.quantity) || 1;

  const additionalsGroupedArray = Object.values(additionalsGrouped);
  const additionalPerItem = calculateAdditionalsPerItem(additionalsGroupedArray);
  const subtotal = (unitPrice + additionalPerItem) * qty;

  return {
    id: item?.id || Date.now(),
    catalog_id: item?.catalog_id,
    category: item?.category || { id: item?.category_id || 0 },
    name: item?.catalog_name || item?.name || 'Item',
    unit_price: unitPrice,
    quantity: qty,
    subtotal,
    final_total: subtotal,
    is_custom: item?.is_custom || false,
    is_vatable: item?.is_vatable || false,
    addons: additionalsGroupedArray,
    additionals_flat: additionalsFlat,
    discount_amount: 0,
    discount_percentage: 0,
    from_bill: true,
    is_offline_mode: true,
  };
}

// Initial State
const defineInitialState = () => ({
  items: {
    list: [],
    bill: [],
    count: 0,
  },
  discount: {
    category: [],
    cart: {
      type: null, // 'percentage' | 'nominal'
      value: 0,
      amount: 0,
    },
  },
  meta: {
    subtotal: 0,
    grand_total: 0,
    subtotal_list: 0,
    service_charge_percentage: 0,
    service_charge_value: 0,
    customer: null,
  },
  bill: null,
});

// Slice
const cartSlice = createSlice({
  name: 'cart',
  initialState: defineInitialState(),
  reducers: {
    resetCart: () => defineInitialState(),

    addItem: (state, action) => {
      const catalog = action.payload;
      const flat = flattenAdditionals(catalog.addons);
      let existingIndex;

      if (catalog.is_custom) {
        existingIndex = state.items.list.findIndex(
          item =>
            !item.from_bill &&
            item.is_custom === true &&
            item.name?.trim().toLowerCase() === catalog.name?.trim().toLowerCase() &&
            item.unit_price === catalog.unit_price
        );
      } else {
        existingIndex = state.items.list.findIndex(
          item =>
            !item.from_bill &&
            item.catalog_id === catalog.id &&
            _.isEqual(item.additionals_flat, flat)
        );
      }

      if (existingIndex >= 0) {
        state.items.list[existingIndex].quantity += catalog.quantity;
        state.items.list[existingIndex].subtotal += catalog.subtotal;
      } else {
        const newItem = {
          ...catalog,
          from_bill: undefined,
          catalog_id: catalog.id,
          addons: catalog.addons,
          additionals_flat: flat,
          quantity: catalog.quantity,
          subtotal: catalog.subtotal,
        };
        state.items.list.push(newItem);
      }

      state.items.list = removingZero(state.items.list);
      state.items.count = state.items.list.length;

      const allItems = [...state.items.list, ...state.items.bill];
      state.discount.category = extractUniqueCategories(allItems);

      recalculateTotals(state);
    },

    changeItem: (state, action) => {
      const { key, catalog } = action.payload;

      if (state.items.list[key]) {
        state.items.list[key] = {
          ...state.items.list[key],
          name: catalog.name,
          quantity: catalog.quantity,
          unit_price: catalog.unit_price,
          addons: catalog.addons,
          additionals_flat: flattenAdditionals(catalog.addons),
          subtotal: catalog.subtotal,
        };
      }

      // Clean up + reprocess
      state.items.list = removingZero(state.items.list);
      state.items.count = state.items.list.length;

      const allItems = [...state.items.list, ...state.items.bill];
      state.discount.category = extractUniqueCategories(allItems);

      recalculateTotals(state);
    },

    removeItem: (state, action) => {
      const index = action.payload;

      if (typeof index === 'number' && state.items.list[index]) {
        state.items.list.splice(index, 1);
      }

      state.items.list = removingZero(state.items.list);
      state.items.count = state.items.list.length;

      const allItems = [...state.items.list, ...state.items.bill];
      state.discount.category = extractUniqueCategories(allItems);

      recalculateTotals(state);
    },

    updateCategoryDiscount: (state, action) => {
      const { id, discount_type, discount_value } = action.payload;

      const cat = state.discount.category.find(c => c.id === id);
      if (cat) {
        cat.discount_type = discount_type;
        cat.discount_value = discount_value;
      }

      recalculateTotals(state);
    },

    updateCartDiscount: (state, action) => {
      const { discount_type, discount_value } = action.payload;

      state.discount.cart.type = discount_type;
      state.discount.cart.value = discount_value;

      recalculateTotals(state);
    },

    customer: (state, action) => {
      state.meta.customer = action.payload;
    },

    changeServiceCharge: (state, action) => {
      state.meta.service_charge_percentage = action.payload;

      recalculateTotals(state);
    },

    selectedBill: (state, action) => {
      const bill = action.payload;

      state.bill = bill;
      state.meta.customer = bill?.membership ?? null;
      state.meta.service_charge_value = bill?.service_charge_value ?? 0;
      if (bill?.service_charge_percentage > 0) {
        state.meta.service_charge_percentage = bill?.service_charge_percentage;
      }
      recalculateTotals(state);
    },

    setBillItems: (state, action) => {
      const { items, category_discounts } = action.payload;

      state.items.bill = items.map(item => convertApiOrderToCartItem(item));

      const allItems = [...state.items.list, ...state.items.bill];

      if (
        category_discounts &&
        Array.isArray(category_discounts) &&
        category_discounts.length > 0
      ) {
        state.discount.category = category_discounts.map(cd => {
          const itemWithCat = allItems.find(i => i.category_id === cd.category_id);

          return {
            id: cd.category_id,
            name: itemWithCat?.category_name || '',
            discount_type: cd.is_discount_percentage ? 'percentage' : 'nominal',
            discount_value: cd.is_discount_percentage ? cd.discount_percentage : cd.discount_value,
          };
        });
      } else {
        state.discount.category = extractUniqueCategories(allItems);
      }

      recalculateTotals(state);
    },

    changeBillItem: (state, action) => {
      const { key, catalog } = action.payload;

      if (state.items.bill[key]) {
        state.items.bill[key] = {
          ...state.items.bill[key],
          name: catalog.name,
          quantity: catalog.quantity,
          unit_price: catalog.unit_price,
          addons: catalog.addons,
          additionals_flat: flattenAdditionals(catalog.addons),
          subtotal: catalog.subtotal,
        };
      }

      // Clean up + reprocess
      state.items.bill = removingZero(state.items.bill);

      const allItems = [...state.items.list, ...state.items.bill];
      state.discount.category = extractUniqueCategories(allItems);

      recalculateTotals(state);
    },

    removeBillItem: (state, action) => {
      const index = action.payload;

      if (typeof index === 'number' && state.items.bill[index]) {
        state.items.bill.splice(index, 1);
      }

      state.items.bill = removingZero(state.items.bill);

      const allItems = [...state.items.list, ...state.items.bill];
      state.discount.category = extractUniqueCategories(allItems);

      recalculateTotals(state);
    },

    loadOfflineBill: (state, action) => {
      const order = action.payload;
      // New shape: flat order from session blob (no wrapper)
      // Old shape: { transaction_preview, body }
      const isFlatOrder = order?.sync_id && !order?.transaction_preview && !order?.body;

      let preview, body;
      if (isFlatOrder) {
        // Compute total from items (since totalPayment = 0 for pending save-bills)
        const computedTotal = (order.items || []).reduce((sum, item) => {
          const itemTotal = Number(item.unit_price || 0) * Number(item.quantity || 0);
          const addonsTotal = (item.addons || []).reduce(
            (asum, a) => asum + Number(a.unit_price || 0) * Number(a.quantity || 0),
            0
          );
          return sum + itemTotal + addonsTotal;
        }, 0);
        const totalCharges =
          order.total_payment ||
          order.totalPayment ||
          computedTotal + Number(order.service_charge_value || order.serviceChargeValue || 0);

        // Build preview directly from order fields
        preview = {
          id: order.sync_id,
          bill_name: order.bill_name || order.billName || '',
          total_charges: totalCharges,
          total_bill: totalCharges,
          discount_value: order.discount_value || order.discountValue || 0,
          is_discount_percentage: (order.discount_percentage || order.discountPercentage || 0) > 0,
          items: (order.items || []).map(item => ({
            ...item,
            catalog: { name: item.catalog_name || '', id: item.catalog_id },
            unit_nett: item.unit_price,
            discount_value: 0,
            // Wrap flat addons so convertApiOrderToCartItem groups them with type 'checkbox'
            addons: (item.addons || []).map((a, idx) => ({
              addon_group_name: a.addon_group_name || '',
              addon_group_type: a.addon_group_type || '',
              addon: {
                id: `oad-${idx}`,
                name: a.addon_group_name || 'Add-ons',
                type: a.addon_group_type || 'checkbox',
              },
              catalog: {
                id: a.addon_item_id,
                name: a.catalog_name || '',
                unit_price: a.unit_price || 0,
              },
              quantity: a.quantity || 1,
              selected: true,
            })),
          })),
          membership:
            order.membership_id || order.membershipId
              ? { id: order.membership_id || order.membershipId }
              : null,
        };
        body = { ...order, bill_name: order.bill_name || order.billName };
      } else {
        preview = order?.transaction_preview || {};
        body = order?.body || {};
      }

      // Set bill metadata from preview, falling back to body
      state.bill = {
        id: order?.sync_id || preview?.id,
        bill_name: preview?.bill_name || body?.bill_name || '',
        total_bill: preview?.total_charges || preview?.total_bill || 0,
        membership:
          preview?.membership || (body?.membership_id ? { id: body.membership_id } : null),
        is_offline_mode: true,
        sync_id: order?.sync_id || order?.id,
        // BARU: untuk deteksi cross-session & hitung sisa split
        origin_session_sync_id:
          order.origin_session_sync_id ||
          order.originSessionSyncId ||
          body?.origin_session_sync_id ||
          body?.originSessionSyncId ||
          order._sessionData?.sync_id ||
          null,
        originalItems:
          order.original_items ||
          order.originalItems ||
          body?.original_items ||
          body?.originalItems ||
          null,
        itemSnapshot: (order.items || body?.items || preview?.items || []).map(i => ({
          catalog_id: i.catalog_id || i.catalog?.id,
          quantity: i.quantity || 0,
        })),
      };

      // Reset cart items
      state.items.list = [];
      state.items.bill = [];

      // Use items from transaction_preview if available (they are in Order Item format)
      if (Array.isArray(preview?.items) && preview.items.length > 0) {
        state.items.bill = preview.items.map(item => convertApiOrderToCartItem(item));
      } else {
        // Fallback to body items (raw format)
        const rawItems = Array.isArray(body?.items) ? body.items : [];
        state.items.bill = rawItems.map(item => convertOfflineQueueItemToCartItem(item));
      }

      state.items.count = 0; // bill items don't count as new items

      // Set customer
      if (preview?.membership) {
        state.meta.customer = preview.membership;
      } else if (body?.membership_id) {
        state.meta.customer = { id: body.membership_id };
      }

      // Apply cart discount
      const isPercentage = preview?.is_discount_percentage || body?.discount_percentage > 0;
      const discountVal =
        preview?.discount_value || body?.discount_percentage || body?.discount_value || 0;

      if (discountVal > 0) {
        state.discount.cart = {
          type: isPercentage ? 'percentage' : 'nominal',
          value: discountVal,
          amount: 0,
        };
      }

      // Extract categories and recalculate
      const allItems = [...state.items.list, ...state.items.bill];
      state.discount.category = extractUniqueCategories(allItems);
      recalculateTotals(state);
    },
  },
});

export const {
  addItem,
  changeItem,
  resetCart,
  removeItem,
  customer,
  changeServiceCharge,
  updateCategoryDiscount,
  updateCartDiscount,
  selectedBill,
  setBillItems,
  changeBillItem,
  removeBillItem,
  loadOfflineBill,
} = cartSlice.actions;

export const cartReducer = cartSlice.reducer;
