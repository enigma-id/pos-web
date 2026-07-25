# Phase 1: Session Lifecycle — Open, Close, Summary, List Shift

## Goal

Core session blob infrastructure + session CRUD offline. User bisa:

1. **Buka session** saat offline → tersimpan di IndexedDB sebagai `offlineSessions` blob
2. **Tutup session** saat offline → update close_at + cash_finished
3. **Lihat summary** session dari local data (tanpa server)
4. **Lihat daftar shifts** (session history) dari server, dengan fallback offline
5. **Sync session** ke server saat koneksi kembali

---

## Files Changed (Phase 1)

| # | File | Change |
|---|------|--------|
| 1 | `src/services/offline/queue.js` | **Major.** DB v2→v3. Hapus `pendingRequests`. Tambah `offlineSessions` store + 11 fungsi baru |
| 2 | `src/services/offline/slice.js` | State: `items[]` → `sessions[]`, tambah `activeSyncId`. Reducers baru |
| 3 | `src/services/offline/syncManager.js` | **Refactor.** `syncNow()` → `syncPendingSessions()`. Init-time rehydration. Hapus `processItem`, `sortPendingQueue`, `executeQueuedRequest` |
| 4 | `src/services/offline/index.js` | Update exports |
| 5 | `src/services/baseQuery.js` | **Simplify.** Hapus `queueOfflineMutation()`, `buildTransactionPreview()`, `__skipOfflineQueue`. Back to normal fetch interceptor |
| 6 | `src/services/sales/session/action.js` | Tambah mutation `POST /sales/sync` |
| 7 | `src/services/sales/session/slice.js` | Tambah state `activeSyncId` + reducers `setActiveSyncId`, `clearActiveSyncId`. Tambah state `offlineStartResult` untuk offline flow |
| 8 | `src/services/sales/session/hook.js` | **Refactor.** `start()` offline: create IndexedDB + dispatch offlineStartResult. `end()` offline: update close + local summary. `summary()` offline: baca dari blob + dispatch ke Redux |
| 9 | `src/pages/authorize/home/openSession.jsx` | Render dari Redux `offlineStartResult` untuk offline flow |
| 10 | `src/pages/authorize/home/closeSession.jsx` | Offline: summary dari Redux. Online: tetap panggil API summary + end mutation |
| 11 | `src/pages/authorize/shifts/index.jsx` | Offline fallback: list session dari IndexedDB `getAllSessions()`. Detail session dari local blob |
| 12 | `src/services/offline/slice.js` | **Tambah** `offlineSummary` state untuk holding offline summary |

---

## Arsitektur Gap & Fix

### Gap 1: `hook.js` — Offline Path Ga Bisa Pake Mutation Results

**Problem:** Skrg doc bilang `start()` offline → create IndexedDB → return success. Tapi `startMutation()` ga pernah dipanggil, jadi `startResult?.isSuccess` di UI (openSession.jsx) ga pernah `true`. UI tetap nunggu result yang gak pernah dateng.

**Fix — Approach: Redux offlineStartResult**

Hook offline start → dispatch `setOfflineStartResult({ sync_id, is_offline_session: true })` ke `salesSession` slice.

```js
// salesSession/slice.js — tambah
state.offlineStartResult = null | {
  sync_id: "uuid",
  is_offline_session: true,
  created_at: "ISO",
  cash_started: number,
};

// Reducers:
setOfflineStartResult(state, action)  // simpan result
clearOfflineStartResult(state)        // reset ke null
```

```js
// session/hook.js — start() offline:
start({ cash_started }) offline:
  ├─ createOfflineSession({...}, userId)
  ├─ dispatch(checkSession())
  ├─ dispatch(setActiveSyncId(sync_id))
  ├─ dispatch(setOfflineStartResult({ sync_id, is_offline_session: true, created_at: now, cash_started }))
  ├─ dispatch(resetCart())
  └─ return
```

```js
// session/hook.js — start() online (tambah):
start({ cash_started }) online:
  ├─ startMutation({...})
  ├─ Sukses → dispatch(clearOfflineStartResult())  // reset
  ├─ refreshCatalog, resetCart, summary()
  └─ Gagal → dispatch($failure)
```

