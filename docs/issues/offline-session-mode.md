# Offline Session Mode — POS Offline Sync

## Problem

Existing offline queue model **per-item** (`pendingRequests` di IndexedDB) gak cocok dengan API contract baru `POST /sales/sync` yang **1 request = 1 session** (atomic, idempotent via `sync_id`).

## API Contract

**`POST /sales/sync`**

```json
{
  "session": {
    "sync_id": "uuid",
    "id": "" | "server-uuid",
    "open_at": "ISO",
    "close_at": "ISO",
    "cash_started": 200000,
    "cash_finished": 1500000,
    "latitude": -6.2,
    "longitude": 106.8,
    "battery_health": "85%"
  },
  "orders": [
    {
      "sync_id": "uuid",
      "id": "" | "server-uuid",
      "session_sync_id": "uuid | server-uuid",
      "sales_channel_id": "...",
      "payment_method_id": 0,
      "membership_id": "" | "uuid",
      "payment_ref": "",
      "bill_name": "John Doe",
      "discount_percentage": 0,
      "discount_value": 0,
      "items": [
        { "catalog_id": "...", "catalog_name": "Nasi Goreng", "quantity": 2, "unit_price": 25000, "addons": [] }
      ],
      "category_discounts": [],
      "status": "pending | completed",
      "total_payment": 50000,
      "paid_at": "ISO",
      "is_offline_mode": true,
      "ref_sync_id": "" | "uuid"
    }
  ],
  "memberships": [
    { "card_id": "...", "name": "New Member" }
  ],
  "topups": [
    { "membership_id": "uuid", "session_sync_id": "uuid", "nominal": 50000, "payment_type": "cash" }
  ]
}
```

**Response:**
```json
{
  "session": { "sync_id": "...", "id": "server-uuid", "is_new": true },
  "orders": [
    { "sync_id": "...", "id": "server-uuid", "is_new": true }
  ]
}
```

### Key Behaviors

| Field | Behavior |
|-------|----------|
| `session.id` kosong | Server CREATE session baru |
| `session.id` ada | Refer existing session (online / udah sync) |
| `session.close_at` ada | Server close session setelah orders diproses |
| `orders[].id` kosong | Insert order baru |
| `orders[].id` ada | Update existing (split payment, qty change) |
| `orders[].session_sync_id` | Bisa `sync_id` (session baru) atau `session.id` (existing) |
| `orders[].ref_sync_id` | Cross-order ref dalam batch (split bill) |
| `session: null` | Orders-only sync, refer session existing via `session_sync_id` |

## Session ID Resolution

Karena session bisa:
- Start online → `Auth.session.sales_session.id` (server ID)
- Start offline → `sync_id` (UUID client)
- Udah sync sebelumnya → `serverSessionId` dari mapping

```
getActiveSessionId(authSession, userId) → returns { id, source }
  1. Cek authSession?.sales_session?.id          → server ID (online)
  2. Cek offline_sessions.serverSessionId        → server ID (udah sync)
  3. Cek offline_sessions.sync_id (yg masih open) → client UUID
```

## Case Scenarios

### Case 1: Open Online → Close Offline

| # | Status | Aksi |
|---|--------|------|
| 1 | ✅ Online | Login + session start. Server ID di Redux |
| 2 | ❌ Offline | End session |

**Sync:** 1 request
```json
POST /sales/sync
{
  "session": {
    "sync_id": "sess-close-001",
    "id": "<server-session-id>",
    "close_at": "2026-07-23T17:00:00Z",
    "cash_finished": 1500000
  },
  "orders": []
}
```
Server: `session.id` ada → langsung update close.

### Case 2: Open Online → Mixed Orders → Close Online

| # | Status | Aksi |
|---|--------|------|
| 1 | ✅ Online | Login + session start |
| 2 | ❌ Offline | Order 1 (pending) |
| 3 | ✅ Online | Order 2 (pending) |
| 4 | ❌ Offline | Order 3 (completed) |
| 5 | ✅ Online | Order 4 (completed) |
| 6 | ✅ Online | End session via `PUT /sales/session/close` |

