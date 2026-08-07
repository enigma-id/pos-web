# Offline Refactor — Complete Summary

## Latar Belakang

Kode offline sebelumnya menyimpan data dalam **session blob** di IndexedDB: satu dokumen besar `{ session, orders[], topups[], memberships[] }` — bentuknya sudah disesuaikan dengan payload `/sales/sync`. Ini menyebabkan:

1. Tight coupling antara storage dan API shape
2. Transformasi kompleks di syncManager (96 line mapping)
3. Kalau `/sales/sync` berubah, storage ikut berubah

**Tujuan:** Pisahkan storage dari API — entity flat per store, compose payload saat sync.

---

## Arsitektur Final

```
IndexedDB (flat stores — cuma buat persist + sync)
  ├── sessions        ← open/close session
  ├── order_bills     ← pending orders (save bill)
  ├── order_payments  ← completed orders (paynow)
  ├── topups          ← topup transactions
  └── memberships     ← membership create/update
        │
        ├── syncManager: grouping by session_sync_id → POST /sales/sync
        ├── syncManager: batch → POST /membership/sync
        └── PendingDrawer: baca IndexedDB langsung (4 tab)

Redux Cache (minimal — buat UI + summary)
  ├── pendingCount     ← write/sync incremental
  ├── sessionSummary   ← API (online) / computeIncremental (offline)
  ├── offlineSessionEnded ← trigger print
  └── isOnline, apiReachable, isSyncing, lastSyncTime

localStorage Cache (buat history/bills/shifts page — offline fallback)
  ├── cache_order_history
  ├── cache_openbills
  └── cache_shifts
```

---

## Semua Perubahan

### 1. IndexedDB — DB_VERSION 3 → 5

**Hapus:** `offlineSessions` (blob)

**Bikin 5 store baru:**

| Store | Key | Index |
|---|---|---|
| `sessions` | sync_id | syncStatus, createdAt |
| `order_bills` | sync_id | origin_session_sync_id |
| `order_payments` | sync_id | origin_session_sync_id, paid_session_sync_id |
| `topups` | sync_id | session_sync_id |
| `memberships` | sync_id | - |
| `metadata` | key | - |

**Rename field:**
- `origin_session_id` → `origin_session_sync_id`
- `paid_session_id` → `paid_session_sync_id`
- `referenceId` (camelCase) → `id` (snake_case, server ID)
- `from_offline_queue` → `is_offline_mode`
- `queue_id` → `sync_id`
- `originSyncId` → `origin_session_sync_id`

### 2. queue.js — CRUD Flat

**Dihapus (blob functions):**
- `appendOrderToSession`, `removeOrderFromSession`, `updateOrderInSession`, `updateOrderBillName`
- `appendTopupToSession`, `appendMembershipToSession`, `updateMembershipInSession`
- `getActiveSession`, `getOrCreateOfflineSession`, `getActiveSessionId`
- `getAllSessions`, `getPendingSessions`, `getOfflinePendingCount`, `setSyncStatus`, `updateSyncResult`

**New functions:**
- `createOrderBill(data, userId)` — `order_bills`
- `createOrderPayment(data, userId)` — `order_payments`
- `updateOrderBill(syncId, data, userId)` — update + insert fallback (handle server bill)
- `deleteOrderBill`, `deleteOrderPayment`
- `createTopup(data, userId)` — `topups`
- `createMembership(data, userId)` — `memberships`
- `updateMembership(cardId, data, userId)` — `memberships`
- `createOfflineSession(data, userId)` — `sessions`
- `closeSession(syncId, data, userId)` — `sessions`
- `deleteOfflineSession(syncId, userId)` — cascade all

**Mapping fix (snake_case + camelCase):**
```js
paid_session_sync_id: data.paid_session_sync_id || data.paidSessionSyncId || data.paidSessionId || null,
origin_session_sync_id: data.origin_session_sync_id || data.originSessionSyncId || null,
sales_channel_id: data.sales_channel_id || data.salesChannelId || null,
payment_method_name: data.payment_method_name || data.paymentMethodName || null,
```

### 3. syncManager.js — Grouping by Session ID

**Sebelum:**
- Iterate sessions → query orders by FK → compose → POST
- Per-item memberships sync