```js
// openSession.jsx:
const offlineStartResult = useSelector(state => state?.SalesSession?.offlineStartResult);
const { isLoading } = startResult;

const isStarting = isLoading || (isOffline && offlineStartResult === undefined);
const offlineSuccess = offlineStartResult?.is_offline_session;

React.useEffect(() => {
  if (offlineSuccess) {
    navigate('/');
  }
}, [offlineSuccess]);
```

---

### Gap 2: `summary()` Offline — Data Mau Ditaruh Dimana?

**Problem:** `summaryResult` dari `useLazySummaryQuery()` gak kepanggil pas offline. Tapi `closeSession.jsx` render dari `summaryResult?.data?.data`.

**Fix — Approach: Redux `offlineSummary`**

Di offline slice, tambah state untuk menampung offline summary:

```js
// offline/slice.js — tambah:
offlineSummary: null | {
  started_at: "ISO",
  cash_started: number,
  cash_finished: number | null,
  cashier: { name: string },
  summary: {
    sales: { total_sales, total_discount, grand_total, ... },
    cash: { expected_cash },
    payment_methods: [],
    topups: [],
  },
  orders: [],
}

// Reducers:
setOfflineSummary(state, action)
clearOfflineSummary(state)
```

```js
// session/hook.js — summary() offline:
summary() offline:
  ├─ Baca active session dari IndexedDB
  ├─ Compute summary:
  │   {
  │     started_at: session.open_at,
  │     cash_started: session.cash_started,
  │     cash_finished: session.cash_finished,
  │     cashier: { name: authUser.name },
  │     summary: {
  │       sales: { total_sales: 0, ... },    // 0 karena orders masih []
  │       cash: { expected_cash: session.cash_started },
  │     },
  │     orders: session.orders,   // masih []
  │   }
  ├─ dispatch(setOfflineSummary(summary))
  └─ return
```

```js
// closeSession.jsx:
const offlineSummary = useSelector(state => state?.Offline?.offlineSummary);
const data = isOffline ? offlineSummary : summaryResult?.data?.data;
```

---

### Gap 3: `closeSession.jsx` — Offline End Juga Butuh Trigger

**Problem:** Ada `useEffect`:
```js
if (endResult?.isSuccess) { handleOpenPrintSummary(endResult?.data?.data); }
```
Kalo end offline, `endMutation` gak kepanggil, jadi efek ini gak jalan.

**Fix — Approach: Dispatch `setOfflineSummary` di hook `end()` + effect ngecek offline end**

```js
// session/hook.js — end() offline:
end({ cash_finished }) offline:
  ├─ updateSessionClose(...)
  ├─ dispatch(invalidateSession())
  ├─ dispatch(clearActiveSyncId())
  ├─ refreshCatalog(), dispatch(resetCart())
  ├─ Dispatch offline summary langsung:
  │   dispatch(setOfflineSummary({
  │     started_at: session.open_at,
  │     cash_started: session.cash_started,
  │     cash_finished,
  │     cashier: { name: authUser.name },
  │     summary: { ... },
  │     orders: session.orders,
  │   }))
  ├─ dispatch(setOfflineSessionEnded(true))    // flag bahwa end offline sukses
  └─ return
```

```js
// closeSession.jsx:
const offlineEnded = useSelector(state => state?.Offline?.offlineSessionEnded);
const offlineSummary = useSelector(state => state?.Offline?.offlineSummary);

React.useEffect(() => {
  if (endResult?.isSuccess && endResult?.data?.data) {
    handleOpenPrintSummary(endResult.data.data);
  }
}, [endResult]);

// Offline end trigger
React.useEffect(() => {
  if (offlineEnded && offlineSummary) {
    handleOpenPrintSummary(offlineSummary);
    dispatch(clearOfflineSessionEnded());
  }
}, [offlineEnded]);
```

```js
// offline/slice.js — tambah:
offlineSessionEnded: false

// Reducers:
setOfflineSessionEnded(state, action)
clearOfflineSessionEnded(state)
```

---

### Gap 4: `end()` Online + Pending Sessions — Trigger Sync

**Problem:** Skrg `closeSession.jsx` panggil `syncNow()`. Tapi Phase 1 ganti jadi `syncPendingSessions()`. Trigger-nya perlu diupdate.

