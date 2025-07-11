import { createAction } from '@reduxjs/toolkit';
import { createApi } from '@reduxjs/toolkit/query/react';

import { baseQuery } from '../baseQuery';

export const $reset = createAction('Table/reset');

// Helper: generate query params
const buildParams = table => {
  const params = {
    page: table.page,
    limit: table.limit,
    search: table.textSearch,
    order_by: table.sorting,
    downloadable: table.downloadable,
  };

  // remove empty/null values
  Object.keys(params).forEach(key => {
    if (params[key] === '' || params[key] === 0 || params[key] === null) {
      delete params[key];
    }
  });

  // apply filters
  if (table.filter) {
    for (const key in table.filter) {
      const value = table.filter[key];
      if (value !== '' && value !== null) {
        params[key] = Array.isArray(value) ? value.join('.') : value;
      }
    }
  }

  return params;
};

// Main API
export const tableApi = createApi({
  reducerPath: 'tableApi',
  baseQuery,
  endpoints: builder => ({
    getTableData: builder.query({
      query: ({ url, table }) => {
        console.log('params: ', buildParams(table));
        return {
          url,
          method: 'GET',
          params: buildParams(table),
        };
      },
    }),
    downloadTableData: builder.query({
      query: ({ url, table }) => {
        const params = buildParams({ ...table, downloadable: true });
        return {
          url,
          method: 'GET',
          params,
        };
      },
    }),
  }),
});

export const { useLazyGetTableDataQuery, useLazyDownloadTableDataQuery } = tableApi;
