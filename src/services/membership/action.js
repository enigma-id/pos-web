import { createApi } from '@reduxjs/toolkit/query/react';

import { baseQuery } from '../baseQuery';

export const memberApi = createApi({
  reducerPath: 'memberApi',
  baseQuery: baseQuery,
  endpoints: builder => ({
    create: builder.mutation({
      query: payload => ({
        url: '/membership',
        method: 'POST',
        body: payload,
      }),
    }),
    update: builder.mutation({
      query: ({ id, ...payload }) => ({
        url: `/membership/${id}`,
        method: 'PUT',
        body: payload,
      }),
    }),
    delete: builder.mutation({
      query: id => ({
        url: `/membership/${id}`,
        method: 'DELETE',
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
        url: `/saldo/cek`,
        method: 'GET',
        params,
      }),
    }),
    topup: builder.mutation({
      query: payload => ({
        url: '/saldo/top-up',
        method: 'POST',
        body: payload,
      }),
    }),
  }),
});

export const {
  useCreateMutation,
  useUpdateMutation,
  useDeleteMutation,
  useLazyShowQuery,
  useLazyCheckSaldoQuery,
  useTopupMutation,
} = memberApi;