**Fix:** Hook `end()` online → panggil `syncPendingSessions()` dari syncManager langsung.

```js
import { syncPendingSessions } from '../../offline/syncManager';

// session/hook.js — end() online:
end({ cash_finished }) online:
  ├─ await syncPendingSessions()   // sync dulu
  ├─ endMutation({ cash_finished })
  ├─ Sukses → refreshCatalog, resetCart
  └─ Gagal → dispatch($failure)
```

Catatan: `syncPendingSessions()` harus di-export dari syncManager:

```js
// syncManager.js — export:
export { syncPendingSessions, getSyncingState, startHeartbeat, stopHeartbeat };
```

---

### Gap 5: `closeSession.jsx` — `pendingCount` Makna Berubah

**Problem:** Skrg `pendingCount` = jumlah item di queue. Phase 1 `pendingCount` = jumlah session yg belum di-sync. Failover modal perlu update.

**Fix:** Failover modal logic:

```js
// closeSession.jsx — onSubmit:
const onSubmit = async () => {
  if (pendingCount > 0) {
    if (isOnline && apiReachable) {
      // Online → sync dulu
      setSyncing(true);
      await handleTrySync();   // panggil syncPendingSessions()
    } else {
      // Offline → langsung close (simpan di IndexedDB)
      doEndSession();
    }
    return;
  }
  doEndSession();
};
```

Failover modal: kalo online → "Try Sync" button. Kalo offline → langsung close aja (ga perlu modal, karena session tinggal ditutup di IndexedDB).

---

### Gap 6: `openSession.jsx` — Loading State Offline

**Problem:** Button pake `startResult?.isLoading` buat disable. Kalo offline, loading state gak pernah update.

**Fix:** Pake local state atau Redux:

```js
// openSession.jsx:
const [isStartingLocal, setIsStartingLocal] = React.useState(false);
const offlineStartResult = useSelector(state => state?.SalesSession?.offlineStartResult);

const isStarting = startResult?.isLoading || (isOffline && isStartingLocal);

const onSubmit = async () => {
  if (isOffline) {
    setIsStartingLocal(true);
    await start(payload);
    // Ga usah setIsStartingLocal(false) — navigate otomatis
    return;
  }
  start(payload);
};
```

---

## 1. `src/services/offline/queue.js` — IndexedDB v3

### Perubahan

```
DB_VERSION: 2 → 3

STORES:
  - pendingRequests: 'pendingRequests'   ❌ HAPUS
  - metadata: 'metadata'                 ✅ RETAIN
  + offlineSessions: 'offlineSessions'   ✅ BARU
```

### Object Store: `offlineSessions`

```
keyPath: "sync_id"
indexes:
  - { name: "syncStatus", keyPath: "syncStatus" }
  - { name: "createdAt", keyPath: "createdAt" }
```

### Dokumen Shape

```js
{
  sync_id: "uuid",                              // primary key
  referenceId: null | "server-uuid",             // diisi pas sync sukses (server session.id)
  session: {
    open_at: "ISO",
    cash_started: 200000,
    close_at: null | "ISO",
    cash_finished: null | number,
    latitude: null | number,
    longitude: null | number,
    battery_health: null | string
  },
  orders: [],                                     // masih kosong di Phase 1
  topups: [],                                     // masih kosong di Phase 1
  memberships: [],                                // masih kosong di Phase 1
  syncStatus: "pending",                          // pending | syncing | failed | synced
  error: null | string,
  createdAt: "ISO"
}
```

Catatan: `orders[]`, `topups[]`, `memberships[]` tetap ada di schema walau Phase 1 belum diisi. Biar struktur stabil dan gak perlu migrasi ulang pas Phase 2/3.

### Fungsi — Lengkap

```js
// ========== CREATE ==========

createOfflineSession({ cash_started, latitude, longitude, battery_health }, userId)
  → { sync_id, session, orders:[], topups:[], memberships:[], syncStatus:"pending", createdAt }


// ========== READ ==========

getActiveSession(userId)                        → session | null
getPendingSessions(userId)                      → session[]
getAllSessions(userId)                          → session[]
getActiveSessionId(authSession, userId)          → { id: string, source } | null


// ========== UPDATE ==========

appendOrderToSession(syncId, order, userId)     // Phase 2
appendTopupToSession(syncId, topup, userId)      // Phase 3
appendMembershipToSession(syncId, membership, userId) // Phase 3
updateSessionClose(syncId, { cash_finished, ... }, userId)
setSyncStatus(syncId, status, { error?, userId })
updateSyncResult(syncId, { referenceId, orderMap }, userId)


// ========== DELETE ==========

deleteOfflineSession(syncId, userId)            // dipake pas sync sukses
```

