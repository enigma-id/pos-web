# Subtotal Nett Sales (Kategori Non-Bagi-Hasil) — Rencana & Implementasi

**Tanggal:** 2026-10-05
**Branch:** `v2`
**Scope FE:** `pos-web` — tampilkan baris + recompute offline (`updateSessionSummary`) + bawa flag di payload offline
**Scope BE:** `franq` — **perlu tambah `is_bagi_hasil` ke `GET /catalog`** (seperti dulu `point_percentage`); summary sudah ada
**Status:** **Rencana.** Belum diimplementasikan.

---

## 1. Ringkas

Kategori menu bisa ditandai **bagi hasil** (`is_bagi_hasil`). Sesi penjualan menyimpan nilai
**`summary.sales.subtotal_nett_non_bagi_hasil`** = Σ nett dari item yang kategorinya **bukan** bagi hasil.

Tujuan FE: menampilkan baris **"Subtotal Nett Sales"** tepat setelah **Grand Total** pada tiga view
sales session summary, dan memastikan nilainya benar saat **offline**.

Tiga view:

1. **Print Summary** — struk CASHIER REPORT — `src/components/ui/summary.jsx`
2. **Panel "Sales Session"** (di layar) — `src/pages/authorize/home/closeSession.jsx`
3. **Detail Shift** (riwayat sesi) — `src/pages/authorize/shifts/index.jsx`

> Catatan penamaan: permintaan awal menyebut `subtotal_nett_sales`, tetapi key data di response BE adalah
> **`subtotal_nett_non_bagi_hasil`**. Label UI tetap **"Subtotal Nett Sales"**.

---

## 2. Verifikasi BE (franq)

Key data ada di POS `GET /sales/session/summary`:

| Hal | Bukti |
|---|---|
| Struct summary `sales` | `backend/pos/entity/sales_session_summary.go:14` (`SubtotalNettNonBagiHasil float64 \`json:"subtotal_nett_non_bagi_hasil"\``) |
| Struct sama di franchise | `backend/franchise/entity/sales_session_summary.go:14` |
| `category_solds[]` membawa flag & nett | `.../sales_session_summary.go:43-49` (`category_name`, `is_bagi_hasil`, `total_qty`, `total_charges`, `total_nett`) |
| Rumus subtotal | `backend/pos/src/usecase/sales_session.go:401-411` — `subtotalNettNonBagiHasil = Σ total_nett` untuk `!IsBagiHasil` |
| Sumber per kategori | `backend/pos/src/repository/sales_order.go:159-172` — `sum(soi.unit_nett * soi.quantity) as total_nett`, `additional_id IS NULL`, `status='completed'` |
| Dipakai di tiap event order | `sales_session.go:289` (created), `:337` (updated), `:386` (checkout), `:455` (cancelled), dan offline-sync `sales_sync.go:1348` |
| `is_bagi_hasil` per kategori | POS `GET /category` → `backend/pos/entity/category.go:18` |
| Backfill data lama | `backend/franchise/migrations/20261005000000_category_bagi_hasil.up.sql:12-30` |

Temuan penting:

- **`is_bagi_hasil` belum ada di `GET /catalog` (pricing)** dan di order/order-item payload → FE offline
  belum bisa tahu kategori mana bagi hasil.
- `GET /catalog` sudah join `category` (`backend/pos/src/usecase/catalog.go:99`), jadi menambah
  `cat.is_bagi_hasil` ke `entity.Pricing` mengikuti pola `point_percentage`.

### 2.1 Definisi & formula

```
subtotal_nett_non_bagi_hasil = Σ total_nett(category_solds)  untuk is_bagi_hasil = false
total_nett(per kategori)     = Σ(unit_nett × quantity)       -- item root, additional_id IS NULL
```

- Satuan `unit_nett` = harga setelah diskon, sebelum pajak (konsisten dengan `sales.subtotal_nett`).
- Addon tidak dihitung (`additional_id IS NULL`), sama seperti `category_solds`.
- Flag di-resolve dari kondisi `category` **saat rekalkulasi** di server; di sisi offline kita memakai
  **snapshot `item.is_bagi_hasil`** yang dibawa dari `/catalog` (pola `point_percentage`).
- `total_nett` memakai `unit_nett` (bukan `unit_nett - unit_discount`) — di client, `item.unit_nett`
  setara `soi.unit_nett` (terbukti dari `shapes.js` `subtotal_nett`), berbeda dari `total_charges`
  `category_solds` yang memakai `unit_nett - unit_discount`.

---

## 3. Keputusan

