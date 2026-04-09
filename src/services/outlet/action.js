import { createApi } from '@reduxjs/toolkit/query/react';

import { baseQuery } from '../baseQuery';

export const outletApi = createApi({
  reducerPath: 'outletApi',
  baseQuery: baseQuery,
  endpoints: builder => ({
    getServiceCharge: builder.query({
      query: () => ({
        url: '/outlet/service/charge',
        method: 'GET',
      }),
    }),
  }),
});

export const { useLazyGetServiceChargeQuery } = outletApi;
