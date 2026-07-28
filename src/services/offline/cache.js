/**
 * Helpers untuk update Redux cache secara incremental tanpa re-read IndexedDB.
 *
 * Dipake di consumer pages (cart, checkout, membership) pas write operation.
 */

export const addOrderToCache = (sessions, newOrder, sessionId) => {
  return sessions.map(s => {
    if (s.sync_id === sessionId || s.id === sessionId) {
      return { ...s, orders: [...(s.orders || []), newOrder] };
    }
    return s;
  });
};

export const updateOrderInCache = (sessions, orderSyncId, updates) => {
  return sessions.map(s => ({
    ...s,
    orders: (s.orders || []).map(o =>
      o.sync_id === orderSyncId ? { ...o, ...updates } : o
    ),
  }));
};

export const removeOrderFromCache = (sessions, orderSyncId) => {
  return sessions.map(s => ({
    ...s,
    orders: (s.orders || []).filter(o => o.sync_id !== orderSyncId),
  }));
};

export const addTopupToCache = (sessions, newTopup, sessionId) => {
  return sessions.map(s => {
    if (s.sync_id === sessionId || s.id === sessionId) {
      return { ...s, topups: [...(s.topups || []), newTopup] };
    }
    return s;
  });
};

export const addMembershipToCache = (sessions, newMember, sessionId) => {
  return sessions.map(s => {
    if (s.sync_id === sessionId || s.id === sessionId) {
      return { ...s, memberships: [...(s.memberships || []), newMember] };
    }
    return s;
  });
};

/**
 * Hitung pendingCount dari sessions array di cache (fallback kalo gak ada di Redux).
 */
export const computePendingCount = (sessions) => {
  return sessions.reduce((sum, s) => {
    if (s.syncStatus === 'synced') return sum;
    const itemCount = (s.orders || []).length + (s.topups || []).length;
    return sum + (itemCount > 0 ? itemCount : 1);
  }, 0);
};
