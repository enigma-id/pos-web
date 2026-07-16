import { createApi } from '@reduxjs/toolkit/query/react';

import { baseQuery } from '../baseQuery';

export const deliveryApi = createApi({
  reducerPath: 'deliveryApi',
  baseQuery: baseQuery,
  endpoints: builder => ({
    getPlan: builder.query({
      query: params => ({
        url: '/delivery/plan',
        method: 'GET',
        params,
      }),
    }),
    receive: builder.mutation({
      query: payload => ({
        url: '/delivery/receive',
        method: 'POST',
        body: payload,
      }),
    }),
  }),
});

export const {
  useLazyGetPlanQuery,
  useReceiveMutation,
} = deliveryApi;