### Fungsi — Dihapus

```js
addToQueue()           // ❌
getQueue()             // ❌
getQueueByStatus()     // ❌
getQueueItem()         // ❌
updateQueueItem()      // ❌
removeFromQueue()      // ❌
clearQueue()           // ❌
getPendingCount()      // ❌
getLegacyQueue()       // ❌
migrateLegacyQueue()   // ❌
```

### Fungsi — Retain

```js
closeUserDB(userId)
deleteUserDB(userId)
initQueueDB(userId)

setLastSyncTime(timestamp, userId)
getLastSyncTime(userId)
incrementSyncAttempt(userId)
resetMetadata(userId)
getAllMetadata(userId)
```

### pendingCount Helper

```js
const getOfflinePendingCount = async (userId) => {
  const sessions = await getAllSessions(userId);
  return sessions.filter(s => s.syncStatus !== 'synced').length;
};
```

---

## 2. `src/services/offline/slice.js` — Redux State Baru

### State Lengkap

```js
{
  isOnline: true,
  wasOffline: false,
  isSyncing: false,
  pendingCount: 0,          // session + orders pending
  failedCount: 0,           // session gagal sync
  warning: null,
  error: null,
  lastSyncTime: null,
  sessions: [],             // offlineSessions dari IndexedDB
  activeSyncId: null,       // sync_id dari session yg aktif
  apiReachable: true,
  offlineSummary: null,     // ✅ BARU — summary hasil compute local
  offlineSessionEnded: false, // ✅ BARU — flag bahwa end offline sukses
}
```

### Reducers

```js
// BARU:
setSessions(state, action)
setActiveSyncId(state, action)
clearActiveSyncId(state)
setOfflineSummary(state, action)
clearOfflineSummary(state)
setOfflineSessionEnded(state, action)
clearOfflineSessionEnded(state)

// HAPUS:
setQueueItems

// RETAIN:
setNetworkState, setSyncing, setPendingCount, setFailedCount,
setWarning, clearWarning, setOfflineError, clearOfflineError,
setLastSyncTime, setApiReachable, resetOfflineState
```

---

## 3. `src/services/sales/session/slice.js` — Tambah offlineStartResult

```js
const defineInitialState = () => ({
  hasSession: false,
  activeSyncId: null,
  offlineStartResult: null,     // ✅ BARU
});

// Reducers:
setActiveSyncId(state, action)
clearActiveSyncId(state)
setOfflineStartResult(state, action)
clearOfflineStartResult(state)
```

---

## 4. `src/services/offline/syncManager.js` — Refactor Sync

### async function syncPendingSessions()

```
syncPendingSessions():
  getPendingSessions(userId) → filter syncStatus = "pending"
  Tiap session:
    setSyncStatus("syncing")
    POST /sales/sync { session, orders, memberships, topups }
    Sukses: updateSyncResult + deleteOfflineSession + broadcast
    Gagal: setSyncStatus("failed") + broadcast
  setLastSyncTime(now)
```

### Init-time Rehydration

```js
initSyncManager(store):
  storeRef = store
  syncOfflineState()    // panggil langsung (ga async — wait)
  broadcastOfflineState()
  startHeartbeat()
  Subscribe auth changes

async function syncOfflineState():
  const userId = getCurrentUserId()
  if (!userId) return

  const allSessions = await getAllSessions(userId)
  const active = allSessions.find(s => s.syncStatus === "pending" && !s.session.close_at)

  storeRef.dispatch(setSessions(allSessions))
  storeRef.dispatch(setPendingCount(allSessions.filter(s => s.syncStatus !== "synced").length))
  storeRef.dispatch(setFailedCount(allSessions.filter(s => s.syncStatus === "failed").length))

  if (active) {
    storeRef.dispatch(setActiveSyncId(active.sync_id))
  }

  if (allSessions.some(s => s.syncStatus === "pending")) {
    syncPendingSessions()
  }
```

