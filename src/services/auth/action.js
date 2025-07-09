import { createApi } from '@reduxjs/toolkit/query/react';
import { createAction } from '@reduxjs/toolkit';
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
        url: '/auth/signin',
        method: 'POST',
        body: payload,
      }),
    }),
    getUser: builder.query({
      query: () => ({
        url: '/auth/me',
        method: 'GET',
      }),
    }),
    update: builder.mutation({
      query: payload => ({
        url: '/auth/me',
        method: 'PUT',
        body: payload,
      }),
    }),
  }),
});

export const { useLoginMutation, useLazyGetUserQuery, useUpdateMutation } = authApi;