| # | Topik | Keputusan | Alasan |
|---|---|---|---|
| 1 | Key data | **`summary.sales.subtotal_nett_non_bagi_hasil`** | Sudah tersedia di response BE |
| 2 | Label UI | **"Subtotal Nett Sales"** | Sesuai permintaan |
| 3 | Scope view | **3 view**: print, panel close session, detail shift | Konsisten di semua tempat Grand Total muncul |
| 4 | Sumber offline | **Snapshot `item.is_bagi_hasil`** yang dibawa dari `GET /catalog` → cart → order (pola `point_percentage`, **tanpa fallback**) | Snapshot per item; item lama tanpa field dianggap `false` |
| 5 | Metode offline | **Hitung ulang dari `category_solds`** tiap kali (assign hasil `reduce`, bukan delta) | Menghindari drift saat tambah/hapus order |
| 6 | Nilai 0 / negatif | **Baris selalu tampil**; nilai negatif **dibiarkan apa adanya** (server mengoreksi saat online) | Konsisten & sederhana |
| 7 | Sesi lama | Semua pembacaan pakai `|| 0` | Sesi di `cache_shifts` belum punya field ini |

---

## 4. Perubahan BE (franq) — prasyarat

Mengikuti pola `point_percentage` (`docs/feature/offline-membership-point.md` §3):

| File | Perubahan |
|---|---|
| `backend/pos/entity/pricing.go` | + `IsBagiHasil bool \`bun:"is_bagi_hasil" json:"is_bagi_hasil"\`` |
| `backend/pos/src/usecase/catalog.go` `Get` `fieldSelect` | + `cat.is_bagi_hasil` (query katalog biasa) |
| `backend/pos/src/usecase/catalog.go` `Get` `fieldCustomSelect` | + `cat.is_bagi_hasil` (query custom — **union harus tetap balance**, jumlah kolom 10 → 11 di keduanya) |
| `backend/pos/src/usecase/catalog.go` `Show` `queryCatalog` (non-custom) | + `cat.is_bagi_hasil` |
| `backend/pos/src/usecase/catalog.go` `Show` `queryCustom` | + `cat.is_bagi_hasil` |

Response `/catalog` & `/catalog/{id}` mengembalikan entity `Pricing` langsung, jadi field-nya otomatis
ke-expose ke FE. Query addon sengaja **tanpa** flag (addon tidak dihitung), sama seperti `point_percentage`.

> Tanpa perubahan BE ini, `item.is_bagi_hasil` akan `undefined` → semua item dianggap non-bagi-hasil
> (subtotal = total). Bagian tampilan online tetap benar karena nilainya dari server.

---

## 5. Perubahan pos-web

### 5.1 Seed offline — `src/services/offline/shapes.js`

`makeStartSession` (`summary.sales`, ± baris 13-21): tambah `subtotal_nett_non_bagi_hasil: 0`.

### 5.2 State awal Redux — `src/services/sales/session/slice.js`

`defineInitialState().sessionSummary.summary.sales`: tambah `subtotal_nett_non_bagi_hasil: 0`
(konsistensi; UI tetap pakai `|| 0`).

### 5.3 Bawa `is_bagi_hasil` ke payload offline (pola `point_percentage`)

`cart` → `addItem` sudah spread `...catalog`, jadi item yang di-add dari katalog otomatis membawa
`is_bagi_hasil`. Tapi **6 mapping item offline** membangun object baru → field harus ditambah eksplisit
(sama seperti `point_percentage`), plus payload `/sales/sync`:

| # | Lokasi | Fungsi | Isi |
|---|---|---|---|
| 1 | `src/pages/authorize/home/checkout.jsx:181` | `onPayOffline` | `is_bagi_hasil: !!item.is_bagi_hasil` |
| 2 | `src/pages/authorize/home/checkout.jsx:374` | `onCreateBillOffline` | idem |
| 3 | `src/pages/authorize/home/checkout.jsx:595` | `onUpdateBillOffline` | idem |
| 4 | `src/pages/authorize/home/cart.jsx:108` | `onCreateBillOffline` | idem |
| 5 | `src/pages/authorize/home/cart.jsx:315` | `onUpdateBillOffline` | idem |
| 6 | `src/services/cart/slice.js:258` | `convertApiOrderToCartItem` (open bill) | idem |
| 7 | `src/services/offline/syncManager.js:85` | `mapItemsToSync` (`/sales/sync`) | idem |

`makeCompletedOrder` / `makePendingBill` (`shapes.js`) men-spread item, jadi begitu field-nya ada di
mapping, nilainya ikut tersimpan ke IndexedDB & cache.

### 5.4 Offline recompute engine — `src/services/sales/session/hook.js`

Di `updateSessionSummary`, cabang `payment` / `deleted_payment`, loop `// --- CATEGORY SOLDS ---`
(baris 176-219):

- Simpan `is_bagi_hasil` + `total_nett` pada tiap row:
  - Row baru: `is_bagi_hasil: !!item.is_bagi_hasil`,
    `total_nett: item.quantity * (item.unit_nett || 0)`.
  - Row existing: update `total_nett += item.quantity * item.unit_nett * qtyMultiplier`
    (`qtyMultiplier` sudah ada, `-1` untuk `deleted_payment`).
  - `total_charges` **tidak diubah** (tetap `quantity * (unit_nett - unit_discount)`).
