import { createApi } from '@reduxjs/toolkit/query/react';

import { baseQuery } from '../../baseQuery';

export const salesChannelApi = createApi({
  reducerPath: 'salesChannelApi',
  baseQuery: baseQuery,
  endpoints: builder => ({
    getSalesChannels: builder.query({
      query: params => ({
        url: '/sales/channel',
        method: 'GET',
        params,
      }),
    }),
  }),
});

export const { useLazyGetSalesChannelsQuery } = salesChannelApi;
