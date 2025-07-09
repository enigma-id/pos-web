import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // ⬅ localStorage untuk web
import rootReducer from './reducer';

import { authApi } from './auth/action';
import { catalogApi } from './catalog/action';
import { salesSessionApi } from './sales/session/action';
import { salesOrderApi } from './sales/order/action';
import { salesChannelApi } from './sales/channel/action';
import { cartApi } from './cart/action';
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
    'cartApi',
    'tableApi',
    '_persist',
  ],
  debug: true,
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

const apiMiddleware = [
  authApi.middleware,
  catalogApi.middleware,
  salesSessionApi.middleware,
  salesOrderApi.middleware,
  salesChannelApi.middleware,
  cartApi.middleware,
  tableApi.middleware,
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
