import { combineReducers } from '@reduxjs/toolkit';

import { activityReducer } from './activity/slice';
import { authApi } from './auth/action';
import { authReducer } from './auth/slice';
import { cartApi } from './cart/action';
import { cartReducer } from './cart/slice';
import { catalogApi } from './catalog/action';
import { formReducer } from './form/slice';
import { deliveryApi } from './delivery/action';
import { memberApi } from './membership/action';
import { offlineReducer } from './offline/slice';
import { outletApi } from './outlet/action';
import { salesChannelApi } from './sales/channel/action';
import { channelReducer } from './sales/channel/slice';
import { salesOrderApi } from './sales/order/action';
import { salesSessionApi } from './sales/session/action';
import { sessionReducer } from './sales/session/slice';
import { tableApi } from './table/action';
import { tableReducer } from './table/slice';

const apiReducers = {
  [authApi.reducerPath]: authApi.reducer,
  [salesSessionApi.reducerPath]: salesSessionApi.reducer,
  [salesOrderApi.reducerPath]: salesOrderApi.reducer,
  [salesChannelApi.reducerPath]: salesChannelApi.reducer,
  [catalogApi.reducerPath]: catalogApi.reducer,
  [outletApi.reducerPath]: outletApi.reducer,
  [cartApi.reducerPath]: cartApi.reducer,
  [tableApi.reducerPath]: tableApi.reducer,
  [memberApi.reducerPath]: memberApi.reducer,
  [deliveryApi.reducerPath]: deliveryApi.reducer,
};

const rootReducer = combineReducers({
  Activity: activityReducer,
  Form: formReducer,
  Auth: authReducer,
  SalesSession: sessionReducer,
  SalesChannel: channelReducer,
  Cart: cartReducer,
  Table: tableReducer,
  Offline: offlineReducer,
  ...apiReducers,
});

export default rootReducer;
