# Saved Bills: Merge Offline Queue Data

## Problem

Saat ini, page Saved Bills (`/bills`) dan modal "Open Bill" hanya membaca data dari `GET /sales/order/openbill` (server). Sedangkan save bill yang dilakukan saat **offline** disimpan di IndexedDB (offline queue) dan **tidak muncul** di Saved Bills.

Data offline save bill cuma bisa dilihat dari **Queue Manager drawer** (tab Bills).

## Tujuan

Menampilkan data offline queue (pending save bills) bersamaan dengan data server di halaman Saved Bills tanpa duplikasi.

## Batasan (Ga Disentuh)

- **Queue Manager (PendingDrawer)** tetap pure dari IndexedDB — ga berubah
- **IndexedDB queue (`services/offline/queue.js`)** — ga berubah
- **Sync manager (`syncManager.js`)** — ga berubah
- **BaseQuery interceptor (`baseQuery.js`)** — ga berubah
- **Redux slice Offline** — ga berubah

## Dedup Strategy

Queue items di-merge ke server data, lalu di-filter: **skip queue items yang `ticket`-nya sudah match dengan server data**.

Key unique: `body.ticket` (bill name).

| Scenario | Server | Queue | Dedup | Result |
|---|---|---|---|---|
| Save bill online | `ticket: "A"` | — | — | 1 item |
| Save bill offline | — | `ticket: "A"` | skip (ga ada server match) | 1 item |
| Sync sukses → server punya | `ticket: "A"` | ❌ (removed) | — | 1 item |
| Sync failed | — | `ticket: "A"` | skip (ga ada server match) | 1 item |
| Offline save + online save (nama beda) | `ticket: "A"` | `ticket: "B"` | B ≠ A → masuk | 2 item |
| Offline save + SAME name (blm sync) | — | `ticket: "A"` | ga ada server match | 1 item |
| SAME name (udah sync tp msh pending) | `ticket: "A"` | `ticket: "A"` | MATCH → skip queue | 1 item ✅ no dupe |

## Desain

### Arsitektur

Consumer (bills page, cart, saveBill modal) tetap panggil `bill()` dari `useCart` seperti biasa. Bedanya, `bill()` sekarang:

1. Fetch `GET /sales/order/openbill` (server) — kalo gagal, fallback ke array kosong
2. Baca offline queue via `getQueue(userId)` — filter pending save-bills
3. Transform queue items → shape API response
4. Dedup: skip queue items yg `ticket` match dgn server
5. Return merged array: `[...serverData, ...offlineQueueItems]`

### Queue Item → API Response Shape Mapping

| API Response Field | Sumber |
|---|---|
| `id` | `preview.id` atau `item.id` |
| `bill_name` | `preview.bill_name` |
| `ticket` | `body.ticket` |
| `total_charges` | `preview.total_charges` |
| `code` | `preview.code` (format: `OFF-{localId}`) |
| `ordered_at` | `preview.created_at` |
| `items` | `preview.items` |
| `from_queue` | `true` (flag) |
| `queue_id` | `item.id` (IndexedDB key) |

### Detail Fetch (show bill)

Kalo user klik bill hasil offline queue, ID-nya adalah **local ID** — ga bisa `GET /sales/order/{id}` (server ga kenal).

- Deteksi: `data.from_queue === true` → langsung pake `data` sebagai detail
- Ga perlu fetch server

## Files Berubah

### 1. `src/services/cart/hook.js`

- `bill()` → hybrid: fetch server + ambil queue items + dedup
- `onBillSelected()` → fallback offline: kalo item dari queue, langsung dispatch `loadOfflineBill` tanpa hit server
- Export `getOfflinePendingBills()` (optional) atau inline di `bill()`

### 2. `src/pages/authorize/bills/index.jsx`

- List sidebar pake data hasil merge dari `bill()`
- Detail: kalo `from_queue === true`, render langsung dari data (no API call)
- Badge/indicator kalo bill masih "pending sync" / "offline"

### 3. `src/pages/authorize/home/saveBill.jsx`

- Modal "Open Bill" pake data hasil merge
- Kalo item dari queue, `onBillSelected` fallback pake `loadOfflineBill`

### 4. `src/pages/authorize/home/cart.jsx`

- Badge count "Open Bill (N)" otomatis karena pake data merger
- Ga perlu ubah logic — tinggal consumer data

## Tidak Berubah

| File | Alasan |
|---|---|
| `services/offline/queue.js` | Fungsi (`getQueue`, `getQueueByStatus`) udah cukup |
| `services/offline/syncManager.js` | Ga relevan |
| `services/offline/slice.js` | Ga relevan |
| `services/baseQuery.js` | Risiko tinggi, ga perlu |
| `services/cart/action.js` | Cuma definisi API call |
| `services/cart/slice.js` | Udah ada `loadOfflineBill` |
| `components/ui/offline/*` | Queue Manager tetap pure queue |

## Verification

1. **Save bill offline** → cek muncul di Saved Bills page + modal "Open Bill"
2. **Save bill online** → tetep muncul, ga ada duplikasi
3. **Save bill offline → sync sukses** → muncul sekali dari server
4. **Save bill SAME name online + offline** → cuma muncul 1× (dedup by ticket)
5. **Buka detail bill dari offline queue** → render dari local data, bukan fetch server
6. **Queue Manager** tetep nampilin semua pending items (termasuk yg udah muncul di Saved Bills)
7. **Refresh page** → data tetap konsisten
