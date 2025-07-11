import { createApi } from '@reduxjs/toolkit/query/react';

import { baseQuery } from '../baseQuery';

export const cartApi = createApi({
  reducerPath: 'cartApi',
  baseQuery: baseQuery,
  endpoints: builder => ({
    checkout: builder.mutation({
      query: payload => {
        return {
          url: '/sales/order/direct-pay',
          method: 'POST',
          body: payload,
        };
      },
    }),
    bill: builder.mutation({
      query: payload => {
        return {
          url: '/sales/order/open-bill',
          method: 'POST',
          body: payload,
        };
      },
    }),
    update: builder.mutation({
      query: ({ id, ...payload }) => ({
        url: `/sales/order/${id}`,
        method: 'PUT',
        body: payload,
      }),
    }),
    getMethod: builder.query({
      query: params => ({
        url: '/sales/payment',
        method: 'GET',
        params,
      }),
    }),
  }),
});

export const {
  useCheckoutMutation,
  useBillMutation,
  useUpdateMutation,
  useLazyGetMethodQuery,
  useLazyGetTableQuery,
} = cartApi;