**Sync:** 1 request
```json
POST /sales/sync
{
  "session": null,
  "orders": [
    {
      "sync_id": "ord-offline-1",
      "session_sync_id": "<server-session-id>",
      "id": "",
      "items": [...],
      "status": "pending",
      "is_offline_mode": true
    },
    {
      "sync_id": "ord-offline-3",
      "session_sync_id": "<server-session-id>",
      "id": "",
      "items": [...],
      "status": "completed",
      "total_payment": 50000,
      "paid_at": "...",
      "is_offline_mode": true
    }
  ]
}
```

### Case 3: Open Offline → Split Bill → Close Online (Approach A)

| # | Status | Aksi |
|---|--------|------|
| 1 | ✅ Online | Login |
| 2 | ❌ Offline | Start session |
| 3 | ❌ Offline | Order 1: A-60, B-70 (pending) |
| 4 | ❌ Offline | Split: Order 1 sisa A-55, B-65. Order 2 (new) A-5, B-5 (pending) |
| 5 | ✅ Online | End session |

**Step 5a — Sync session + orders dulu:**
```json
POST /sales/sync
{
  "session": {
    "sync_id": "sess-1",
    "open_at": "2026-07-23T08:00:00Z",
    "cash_started": 200000
  },
  "orders": [
    {
      "sync_id": "ord-1",
      "session_sync_id": "sess-1",
      "id": "",
      "items": [{ "catalog_id": "A", "quantity": 55 }, { "catalog_id": "B", "quantity": 65 }],
      "status": "pending",
      "is_offline_mode": true
    },
    {
      "sync_id": "split-1",
      "session_sync_id": "sess-1",
      "id": "",
      "ref_sync_id": "ord-1",
      "items": [{ "catalog_id": "A", "quantity": 5 }, { "catalog_id": "B", "quantity": 5 }],
      "status": "pending",
      "is_offline_mode": true
    }
  ]
}
```

**Response:**
```json
{
  "session": { "sync_id": "sess-1", "id": "<sess-uuid>", "is_new": true },
  "orders": [
    { "sync_id": "ord-1", "id": "<ord-1-uuid>", "is_new": true },
    { "sync_id": "split-1", "id": "<ord-2-uuid>", "is_new": true }
  ]
}
```

**Step 5b — Close via endpoint normal:**
```
PUT /sales/session/close
{ cash_finished: 1500000 }
```

## Queue Model

### IndexedDB Schema

```js
DB_VERSION = 3
STORES = {
  offlineSessions: 'offlineSessions',   // session blob
  metadata: 'metadata',                 // retain (sync time, dll)
  pendingRequests: 'pendingRequests'    // RETAIN — masih dipake topup? atau topup ikut session.blob.topups[]
}
```

### Object Store: `offlineSessions`

```
keyPath: "sync_id"
indexes: [
  { name: "syncStatus", keyPath: "syncStatus" },
  { name: "createdAt", keyPath: "createdAt" }
]
```

### Dokumen Shape

```js
{
  sync_id: "uuid",
  referenceId: null | "server-uuid",        // diisi pas sync sukses
  session: {
    open_at: "ISO",
    cash_started: 200000,
    close_at: null | "ISO",
    cash_finished: null | number,
    latitude: null | number,
    longitude: null | number,
    battery_health: null | string
  },
  orders: [
    {
      sync_id: "uuid",
      referenceId: null | "server-uuid",    // diisi pas sync sukses
      sessionSyncId: "sync_id | server-uuid",
      salesChannelId: "...",
      paymentMethodId: 0,
      membershipId: null | "uuid",
      paymentRef: "",
      billName: "",
      discountPercentage: 0,
      discountValue: 0,
      categoryDiscounts: [],
      items: [
        { catalog_id, catalog_name, quantity, unit_price, addons: [] }
      ],
      status: "pending | completed",
      totalPayment: 0,
      paidAt: "ISO",
      isOfflineMode: true,
      refSyncId: "" | "sync_id"             // split bill ref
    }
  ],
  topups: [],
  memberships: [],
  syncStatus: "pending | syncing | failed | synced",
  error: null | string,
  createdAt: "ISO"
}
```

