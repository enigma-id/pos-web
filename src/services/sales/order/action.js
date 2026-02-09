import { createApi } from '@reduxjs/toolkit/query/react';

import { baseQuery } from '../../baseQuery';

export const salesOrderApi = createApi({
  reducerPath: 'salesOrderApi',
  baseQuery: baseQuery,
  endpoints: builder => ({
    order: builder.query({
      query: ({ page = 1, limit = 25, ...params }) => ({
        url: '/sales/order',
        method: 'GET',
        params: {
          page,
          limit,
          ...params,
        },
      }),
    }),
    show: builder.query({
      query: ({ id }) => ({
        url: `/sales/order/${id}`,
        method: 'GET',
      }),
    }),
    cancel: builder.mutation({
      query: ({ id, ...payload }) => ({
        url: `/sales/order/${id}/cancel`,
        method: 'PUT',
        body: {
          ...payload,
        },
      }),
    }),
    copy: builder.mutation({
      query: ({ id, payload }) => ({
        url: `/sales/order/${id}/copy`,
        method: 'POST',
        body: payload,
      }),
    }),
  }),
});

export const { useLazyOrderQuery, useLazyShowQuery, useCancelMutation, useCopyMutation } =
  salesOrderApi;
