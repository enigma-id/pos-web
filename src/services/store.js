import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // ⬅ localStorage untuk web

import { authApi } from './auth/action';
import { cartApi } from './cart/action';
import { catalogApi } from './catalog/action';
import { deliveryApi } from './delivery/action';
import { memberApi } from './membership/action';
import { outletApi } from './outlet/action';
import rootReducer from './reducer';
import { salesChannelApi } from './sales/channel/action';
import { salesOrderApi } from './sales/order/action';
import { salesSessionApi } from './sales/session/action';
import { tableApi } from './table/action';
import { getSalesCacheValue } from '../utils/cache';
import { changeServiceCharge } from './cart/slice';

const persistConfig = {
  key: 'root',
  storage, // ⬅ pakai localStorage
  blacklist: [
    'Offline',
    'authApi',
    'salesSessionApi',
    'salesOrderApi',
    'salesChannelApi',
    'catalogApi',
    'outletApi',
    'cartApi',
    'tableApi',
    'deliveryApi',
    'memberApi',
    '_persist',
  ],
  debug: true,
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

// Re-apply cached service charge after any resetCart dispatch
const preserveServiceCharge = store => next => action => {
  const result = next(action);

  if (action?.type === 'cart/resetCart') {
    const cached = getSalesCacheValue('service_charge');
    if (cached != null) {
      store.dispatch(changeServiceCharge(cached));
    }
  }

  return result;
};

const apiMiddleware = [
  authApi.middleware,
  catalogApi.middleware,
  outletApi.middleware,
  salesSessionApi.middleware,
  salesOrderApi.middleware,
  salesChannelApi.middleware,
  cartApi.middleware,
  tableApi.middleware,
  deliveryApi.middleware,
  memberApi.middleware,
];

const store = configureStore({
  reducer: persistedReducer,
  devTools: import.meta.env.DEV,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      immutableCheck: false,
      serializableCheck: false,
    }).concat([preserveServiceCharge, ...apiMiddleware]),
});

const persistor = persistStore(store);

export { store, persistor };