## Flow Detail

### 1. Start Session (Offline)

```
openSession.jsx → useSession.start({ cash_started })
  ├─ isOffline?
  │    └─ YA:
  │       ├─ CREATE offline_sessions:
  │       │   sync_id = uuid()
  │       │   session = { open_at: now, cash_started, lat, lon, battery }
  │       │   orders = [], topups = [], memberships = []
  │       │   syncStatus = "pending"
  │       ├─ Redux: dispatch(checkSession())
  │       ├─ Redux: setActiveSyncId(sync_id)
  │       └─ UI: ke POS screen
  │
  └─ TIDAK:
       └─ POST /sales/session (existing online flow)
```

### 2. Checkout / Save Bill (Offline)

```
checkout.jsx → handlePay()
  │
  ├─ isOffline?
  │    └─ YA:
  │       ├─ Baca active session: Redux activeSyncId → offline_sessions dari IndexedDB
  │       ├─ APPEND ke orders[]:
  │       │   { sync_id: uuid(),
  │       │     sessionSyncId: session.sync_id,
  │       │     items: [...],
  │       │     paymentMethodId,
  │       │     status: "completed" | "pending",
  │       │     totalPayment,
  │       │     paidAt: now,
  │       │     isOfflineMode: true }
  │       ├─ UPDATE IndexedDB offline_sessions
  │       ├─ Update Redux pendingCount
  │       └─ RETURN mock success + preview buat UI
  │
  └─ TIDAK:
       └─ POST /sales/order via baseQuery (existing online)
```

### 3. Open Bills (Offline)

```
cart.hook → bill()
  ├─ Baca server bills (GET /sales/order/openbill) → kalo fail: []
  ├─ Baca active offline_sessions
  ├─ Filter orders[] status = "pending"
  ├─ Transform ke shape API response
  ├─ Dedup by bill_name/ticket
  └─ Return merged: [...serverData, ...offlinePending]
```

### 4. End Session

```
closeSession.jsx → useSession.end({ cash_finished })
  │
  ├─ isOffline?
  │    └─ YA:
  │       ├─ UPDATE session.close_at = now, cash_finished
  │       ├─ syncStatus tetap "pending"
  │       ├─ Compute summary dari orders[] → tampilkan
  │       ├─ dispatch(invalidateSession())
  │       └─ Print summary dari local data
  │
  └─ TIDAK (online):
       ├─ Ada pending offline_sessions?
       │    └─ YA:
       │       ├─ Sync dulu → POST /sales/sync
       │       ├─ Simpan mapping (serverSessionId + serverOrderMap)
       │       ├─ Hapus offline_sessions
       │
       └─ PUT /sales/session/close (existing)
```

### 5. Sync (syncManager)

```
syncManager → syncPendingSessions()
  │
  ├─ Baca offline_sessions WHERE syncStatus = "pending"
  │
  ├─ Untuk tiap session:
  │   ├─ SET syncStatus = "syncing"
  │   │
  │   ├─ Session payload:
  │   │   referenceId != null → { id: referenceId, close_at?, cash_finished? }
  │   │   referenceId == null → { sync_id, open_at, cash_started, ... }
  │   │
  │   ├─ POST /sales/sync
  │   │   { session: ..., orders: [...], memberships: [...], topups: [...] }
  │   │
  │   ├─ SUKSES:
  │   │   ├─ SET referenceId = response.session.id
  │   │   ├─ Map orders: orders[].referenceId dari response.orders[]
  │   │   ├─ SET syncStatus = "synced"
  │   │   └─ Archive / delete session (opsional)
  │   │
  │   └─ GAGAL:
  │       ├─ SET syncStatus = "failed"
  │       ├─ SET error = error.message
  │       └─ Retry on next trigger
  │
  └─ Broadcast ke Redux: update sessions, pendingCount
```

## Files Changed

### Major Changes

