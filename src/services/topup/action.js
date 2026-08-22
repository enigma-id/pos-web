import { createApi } from '@reduxjs/toolkit/query/react';

import { baseQuery } from '../baseQuery';

export const topupApi = createApi({
  reducerPath: 'topupApi',
  baseQuery: baseQuery,
  endpoints: builder => ({
    getSaldoLogs: builder.query({
      query: params => ({
        url: '/saldo_logs',
        method: 'GET',
        params,
      }),
    }),
    cancelTopup: builder.mutation({
      query: ({ id, payload }) => ({
        url: `/balance/topup/${id}/cancel`,
        method: 'PUT',
        body: payload,
      }),
    }),
  }),
});

export const {
  useLazyGetSaldoLogsQuery,
  useCancelTopupMutation,
} = topupApi;
