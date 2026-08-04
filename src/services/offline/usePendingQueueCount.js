import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { ensureDB, STORES } from './queue';

/**
 * Hook — baca pending queue count langsung dari IndexedDB.
 * Gantiin pola manual setPendingCount(+1) yg gampang drift.
 *
 * Auto-refresh via custom event `pending-queue-changed`.
 * Panggil `triggerQueueRefresh()` setelah offline write operations.
 */
const usePendingQueueCount = () => {
  const sessionUserId = useSelector(state => state?.Auth?.session?.user?.id);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!sessionUserId) {
      setCount(0);
      return;
    }
    setLoading(true);
    try {
      const db = await ensureDB(sessionUserId);
      const [bills, payments, topups, sessions] = await Promise.all([
        db.getAll(STORES.orderBills),
        db.getAll(STORES.orderPayments),
        db.getAll(STORES.topups),
        db.getAll(STORES.sessions),
      ]);

      const pendingBills = bills.filter(b => !b.is_synced).length;
      const pendingPayments = payments.filter(p => !p.is_synced).length;
      const pendingTopups = topups.length; // semua topup pending sync
      const pendingSessions = sessions.filter(s => s.syncStatus !== 'synced').length;

      setCount(pendingBills + pendingPayments + pendingTopups + pendingSessions);
    } catch (err) {
      console.error('[usePendingQueueCount] error:', err);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [sessionUserId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-refresh on write events
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('pending-queue-changed', handler);
    return () => window.removeEventListener('pending-queue-changed', handler);
  }, [refresh]);

  return { count, loading, refresh };
};

export default usePendingQueueCount;

/** Panggil setelah offline write operations */
export const triggerQueueRefresh = () => {
  window.dispatchEvent(new CustomEvent('pending-queue-changed'));
};
