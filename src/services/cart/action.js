import { createApi } from '@reduxjs/toolkit/query/react';

import { baseQuery } from '../baseQuery';

export const cartApi = createApi({
  reducerPath: 'cartApi',
  baseQuery: baseQuery,
  endpoints: builder => ({
    checkout: builder.mutation({
      query: payload => {
        return {
          url: '/sales/order',
          method: 'POST',
          body: payload,
        };
      },
    }),
    getBill: builder.query({
      query: params => ({
        url: '/sales/order/openbill',
        method: 'GET',
        params,
      }),
    }),
    closeBill: builder.mutation({
      query: ({ id, payload }) => ({
        url: `/sales/order/${id}/checkout`,
        method: 'POST',
        body: payload,
      }),
    }),
    update: builder.mutation({
      query: ({ id, payload }) => ({
        url: `/sales/order/${id}`,
        method: 'PUT',
        body: payload,
      }),
    }),
    getMethod: builder.query({
      query: params => ({
        url: '/payment-method',
        method: 'GET',
        params,
      }),
    }),
  }),
});

export const {
  useCheckoutMutation,
  useLazyGetBillQuery,
  useCloseBillMutation,
  useUpdateMutation,
  useLazyGetMethodQuery,
} = cartApi;
