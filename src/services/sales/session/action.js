import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from '../../baseQuery';

export const salesSessionApi = createApi({
  reducerPath: 'salesSessionApi',
  baseQuery: baseQuery,
  endpoints: builder => ({
    start: builder.mutation({
      query: payload => ({
        url: '/sales/session/start',
        method: 'POST',
        body: payload,
      }),
    }),
    end: builder.mutation({
      query: payload => ({
        url: '/sales/session/end',
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
      query: ({ page = 1, limit = 10, ...params }) => ({
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
  }),
});

export const {
  useStartMutation,
  useEndMutation,
  useLazySummaryQuery,
  useLazySessionQuery,
  useLazyShowSessionQuery,
} = salesSessionApi;
