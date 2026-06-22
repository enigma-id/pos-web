import { createAction } from '@reduxjs/toolkit';
import { createApi } from '@reduxjs/toolkit/query/react';

import { baseQuery } from '../baseQuery';

export const $reset = createAction('Auth/reset');
export const $logout = createAction('Auth/signout');

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: baseQuery,
  endpoints: builder => ({
    login: builder.mutation({
      fixedCacheKey: 'login',
      query: payload => ({
        url: '/auth/login',
        method: 'POST',
        body: payload,
      }),
    }),
    getUser: builder.query({
      query: () => ({
        url: '/profile/me',
        method: 'GET',
      }),
    }),
    update: builder.mutation({
      query: payload => ({
        url: '/profile/me',
        method: 'PUT',
        body: payload,
      }),
    }),
  }),
});

export const { useLoginMutation, useLazyGetUserQuery, useUpdateMutation } = authApi;
