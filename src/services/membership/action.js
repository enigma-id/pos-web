import { createApi } from '@reduxjs/toolkit/query/react';

import { baseQuery } from '../baseQuery';

export const memberApi = createApi({
  reducerPath: 'memberApi',
  baseQuery: baseQuery,
  endpoints: builder => ({
    get: builder.query({
      query: params => ({
        url: '/membership',
        method: 'GET',
        params,
      }),
    }),
    create: builder.mutation({
      query: payload => ({
        url: '/membership',
        method: 'POST',
        body: payload,
      }),
    }),
    update: builder.mutation({
      query: ({ id, payload }) => ({
        url: `/membership/${id}`,
        method: 'PUT',
        body: payload,
      }),
    }),
    delete: builder.mutation({
      query: ({ id, payload }) => ({
        url: `/membership/${id}`,
        method: 'DELETE',
        body: payload,
      }),
    }),
    show: builder.query({
      query: id => ({
        url: `/membership/${id}`,
        method: 'GET',
      }),
    }),
    checkSaldo: builder.query({
      query: params => ({
        url: `/balance`,
        method: 'GET',
        params,
      }),
    }),
    topup: builder.mutation({
      query: ({ id, payload }) => ({
        url: `/balance/${id}/topup`,
        method: 'POST',
        body: payload,
      }),
    }),
    getSaldoLog: builder.query({
      query: ({ id, params }) => ({
        url: `/balance/${id}/log`,
        method: 'GET',
        params,
      }),
    }),
  }),
});

export const {
  useLazyGetQuery,
  useCreateMutation,
  useUpdateMutation,
  useDeleteMutation,
  useLazyShowQuery,
  useLazyCheckSaldoQuery,
  useLazyGetSaldoLogQuery,
  useTopupMutation,
} = memberApi;
