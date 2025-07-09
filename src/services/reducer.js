import { combineReducers } from '@reduxjs/toolkit';

import { activityReducer } from './activity/slice';
import { formReducer } from './form/slice';

import { authReducer } from './auth/slice';
import { authApi } from './auth/action';

import { catalogApi } from './catalog/action';

import { sessionReducer } from './sales/session/slice';
import { salesSessionApi } from './sales/session/action';

import { salesOrderApi } from './sales/order/action';

import { salesChannelApi } from './sales/channel/action';
import { channelReducer } from './sales/channel/slice';

import { cartReducer } from './cart/slice';
import { cartApi } from './cart/action';

import { tableApi } from './table/action';
import { tableReducer } from './table/slice';

const apiReducers = {
  [authApi.reducerPath]: authApi.reducer,
  [salesSessionApi.reducerPath]: salesSessionApi.reducer,
  [salesOrderApi.reducerPath]: salesOrderApi.reducer,
  [salesChannelApi.reducerPath]: salesChannelApi.reducer,
  [catalogApi.reducerPath]: catalogApi.reducer,
  [cartApi.reducerPath]: cartApi.reducer,
  [tableApi.reducerPath]: tableApi.reducer,
};

const rootReducer = combineReducers({
  Activity: activityReducer,
  Form: formReducer,
  Auth: authReducer,
  SalesSession: sessionReducer,
  SalesChannel: channelReducer,
  Cart: cartReducer,
  Table: tableReducer,
  ...apiReducers,
});

export default rootReducer;
