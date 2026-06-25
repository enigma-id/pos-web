import { openDB } from 'idb';
import { v4 as uuidv4 } from 'uuid';

const DB_NAME = 'pos-offline-queue';
const DB_VERSION = 1;

const STORES = {
  pendingRequests: 'pendingRequests',
  idempotencyKeys: 'idempotencyKeys',
  metadata: 'metadata',
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

let dbPromise = null;

const getNow = () => Date.now();

const ensureDB = () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORES.pendingRequests)) {
          const store = db.createObjectStore(STORES.pendingRequests, { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.idempotencyKeys)) {
          const idem = db.createObjectStore(STORES.idempotencyKeys, { keyPath: 'key' });
          idem.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.metadata)) {
          db.createObjectStore(STORES.metadata, { keyPath: 'key' });
        }
      },
    });
  }

  return dbPromise;
};

const sortFIFO = items => {
  return [...items].sort((a, b) => {
    const aTime = a?.createdAt || 0;
    const bTime = b?.createdAt || 0;
    return aTime - bTime;
  });
};

export const generateIdempotencyKey = () => uuidv4();

export const initQueueDB = async () => {
  await ensureDB();
  return true;
};

export const addToQueue = async request => {
  const db = await ensureDB();
  const now = getNow();

  // If it's an open-bill request, check if a bill with the same ticket already exists in the queue
  const isSaveBill =
    String(request?.url).toLowerCase().includes('/sales/order') &&
    request?.body?.status === 'pending';
  const ticketName = request?.body?.ticket;

  if (isSaveBill && ticketName) {
    const allItems = await db.getAll(STORES.pendingRequests);
    const existingBill = allItems.find(
      item => String(item?.url).endsWith('open-bill') && item?.body?.ticket === ticketName
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

  const item = {
    id: request?.id || uuidv4(),
    idempotencyKey: request?.idempotencyKey || generateIdempotencyKey(),
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

export const getQueue = async () => {
  const db = await ensureDB();
  const all = await db.getAll(STORES.pendingRequests);
  return sortFIFO(all);
};

export const getQueueByStatus = async status => {
  const db = await ensureDB();
  const all = await db.getAllFromIndex(STORES.pendingRequests, 'status', status);
  return sortFIFO(all);
};

export const getQueueItem = async id => {
  const db = await ensureDB();
  return db.get(STORES.pendingRequests, id);
};

export const updateQueueItem = async (id, updates = {}) => {
  const db = await ensureDB();
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

export const removeFromQueue = async id => {
  const db = await ensureDB();
  await db.delete(STORES.pendingRequests, id);
  return true;
};

export const clearQueue = async () => {
  const db = await ensureDB();
  await db.clear(STORES.pendingRequests);
  return true;
};

export const hasIdempotentKey = async key => {
  if (!key) return false;
  const db = await ensureDB();
  const found = await db.get(STORES.idempotencyKeys, key);
  return !!found;
};

export const setIdempotentKey = async key => {
  if (!key) return false;
  const db = await ensureDB();
  await db.put(STORES.idempotencyKeys, {
    key,
    createdAt: getNow(),
  });
  return true;
};

export const cleanupExpiredIdempotencyKeys = async () => {
  const db = await ensureDB();
  const all = await db.getAll(STORES.idempotencyKeys);
  const threshold = getNow() - ONE_DAY_MS;

  const expired = all.filter(item => (item?.createdAt || 0) < threshold);
  await Promise.all(expired.map(item => db.delete(STORES.idempotencyKeys, item.key)));

  return expired.length;
};

export const checkAndSetIdempotency = async key => {
  if (!key) return { exists: false, set: false };

  await cleanupExpiredIdempotencyKeys();

  const exists = await hasIdempotentKey(key);
  if (exists) {
    return { exists: true, set: false };
  }

  await setIdempotentKey(key);
  return { exists: false, set: true };
};

const METADATA_KEYS = {
  lastSyncTime: 'lastSyncTime',
  syncAttempt: 'syncAttempt',
};

export const getPendingCount = async () => {
  const pending = await getQueueByStatus('pending');
  return pending.length;
};

export const setLastSyncTime = async timestamp => {
  const db = await ensureDB();
  await db.put(STORES.metadata, {
    key: METADATA_KEYS.lastSyncTime,
    value: timestamp,
    updatedAt: getNow(),
  });
  return true;
};

export const getLastSyncTime = async () => {
  const db = await ensureDB();
  const data = await db.get(STORES.metadata, METADATA_KEYS.lastSyncTime);
  return data?.value ?? null;
};

export const incrementSyncAttempt = async () => {
  const db = await ensureDB();
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

export const resetMetadata = async () => {
  const db = await ensureDB();
  await db.clear(STORES.metadata);
  return true;
};

export const getAllMetadata = async () => {
  const db = await ensureDB();
  return db.getAll(STORES.metadata);
};

export const QUEUE_STORES = STORES;
