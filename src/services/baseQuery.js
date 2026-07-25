import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { setApiReachable } from './offline/slice';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL || 'https://api.envio.co.id/dev/pos',
  prepareHeaders: (headers, { getState }) => {
    const token = getState()?.Auth?.token;
    headers.set('Accept', 'application/json');
    headers.set('Content-Type', 'application/json');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    if (import.meta.env.DEV) {
      console.log(
        '%c[RTKQ] Headers:',
        'color: orange; font-weight: bold;',
        Object.fromEntries(headers.entries())
      );
    }

    return headers;
  },
});

export const baseQuery = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  // Detect dead API
  if (result?.error) {
    const status = result.error.status;
    const isNetworkError = status == null || status === 'TIMEOUT' || status === 'FETCH_ERROR' || status === 'PARSING_ERROR';
    const isServerError = typeof status === 'number' && status >= 500;

    if (isNetworkError || isServerError) {
      api.dispatch(setApiReachable(false));
    }
  } else {
    const state = api?.getState?.();
    if (state?.Offline?.apiReachable === false) {
      api.dispatch(setApiReachable(true));
    }
  }

  if (import.meta.env.DEV) {
    const url = typeof args === 'string' ? args : args.url;
    const currentMethod = typeof args === 'object' ? args.method : undefined;
    const body = typeof args === 'object' ? args.body : undefined;
    const params = typeof args === 'object' ? args.params : undefined;

    console.log(
      '%c[RTKQ] URL: ' + url,
      'color: #fff; background: #007acc; font-weight: bold; padding:2px 6px; border-radius:3px;'
    );
    if (currentMethod) {
      console.log(
        '%c[RTKQ] Method: ' + currentMethod,
        'color: #fff; background: #2dba4e; font-weight: bold; padding:2px 6px; border-radius:3px;'
      );
    }
    if (params) {
      console.log(
        '%c[RTKQ] Params:',
        'color: #fff; background: #b8860b; font-weight: bold; padding:2px 6px; border-radius:3px;',
        params
      );
    }
    if (body) {
      console.log(
        '%c[RTKQ] Payload:',
        'color: #fff; background: #d9534f; font-weight: bold; padding:2px 6px; border-radius:3px;',
        body
      );
    }
    console.log(
      '%c[RTKQ] Response:',
      'color: #fff; background: #5bc0de; font-weight: bold; padding:2px 6px; border-radius:3px;',
      result
    );
  }

  return result;
};
