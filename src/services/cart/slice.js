// import { createSlice } from '@reduxjs/toolkit';

// function removingZero(items) {
//   return items.filter(item => item.quantity >= 1);
// }

// const defineInitialState = () => ({
//   items: [],
//   subtotal: 0,
//   count: 0,
// });

// const cartSlice = createSlice({
//   name: 'cart',
//   initialState: defineInitialState(),
//   reducers: {
//     resetCart: () => {
//       return defineInitialState();
//     },
//     addItem: (state, action) => {
//       const catalog = action.payload;
//       const newItem = {
//         ...catalog,
//         catalog_id: catalog.id,
//         additionals: catalog.additionals,
//         quantity: catalog.quantity,
//         subtotal: catalog.subtotal,
//       };
//       state.items.push(newItem);
//       state.items = removingZero(state.items);
//       state.subtotal = state.items.reduce(
//         (sum, item) => sum + (item.quantity > 0 ? item.subtotal : 0),
//         0
//       );
//       state.count = state.items.length;
//     },
//     changeItem: (state, action) => {
//       const { key, catalog } = action.payload;
//       if (state.items[key]) {
//         state.items[key].quantity = catalog.quantity;
//         state.items[key].unit_price = catalog.unit_price;
//         state.items[key].additionals = catalog.additionals;
//         state.items[key].subtotal = catalog.subtotal;
//       }
//       state.items = removingZero(state.items);
//       state.subtotal = state.items.reduce(
//         (sum, item) => sum + (item.quantity > 0 ? item.subtotal : 0),
//         0
//       );
//       state.count = state.items.length;
//     },
//     removeItem: (state, action) => {
//       const id = action.payload;
//       state.items = state.items.filter(item => item.catalog_id !== id);
//       state.subtotal = state.items.reduce(
//         (sum, item) => sum + (item.quantity > 0 ? item.subtotal : 0),
//         0
//       );
//       state.count = state.items.length;
//     },
//   },
// });

// export const { addItem, changeItem, resetCart, removeItem } = cartSlice.actions;
// export const cartReducer = cartSlice.reducer;

import { createSlice } from '@reduxjs/toolkit';
import _ from 'underscore';

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
        const entry = {
          addon_id,
          catalog_id: child.id,
        };

        if (type === 'quantity') {
          entry.quantity = child.quantity;
        }

        result.push(entry);
      }
    });
  });

  // Sort to ensure consistent comparison
  return _.sortBy(result, ['addon_id', 'catalog_id']);
}

const defineInitialState = () => ({
  items: [],
  subtotal: 0,
  count: 0,
});

const cartSlice = createSlice({
  name: 'cart',
  initialState: defineInitialState(),
  reducers: {
    resetCart: () => {
      return defineInitialState();
    },
    addItem: (state, action) => {
      const catalog = action.payload;
      const flat = flattenAdditionals(catalog.additionals);

      const existingIndex = state.items.findIndex(
        item => item.catalog_id === catalog.id && _.isEqual(item.additionals_flat, flat)
      );

      if (existingIndex >= 0) {
        // Tambahkan qty dan subtotal
        state.items[existingIndex].quantity += catalog.quantity;
        state.items[existingIndex].subtotal += catalog.subtotal;
      } else {
        // Masukkan item baru
        const newItem = {
          ...catalog,
          catalog_id: catalog.id,
          additionals: catalog.additionals,
          additionals_flat: flat,
          quantity: catalog.quantity,
          subtotal: catalog.subtotal,
        };
        state.items.push(newItem);
      }

      state.items = removingZero(state.items);
      state.subtotal = state.items.reduce(
        (sum, item) => sum + (item.quantity > 0 ? item.subtotal : 0),
        0
      );
      state.count = state.items.length;
    },
    changeItem: (state, action) => {
      const { key, catalog } = action.payload;
      if (state.items[key]) {
        state.items[key].quantity = catalog.quantity;
        state.items[key].unit_price = catalog.unit_price;
        state.items[key].additionals = catalog.additionals;
        state.items[key].additionals_flat = flattenAdditionals(catalog.additionals);
        state.items[key].subtotal = catalog.subtotal;
      }
      state.items = removingZero(state.items);
      state.subtotal = state.items.reduce(
        (sum, item) => sum + (item.quantity > 0 ? item.subtotal : 0),
        0
      );
      state.count = state.items.length;
    },
    removeItem: (state, action) => {
      const index = action.payload;
      if (typeof index === 'number' && state.items[index]) {
        state.items.splice(index, 1);
      }

      state.subtotal = state.items.reduce(
        (sum, item) => sum + (item.quantity > 0 ? item.subtotal : 0),
        0
      );
      state.count = state.items.length;
    },
  },
});

export const { addItem, changeItem, resetCart, removeItem } = cartSlice.actions;
export const cartReducer = cartSlice.reducer;
