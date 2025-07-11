import { createApi } from '@reduxjs/toolkit/query/react';

import { baseQuery } from '../../baseQuery';

export const salesChannelApi = createApi({
  reducerPath: 'salesChannelApi',
  baseQuery: baseQuery,
  endpoints: builder => ({
    getSalesChannels: builder.query({
      query: () => ({
        url: '/sales/channel',
        method: 'GET',
      }),
    }),
  }),
});

export const { useLazyGetSalesChannelsQuery } = salesChannelApi;
