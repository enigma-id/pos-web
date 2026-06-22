import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import {
  addToQueue,
  checkAndSetIdempotency,
  generateIdempotencyKey,
  getPendingCount,
} from './offline/queue';
import { setPendingCount, setQueueItems, setWarning } from './offline/slice';

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

const isMutationMethod = method => {
  const upper = String(method || 'GET').toUpperCase();
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(upper);
};

const toObjectHeaders = headers => {
  if (!headers) return {};
  if (typeof headers.entries === 'function') {
    return Object.fromEntries(headers.entries());
  }
  return headers;
};

const buildTransactionPreview = ({ args, queued }) => {
  // Priority 1: Use pre-built preview if provided in args or body
  const customPreview = args?.__offlinePreview || args?.body?.__offlinePreview;
  if (customPreview) {
    return {
      ...customPreview,
      // Ensure code and date are set if missing
      code: customPreview.code || `OFF-${queued?.id ?? Date.now()}`,
      created_at: customPreview.created_at || queued?.createdAt || new Date().toISOString(),
    };
  }

  const body = args?.body || {};
  const rawItems = Array.isArray(body?.items) ? body.items : [];
  const totalPayment = Number(body?.total_payment);
  const safeTotalPayment = totalPayment;

  console.log('body', body);

  return {
    code: body?.code || `OFF-${queued?.id ?? Date.now()}`,
    channel: {
      id: body?.channel_id ?? null,
      name: body?.channel_name || 'Unknown Channel',
    },
    payment_method: {
      id: body?.payment_method_id ?? 0,
      name: body?.payment_method_name || (body?.payment_method_id === 0 ? 'Cash' : 'Non Cash'),
    },
    total_payment: safeTotalPayment,
    item_count: rawItems.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0),
    created_at: queued?.createdAt || new Date().toISOString(),
  };
};

const queueOfflineMutation = async (args, api) => {
  console.log('args', args);

  const url = String(args?.url || '');
  const method = String(args?.method || 'GET').toUpperCase();
  const idempotencyKey =
    args?.idempotencyKey || args?.headers?.['X-Idempotency-Key'] || generateIdempotencyKey();

  const check = await checkAndSetIdempotency(idempotencyKey);
  if (check?.exists) {
    return {
      data: {
        status: 'success',
        offline_queued: true,
        duplicate: true,
        message: 'Request already queued.',
      },
    };
  }

  const token = api?.getState?.()?.Auth?.token || null;

  // Special handling for Session Start/End to provide immediate UI feedback
  const isSessionStart = url.includes('/sales/session');
  // const isSessionEnd = url.includes('/sales/session/close');

  const previewData = buildTransactionPreview({ args, queued: { id: null } });

  const queuedRaw = await addToQueue({
    url: args?.url,
    method,
    body: args?.body,
    params: args?.params,
    headers: {
      ...toObjectHeaders(args?.headers),
      'X-Idempotency-Key': idempotencyKey,
    },
    token,
    type: 'mutation',
    status: 'pending',
    transaction_preview: previewData,
  });

  const queued = {
    ...queuedRaw,
    transaction_preview: {
      ...previewData,
      code: previewData?.code || `OFF-${queuedRaw?.id ?? Date.now()}`,
    },
  };

  const pendingCount = await getPendingCount();
  api.dispatch(setPendingCount(pendingCount));

  const offlineState = api?.getState?.()?.Offline;
  const existingItems = Array.isArray(offlineState?.items) ? offlineState.items : [];
  api.dispatch(setQueueItems([...existingItems.filter(item => item?.id !== queued?.id), queued]));

  console.log('queued', queued);
  if (pendingCount >= 100) {
    api.dispatch(setWarning('Many pending transactions. Contact support.'));
  } else {
    api.dispatch(setWarning(null));
  }

  // If session start, we mock the response to allow the UI to proceed
  if (isSessionStart) {
    return {
      data: {
        status: 'success',
        data: {
          id: queued?.id,
          offline_queued: true,
          is_offline_session: true,
        },
        message: 'Session started locally.',
      },
    };
  }

  return {
    data: {
      status: 'success',
      data: {
        id: queued?.id,
        queued_at: queued?.createdAt,
        offline_queued: true,
      },
      message: 'Transaction saved. Will sync when online.',
    },
  };
};

export const baseQuery = async (args, api, extraOptions) => {
  const isSkipOffline = !!(typeof args === 'object' && args?.__skipOfflineQueue);
  const method = typeof args === 'object' ? args.method : 'GET';
  const offlineMutation = typeof args === 'object' && isMutationMethod(method);

  if (!isSkipOffline && offlineMutation && typeof navigator !== 'undefined' && !navigator.onLine) {
    return queueOfflineMutation(args, api);
  }

  const result = await rawBaseQuery(args, api, extraOptions);

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
