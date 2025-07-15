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
    const cat = item.category;
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
  const cat = item.category;
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

// Initial State
const defineInitialState = () => ({
  items: {
    list: [],
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
    customer: null,
  },
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

      // Update category reference
      state.discount.category = extractUniqueCategories(state.items.list);

      // Hitung ulang subtotal & diskon
      const itemWithDiscounts = state.items.list.map(item => {
        const discount = getCategoryDiscount(item, state.discount.category);
        return {
          ...item,
          discount_amount: discount,
          final_total: Math.max(0, item.subtotal - discount),
        };
      });

      const subtotal = itemWithDiscounts.reduce((sum, item) => sum + item.final_total, 0);
      const cartDiscount = calculateCartLevelDiscount(
        subtotal,
        state.discount.cart.type,
        state.discount.cart.value
      );

      state.items.list = itemWithDiscounts;
      state.meta.subtotal = subtotal;
      state.discount.cart.amount = cartDiscount;
      state.meta.grand_total = Math.max(0, subtotal - cartDiscount);
    },

    changeItem: (state, action) => {
      const { key, catalog } = action.payload;
      if (state.items.list[key]) {
        const updated = {
          ...state.items.list[key],
          name: catalog.name,
          quantity: catalog.quantity,
          unit_price: catalog.unit_price,
          additionals: catalog.additionals,
          additionals_flat: flattenAdditionals(catalog.additionals),
          subtotal: catalog.subtotal,
        };
        state.items.list[key] = updated;
      }

      // Clean up
      state.items.list = removingZero(state.items.list);
      state.items.count = state.items.list.length;
      state.discount.category = extractUniqueCategories(state.items.list);

      const itemWithDiscounts = state.items.list.map(item => {
        const discount = getCategoryDiscount(item, state.discount.category);
        return {
          ...item,
          discount_amount: discount,
          final_total: Math.max(0, item.subtotal - discount),
        };
      });

      const subtotal = itemWithDiscounts.reduce((sum, item) => sum + item.final_total, 0);
      const cartDiscount = calculateCartLevelDiscount(
        subtotal,
        state.discount.cart.type,
        state.discount.cart.value
      );

      state.items.list = itemWithDiscounts;
      state.meta.subtotal = subtotal;
      state.discount.cart.amount = cartDiscount;
      state.meta.grand_total = Math.max(0, subtotal - cartDiscount);
    },

    removeItem: (state, action) => {
      const index = action.payload;
      if (typeof index === 'number' && state.items.list[index]) {
        state.items.list.splice(index, 1);
      }

      state.items.list = removingZero(state.items.list);
      state.items.count = state.items.list.length;
      state.discount.category = extractUniqueCategories(state.items.list);

      const itemWithDiscounts = state.items.list.map(item => {
        const discount = getCategoryDiscount(item, state.discount.category);
        return {
          ...item,
          discount_amount: discount,
          final_total: Math.max(0, item.subtotal - discount),
        };
      });

      const subtotal = itemWithDiscounts.reduce((sum, item) => sum + item.final_total, 0);
      const cartDiscount = calculateCartLevelDiscount(
        subtotal,
        state.discount.cart.type,
        state.discount.cart.value
      );

      state.items.list = itemWithDiscounts;
      state.meta.subtotal = subtotal;
      state.discount.cart.amount = cartDiscount;
      state.meta.grand_total = Math.max(0, subtotal - cartDiscount);
    },

    updateCategoryDiscount: (state, action) => {
      const { id, discount_type, discount_value } = action.payload;
      const cat = state.discount.category.find(c => c.id === id);
      if (cat) {
        cat.discount_type = discount_type;
        cat.discount_value = discount_value;
      }

      // Recalculate all items
      const itemWithDiscounts = state.items.list.map(item => {
        const discount = getCategoryDiscount(item, state.discount.category);
        return {
          ...item,
          discount_amount: discount,
          final_total: Math.max(0, item.subtotal - discount),
        };
      });

      const subtotal = itemWithDiscounts.reduce((sum, item) => sum + item.final_total, 0);
      const cartDiscount = calculateCartLevelDiscount(
        subtotal,
        state.discount.cart.type,
        state.discount.cart.value
      );

      state.items.list = itemWithDiscounts;
      state.meta.subtotal = subtotal;
      state.discount.cart.amount = cartDiscount;
      state.meta.grand_total = Math.max(0, subtotal - cartDiscount);
    },

    updateCartDiscount: (state, action) => {
      const { discount_type, discount_value } = action.payload;

      state.discount.cart.type = discount_type;
      state.discount.cart.value = discount_value;

      const itemWithDiscounts = state.items.list.map(item => {
        const discount = getCategoryDiscount(item, state.discount.category);
        return {
          ...item,
          discount_amount: discount,
          final_total: Math.max(0, item.subtotal - discount),
        };
      });

      const subtotal = itemWithDiscounts.reduce((sum, item) => sum + item.final_total, 0);
      const cartDiscount = calculateCartLevelDiscount(subtotal, discount_type, discount_value);

      state.items.list = itemWithDiscounts;
      state.meta.subtotal = subtotal;
      state.discount.cart.amount = cartDiscount;
      state.meta.grand_total = Math.max(0, subtotal - cartDiscount);
    },

    customer: (state, action) => {
      state.meta.customer = action.payload;
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
} = cartSlice.actions;

export const cartReducer = cartSlice.reducer;