**Sesudah:**
```
1. POST /membership/sync (batch: { members: [...] })
2. Read all: sessions + order_bills + order_payments + topups
3. Group by session_sync_id
4. Per group:
   - Include session object (kalo close_at atau start offline)
   - orders = bills + payments
   - topups
   → POST /sales/sync
5. Sukses → hapus dari IndexedDB + set needs_sync=false di localStorage cache
```

### 4. Redux Slice — Minimal

**Dihapus dari state:**
- `sessions[]` — PendingDrawer baca IndexedDB langsung
- `activeSyncId` — redundant

**Ditambah:**
- `sessionSummary` — data summary dari API (online) atau incremental (offline)
- `clearSessionSummary`

**State.Offline sekarang:**
```js
{ isOnline, wasOffline, isSyncing, pendingCount, failedCount,
  warning, error, lastSyncTime, apiReachable, sessionSummary, offlineSessionEnded }
```

**Cart.bill rename:**
```js
from_offline_queue → is_offline_mode
queue_id → sync_id
originSyncId → origin_session_sync_id
```

### 5. session/hook.js — updateSessionSummary

**Fungsi baru `updateSessionSummary(newData)`:**
- Incremental update (gausah query IndexedDB)
- Handle `type: 'bill'`, `'payment'`, `'topup'`
- Termsuk service_charge, payment_methods breakdown
- Auto sync ke `cache_shifts` biar shifts page offline kebaca

**Start offline flow:**
1. `createOfflineSession()` → IndexedDB
2. `dispatch(setSessionSummary({...}))` — sessionSummary awal
3. Push ke `cache_shifts` (list shifts)
4. `dispatch(setPendingCount(1))`

**End offline flow:**
1. Query IndexedDB (orders + topups by sessionId)
2. `closeSession()` → update close_at
3. `dispatch(setSessionSummary(computedSummary))`
4. Push ke `cache_shifts` (update status closed)

### 6. PendingDrawer — Baca IndexedDB Langsung

| Tab | Store | Filter |
|---|---|---|
| **Order** | `order_payments` | status=completed |
| **Bills** | `order_bills` | status=pending, is_show=true |
| **Member** | `topups` + `memberships` | semua |
| **Shifts** | `sessions` | syncStatus≠synced |

`payment_method_name` ditampilkan dengan fallback ke `#id` atau 'Cash'.

### 7. Bills & History — localStorage Cache

- **Online** → fetch API → simpan ke cache (`setCache` = `{data: [...]}`)
- **Offline** → baca dari cache (`getCache`)
- `mergeOfflineBills()` dihapus
- **Badge "pending sync"** cek `item?.needs_sync`
- Pas sync sukses → `cleanupLocalStorageCache()` set `needs_sync = false` (gausah hapus)

### 8. Shifts Page — localStorage + Detail from List

- **Data** dari `cache_shifts` (diisi pas start/end session + dari API)
- **Detail** offline: selected item dari list (kayak history page)
- Gada IndexedDB query buat list

### 9. cart.jsx — onUpdateBill + onCreateBill

**Pisah jadi 2 fungsi:**

**`onUpdateBill(ticket)`** — update bill yg udah ada:
- Offline: `updateOrderBill(id, { items, discounts, ... })` → IndexedDB
- Online: `update({ id, payload })` → API
- Helper `getOrderPayload(ticket)` — build items + discounts dari CartState

**`onCreateBill(ticket)`** — save bill baru:
- Offline: `createOrderBill(...)` → IndexedDB + `setPendingCount` + push `cache_openbills` + `updateSessionSummary`
- Online: `checkout(payload)` atau `update({ id, payload })` → API

### 10. checkout.jsx — Paynow Offline

- `createOrderPayment(completedOrder, userId)` → IndexedDB
- Update pending bill (split payment) via `updateOrderBill`
- Push ke `cache_order_history`
- `updateSessionSummary({ type: 'payment', ... })`
- Push ke `cache_openbills` (save bill di checkout)

---

## Files Modified (20+ files)

