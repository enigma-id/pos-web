import { combineReducers } from '@reduxjs/toolkit';

import { activityReducer } from './activity/slice';
import { authApi } from './auth/action';
import { authReducer } from './auth/slice';
import { cartApi } from './cart/action';
import { cartReducer } from './cart/slice';
import { catalogApi } from './catalog/action';
import { formReducer } from './form/slice';
import { memberApi } from './membership/action';
import { offlineReducer } from './offline/slice';
import { salesChannelApi } from './sales/channel/action';
import { channelReducer } from './sales/channel/slice';
import { salesOrderApi } from './sales/order/action';
import { salesSessionApi } from './sales/session/action';
import { sessionReducer } from './sales/session/slice';
import { masterApi } from './master/action';
import { tableApi } from './table/action';
import { tableReducer } from './table/slice';
import { topupApi } from './topup/action';

const apiReducers = {
  [authApi.reducerPath]: authApi.reducer,
  [salesSessionApi.reducerPath]: salesSessionApi.reducer,
  [salesOrderApi.reducerPath]: salesOrderApi.reducer,
  [salesChannelApi.reducerPath]: salesChannelApi.reducer,
  [catalogApi.reducerPath]: catalogApi.reducer,
  [cartApi.reducerPath]: cartApi.reducer,
  [tableApi.reducerPath]: tableApi.reducer,
  [memberApi.reducerPath]: memberApi.reducer,
  [masterApi.reducerPath]: masterApi.reducer,
  [topupApi.reducerPath]: topupApi.reducer,
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
