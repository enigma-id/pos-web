import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // ⬅ localStorage untuk web

import { authApi } from './auth/action';
import { cartApi } from './cart/action';
import { catalogApi } from './catalog/action';
import { outletApi } from './outlet/action';
import { memberApi } from './membership/action';
import rootReducer from './reducer';
import { salesChannelApi } from './sales/channel/action';
import { salesOrderApi } from './sales/order/action';
import { salesSessionApi } from './sales/session/action';
import { tableApi } from './table/action';

const persistConfig = {
  key: 'root',
  storage, // ⬅ pakai localStorage
  blacklist: [
    'authApi',
    'salesSessionApi',
    'salesOrderApi',
    'salesChannelApi',
    'catalogApi',
    'outletApi',
    'cartApi',
    'tableApi',
    'memberApi',
    '_persist',
  ],
  debug: true,
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

const apiMiddleware = [
  authApi.middleware,
  catalogApi.middleware,
  outletApi.middleware,
  salesSessionApi.middleware,
  salesOrderApi.middleware,
  salesChannelApi.middleware,
  cartApi.middleware,
  tableApi.middleware,
  memberApi.middleware,
];

const store = configureStore({
  reducer: persistedReducer,
  devTools: import.meta.env.DEV,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      immutableCheck: false,
      serializableCheck: false,
    }).concat(apiMiddleware),
});

const persistor = persistStore(store);

export { store, persistor };
