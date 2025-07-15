import { createApi } from '@reduxjs/toolkit/query/react';

import { baseQuery } from '../baseQuery';

export const catalogApi = createApi({
  reducerPath: 'catalogApi',
  baseQuery: baseQuery,
  endpoints: builder => ({
    create: builder.mutation({
      query: payload => ({
        url: '/catalog',
        method: 'POST',
        body: payload,
      }),
    }),

    getCatalogPricing: builder.query({
      query: ({ page = 1, limit = 10000000, ...params }) => ({
        url: '/catalog/pricing',
        method: 'GET',
        params: {
          page,
          limit,
          ...params,
        },
      }),
    }),

    getCategories: builder.query({
      query: () => ({
        url: '/catalog/category',
        method: 'GET',
      }),
    }),

    getCatalogDetail: builder.query({
      query: ({ id, channel_id }) => ({
        url: `/catalog/${id}`,
        method: 'GET',
        params: {
          channel_id: channel_id,
        },
      }),
    }),
  }),
});

export const {
  useCreateMutation,
  useLazyGetCatalogPricingQuery,
  useLazyGetCategoriesQuery,
  useLazyGetCatalogDetailQuery,
} = catalogApi;
