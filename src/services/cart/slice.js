import { createSlice } from '@reduxjs/toolkit';
import _ from 'underscore';

// Helpers
function removingZero(items) {
  return items.filter(item => item.quantity >= 1);
}

function flattenAdditionals(additionals = []) {
  const result = [];

  additionals.forEach(add => {
    const { id: addon_id, type, childs = [] } = add;

    childs.forEach(child => {
      const isSelected = type === 'quantity' ? (child.quantity || 0) > 0 : !!child.selected;

      if (isSelected) {
        const entry = { addon_id, catalog_id: child.catalog_id ?? child.id };

        if (child.catalog_id) {
          entry.id = child.id;
        }

        if (type === 'quantity') entry.quantity = child.quantity;
        result.push(entry);
      }
    });
  });

  return _.sortBy(result, ['addon_id', 'catalog_id']);
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
    return Math.floor(item.unit_price * (discount_value / 100));
  }

  if (discount_type === 'nominal') {
    return Math.floor(discount_value > item?.unit_price ? item?.unit_price : discount_value);
  }

  return 0;
}

function calculateCartLevelDiscount(subtotal, type, value) {
  if (!type || !value) return 0;

  if (type === 'percentage') {
    return Math.floor((subtotal * value) / 100);
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

  for (const add of item.additionals || []) {
    const addon = add.addon || {};
    const addonId = addon.id || add.addon_id;
    if (!addonId) continue;

    if (!groupedAdditionals[addonId]) {
      groupedAdditionals[addonId] = {
        id: addonId,
        name: addon.name || add.name || '',
        type: addon.type || add.addon_type || '',
        childs: [],
      };
    }

    const qty = add.quantity > 0 ? add.quantity / item.quantity : 0;
    const addCatalog = add.catalog || {};

    groupedAdditionals[addonId].childs.push({
      id: add.id,
      catalog_id: addCatalog.id || add.catalog_id,
      name: addCatalog.name || add.name || '',
      unit_price: addCatalog.unit_price || add.unit_nett || 0,
      quantity: qty,
      selected: add.quantity > 0 || (addon.type || add.addon_type) !== 'quantity',
    });
  }

  const additionalsGrouped = Object.values(groupedAdditionals);

  const additionalsFlat = (item.additionals || []).map(add => ({
    id: add.id,
    addon_id: add.addon?.id || add.addon_id,
    catalog_id: add.catalog?.id || add.catalog_id,
    ...(add.quantity ? { quantity: add.quantity / item.quantity } : {}),
  }));

  const additionalPerItem = calculateAdditionalsPerItem(additionalsGrouped);
  const subtotal = (item.unit_nett + additionalPerItem) * item.quantity;

  return {
    id: item.id,
    category: item.catalog.category,
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
    additionals: additionalsGrouped,
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
    const { childs = [] } = add;

    return (
      total +
      childs.reduce((sum, child) => {
        return sum + (child.unit_price || 0) * (child.quantity || 0);
      }, 0)
    );
  }, 0);
}

function recalculateGrandTotalWithServiceCharge(state) {
  if (state.meta.service_charge_percentage > 0) {
    state.meta.service_charge_value = Math.floor(
      (state.meta.subtotal - state.discount.cart.amount) *
        (state.meta.service_charge_percentage / 100)
    );
  } else {
    // If percentage is 0, preserve existing value if it was set manually from preview
    // but only if it's already there. Otherwise reset to 0.
    if (!state.meta.service_charge_value) {
      state.meta.service_charge_value = 0;
    }
  }

  state.meta.grand_total += state.meta.service_charge_value;
}

// Convert offline queue item (open-bill) to cart item format
function convertOfflineQueueItemToCartItem(item) {
  const additionalsGrouped = {};
  const rawAdditionals = Array.isArray(item?.additionals) ? item.additionals : [];

  rawAdditionals.forEach(add => {
    const addon = add.addon || {};
    const addonId = addon.id || add.addon_id;
    if (!addonId) return;

    if (!additionalsGrouped[addonId]) {
      additionalsGrouped[addonId] = {
        id: addonId,
        name: addon.name || add.name || '',
        type: addon.type || add.addon_type || '',
        childs: [],
      };
    }

    const addCatalog = add.catalog || {};
    additionalsGrouped[addonId].childs.push({
      id: add?.id,
      catalog_id: addCatalog.id || add?.catalog_id,
      name: addCatalog.name || add?.name || '',
      unit_price: addCatalog.unit_price || add?.unit_nett || 0,
      quantity: add?.quantity || 1,
      selected: true,
    });
  });

  const additionalsFlat = rawAdditionals.map(add => ({
    addon_id: add.addon?.id || add?.addon_id,
    catalog_id: add.catalog?.id || add?.catalog_id,
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
    name: item?.description || item?.name || 'Item',
    unit_price: unitPrice,
    quantity: qty,
    subtotal,
    final_total: subtotal,
    is_custom: item?.is_custom || 0,
    is_vatable: item?.is_vatable || 0,
    additionals: additionalsGroupedArray,
    additionals_flat: additionalsFlat,
    discount_amount: 0,
    discount_percentage: 0,
    from_bill: true,
    from_offline_queue: true,
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
      const flat = flattenAdditionals(catalog.additionals);
      let existingIndex;

      if (catalog.is_custom) {
        existingIndex = state.items.list.findIndex(
          item =>
            !item.from_bill &&
            item.is_custom === 1 &&
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
          additionals: catalog.additionals,
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
          additionals: catalog.additionals,
          additionals_flat: flattenAdditionals(catalog.additionals),
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
      recalculateTotals(state);
    },

    setBillItems: (state, action) => {
      const items = action.payload;

      state.items.bill = items.map(item => convertApiOrderToCartItem(item));

      const allItems = [...state.items.list, ...state.items.bill];

      state.discount.category = extractUniqueCategories(allItems);
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
          additionals: catalog.additionals,
          additionals_flat: flattenAdditionals(catalog.additionals),
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
      const queueItem = action.payload;
      const preview = queueItem?.transaction_preview || {};
      const body = queueItem?.body || {};

      // Set bill metadata from preview, falling back to body
      state.bill = {
        id: null,
        ticket: preview?.ticket || body?.ticket || '',
        total_bill: preview?.total_charges || preview?.total_bill || 0,
        membership:
          preview?.membership || (body?.membership_id ? { id: body.membership_id } : null),
        from_offline_queue: true,
        queue_id: queueItem?.id,
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
