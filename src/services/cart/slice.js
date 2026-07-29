import { createSlice } from '@reduxjs/toolkit';
import _ from 'underscore';

// Helpers
function removingZero(items) {
  return items.filter(item => item.quantity >= 1);
}

function flattenAdditionals(additionals = []) {
  const result = [];

  additionals.forEach(add => {
    const { id: addonGroupId, type, name: addonGroupName, items = [] } = add;

    items.forEach(child => {
      const isSelected = type === 'quantity' ? (child.quantity || 0) > 0 : !!child.selected;

      if (isSelected) {
        const entry = {
          addon_group: { id: addonGroupId, name: addonGroupName || '', type: type || '' },
          addon_item_id: child.catalog_id ?? child.addon_item_id ?? child.id,
          name: child.catalog_name ?? child.name,
          unit_nett: Number(child.unit_nett ?? 0) || 0,
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
    return Math.ceil(item.unit_nett * (discount_value / 100));
  }

  if (discount_type === 'nominal') {
    return Math.ceil(discount_value > item?.unit_nett ? item?.unit_nett : discount_value);
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
    const group = add.addon_group || {};
    const addonId = group.id;

    if (!addonId) {
      if (!groupedAdditionals._flat_addons_) {
        groupedAdditionals._flat_addons_ = {
          id: '_flat_addons_',
          name: 'Add-ons',
          type: 'options',
          items: [],
        };
      }
      groupedAdditionals._flat_addons_.items.push({
        id: add.catalog_id,
        catalog_id: add.catalog_id,
        name: add.catalog_name || add.catalog?.name || '',
        unit_nett: add.unit_nett || 0,
        selected: true,
      });
      continue;
    }

    if (!groupedAdditionals[addonId]) {
      groupedAdditionals[addonId] = {
        id: addonId,
        name: group.name || '',
        type: group.type || '',
        items: [],
      };
    }

    const grpEntry = {
      id: add.id,
      catalog_id: add.catalog?.id || add.catalog_id,
      name: add.catalog_name || add.catalog?.name || '',
      unit_nett: add.unit_nett || 0,
      selected: true,
      // options/checkbox → qty=1, quantity → add.quantity / item.quantity
      quantity: group.type === 'quantity' && add.quantity > 0
        ? (item.quantity > 0 ? add.quantity / item.quantity : 0)
        : 1,
    };
    groupedAdditionals[addonId].items.push(grpEntry);
  }

  const additionalsGrouped = Object.values(groupedAdditionals);

  const additionalsFlat = (item.addons || []).map(add => {
    const addonGroup = add.addon_group || {};
    const grpType = addonGroup.type || '';
    const entry = {
      id: add.id,
      addon_group: {
        id: addonGroup.id || add.addon_group_id,
        name: addonGroup.name || '',
        type: grpType,
      },
      addon_item_id: add.catalog?.id || add.catalog_id,
      name: add.catalog_name || add.catalog?.name || '',
      unit_nett: Number(add.unit_nett ?? 0) || 0,
    };
    if (grpType === 'quantity') {
      entry.quantity = add.quantity > 0 ? add.quantity / item.quantity : 1;
    }
    return entry;
  });

  const additionalPerItem = calculateAdditionalsPerItem(additionalsGrouped);
  const subtotal = (item.unit_nett + additionalPerItem) * item.quantity;

  return {
    id: item.id,
    category_id: item.catalog?.category_id,
    category_name: item.category_name,
    brand_id: item.catalog?.brand_id,
    ref_id: item.catalog?.ref_id,
    code: item.catalog?.code,
    name: item.catalog_name || item.catalog?.name || '',
    base_price: item.catalog?.base_price,
    image: item.catalog?.image,
    is_custom: !!item.catalog?.is_custom,
    is_vatable: !!item.catalog?.is_vatable,
    is_active: item.catalog?.is_active,
    is_additional: item.catalog?.is_additional,
    is_deleted: item.catalog?.is_deleted,
    unit_nett: item.unit_nett || 0,
    quantity: item.quantity,
    subtotal,
    catalog_id: item.catalog?.id,
    addons: additionalsGrouped,
    additionals_flat: additionalsFlat,
    discount_amount: item.discount_value || 0,
    discount_percentage: item.discount || 0,
    final_total: item.unit_bill ? item.unit_bill * item.quantity : subtotal,
    from_bill: true,
    is_discount_percentage: !!item.is_discount_percentage,
  };
}

function calculateAdditionalsPerItem(additionals = []) {
  return additionals.reduce((total, add) => {
    const { items = [] } = add;

    return (
      total +
      items.reduce((sum, child) => {
        return sum + (child.unit_nett || 0) * (child.quantity || 0);
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
            item.unit_nett === catalog.unit_nett
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
          unit_nett: catalog.unit_nett,
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
      const raw = action.payload;
      let items, category_discounts;

      if (Array.isArray(raw)) {
        items = raw;
        category_discounts = undefined;
      } else if (raw && Array.isArray(raw.items)) {
        items = raw.items;
        category_discounts = raw.category_discounts;
      } else {
        return;
      }

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
          unit_nett: catalog.unit_nett,
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
      const totalCharges =
        order.total_payment ||
        order.totalPayment ||
        (order.items || []).reduce((sum, item) => {
          const it = Number(item.unit_nett || 0) * Number(item.quantity || 0);
          const at = (item.addons || []).reduce((a, ad) => a + Number(ad.unit_nett || 0) * Number(ad.quantity || 0), 0);
          return sum + it + at;
        }, 0) + Number(order.service_charge_value || order.serviceChargeValue || 0);

      const previewItems = (order.items || []).map(item => ({
        ...item,
        catalog: { name: item.catalog_name || '', id: item.catalog_id },
        unit_nett: item.unit_nett,
        discount_value: 0,
        addons: (item.addons || []).map((a, idx) => {
          const grpType = a.addon_group?.type || '';
          const ae = {
            addon_group: {
              id: a.addon_group?.id || `oad-${idx}`,
              name: a.addon_group?.name || 'Add-ons',
              type: grpType,
            },
            catalog: { id: a.addon_item_id, name: a.catalog_name || '', unit_nett: a.unit_nett || 0 },
            selected: true,
          };
          if (grpType === 'quantity') ae.quantity = a.quantity / item.quantity || 1;
          return ae;
        }),
      }));

      state.bill = {
        id: order?.sync_id || UUID_ZERO,
        bill_name: order.bill_name || '',
        total_bill: totalCharges,
        membership: order.membership_id ? { id: order.membership_id } : null,
        is_offline_mode: true,
        sync_id: order?.sync_id || UUID_ZERO,
        origin_session_sync_id: order.origin_session_sync_id || null,
        originalItems: order.original_items || null,
        itemSnapshot: (order.items || []).map(i => ({ catalog_id: i.catalog_id || i.catalog?.id, quantity: i.quantity || 0 })),
      };

      state.items.list = [];
      state.items.bill = previewItems.map(item => convertApiOrderToCartItem(item));
      state.bill.items = order.items || [];
      state.items.count = 0;

      if (order.membership_id) {
        state.meta.customer = { id: order.membership_id };
      }

      const isPer = !!(order.discount_percentage || 0);
      const dVal = order.discount_value || 0;
      if (dVal > 0) {
        state.discount.cart = { type: isPer ? 'percentage' : 'nominal', value: dVal, amount: 0 };
      }

      state.discount.category = extractUniqueCategories([...state.items.list, ...state.items.bill]);
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