| File | Perubahan |
|------|-----------|
| `src/services/offline/queue.js` | **Refactor major**. DB v3 + offlineSessions. Hapus fungsi per-item session/order. Tambah: `createOfflineSession`, `getActiveSession`, `getPendingSessions`, `getAllSessions`, `appendOrderToSession`, `updateSessionClose`, `updateSyncResult`, `deleteOfflineSession`, `getActiveSessionId` |
| `src/services/offline/syncManager.js` | **Refactor total**. Ganti core logic: `processItem` → `syncPendingSessions`. Hapus `sortPendingQueue`, `executeQueuedRequest`, retry per-item. Pake POST /sales/sync |
| `src/services/offline/slice.js` | Ubah state: hapus `items[]`, tambah `sessions[]`, `activeSession`, `activeSyncId`. Reducers baru |
| `src/services/sales/session/action.js` | Add `POST /sales/sync` mutation |
| `src/services/sales/session/slice.js` | Add `activeSyncId` + reducers |
| `src/services/sales/session/hook.js` | `start()`: create IndexedDB. `end()`: update close + trigger sync. `summary()`: compute local |
| `src/services/cart/hook.js` | `checkout()`: append ke session blob. `bill()`: merge offline. `onBillSelected()`: read from blob |
| `src/pages/authorize/home/checkout.jsx` | Offline: append ke session blob alih-alih baseQuery queue |
| `src/components/ui/offline/PendingDrawer.jsx` | Baca dari `sessions[]`, flatten orders grouped by status |
| `src/pages/authorize/home/closeSession.jsx` | Summary dari local orders[] |
| `src/services/baseQuery.js` | **Simplify.** Hapus session queue logic, offline mutation queue, `buildTransactionPreview`, `queueOfflineMutation`. BaseQuery kembali ke fungsi normal fetch online |

### No Change

| File | Alasan |
|------|--------|
| `src/services/auth/*` | Auth flow gak berubah |
| `src/components/ui/layout.jsx` | Cuma baca hasSession |
| `src/components/ui/sidebar/index.jsx` | Gak berubah |
| `src/pages/authorize/home/openSession.jsx` | Panggil hook aja |
| `src/pages/authorize/shifts/index.jsx` | Offline fallback optional |
| `src/services/offline/localTransaction.js` | Diganti implementasi langsung di hook/checkout |
| `src/services/reducer.js` | Gak berubah |
| `src/services/store.js` | Gak perlu update blacklist |

## Implementation Phases

| Phase | Fokus | Files |
|-------|-------|-------|
| 1 | **Queue Model** | queue.js (DB v3 + offlineSessions), slice.js (state baru), session/slice.js (activeSyncId) |
| 2 | **Session Flow** | session/hook.js (start/end offline), closeSession.jsx (local summary) |
| 3 | **Cart Integration** | cart/hook.js (checkout offline + bills), checkout.jsx (append ke blob) |
| 4 | **Sync** | syncManager.js (syncPendingSessions), session/action.js (sync endpoint) |
| 5 | **Cleanup** | baseQuery.js (simplify, hapus offline logic) |
| 6 | **UI** | PendingDrawer.jsx (baca dari sessions), ShiftScreen (offline fallback) |

## Verification

1. **Start session offline** → IndexedDB `offline_sessions` created ✅
2. **Checkout offline** → order append ke session.orders[] ✅
3. **Save bill offline** → order status "pending" di session.orders[] ✅
4. **Open bills offline** → merge pending + server, dedup ✅
5. **Split bill offline** → 2 orders, `ref_sync_id` ✅
6. **End session offline** → close_at set, syncStatus pending ✅
7. **Case 1 (online → offline close)** → 1 sync request ✅
8. **Case 2 (online → mixed → online close)** → sync orders, close via endpoint ✅
9. **Case 3 (offline → split → online close)** → sync (Step A), close (Step B) ✅
10. **Sync sukses** → mapping disimpan ✅
11. **Sync gagal** → retry, error persist ✅
12. **PendingDrawer** → flatten orders, tampilkan ✅
13. **Refresh page** → rehydrate IndexedDB → Redux ✅
