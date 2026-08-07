# Page History: Offline Cache

## Problem

Page History (`/history`) hanya membaca data dari `GET /sales/order/history` (server). Saat offline:
- RTK Query cache hilang (`salesOrderApi` di-blacklist dari redux-persist)
- `historyResult?.isSuccess` tidak pernah `true` → list kosong
- Detail fetch `GET /sales/order/{id}` juga gagal

## Tujuan

Cache data history dari server agar tetap tampil saat offline. Tidak perlu merge data queue — cukup cache server response.

## Batasan (Ga Disentuh)

- Queue engine (`services/offline/queue.js`) ❌
- Sync manager ❌
- BaseQuery ❌
- Queue Manager (PendingDrawer) ❌

## Desain

### Flow

1. **Online** → `history()` fetch server → merge dgn offline entries di cache → tampilkan
2. **Offline** → `history()` skip server fetch → baca dari `cache_order_history` → tampilkan
3. **Detail online** → `show(id)` → fetch `/sales/order/{id}` → tampilkan
4. **Detail offline** → render langsung dari data list (asumsi cukup lengkap)

### File yang Berubah

#### 1. `src/services/sales/order/hook.js`

Tambah:
- `mergedHistoryData` state
- Cache key `cache_order_history`
- `history()` hybrid: online fetch → merge + cache, offline → baca cache
- Online fetch sekarang **merge** server data dgn offline entries (`e?.offline_queued`) biar ga kehapus

Tambah return: `historyData`

#### 2. `src/pages/authorize/history/index.jsx`

Ubah:
- Pake `historyData` sebagai sumber data list
- Detail: online → `show(id)`, offline → `setDetail(selected)` (dari list)
- Re-trigger `history()` saat `state.Offline.items.length` berubah (kalo offline), biar cache ter-refresh setelah remove queue

#### 3. `src/pages/authorize/home/checkout.jsx`

Tambah:
- Pas offline checkout sukses, inject entry ke `cache_order_history` pake `offline_queued: true`
- Pake `buildOfflineTransactionPayload` buat preview Queue Manager
- Refresh Redux state setelah `updateQueueItem` biar Queue Manager up-to-date
- Kirim `__offlinePreview` di body request (dipake baseQuery sebagai preview awal)

#### 4. `src/services/offline/queue.js`

Tambah:
- `removeFromQueue()` otomatis cleanup `cache_order_history` — hapus entry yg match `offline_meta.queue_id`

#### 5. `src/services/cart/hook.js`

- `handleSaveBill()` tetap kirim `__offlinePreview` (pre-existing)

#### 6. `src/components/ui/offline/PendingDrawer.jsx`

Ubah:
- Baris metadata: `cashierName` diganti `preview?.bill_name || cashierName`

### Tidak Berubah

| File | Alasan |
|---|---|
| `services/offline/queue.js` | Hanya tambah cleanup di `removeFromQueue` |
| `services/offline/syncManager.js` | Ga relevan (cleanup dipindah ke queue.js) |
| `services/offline/slice.js` | Ga relevan |
| `services/baseQuery.js` | Risiko tinggi |
| `services/sales/order/action.js` | Cuma definisi API |

## Key Behaviors

### History Cache Key
`cache_order_history` — disimpan di localStorage via `setCache/getCache`

### Offline Entry Flag
Semua entry hasil offline checkout punya field `offline_queued: true` + `offline_meta: { queue_id }`.

### Merge Logic (Online)
```js
const offlineEntries = existing.filter(e => e?.offline_queued);
const merged = [...serverData, ...offlineEntries];
setCache(HISTORY_CACHE_KEY, merged);
```
Ini mastiin offline entries ga ilang pas online fetch.

### cleanup Logic (Remove Queue)
`removeFromQueue()` di queue.js otomatis filter `cache_order_history` — hapus entry yg `offline_meta.queue_id === queueId` atau `id === queueId`.

### Preview di Queue Manager
`handlePay()` panggil `buildOfflineTransactionPayload()` langsung buat dapetin format `{ channel, payment_method, items, ... }` — bukan dari snapshot mentah.

## Verification

1. **Online** → buka `/history` → data server tampil
2. **Klik item** → detail fetch dari server ✅
3. **Offline** → buka `/history` → data cached tampil (server + offline entries) ✅
4. **Klik item offline** → render dari data list ✅
5. **Online lagi** → fetch baru, cache di-merge dengan offline entries
6. **Queue sync success** → entry otomatis cleanup dari cache ✅
7. **Remove queue manual** → cleanup dari cache ✅
