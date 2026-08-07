import { createApi } from '@reduxjs/toolkit/query/react';

import { baseQuery } from '../baseQuery';

export const masterApi = createApi({
  reducerPath: 'masterApi',
  baseQuery: baseQuery,
  endpoints: builder => ({
    getSchemaBonus: builder.query({
      query: params => ({
        url: '/balance/bonus',
        method: 'GET',
        params,
      }),
    }),
    getPaymentMethod: builder.query({
      query: params => ({
        url: '/payment-method',
        method: 'GET',
        params,
      }),
    }),
  }),
});

export const { useLazyGetSchemaBonusQuery, useLazyGetPaymentMethodQuery } = masterApi;
