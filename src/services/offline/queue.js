import { openDB, deleteDB } from 'idb';
import { v4 as uuidv4 } from 'uuid';

const DB_VERSION = 2;

const STORES = {
  pendingRequests: 'pendingRequests',
  metadata: 'metadata',
};

const dbInstances = new Map();

const getNow = () => Date.now();

const getDBName = userId => `pos-offline-queue-${userId}`;

const ensureDB = userId => {
  if (!userId) throw new Error('userId required for queue DB');
  const key = String(userId);
  if (!dbInstances.has(key)) {
    dbInstances.set(
      key,
      openDB(getDBName(userId), DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORES.pendingRequests)) {
            const store = db.createObjectStore(STORES.pendingRequests, { keyPath: 'id' });
            store.createIndex('status', 'status', { unique: false });
            store.createIndex('createdAt', 'createdAt', { unique: false });
          }

          if (!db.objectStoreNames.contains(STORES.metadata)) {
            db.createObjectStore(STORES.metadata, { keyPath: 'key' });
          }
        },
      })
    );
  }
  return dbInstances.get(key);
};

const sortFIFO = items => {
  return [...items].sort((a, b) => {
    const aTime = a?.createdAt || 0;
    const bTime = b?.createdAt || 0;
    return aTime - bTime;
  });
};

export const closeUserDB = async userId => {
  const key = String(userId);
  const db = dbInstances.get(key);
  if (db) {
    db.close();
    dbInstances.delete(key);
  }
};

export const deleteUserDB = async userId => {
  await closeUserDB(userId);
  const name = getDBName(userId);
  try {
    await deleteDB(name);
  } catch {
    // DB may not exist, ignore
  }
};

export const initQueueDB = async userId => {
  await ensureDB(userId);
  return true;
};

export const addToQueue = async (request, userId) => {
  const db = await ensureDB(userId);
  const now = getNow();

  // If it's an open-bill request, check if a bill with the same ticket/bill_name already exists in the queue
  const isSaveBill =
    String(request?.url).toLowerCase().includes('/sales/order') &&
    request?.body?.status === 'pending';
  const ticketName = request?.body?.ticket || request?.body?.bill_name;

  if (isSaveBill && ticketName) {
    const allItems = await db.getAll(STORES.pendingRequests);
    const existingBill = allItems.find(
      item =>
        String(item?.url).toLowerCase().includes('/sales/order') &&
        item?.body?.status === 'pending' &&
        (item?.body?.ticket === ticketName || item?.body?.bill_name === ticketName)
    );

    if (existingBill) {
      // Merge items instead of adding a new entry
      const existingItems = Array.isArray(existingBill.body?.items) ? existingBill.body.items : [];
      const newItems = Array.isArray(request?.body?.items) ? request.body.items : [];

      // Simple merge logic: for each new item, check if it exists (catalog_id)
      const mergedItems = [...existingItems];
      newItems.forEach(newItem => {
        const existingItemIndex = mergedItems.findIndex(
          ei =>
            ei.catalog_id === newItem.catalog_id &&
            JSON.stringify(ei.addons) === JSON.stringify(newItem.addons)
        );

        if (existingItemIndex >= 0) {
          mergedItems[existingItemIndex].quantity += newItem.quantity;
        } else {
          mergedItems.push(newItem);
        }
      });

      const updatedBill = {
        ...existingBill,
        body: {
          ...existingBill.body,
          ...request?.body,
          items: mergedItems,
        },
        updatedAt: now,
      };

      // Recalculate transaction_preview if it exists
      if (existingBill.transaction_preview) {
        const preview = existingBill.transaction_preview;

        // If the new request has a high-fidelity preview, use it
        const newPreview = request?.transaction_preview;

        const totalBill = mergedItems.reduce(
          (sum, item) => sum + Number(item.unit_price) * Number(item.quantity),
          0
        );
        const itemCount = mergedItems.reduce((sum, item) => sum + Number(item.quantity), 0);

        updatedBill.transaction_preview = {
          ...preview,
          ...newPreview,
          items: mergedItems,
          total_bill: totalBill,
          total_charges: totalBill,
          item_count: itemCount,
        };
      }

      await db.put(STORES.pendingRequests, updatedBill);
      return updatedBill;
    }
  }

  // If it's a checkout request, remove any matching pending save-bill
  const isCheckout =
    String(request?.url).toLowerCase().includes('/sales/order') &&
    request?.body?.status === 'completed' &&
    ticketName;

  if (isCheckout && ticketName) {
    const allItems = await db.getAll(STORES.pendingRequests);
    const pendingBills = allItems.filter(
      item =>
        String(item?.url).toLowerCase().includes('/sales/order') &&
        item?.body?.status === 'pending' &&
        (item?.body?.ticket === ticketName || item?.body?.bill_name === ticketName)
    );
    for (const bill of pendingBills) {
      await db.delete(STORES.pendingRequests, bill.id);
    }
  }

  const item = {
    id: request?.id || uuidv4(),
    url: request?.url || '',
    method: request?.method || 'POST',
    body: request?.body ?? null,
    params: request?.params ?? null,
    headers: request?.headers || {},
    token: request?.token || null,
    type: request?.type || 'mutation',
    status: request?.status || 'pending',
    retryCount: request?.retryCount || 0,
    lastError: request?.lastError || null,
    transaction_preview: request?.transaction_preview ?? null,
    createdAt: request?.createdAt || now,
    updatedAt: now,
  };

  await db.put(STORES.pendingRequests, item);
  return item;
};