- Setelah loop, hitung ulang sekali (assign hasil `reduce`, bukan delta):
  ```js
  updatedSummary.summary.sales.subtotal_nett_non_bagi_hasil = (
    updatedSummary.summary.category_solds || []
  )
    .filter(r => !r.is_bagi_hasil)
    .reduce((s, r) => s + (r.total_nett || 0), 0);
  ```
- Sesi lama: `updatedSummary.summary.sales.subtotal_nett_non_bagi_hasil` ditimpa hasil hitung di atas,
  jadi tidak perlu fallback khusus.

### 5.5 Print Summary — `src/components/ui/summary.jsx`

Tambah blok row "Subtotal Nett Sales" setelah blok Grand Total (baris 225-237), gaya `div` flex sama:
`{currencyFormat(data?.summary?.sales?.subtotal_nett_non_bagi_hasil, false)}`.

### 5.6 Panel Close Session — `src/pages/authorize/home/closeSession.jsx`

Setelah `<List title="Grand Total" ... />` (baris 236):

```jsx
<List
  title="Subtotal Nett Sales"
  value={currencyFormat(data?.summary?.sales?.subtotal_nett_non_bagi_hasil || 0)}
/>
```

### 5.7 Detail Shift — `src/pages/authorize/shifts/index.jsx`

Row "Subtotal Nett Sales" setelah row "Grand Total" (baris 377-384), gaya flex sama,
`currencyFormat(detail?.summary?.sales?.subtotal_nett_non_bagi_hasil || 0)`.

### 5.8 Spec — `specs/api-contract.md`

§`GET /sales/session/summary` (baris 325-345): tambah `subtotal_nett_non_bagi_hasil` di `sales`,
`is_bagi_hasil` + `total_nett` di contoh `category_sold`, dan `is_bagi_hasil` di `GET /catalog`.

---

## 6. Edge Cases

| Kasus | Perilaku yang diharapkan |
|---|---|
| Sesi lama di `cache_shifts` tanpa field | Dibaca `0` (`|| 0`) |
| Item lama/cache katalog tanpa `is_bagi_hasil` | Dianggap non-bagi-hasil (`false`); server mengoreksi saat online/sync |
| Kategori bagi hasil ("Koperasi") | Nett-nya **tidak** ikut subtotal; tetap ada di `Grand Total` |
| Semua kategori non-bagi-hasil | `Subtotal Nett Sales` = `Grand Total` (bukan error) |
| Semua kategori bagi hasil | `Subtotal Nett Sales = 0` (baris tetap tampil) |
| `deleted_payment` | Row `category_solds` minus; subtotal dihitung ulang dari row (bisa negatif, dibiarkan) |
| Custom catalog | Ikut flag dari kategorinya (union query harus tetap balance) |
| Addon | Tidak dihitung (loop hanya `data.order.items` root) |
| Online | Nilai dibaca langsung dari response `summary()` |

---

## 7. Verifikasi

1. **BE `/catalog` GET** (dengan custom catalog ada) → tidak error; tiap item punya `is_bagi_hasil`.
   Cek juga `/catalog/{id}` untuk item normal & custom.
2. `npm run lint` → 0 error; `npm start` / build sukses.
3. **Online:** buat order campur kategori bagi-hasil & non → tutup sesi → cek baris "Subtotal Nett Sales"
   di panel Close Session, print preview, dan Detail Shift.
4. Bandingkan angka dengan response `GET /sales/session/summary`
   (`summary.sales.subtotal_nett_non_bagi_hasil`) — harus sama.
5. **Offline:** matikan jaringan, buat order campur kategori (termasuk item dari cache katalog lama) →
   cek panel Close Session (Offline mode); sync → pastikan nilai tetap sama setelah `summary()` refetch.
6. **Batal pembayaran offline** (`deleted_payment`) → subtotal turun konsisten.

---

## 8. Risiko / Catatan

- **Perlu perubahan BE** (`is_bagi_hasil` di `/catalog` + `entity.Pricing`). Tanpa itu, offline menghitung
  semua item sebagai non-bagi-hasil sampai sync; online tetap benar.
- **Cache katalog lama** (`catalog_pricing_<channelId>` di localStorage) belum punya `is_bagi_hasil`
  sampai refetch online → item seperti itu dihitung non-bagi-hasil secara lokal (server tetap benar).
- **Perbedaan basis hitung** bisa muncul bila diskon item & kategori bertumpuk: server memakai
  `unit_nett` setelah fold diskon, client memakai `item.unit_nett` dari order payload. Dampaknya hanya
  angka **offline**; begitu online nilai server yang menang.
- Dokumen BE (`franq/docs/feature/category-bagi-hasil-and-nett-sales.md`) menyatakan POS tidak perlu
  diubah — benar untuk **recompute server**, tetapi **tampilan + hitung offline + bawa flag** tetap butuh
  perubahan di `pos-web` (dan `is_bagi_hasil` di `/catalog`) seperti di atas.