### broadcastOfflineState

```js
async function broadcastOfflineState():
  const userId = getCurrentUserId()
  if (!userId) {
    storeRef.dispatch(setSessions([]))
    storeRef.dispatch(setPendingCount(0))
    storeRef.dispatch(setFailedCount(0))
    return
  }

  const all = await getAllSessions(userId)
  const pending = all.filter(s => s.syncStatus === "pending" || s.syncStatus === "syncing")
  const failed = all.filter(s => s.syncStatus === "failed")

  storeRef.dispatch(setSessions(all))
  storeRef.dispatch(setPendingCount(pending.length))
  storeRef.dispatch(setFailedCount(failed.length))
```

### Heartbeat

```js
const startHeartbeat = () => {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (!storeRef) return;
    const state = storeRef.getState();
    const pending = state?.Offline?.sessions?.filter(
      s => s.syncStatus === "pending" || s.syncStatus === "failed"
    ) || [];
    if (pending.length > 0) syncPendingSessions();
  }, HEARTBEAT_INTERVAL);
};
```

### Export

```js
export {
  syncPendingSessions,
  getSyncingState,
  startHeartbeat,
  stopHeartbeat,
};
export { initSyncManager };   // retain
export { retryFailedItem, removeFailedItem } // ❌ dihapus nanti, tapi retain dulu buat backward
```

---

## 5. `src/services/baseQuery.js` — Simplify

```js
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
    return headers;
  },
});

export const baseQuery = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);

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

  return result;
};
```

**HAPUS:** `queueOfflineMutation`, `buildTransactionPreview`, `addToQueue`, `getPendingCount`, `setQueueItems`, `setWarning`, `resetCart`, `changeServiceCharge`, `getSalesCacheValue`, `import { addToQueue, getPendingCount } from './offline/queue'`, flag `__skipOfflineQueue`.

**RETAIN:** `rawBaseQuery`, `setApiReachable`, baseQuery function.

---

## 6. `src/services/sales/session/hook.js` — Offline Flow Lengkap

### Flow Coverage: Online → Offline → Online

| Start | End | IndexedDB | Sync |
|-------|-----|-----------|------|
| Online (API) | Offline | CREATE session dgn `referenceId` dari server | POST /sales/sync → server tau session.id, update close ✅ |
| Offline | Online | session udah ada di IndexedDB, blm di-close | sync dulu → POST /sales/sync → baru PUT /session/close ✅ |
| Offline | Offline | session di IndexedDB, close di IndexedDB | POST /sales/sync nanti pas online ✅ |
| Online (API) | Online (API) | IndexedDB kosong | no sync needed ✅ |

### `start({ cash_started })`

```
start({ cash_started }):
  ├─ Dapatkan deviceInfo (lat, lon, battery)
  │
  ├─ isOffline?
  │    └─ YA:
  │       ├─ sync_id = uuidv4()
  │       ├─ createOfflineSession({ sync_id, session: { open_at: now, cash_started, ... } })
  │       ├─ dispatch(checkSession())
  │       ├─ dispatch(setActiveSyncId(sync_id))
  │       ├─ dispatch(setOfflineStartResult({ sync_id, is_offline_session: true }))
  │       └─ dispatch(resetCart())
  │
  └─ TIDAK (online):
       ├─ startMutation({ ...data, ...deviceInfo })
       ├─ Sukses:
       │   ├─ dispatch(clearOfflineStartResult())
       │   ├─ refreshCatalog()
       │   ├─ dispatch(resetCart())
       │   └─ summary()
       └─ Gagal → dispatch($failure)
```

### `end({ cash_finished })`

