import { openDB, deleteDB } from 'idb';
import { v4 as uuidv4 } from 'uuid';
import { recalculateDiscountCategory } from './helper';

const DB_VERSION = 5;

export const STORES = {
  sessions: 'sessions',
  orderBills: 'order_bills',
  orderPayments: 'order_payments',
  topups: 'topups',
  memberships: 'memberships',
  metadata: 'metadata',
};

const dbInstances = new Map();

const getNow = () => Date.now();
const getISO = () => new Date().toISOString();

const getDBName = userId => `pos-offline-queue-${userId}`;

export const ensureDB = async userId => {
  if (!userId) throw new Error('userId required for queue DB');
  const key = String(userId);

  const open = async () => {
    const db = await openDB(getDBName(userId), DB_VERSION, {
      upgrade(db, oldVersion, newVersion) {
        // Hapus semua store lama dari v3
        if (db.objectStoreNames.contains('offlineSessions')) {
          db.deleteObjectStore('offlineSessions');
        }
        if (db.objectStoreNames.contains('pendingRequests')) {
          db.deleteObjectStore('pendingRequests');
        }
        if (db.objectStoreNames.contains('offlineRequests')) {
          db.deleteObjectStore('offlineRequests');
        }

        // Bikin store baru
        if (!db.objectStoreNames.contains(STORES.sessions)) {
          const store = db.createObjectStore(STORES.sessions, { keyPath: 'sync_id' });
          store.createIndex('syncStatus', 'syncStatus', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.orderBills)) {
          const store = db.createObjectStore(STORES.orderBills, { keyPath: 'sync_id' });
          store.createIndex('origin_session_sync_id', 'origin_session_sync_id', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.orderPayments)) {
          const store = db.createObjectStore(STORES.orderPayments, { keyPath: 'sync_id' });
          store.createIndex('origin_session_sync_id', 'origin_session_sync_id', { unique: false });
          store.createIndex('paid_session_sync_id', 'paid_session_sync_id', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.topups)) {
          const store = db.createObjectStore(STORES.topups, { keyPath: 'sync_id' });
          store.createIndex('session_sync_id', 'session_sync_id', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.memberships)) {
          db.createObjectStore(STORES.memberships, { keyPath: 'sync_id' });
        }

        if (!db.objectStoreNames.contains(STORES.metadata)) {
          db.createObjectStore(STORES.metadata, { keyPath: 'key' });
        }
      },
    });
    return db;
  };

  if (!dbInstances.has(key)) {
    dbInstances.set(key, open());
  }

  try {
    const db = await dbInstances.get(key);
    if (db.name) return db;
  } catch {
    dbInstances.delete(key);
  }

  const reopened = open();
  dbInstances.set(key, reopened);
  return reopened;
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

// ========== SESSIONS ==========

export const createOfflineSession = async (
  { cash_started, latitude, longitude, battery_health },
  userId
) => {
  const db = await ensureDB(userId);
  const sync_id = uuidv4();
  const now = getISO();

  const doc = {
    sync_id,
    id: null,
    open_at: now,
    close_at: null,
    cash_started: cash_started ?? 0,
    cash_finished: null,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    battery_health: battery_health ?? null,
    syncStatus: 'pending',
    error: null,
    createdAt: now,
  };

  await db.add(STORES.sessions, doc);
  return doc;
};

export const closeSession = async (syncId, { cash_finished, latitude, longitude }, userId) => {
  const db = await ensureDB(userId);
  const existing = await db.get(STORES.sessions, syncId);
  if (!existing) throw new Error(`Session not found: ${syncId}`);

  existing.close_at = getISO();
  existing.cash_finished = cash_finished ?? null;
  if (latitude != null) existing.latitude = latitude;
  if (longitude != null) existing.longitude = longitude;
  existing.syncStatus = 'pending';

  await db.put(STORES.sessions, existing);
  return existing;
};

export const deleteOfflineSession = async (syncId, userId) => {
  const db = await ensureDB(userId);

  // Cascade: hapus order_bills, order_payments, topups yg terkait
  let bills = await db.getAllFromIndex(STORES.orderBills, 'origin_session_sync_id', syncId);
  for (const b of bills) await db.delete(STORES.orderBills, b.sync_id);

  let payments = await db.getAllFromIndex(STORES.orderPayments, 'paid_session_sync_id', syncId);
  for (const p of payments) await db.delete(STORES.orderPayments, p.sync_id);

  let topups = await db.getAllFromIndex(STORES.topups, 'session_sync_id', syncId);
  for (const t of topups) await db.delete(STORES.topups, t.sync_id);

  await db.delete(STORES.sessions, syncId);
  return true;
};

// ========== ORDER BILLS ==========

// payload ini sudah data sync untuk online bro
export const createOrderBill = async (payload, userId) => {
  const db = await ensureDB(userId);

  // origin_session_sync_id ini kenapa menggunakan or seperti ini, karena jika session summary/session payload dari online dia tidak mempunyai sync_id (sync_id adalah new id uuid dari client)
  const origin_session_sync_id = payload?.session?.id || payload?.session?.sync_id;

  const doc = {
    ...payload,
    origin_session_sync_id: origin_session_sync_id,
  };

  await db.add(STORES.orderBills, doc);
  return doc;
};

export const updateOrderBill = async (payload, userId) => {
  const db = await ensureDB(userId);

  // cari index untuk update saat create dari offline juga
  let existing = payload?.sync_id ? await db.get(STORES.orderBills, payload?.sync_id) : null;

  // jika esxsting sync_id gaada berarti ini updateo order bill dari online bro
  if (!existing) {
    existing = await db.get(STORES.orderBills, payload?.id);
    payload.sync_id = payload?.id;
  }

  if (!existing) {
    // Bill dari server — insert sebagai referensi
    const doc = {
      ...payload,
      is_synced: false,
      // ini data dari session bill server bro
      origin_session_sync_id: payload?.session?.id,
      // sync_id ini tidak perlu nanti dikirim ke api ya bro - karena ini dari update server
      sync_id: payload?.id,
    };

    await db.add(STORES.orderBills, doc);
    return doc;
  }

  await db.put(STORES.orderBills, {
    ...existing,
    ...data,
  });

  return data;
};

export const deleteOrderBill = async (syncId, userId) => {
  const db = await ensureDB(userId);
  await db.delete(STORES.orderBills, syncId);
  return true;
};

// ========== ORDER PAYMENTS ==========

export const createOrderPayment = async (payload, userId) => {
  const db = await ensureDB(userId);

  // paid_session_sync_id ini kenapa menggunakan or seperti ini, karena jika session summary/session payload dari online dia tidak mempunyai sync_id (sync_id adalah new id uuid dari client)
  const paid_session_sync_id = payload?.session?.id || payload?.session?.sync_id;

  const doc = {
    ...payload,
    paid_session_sync_id: paid_session_sync_id,
  };

  await db.add(STORES.orderPayments, doc);
  return doc;
};

// ========== TOPUPS ==========

export const createTopup = async (payload, userId) => {
  const db = await ensureDB(userId);
  const sync_id = data.sync_id || uuidv4();
  const now = getISO();

  // origin_session_sync_id ini kenapa menggunakan or seperti ini, karena jika session summary/session payload dari online dia tidak mempunyai sync_id (sync_id adalah new id uuid dari client)
  const session_sync_id = payload?.session?.id || payload?.session?.sync_id;

  const doc = {
    ...payload,
    session_sync_id: session_sync_id,
  };

  await db.add(STORES.topups, doc);
  return doc;
};

// ========== MEMBERSHIPS ==========

export const createMembership = async (payload, userId) => {
  const db = await ensureDB(userId);

  const doc = {
    ...payload,
  };

  await db.add(STORES.memberships, doc);
  return doc;
};

export const updateMembership = async (payload, userId) => {
  const db = await ensureDB(userId);

  // cari index untuk update saat create dari offline juga
  let existing = await db.get(STORES.orderBills, payload?.card_id);

  if (!existing) {
    // membership dari server — insert sebagai referensi
    const doc = {
      ...payload,
    };

    await db.add(STORES.orderBills, doc);
    return doc;
  }

  await db.put(STORES.orderBills, {
    ...existing,
    ...data,
  });

  return data;
};

// ========== METADATA ==========

const METADATA_KEYS = {
  lastSyncTime: 'lastSyncTime',
  syncAttempt: 'syncAttempt',
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
