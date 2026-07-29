import { openDB, deleteDB } from 'idb';
import { v4 as uuidv4 } from 'uuid';

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

export const createOfflineSession = async ({ cash_started, latitude, longitude, battery_health }, userId) => {
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

export const createOrderBill = async (data, userId) => {
  const db = await ensureDB(userId);
  const sync_id = data.sync_id || uuidv4();
  const now = getISO();

  const doc = {
    sync_id,
    origin_session_sync_id: data.origin_session_sync_id || null,
    sales_channel_id: data.sales_channel_id || null,
    sales_channel_name: data.sales_channel_name || null,
    payment_method_id: data.payment_method_id || null,
    membership_id: data.membership_id || null,
    payment_ref: data.payment_ref || '',
    bill_name: data.bill_name || '',
    cashier_name: data.cashier_name || '',
    service_charge_value: data.service_charge_value || 0,
    service_charge_percentage: data.service_charge_percentage || 0,
    discount_percentage: data.discount_percentage || 0,
    discount_value: data.discount_value || 0,
    category_discounts: data.category_discounts || [],
    items: data.items || [],
    code: data.code || '',
    status: data.status || 'pending',
    total_payment: data.total_payment || 0,
    paid_at: data.paid_at || null,
    is_offline_mode: true,
    is_synced: false,
    ref_sync_id: data.ref_sync_id || '',
    origin_session_sync_id: data.origin_session_sync_id || '',
    paid_session_sync_id: data.paid_session_sync_id || null,
    is_show: data.is_show !== false,
    original_items: data.original_items || [],
    createdAt: now,
  };

  await db.add(STORES.orderBills, doc);
  return doc;
};

export const updateOrderBill = async (idOrSyncId, data, userId) => {
  const db = await ensureDB(userId);
  // Cari by sync_id dulu, kalo gak ketemu coba by id (server ID)
  let existing = await db.get(STORES.orderBills, idOrSyncId);
  if (!existing) {
    const all = await db.getAll(STORES.orderBills);
    existing = all.find(b => b.id === idOrSyncId);
  }
  if (!existing) {
    // Bill dari server — belum ada di IndexedDB, insert sebagai data baru
    const doc = {
      id: idOrSyncId,
      bill_name: data.bill_name || '',
      items: data.items || [],
      code: data.code || '',
      status: 'completed',
      is_offline_mode: true,
      is_synced: true,
      createdAt: new Date().toISOString(),
    };
    await db.add(STORES.orderBills, doc);
    return doc;
  }

  // Merge update
  const updated = { ...existing, ...data, sync_id: existing.sync_id };
  await db.put(STORES.orderBills, updated);
  return updated;
};

export const deleteOrderBill = async (syncId, userId) => {
  const db = await ensureDB(userId);
  await db.delete(STORES.orderBills, syncId);
  return true;
};

// ========== ORDER PAYMENTS ==========

export const createOrderPayment = async (data, userId) => {
  const db = await ensureDB(userId);
  const sync_id = data.sync_id || uuidv4();
  const now = getISO();

  const doc = {
    sync_id,
    origin_session_sync_id: data.origin_session_sync_id || null,
    paid_session_sync_id: data.paid_session_sync_id || null,
    sales_channel_id: data.sales_channel_id || null,
    sales_channel_name: data.sales_channel_name || null,
    payment_method_id: data.payment_method_id || null,
    payment_method_name: data.payment_method_name || null,
    membership_id: data.membership_id || null,
    payment_ref: data.payment_ref || '',
    bill_name: data.bill_name || '',
    cashier_name: data.cashier_name || '',
    service_charge_value: data.service_charge_value || 0,
    service_charge_percentage: data.service_charge_percentage || 0,
    discount_percentage: data.discount_percentage || 0,
    discount_value: data.discount_value || 0,
    category_discounts: data.category_discounts || [],
    items: data.items || [],
    code: data.code || '',
    status: 'completed',
    total_payment: data.total_payment || 0,
    paid_at: data.paid_at || now,
    is_offline_mode: true,
    is_synced: false,
    ref_sync_id: data.ref_sync_id || '',
    origin_session_sync_id: data.origin_session_sync_id || '',
    paid_session_sync_id: data.paid_session_sync_id || '',
    is_show: data.is_show !== false,
    original_items: data.original_items || [],
    createdAt: now,
  };

  await db.add(STORES.orderPayments, doc);
  return doc;
};

export const updateOrderPayment = async (syncId, data, userId) => {
  const db = await ensureDB(userId);
  const existing = await db.get(STORES.orderPayments, syncId);
  if (!existing) throw new Error(`OrderPayment not found: ${syncId}`);

  const updated = { ...existing, ...data, sync_id: syncId };
  await db.put(STORES.orderPayments, updated);
  return updated;
};

export const deleteOrderPayment = async (syncId, userId) => {
  const db = await ensureDB(userId);
  await db.delete(STORES.orderPayments, syncId);
  return true;
};

// ========== TOPUPS ==========

export const createTopup = async (data, userId) => {
  const db = await ensureDB(userId);
  const sync_id = data.sync_id || uuidv4();
  const now = getISO();

  const doc = {
    sync_id,
    session_sync_id: data.session_sync_id || data.sessionSyncId || null,
    membership_id: data.membership_id || data.membershipId || null,
    membership_sync_id: data.membership_sync_id || data.membershipSyncId || null,
    nominal: data.nominal || 0,
    payment_type: data.payment_type || data.paymentType || 'cash',
    card_id: data.card_id || data.cardId || '',
    member_name: data.member_name || data.memberName || '',
    member_code: data.member_code || data.memberCode || '',
    created_at: data.created_at || data.createdAt || now,
  };

  await db.add(STORES.topups, doc);
  return doc;
};

// ========== MEMBERSHIPS ==========

export const createMembership = async (data, userId) => {
  const db = await ensureDB(userId);
  const sync_id = data.sync_id || uuidv4();

  const doc = {
    sync_id,
    card_id: data.card_id || data.cardId || '',
    name: data.name || '',
    reff_code: data.reff_code || data.reffCode || '',
  };

  await db.add(STORES.memberships, doc);
  return doc;
};

export const updateMembership = async (cardId, data, userId) => {
  const db = await ensureDB(userId);

  // Cari by card_id
  const all = await db.getAll(STORES.memberships);
  const existing = all.find(m => m.card_id === cardId);
  if (!existing) throw new Error(`Membership not found for card: ${cardId}`);

  const updated = { ...existing, ...data, card_id: cardId };
  await db.put(STORES.memberships, updated);
  return updated;
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