export const getQueue = async userId => {
  const db = await ensureDB(userId);
  const all = await db.getAll(STORES.pendingRequests);
  return sortFIFO(all);
};

export const getQueueByStatus = async (status, userId) => {
  const db = await ensureDB(userId);
  const all = await db.getAllFromIndex(STORES.pendingRequests, 'status', status);
  return sortFIFO(all);
};

export const getQueueItem = async (id, userId) => {
  const db = await ensureDB(userId);
  return db.get(STORES.pendingRequests, id);
};

export const updateQueueItem = async (id, updates = {}, userId) => {
  const db = await ensureDB(userId);
  const existing = await db.get(STORES.pendingRequests, id);
  if (!existing) return null;

  const next = {
    ...existing,
    ...updates,
    updatedAt: getNow(),
  };

  await db.put(STORES.pendingRequests, next);
  return next;
};

export const removeFromQueue = async (id, userId) => {
  const db = await ensureDB(userId);
  await db.delete(STORES.pendingRequests, id);

  // Also remove matching entry from history cache (offline checkout entries)
  try {
    const { getCache, setCache } = await import('../../utils/cache');
    const HISTORY_CACHE_KEY = 'cache_order_history';
    const existing = getCache(HISTORY_CACHE_KEY) || [];
    const filtered = existing.filter(e => {
      const entryQueueId = e?.offline_meta?.queue_id || e?.id;
      return String(entryQueueId) !== String(id);
    });
    if (filtered.length !== existing.length) {
      setCache(HISTORY_CACHE_KEY, filtered);
    }
  } catch {
    // fail silently
  }

  return true;
};

export const clearQueue = async userId => {
  const db = await ensureDB(userId);
  await db.clear(STORES.pendingRequests);
  return true;
};

const METADATA_KEYS = {
  lastSyncTime: 'lastSyncTime',
  syncAttempt: 'syncAttempt',
};

export const getPendingCount = async userId => {
  const pending = await getQueueByStatus('pending', userId);
  return pending.length;
};

export const setLastSyncTime = async (timestamp, userId) => {
  const db = await ensureDB(userId);
  await db.put(STORES.metadata, {
    key: METADATA_KEYS.lastSyncTime,
    value: timestamp,
    updatedAt: getNow(),
  });
  return true;
};

export const getLastSyncTime = async userId => {
  const db = await ensureDB(userId);
  const data = await db.get(STORES.metadata, METADATA_KEYS.lastSyncTime);
  return data?.value ?? null;
};

export const incrementSyncAttempt = async userId => {
  const db = await ensureDB(userId);
  const item = await db.get(STORES.metadata, METADATA_KEYS.syncAttempt);
  const current = item?.value || 0;
  const next = current + 1;

  await db.put(STORES.metadata, {
    key: METADATA_KEYS.syncAttempt,
    value: next,
    updatedAt: getNow(),
  });

  return next;
};

export const resetMetadata = async userId => {
  const db = await ensureDB(userId);
  await db.clear(STORES.metadata);
  return true;
};

export const getAllMetadata = async userId => {
  const db = await ensureDB(userId);
  return db.getAll(STORES.metadata);
};

// --- Legacy migration helpers ---

export const getLegacyQueue = async () => {
  let db;
  try {
    db = await openDB('pos-offline-queue', 1);
  } catch {
    return [];
  }
  const all = await db.getAll('pendingRequests');
  db.close();
  return all;
};

export const migrateLegacyQueue = async userId => {
  const legacy = await getLegacyQueue();
  if (legacy.length === 0) return { migrated: 0 };

  let written = 0;
  const skipped = [];

  for (const item of legacy) {
    try {
      await addToQueue(item, userId);
      written++;
    } catch {
      skipped.push(item.id);
    }
  }

  // Only delete legacy if all items were written successfully
  if (skipped.length === 0) {
    try {
      const legacyDb = await openDB('pos-offline-queue', 1);
      legacyDb.close();
      await deleteDB('pos-offline-queue');
    } catch {
      // Legacy DB may not exist, ignore
    }
  }

  return { migrated: written, skipped: skipped.length };
};
