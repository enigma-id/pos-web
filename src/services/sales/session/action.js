import { createApi } from '@reduxjs/toolkit/query/react';

import { baseQuery } from '../../baseQuery';

export const salesSessionApi = createApi({
  reducerPath: 'salesSessionApi',
  baseQuery: baseQuery,
  endpoints: builder => ({
    start: builder.mutation({
      query: payload => ({
        url: '/sales/session',
        method: 'POST',
        body: payload,
      }),
    }),
    end: builder.mutation({
      query: payload => ({
        url: '/sales/session/close',
        method: 'PUT',
        body: payload,
      }),
    }),
    sync: builder.mutation({
      query: payload => ({
        url: '/sales/sync',
        method: 'POST',
        body: payload,
      }),
    }),
    summary: builder.query({
      query: params => ({
        url: '/sales/session/summary',
        method: 'GET',
        params,
      }),
    }),
    session: builder.query({
      query: ({ page = 1, limit = 25, ...params }) => ({
        url: '/sales/session',
        method: 'GET',
        params: {
          page,
          limit,
          ...params,
        },
      }),
    }),
    showSession: builder.query({
      query: ({ id }) => ({
        url: `/sales/session/${id}`,
        method: 'GET',
      }),
    }),
    updateDevice: builder.mutation({
      query: payload => ({
        url: '/sales/session/device',
        method: 'PUT',
        body: payload,
      }),
    }),
  }),
});

export const {
  useStartMutation,
  useEndMutation,
  useSyncMutation,
  useUpdateDeviceMutation,
  useLazySummaryQuery,
  useLazySessionQuery,
  useLazyShowSessionQuery,
} = salesSessionApi;
