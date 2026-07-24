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

1. **Online** → `history()` fetch server → cache response ke `cache_order_history` → tampilkan
2. **Offline** → `history()` skip server fetch → baca dari `cache_order_history` → tampilkan
3. **Detail online** → `show(id)` → fetch `/sales/order/{id}` → tampilkan
4. **Detail offline** → render langsung dari data list (asumsi cukup lengkap)

### File yang Berubah

#### 1. `src/services/sales/order/hook.js`

Tambah:
- `mergedHistoryData` state
- Cache key `cache_order_history`
- `history()` hybrid: online fetch + cache, offline baca cache

Tambah return: `historyData`

#### 2. `src/pages/authorize/history/index.jsx`

Ubah:
- Pake `historyData` sebagai sumber data list
- Detail: online → `show(id)`, offline → `setDetail(selected)` (dari list)

### Tidak Berubah

| File | Alasan |
|---|---|
| `services/offline/queue.js` | Ga perlu merge queue |
| `services/offline/syncManager.js` | Ga relevan |
| `services/offline/slice.js` | Ga relevan |
| `services/baseQuery.js` | Risiko tinggi |
| `services/sales/order/action.js` | Cuma definisi API |

## Verification

1. **Online** → buka `/history` → data server tampil
2. **Klik item** → detail fetch dari server ✅
3. **Offline** → buka `/history` → data cached tampil
4. **Klik item offline** → render dari data list ✅
5. **Online lagi** → fetch baru, cache di-update
