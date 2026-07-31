import { createSlice } from '@reduxjs/toolkit';
import _, { result } from 'underscore';

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
      item?.unit_discount > 0 ? (item.is_discount_percentage ? 'percentage' : 'nominal') : null;

    const discoutnValue =
      discountType === null
        ? null
        : discountType === 'percentage'
          ? item?.discount_percentage
          : item?.unit_discount;

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

// getCategoryDiscount ini result-nya adalah data discount (is_discount_percentage, discount_value, discount_percentage, unit_discount)
function getCategoryDiscount(item, itemCategories) {
  const cat = { id: item.category_id, name: item.category_name };
  const found = itemCategories.find(c => c.id === cat?.id);
  if (!found) return null;

  const { discount_type, discount_value } = found;
  if (!discount_type || !discount_value) return null;

  const result = {
    is_discount_percentage: discount_type === 'percentage' ? true : false,
    discount_percentage: discount_type === 'percentage' ? discount_value : 0,
    discount_value: discount_type === 'percentage' ? 0 : discount_value,
    unit_discount: 0,
  };

  if (discount_type === 'percentage') {
    result.unit_discount = Math.ceil(item.unit_nett * (discount_value / 100));
  }

  if (discount_type === 'nominal') {
    result.unit_discount = Math.ceil(
      discount_value > item?.unit_nett ? item?.unit_nett : discount_value
    );
  }

  return result;
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
    const resultDiscount = getCategoryDiscount(item, state.discount.category);
    let unit_discount = 0;
    if (resultDiscount) {
      unit_discount = resultDiscount.unit_discount;
    }

    return {
      ...item,
      ...resultDiscount,
      unit_discount: unit_discount,
      final_total: Math.max(0, item.subtotal - unit_discount * item?.quantity),
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
      quantity: add.quantity / item.quantity,
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
      quantity: add.quantity / item.quantity,
    };
    return entry;
  });

  const additionalPerItem = calculateAdditionalsPerItem(additionalsGrouped);
  const subtotal = (item.unit_nett + additionalPerItem) * item.quantity;

  return {
    category_id: item.catalog?.category_id,
    category_name: item.category_name,
    code: item.catalog?.code,
    name: item.catalog_name || item.catalog?.name || '',
    image: item.catalog?.image,
    is_custom: !!item.catalog?.is_custom,
    unit_nett: item.unit_nett || 0,
    quantity: item.quantity,
    subtotal,
    catalog_id: item.catalog?.id,
    addons: additionalsGrouped,
    additionals_flat: additionalsFlat,
    unit_discount: item.discount_value || 0,
    discount_percentage: item.discount_percentage || 0,
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
      }

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

    changeBillName: (state, action) => {
      state.bill.bill_name = action.payload;
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
  changeBillName,
} = cartSlice.actions;

export const cartReducer = cartSlice.reducer;
