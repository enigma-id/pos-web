import { createApi } from '@reduxjs/toolkit/query/react';

import { baseQuery } from '../../baseQuery';

export const salesOrderApi = createApi({
  reducerPath: 'salesOrderApi',
  baseQuery: baseQuery,
  endpoints: builder => ({
    show: builder.query({
      query: ({ id }) => ({
        url: `/sales/order/${id}`,
        method: 'GET',
      }),
    }),
    update: builder.mutation({
      query: ({ id, payload }) => ({
        url: `/sales/order/${id}`,
        method: 'PUT',
        body: payload,
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

export const { useLazyShowQuery, useCancelMutation, useUpdateMutation } = salesOrderApi;