```
end({ cash_finished }):
  ├─ stopDeviceTracking()
  │
  ├─ isOffline?
  │    └─ YA:
  │       ├─ Cek authSession?.sales_session?.id → serverSessionId
  │       │
  │       ├─ ADA (start online → close offline):
  │       │   ├─ createOfflineSession({
  │       │   │     sync_id: uuid(),
  │       │   │     referenceId: serverSessionId,
  │       │   │     session: { close_at: now, cash_finished }
  │       │   │   })
  │       │   └─ Compute summary dari data yg ada
  │       │
  │       ├─ TIDAK ADA (start offline → close offline):
  │       │   ├─ updateSessionClose(syncId, { cash_finished })
  │       │   └─ Compute summary dari session blob
  │       │
  │       ├─ dispatch(setOfflineSummary(computedSummary))
  │       ├─ dispatch(setOfflineSessionEnded(true))
  │       ├─ dispatch(invalidateSession())
  │       ├─ dispatch(clearActiveSyncId())
  │       ├─ refreshCatalog()
  │       └─ dispatch(resetCart())
  │
  └─ TIDAK (online):
       ├─ Ada pending sessions?
       │   └─ YA → await syncPendingSessions()
       ├─ endMutation({ cash_finished })
       ├─ Sukses → refreshCatalog, resetCart
       └─ Gagal → dispatch($failure)
```

### `summary()`

```
summary():
  ├─ isOffline?
  │    └─ YA:
  │       ├─ Baca active session dari IndexedDB
  │       ├─ Compute local summary:
  │       │   {
  │       │     started_at: session.open_at,
  │       │     cash_started: session.cash_started,
  │       │     cash_finished: session.cash_finished,
  │       │     cashier: { name: authUser?.name },
  │       │     summary: {
  │       │       sales: { total_sales: 0, grand_total: 0, ... },
  │       │       cash: { expected_cash: session.cash_started }
  │       │     },
  │       │     orders: session.orders
  │       │   }
  │       ├─ dispatch(setOfflineSummary(summary))
  │       └─ return
  │
  └─ TIDAK (online):
       └─ triggerSummary() → existing flow
```

### Return Values (Hook)

```js
return {
  start, startResult,
  end, endResult,
  summary, summaryResult,
  session, sessionResult,
  show, showResult,
  sendDeviceData, startDeviceTracking, stopDeviceTracking,
  updateDeviceResult,
};
```

---

## 7. `src/pages/authorize/home/openSession.jsx` — Update

```js
const isOffline = useSelector(state => !state.Offline.isOnline || state.Offline.apiReachable === false);
const offlineStartResult = useSelector(state => state?.SalesSession?.offlineStartResult);
const [isStartingLocal, setIsStartingLocal] = React.useState(false);

const isStarting = startResult?.isLoading || (isOffline && isStartingLocal);

const onSubmit = async () => {
  if (isOffline) {
    setIsStartingLocal(true);
  }
  const payload = { cash_started: parseFloat(cash) || 0 };
  start(payload);
};

// Navigate setelah offline start sukses
React.useEffect(() => {
  if (offlineStartResult?.is_offline_session) {
    navigate('/');
  }
}, [offlineStartResult]);

// Button:
<button className={`btn btn-block btn-xl btn-primary ${isStarting ? 'btn-disabled' : ''}`}
  onClick={onSubmit}>
  {isStarting ? <span className="loading loading-spinner"></span> : 'Start Session'}
</button>
```

---

## 8. `src/pages/authorize/home/closeSession.jsx` — Update

```js
const isOffline = useSelector(state => !state.Offline.isOnline || state.Offline.apiReachable === false);
const offlineSummary = useSelector(state => state?.Offline?.offlineSummary);
const offlineEnded = useSelector(state => state?.Offline?.offlineSessionEnded);

const data = isOffline ? offlineSummary : summaryResult?.data?.data;

const doEndSession = () => {
  const payload = { cash_finished: Number(cash) };
  end(payload);
};

const onSubmit = async () => {
  if (pendingCount > 0) {
    if (isOffline) {
      // Offline → langsung close (simpan di IndexedDB)
      doEndSession();
    } else {
      // Online → sync dulu
      setSyncing(true);
      await handleTrySync();
    }
    return;
  }
  doEndSession();
};

// Trigger print untuk offline end
React.useEffect(() => {
  if (offlineEnded && offlineSummary) {
    handleOpenPrintSummary(offlineSummary);
    dispatch(clearOfflineSessionEnded());
  }
}, [offlineEnded]);

// Trigger print untuk online end
React.useEffect(() => {
  if (endResult?.isSuccess && endResult?.data?.data) {
    handleOpenPrintSummary(endResult.data.data);
  }
}, [endResult]);

// Summary fetch
React.useEffect(() => {
  if (isOffline) {
    summary();  // offline summary → dispatch setOfflineSummary
  } else {
    summary();  // triggerSummary
  }
}, []);
```

