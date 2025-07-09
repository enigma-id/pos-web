import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from '../../baseQuery';

export const salesOrderApi = createApi({
  reducerPath: 'salesOrderApi',
  baseQuery: baseQuery,
  endpoints: builder => ({
    order: builder.query({
      query: ({ page = 1, limit = 10, ...params }) => ({
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
  }),
});

export const { useLazyOrderQuery, useLazyShowQuery, useCancelMutation } = salesOrderApi;
