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
        const entry = { addon_id, catalog_id: child.id };
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
    const cat = item.category ?? item.catalog?.category;

    if (cat?.id != null && !map.has(cat.id)) {
      map.set(cat.id, {
        ...cat,
        discount_type: null,
        discount_value: 0,
      });
    }
  });

  return Array.from(map.values());
}

function getCategoryDiscount(item, itemCategories) {
  const cat = item.category ?? item.catalog.category;
  const found = itemCategories.find(c => c.id === cat?.id);
  if (!found) return 0;

  const { discount_type, discount_value } = found;
  if (!discount_type || !discount_value) return 0;

  if (discount_type === 'percentage') {
    return Math.floor((item.subtotal * discount_value) / 100);
  }

  if (discount_type === 'nominal') {
    return Math.min(item.subtotal, discount_value);
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
      final_total: Math.max(0, item.subtotal - discount),
    };
  });

  // Hitung ulang items.list & items.bill berdasarkan hasil diskon
  const updatedList = itemWithDiscounts.filter(item =>
    state.items.list.some(i => i.catalog_id === item.catalog_id && i.quantity === item.quantity)
  );

  const updatedBill = itemWithDiscounts.filter(item =>
    state.items.bill.some(i => i.catalog_id === item.catalog_id && i.quantity === item.quantity)
  );

  state.items.list = updatedList;
  state.items.bill = updatedBill;

  const subtotalList = updatedList.reduce((sum, item) => sum + item.final_total, 0);
  const subtotalAll = updatedList
    .concat(updatedBill)
    .reduce((sum, item) => sum + item.final_total, 0);

  const cartDiscount = calculateCartLevelDiscount(
    subtotalAll,
    state.discount.cart.type,
    state.discount.cart.value
  );

  state.meta.subtotal_list = subtotalList;
  state.meta.subtotal = subtotalAll;
  state.discount.cart.amount = cartDiscount;
  state.meta.grand_total = Math.max(0, subtotalAll - cartDiscount);
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
            item.is_custom === 1 &&
            item.name?.trim().toLowerCase() === catalog.name?.trim().toLowerCase() &&
            item.unit_price === catalog.unit_price
        );
      } else {
        existingIndex = state.items.list.findIndex(
          item => item.catalog_id === catalog.id && _.isEqual(item.additionals_flat, flat)
        );
      }

      if (existingIndex >= 0) {
        state.items.list[existingIndex].quantity += catalog.quantity;
        state.items.list[existingIndex].subtotal += catalog.subtotal;
      } else {
        const newItem = {
          ...catalog,
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

    selectedBill: (state, action) => {
      const bill = action.payload;

      state.bill = bill;
      state.meta.customer = bill?.membership ?? null;
      state.meta.subtotal = bill?.total_bill ?? 0;
    },

    setBillItems: (state, action) => {
      const items = action.payload;

      state.items.bill = items.map(item => {
        const rawAdd = item.additionals || [];

        const childs = rawAdd.map(add => ({
          id: add.catalog.id,
          name: add.catalog.name,
          quantity: add.quantity,
          selected: add.quantity > 0,
          unit_price: add.unit_nett,
        }));

        const additional = [
          {
            id: 0,
            name: 'addon',
            type: '',
            childs,
          },
        ];

        return {
          ...item,
          catalog_id: item.catalog_id ?? item.id,
          name: item.name ?? item.catalog.name,
          unit_price: item.unit_price ?? item.unit_nett,
          category_id: item.category?.id ?? item.catalog?.category?.id ?? 0,
          subtotal: item.subtotal ?? item.unit_price ?? item.unit_nett * item.quantity,
          final_total: item.subtotal ?? item.unit_price ?? item.unit_nett * item.quantity,
          discount_amount: 0,
          additionals: additional,
        };
      });

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
  updateCategoryDiscount,
  updateCartDiscount,
  selectedBill,
  setBillItems,
} = cartSlice.actions;

export const cartReducer = cartSlice.reducer;