| File | Perubahan |
|---|---|
| `src/services/offline/queue.js` | 5 stores, CRUD, DB v5, mapping fix |
| `src/services/offline/syncManager.js` | Grouping, memberships batch, cleanup cache |
| `src/services/offline/slice.js` | Hapus sessions[], activeSyncId, tambah sessionSummary |
| `src/services/offline/index.js` | Update exports |
| `src/services/offline/cache.js` | Helper cache incremental |
| `src/services/sales/session/hook.js` | updateSessionSummary, simplify end/start |
| `src/services/cart/hook.js` | Hapus mergeOfflineBills, onBillSelected offline |
| `src/services/cart/slice.js` | Rename fields, loadOfflineBill fix |
| `src/services/offline/localTransaction.js` | Rename queue_id→sync_id, paid_session_id→paid_session_sync_id |
| `src/services/auth/hook.js` | Replace getOfflinePendingCount |
| `src/pages/authorize/home/cart.jsx` | onUpdateBill, onCreateBill, split, helper getOrderPayload |
| `src/pages/authorize/home/checkout.jsx` | createOrderPayment, cache, sessionSummary |
| `src/pages/authorize/home/closeSession.jsx` | Replace getOfflinePendingCount, console.log |
| `src/pages/authorize/home/saveBill.jsx` | Badge fix |
| `src/pages/authorize/home/success.jsx` | offline_queued→is_offline_mode |
| `src/pages/authorize/bills/index.jsx` | offlinePendingCount trigger, badge fix |
| `src/pages/authorize/history/index.jsx` | Badge fix |
| `src/pages/authorize/shifts/index.jsx` | List dari cache, detail dari list, offlinePendingCount trigger |
| `src/pages/authorize/membership/*.jsx` | createMembership, updateMembership, incremental pendingCount |
| `src/components/ui/layout.jsx` | Hapus setSessions/refreshQueue |
| `src/components/ui/offline/PendingDrawer.jsx` | Baca IndexedDB langsung, payment_method_name |
| `src/main.jsx` | initSyncManager(store) |
| `src/App.jsx` | Pre-fetch sessionSummary (dihapus) |

---

## Data Flow (Offline)

```
Save Bill (Cart/Checkout)
  ├── createOrderBill() → order_bills store (IndexedDB)
  ├── setPendingCount(current + 1)
  ├── updateSessionSummary({ type: 'bill' })
  └── setCache('cache_openbills', [entry, ...existing])

Pay Now (Checkout)
  ├── createOrderPayment() → order_payments store (IndexedDB)
  ├── updateOrderBill() → update pending bill (split)
  ├── setPendingCount(current + 1)
  ├── updateSessionSummary({ type: 'payment' })
  ├── setCache('cache_order_history', [entry, ...existing])
  └── (save bill juga ke cache_openbills kalo ada)

Topup
  ├── createTopup() → topups store (IndexedDB)
  ├── setPendingCount(current + 1)
  └── updateSessionSummary({ type: 'topup' })

Create/Update Membership
  ├── createMembership() / updateMembership() → memberships store
  └── setPendingCount(current + 1)

Open Session (Offline)
  ├── createOfflineSession() → sessions store
  ├── setSessionSummary({ id, started_at, ... })
  ├── setPendingCount(1)
  └── push cache_shifts

Close Session (Offline)
  ├── query orders + topups by sessionId
  ├── closeSession() → update close_at
  ├── setSessionSummary(computedSummary)
  ├── setOfflineSessionEnded(true)
  ├── setPendingCount(current + 1)
  └── push cache_shifts

Sync (Online)
  1. POST /membership/sync { members: [...] }
  2. Group entities by session_sync_id
  3. POST /sales/sync per group
  4. Sukses → hapus dari IndexedDB
  5. cleanupLocalStorageCache() → set needs_sync = false
  6. setPendingCount(0)
```

---

## Key Decisions

| Keputusan | Alasan |
|---|---|
| **Flat stores, bukan blob session** | Decouple storage dari API shape |
| **PendingDrawer baca IndexedDB langsung** | Gak perlu rehydrate ke Redux |
| **Redux cache minimal** | sessions[] dihapus, cukup counter + summary |
| **localStorage untuk history/bills/shifts** | Offline fallback, gak merge IndexedDB |
| **updateSessionSummary incremental** | Gausah compute ulang dari 0, tinggal tambahin data baru |
| **needs_sync bukan is_offline_mode** | is_offline_mode permanen, needs_sync sementara |
| **Grouping by session_sync_id** | Gak perlu sessions store buat grouping |
| **API snake_case** | Backend expect snake_case |
| **DB_VERSION 3→5 langsung** | Gak ada data produksi, skip migrasi |