---

## 9. `src/pages/authorize/shifts/index.jsx` — Offline Fallback

### List

```js
const offlineSessions = useSelector(state => state.Offline.sessions);
const isOffline = !state.Offline.isOnline || state.Offline.apiReachable === false;

const data = isOffline
  ? offlineSessions
      .filter(s => s.session.close_at)   // hanya yg udah di-close
      .map(s => ({
        id: s.sync_id,
        cashier: { name: authUser?.name || '-' },
        started_at: s.session.open_at,
        finished_at: s.session.close_at,
        status: 'closed',
        transaction_date: s.session.open_at,
      }))
  : sessionResult?.data?.data || [];
```

### Detail

```js
const detail = isOffline
  ? {
      id: session.sync_id,
      cashier: { name: authUser?.name },
      started_at: session.session.open_at,
      finished_at: session.session.close_at,
      cash_started: session.session.cash_started,
      cash_finished: session.session.cash_finished,
      summary: {
        sales: {
          total_sales: session.orders?.reduce((sum, o) => sum + (o.totalPayment || 0), 0) || 0,
          grand_total: 0,
        },
        cash: { expected_cash: session.session.cash_started },
        payment_methods: [],
        category_solds: [],
      },
      orders: session.orders || [],
    }
  : showResult?.data?.data;
```

---

## 10. `src/services/offline/index.js` — Update Exports

```js
export * from './queue';
export * from './slice';
export * from './syncManager';
export * from './useNetworkStatus';
export * from './localTransaction';    // retain — masih dipake checkout.jsx Phase 2 nanti dihapus
```

---

## Verifikasi Phase 1

### Unit Test (manual)

1. **DB v3 created** → buka session offline, cek IndexedDB ada `offlineSessions` store ✅
2. **pendingRequests removed** → buka IndexedDB, cek `pendingRequests` store tidak ada ✅
3. **Create session offline** → `createOfflineSession()` → dokumen IndexedDB sync_id, open_at, cash_started ✅
4. **Active session** → `getActiveSession()` return session dengan close_at null ✅
5. **Close session offline** → `updateSessionClose()` → close_at terisi, cash_finished terisi ✅
6. **Summary offline** → `summary()` → `offlineSummary` di Redux terisi ✅
7. **Start offline → UI navigate** → `offlineStartResult` trigger navigate ✅
8. **End offline → print summary** → `offlineEnded` trigger print ✅
9. **Shift list offline** → screen shifts render dari `offlineSessions` ✅
10. **Detail session offline** → render dari local blob ✅
11. **Sync session** → `syncPendingSessions()` → POST /sales/sync → sukses hapus session ✅
12. **Sync gagal** → syncStatus = "failed" ✅
13. **Rehydration** → refresh page → initSyncManager scan IndexedDB → Redux terisi ✅
14. **BaseQuery** → ga ada lagi queue offline mutation logic ✅
15. **Online flow tetap jalan** → start/end online tetap panggil API ✅
16. **Search shifts online** → pagination + search tetap dari API ✅
17. **End online dgn pending sessions** → sync dulu, baru close ✅

### Test Cases

| Case | Steps | Expected |
|------|-------|----------|
| Case 1 | Open online → offline close | Session start via API, close via IndexedDB → sync 1 request |
| Case 1a | Open offline → close online | Session start via IndexedDB, close via API → sync session dulu, baru close |
| Open offline | Buka session pas offline | IndexedDB terisi, Redux activeSyncId + offlineStartResult terisi, navigate ke POS |
| Close offline | Tutup session pas offline | IndexedDB close_at + cash_finished, offlineSummary + offlineEnded di Redux, print summary |
| List offline | Buka shifts page pas offline | Tampilkan dari offlineSessions (hanya yg closed) |
| Refresh | Refresh page with active session | Rehydrate: Redux activeSyncId dari IndexedDB |
| Online sync | Online → sync pending session | POST /sales/sync → session terhapus dari IndexedDB |
| Online sync gagal | Online → sync gagal (500) | syncStatus = "failed", retry next heartbeat |
| Online close dgn pending | Online, pending session → close | sync dulu, baru PUT /session/close |
