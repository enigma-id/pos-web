import { openDB, deleteDB } from 'idb';
import { v4 as uuidv4 } from 'uuid';

const DB_VERSION = 3;

export const STORES = {
  offlineSessions: 'offlineSessions',
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
      upgrade(db, oldVersion) {
        if (db.objectStoreNames.contains('pendingRequests')) {
          db.deleteObjectStore('pendingRequests');
        }

        if (!db.objectStoreNames.contains(STORES.offlineSessions)) {
          const store = db.createObjectStore(STORES.offlineSessions, { keyPath: 'sync_id' });
          store.createIndex('syncStatus', 'syncStatus', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
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
    // Verify db is still open — closing connection gives undefined name
    if (db.name) return db;
  } catch {
    // Connection was closed (StrictMode remount race), reopen
    dbInstances.delete(key);
  }

  // Retry once
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

// ========== CREATE ==========

/**
 * Buat session offline baru.
 * Sync status: "pending"
 */
export const createOfflineSession = async ({ cash_started, latitude, longitude, battery_health }, userId) => {
  const db = await ensureDB(userId);
  const sync_id = uuidv4();
  const now = getISO();

  const doc = {
    sync_id,
    referenceId: null,
    session: {
      open_at: now,
      cash_started,
      close_at: null,
      cash_finished: null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      battery_health: battery_health ?? null,
    },
    orders: [],
    topups: [],
    memberships: [],
    syncStatus: 'pending',
    error: null,
    createdAt: now,
  };

  await db.add(STORES.offlineSessions, doc);
  return doc;
};

// ========== READ ==========

/**
 * Ambil session yg masih aktif (syncStatus = "pending" DAN session.close_at == null).
 */
export const getActiveSession = async userId => {
  const db = await ensureDB(userId);
  const all = await db.getAll(STORES.offlineSessions);
  return all.find(s => s.syncStatus === 'pending' && !s.session.close_at) || null;
};

/**
 * Dapetin session buat operasi offline.
 * - Kalo ada offline session aktif → pake itu.
 * - Kalo ada server session ID (authSession.sales_session.id) → auto-create offline session dgn referenceId.
 * - Kalo gak ada → return null.
 */
export const getOrCreateOfflineSession = async (userId, authSession) => {
  // 1. Cari offline session aktif
  const active = await getActiveSession(userId);
  if (active) return active;

  // 2. Cek server session ID — start online, sekarang offline
  const serverId = authSession?.sales_session?.id;
  if (serverId) {
    // Cek apa udah ada offline session dgn referenceId ini
    const db = await ensureDB(userId);
    const all = await db.getAll(STORES.offlineSessions);
    const existing = all.find(s => s.referenceId === serverId && !s.session.close_at);
    if (existing) return existing;

    // Buat baru
    const sync_id = uuidv4();
    const now = getISO();
    const doc = {
      sync_id,
      referenceId: serverId,
      session: {
        open_at: now,
        cash_started: 0,
        close_at: null,
        cash_finished: null,
      },
      orders: [],
      topups: [],
      memberships: [],
      syncStatus: 'synced', // referenced to server session — no need to sync
      error: null,
      createdAt: now,
    };

    await db.add(STORES.offlineSessions, doc);
    return doc;
  }

  return null;
};

/**
 * Ambil semua session yg belum di-sync (pending, syncing, failed).
 */
export const getPendingSessions = async userId => {
  const db = await ensureDB(userId);
  const all = await db.getAll(STORES.offlineSessions);
  return all.filter(s => s.syncStatus !== 'synced');
};

/**
 * Ambil semua session.
 * Sorted by createdAt DESC.
 */
export const getAllSessions = async userId => {
  const db = await ensureDB(userId);
  const all = await db.getAll(STORES.offlineSessions);
  return all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
};

/**
 * Resolve active session ID dari berbagai source.
 * Flow:
 *   1. Cek authSession?.sales_session?.id          → server ID (online)
 *   2. Cek offline_sessions.referenceId            → server ID (udah sync)
 *   3. Cek offline_sessions.sync_id (yg masih open) → client UUID
 */
export const getActiveSessionId = async (authSession, userId) => {
  // Cari offline session yg masih open dulu (lebih fresh)
  if (userId) {
    const all = await getAllSessions(userId);
    const offlineActive = all.find(s => s.syncStatus === 'pending' && !s.session.close_at);
    if (offlineActive) {
      return { id: offlineActive.sync_id, source: 'sync_id' };
    }
  }

  // 1. Server session ID dari auth (pas online) — fallback
  const serverId = authSession?.sales_session?.id;
  if (serverId) {
    return { id: serverId, source: 'server' };
  }

  if (!userId) return null;

  const allS = await getAllSessions(userId);

  // 2. Cari yg punya referenceId (udah pernah sync, masih open)
  const byReference = allS.find(s => s.referenceId && s.syncStatus === 'synced' && !s.session.close_at);
  if (byReference) {
    return { id: byReference.referenceId, source: 'reference' };
  }

  return null;
};

// ========== UPDATE ==========

/**
 * Update session close info.
 */
export const updateSessionClose = async (syncId, { cash_finished, latitude, longitude, battery_health }, userId) => {
  const db = await ensureDB(userId);
  const existing = await db.get(STORES.offlineSessions, syncId);
  if (!existing) throw new Error(`Session not found: ${syncId}`);

  existing.session.close_at = getISO();
  existing.session.cash_finished = cash_finished ?? null;
  if (latitude != null) existing.session.latitude = latitude;
  if (longitude != null) existing.session.longitude = longitude;
  if (battery_health != null) existing.session.battery_health = battery_health;

  await db.put(STORES.offlineSessions, existing);
  return existing;
};

/**
 * Set sync status + error.
 */
export const setSyncStatus = async (syncId, status, { error, userId } = {}) => {
  const db = await ensureDB(userId);
  const existing = await db.get(STORES.offlineSessions, syncId);
  if (!existing) throw new Error(`Session not found: ${syncId}`);

  existing.syncStatus = status;
  if (error) existing.error = error;
  else existing.error = null;

  await db.put(STORES.offlineSessions, existing);
  return existing;
};

/**
 * Simpan hasil sync sukses.
 * referenceId = server session.id
 * orderMap = { localSyncId: serverOrderId, ... }
 */
export const updateSyncResult = async (syncId, { referenceId, orderMap }, userId) => {
  const db = await ensureDB(userId);
  const existing = await db.get(STORES.offlineSessions, syncId);
  if (!existing) throw new Error(`Session not found: ${syncId}`);

  existing.referenceId = referenceId ?? existing.referenceId;
  existing.syncStatus = 'synced';

  // Map order sync_ids ke server IDs
  if (orderMap) {
    existing.orders = (existing.orders || []).map(o => ({
      ...o,
      serverId: orderMap[o.sync_id] || o.serverId || null,
    }));
  }

  await db.put(STORES.offlineSessions, existing);
  return existing;
};

// ========== DELETE ==========

/**
 * Hapus session dari IndexedDB.
 * Dipake pas sync sukses full.
 */
export const deleteOfflineSession = async (syncId, userId) => {
  const db = await ensureDB(userId);
  await db.delete(STORES.offlineSessions, syncId);
  return true;
};

// ========== METADATA (Retain) ==========

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

// ========== ORDER OPERATIONS ==========

/**
 * Append order ke session.orders[].
 * Otomatis set session syncStatus ke 'pending' kalo sebelumnya 'synced'.
 * Order shape:
 * {
 *   sync_id: "uuid",
 *   sessionSyncId: "sync_id",
 *   salesChannelId: "...",
 *   paymentMethodId: 0,
 *   membershipId: null,
 *   paymentRef: "",
 *   billName: "",
 *   discountPercentage: 0,
 *   discountValue: 0,
 *   categoryDiscounts: [],
 *   items: [{ catalog_id, catalog_name, quantity, unit_price, addons }],
 *   status: "pending" | "completed",
 *   totalPayment: 0,
 *   paidAt: "ISO",
 *   isOfflineMode: true,
 *   refSyncId: ""
 * }
 */
export const appendOrderToSession = async (syncId, order, userId) => {
  const db = await ensureDB(userId);
  const existing = await db.get(STORES.offlineSessions, syncId);
  if (!existing) throw new Error(`Session not found: ${syncId}`);

  if (!Array.isArray(existing.orders)) {
    existing.orders = [];
  }

  existing.orders.push(order);

  // Consistent rule: session yg ada pending data → syncStatus = 'pending'
  if (existing.syncStatus === 'synced') {
    existing.syncStatus = 'pending';
  }

  await db.put(STORES.offlineSessions, existing);
  return existing;
};

/**
 * Hapus order dari session blob berdasarkan orderSyncId.
 * Dipake sebelum re-create order pas confirm save bill offline.
 */
export const removeOrderFromSession = async (syncId, orderSyncId, userId) => {
  const db = await ensureDB(userId);
  const existing = await db.get(STORES.offlineSessions, syncId);
  if (!existing) throw new Error(`Session not found: ${syncId}`);

  existing.orders = (existing.orders || []).filter(o => o.sync_id !== orderSyncId);

  if (existing.syncStatus === 'synced') {
    existing.syncStatus = 'pending';
  }

  await db.put(STORES.offlineSessions, existing);
  return existing;
};

/**
 * Update semua field order existing di session blob.
 * Dipake pas confirm save bill offline — update items, discounts, dll tanpa ganti sync_id.
 */
export const updateOrderInSession = async (syncId, orderSyncId, orderData, userId) => {
  const db = await ensureDB(userId);
  const existing = await db.get(STORES.offlineSessions, syncId);
  if (!existing) throw new Error(`Session not found: ${syncId}`);

  const idx = (existing.orders || []).findIndex(o => o.sync_id === orderSyncId);
  if (idx === -1) throw new Error(`Order not found in session: ${orderSyncId}`);

  // Retain sync_id, ganti sisanya
  existing.orders[idx] = { ...existing.orders[idx], ...orderData, sync_id: orderSyncId };

  if (existing.syncStatus === 'synced') {
    existing.syncStatus = 'pending';
  }

  await db.put(STORES.offlineSessions, existing);
  return existing;
};

/**
 * Update billName dari order yang sudah ada di session blob.
 * Dipake offline update bill name (sebelum sync).
 */
export const updateOrderBillName = async (syncId, orderSyncId, billName, userId) => {
  const db = await ensureDB(userId);
  const existing = await db.get(STORES.offlineSessions, syncId);
  if (!existing) throw new Error(`Session not found: ${syncId}`);

  const order = (existing.orders || []).find(o => o.sync_id === orderSyncId);
  if (!order) throw new Error(`Order not found in session: ${orderSyncId}`);

  order.billName = billName;

  if (existing.syncStatus === 'synced') {
    existing.syncStatus = 'pending';
  }

  await db.put(STORES.offlineSessions, existing);
  return existing;
};

// ========== TOPUP OPERATIONS ==========

/**
 * Append topup ke session.topups[].
 * Otomatis set session syncStatus ke 'pending' kalo sebelumnya 'synced'.
 */
export const appendTopupToSession = async (syncId, topup, userId) => {
  const db = await ensureDB(userId);
  const existing = await db.get(STORES.offlineSessions, syncId);
  if (!existing) throw new Error(`Session not found: ${syncId}`);

  if (!Array.isArray(existing.topups)) {
    existing.topups = [];
  }

  existing.topups.push(topup);

  if (existing.syncStatus === 'synced') {
    existing.syncStatus = 'pending';
  }

  await db.put(STORES.offlineSessions, existing);
  return existing;
};

// ========== MEMBERSHIP OPERATIONS ==========

/**
 * Append membership ke session.memberships[].
 * Otomatis set session syncStatus ke 'pending' kalo sebelumnya 'synced'.
 */
export const appendMembershipToSession = async (syncId, membership, userId) => {
  const db = await ensureDB(userId);
  const existing = await db.get(STORES.offlineSessions, syncId);
  if (!existing) throw new Error(`Session not found: ${syncId}`);

  if (!Array.isArray(existing.memberships)) {
    existing.memberships = [];
  }

  existing.memberships.push(membership);

  if (existing.syncStatus === 'synced') {
    existing.syncStatus = 'pending';
  }

  await db.put(STORES.offlineSessions, existing);
  return existing;
};

/**
 * Update membership in-place di session.memberships[].
 * Cari oleh card_id, kalo ketemu merge data baru.
 * Kalo ga ketemu, append aja.
 * Otomatis set session syncStatus ke 'pending' kalo sebelumnya 'synced'.
 */
export const updateMembershipInSession = async (syncId, cardId, updates, userId) => {
  const db = await ensureDB(userId);
  const existing = await db.get(STORES.offlineSessions, syncId);
  if (!existing) throw new Error(`Session not found: ${syncId}`);

  if (!Array.isArray(existing.memberships)) {
    existing.memberships = [];
    existing.memberships.push({ card_id: cardId, ...updates });
  } else {
    const idx = existing.memberships.findIndex(m => m.card_id === cardId);
    if (idx >= 0) {
      existing.memberships[idx] = { ...existing.memberships[idx], ...updates };
    } else {
      existing.memberships.push({ card_id: cardId, ...updates });
    }
  }

  if (existing.syncStatus === 'synced') {
    existing.syncStatus = 'pending';
  }

  await db.put(STORES.offlineSessions, existing);
  return existing;
};

// ========== PENDING COUNT HELPER ==========

/**
 * Hitung total item yg perlu sync/action:
 * - semua orders (pending/completed) — semua perlu sync ke server
 * - topups
 * - session itu sendiri (open/close) kalo status pending/syncing/failed & gak punya item
 */
export const getOfflinePendingCount = async userId => {
  const sessions = await getAllSessions(userId);
  return sessions.reduce((sum, s) => {
    if (s.syncStatus === 'synced') return sum;
    const itemCount = (s.orders || []).length // semua offline orders perlu sync
      + (s.topups || []).length
      + (s.memberships || []).length;
    return sum + (itemCount > 0 ? itemCount : 1);
  }, 0);
};
