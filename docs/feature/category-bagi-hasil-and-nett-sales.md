# Subtotal Nett Sales (Bagi Hasil) — Rencana & Implementasi

**Tanggal:** 2026-10-05
**Branch:** `v2`
**Scope FE:** `pos-web` — tampilkan baris + recompute offline (`updateSessionSummary`) + bawa flag di payload offline
**Scope BE:** `franq` — `is_non_bagi_hasil` (kategori) + `is_bagi_hasil` (brand) + `subtotal_nett_bagi_hasil` (sudah dikerjakan user)
**Status:** **Diimplementasikan** (FE). `npm run lint` 0 error, build sukses.

---

## 1. Ringkas

Kategori menu bisa ditandai **non-bagi-hasil** lewat flag `is_non_bagi_hasil` (contoh: **"Koperasi"**).
Sesi penjualan menyimpan **`summary.sales.subtotal_nett_bagi_hasil`** = Σ nett item yang kategorinya
**bagi hasil** (`is_non_bagi_hasil = false`).

Aturan **brand**: kalau brand outlet **bukan** bagi hasil → nilai di-set **0**; kalau brand bagi hasil →
Σ nett kategori bagi hasil.

Tujuan FE: menampilkan baris **"Subtotal Nett Sales"** tepat setelah **Grand Total** pada tiga view
sales session summary, dan memastikan nilainya benar saat **offline**.

Tiga view:

1. **Print Summary** — struk CASHIER REPORT — `src/components/ui/summary.jsx`
2. **Panel "Sales Session"** (di layar) — `src/pages/authorize/home/closeSession.jsx`
3. **Detail Shift** (riwayat sesi) — `src/pages/authorize/shifts/index.jsx`

> **Konvensi flag:** `is_non_bagi_hasil = true` → kategori **bukan** bagi hasil (mis. Koperasi) → **tidak**
> masuk subtotal. Default `false` → kategori bagi hasil → masuk subtotal. Flag brand tetap
> `is_bagi_hasil` (makna: brand melakukan bagi hasil).

---

## 2. Verifikasi BE (franq)

Key data ada di POS `GET /sales/session/summary`:

| Hal | Bukti |
|---|---|
| Field nilai | `backend/pos/entity/sales_session_summary.go:14` (`SubtotalNettBagiHasil float64 \`json:"subtotal_nett_bagi_hasil"\``) |
| Flag kategori di `category_solds[]` | `.../sales_session_summary.go:45` (`IsNonBagiHasil bool \`json:"is_non_bagi_hasil"\``) + `total_nett` |
| Rumus subtotal (+ brand) | `backend/pos/src/usecase/sales_session.go:401-424` — brand non-bagi-hasil / tak ditemukan → **0**; jika brand bagi hasil → Σ `total_nett` untuk `!IsNonBagiHasil` |
| Flag brand | `backend/pos/entity/brand.go:21` (`IsBagiHasil`); `Outlet.Brand` di `entity/outlet.go:26` |
| Brand ikut di response client | `backend/pos/src/repository/outlet.go:21` — relations `["Brand"]` (dipakai login `usecase/auth.go` & `/profile/me` `utility/session.go`) |
| Sumber per kategori | `backend/pos/src/repository/sales_order.go:159-172` — `sum(soi.unit_nett * soi.quantity) as total_nett`, `cc.is_non_bagi_hasil`, `additional_id IS NULL`, `status='completed'` |
| `is_non_bagi_hasil` per item | POS `GET /catalog` → `entity/pricing.go:10`; `GET /category` → `entity/category.go:18` |
| Migrasi corrective | `backend/franchisor/migrations/20261007000000_menu_category_non_bagi_hasil.*`, `backend/franchise/migrations/20261007000000_non_bagi_hasil_rename.*` |

Temuan penting:

- `GET /catalog` (`CatalogUsecase.Get`/`Show`, `entity.Pricing`) mengembalikan `is_non_bagi_hasil` per item
  (keempat query; union tetap balance 11 vs 11).
- Brand tidak pernah masuk ke client sebelumnya; sekarang `outlet.brand.is_bagi_hasil` ikut karena
  `OutletRepository` memuat relasi `Brand`.

### 2.1 Definisi & formula

```
brand_bagi_hasil ?  Σ total_nett(kategori bagi hasil)  :  0
kategori bagi hasil   =  is_non_bagi_hasil = false
total_nett            =  Σ(unit_nett × quantity)   -- item root, additional_id IS NULL
```

- Satuan `unit_nett` = harga setelah diskon, sebelum pajak (konsisten dengan `sales.subtotal_nett`).
- Addon tidak dihitung (`additional_id IS NULL`), sama seperti `category_solds`.
- Flag kategori di-resolve dari kondisi `category` **saat rekalkulasi** di server; di sisi offline kita
  memakai **snapshot `item.is_non_bagi_hasil`** dari `/catalog` (pola `point_percentage`).
- Flag brand di-resolve dari `outlet.brand.is_bagi_hasil` (dibawa dari login/`profile/me`).
- `total_nett` memakai `unit_nett` (bukan `unit_nett - unit_discount`) — di client, `item.unit_nett`
  setara `soi.unit_nett` (terbukti dari `shapes.js` `subtotal_nett`), berbeda dari `total_charges`
  `category_solds` yang memakai `unit_nett - unit_discount`.

---

## 3. Keputusan

| # | Topik | Keputusan | Alasan |
|---|---|---|---|
| 1 | Key data | **`summary.sales.subtotal_nett_bagi_hasil`** | Sesuai response BE |
| 2 | Label UI | **"Subtotal Nett Sales"** | Sesuai permintaan (nilai = porsi bagi hasil) |
| 3 | Scope view | **3 view**: print, panel close session, detail shift | Konsisten di semua tempat Grand Total muncul |
| 4 | Flag kategori (offline) | **Snapshot `item.is_non_bagi_hasil`** dari `GET /catalog` → cart → order (pola `point_percentage`, **tanpa fallback**) | Snapshot per item; item lama tanpa field → `false` (= bagi hasil) |
| 5 | Flag brand (offline) | **`outlet.brand.is_bagi_hasil`** (dari login/`profile/me`, tersimpan di sesi lokal) | Mengikuti rule brand server |
| 6 | Rule brand (offline) | **Ikuti server**: brand bukan bagi hasil → `0`; brand bagi hasil → Σ | Biar offline = online |
| 7 | Metode offline | **Hitung ulang dari `category_solds`** tiap kali (assign hasil `reduce`, bukan delta) | Menghindari drift saat tambah/hapus order |
| 8 | Nilai 0 / negatif | **Baris selalu tampil**; nilai negatif **dibiarkan apa adanya** (server mengoreksi saat online) | Konsisten & sederhana |
| 9 | Sesi lama | Semua pembacaan pakai `|| 0` | Sesi di `cache_shifts` belum punya field ini |

---

## 4. Perubahan BE (franq) — sudah ada

| File | Perubahan |
|---|---|
| `backend/pos/entity/pricing.go` | `IsNonBagiHasil` (`json:"is_non_bagi_hasil"`) |
| `backend/pos/src/usecase/catalog.go` `Get` `fieldSelect` / `fieldCustomSelect` | + `cat.is_non_bagi_hasil` (union balance 11 vs 11) |
| `backend/pos/src/usecase/catalog.go` `Show` `queryCatalog` (non-custom) / `queryCustom` | + `cat.is_non_bagi_hasil` |
| `backend/pos/entity/category.go` | `IsNonBagiHasil` |
| `backend/pos/entity/brand.go` | `IsBagiHasil` |
| `backend/pos/src/repository/outlet.go` | relations `["Brand"]` → `outlet.brand.is_bagi_hasil` ikut di login & `/profile/me` |
| `backend/pos/entity/sales_session_summary.go` | `SubtotalNettBagiHasil` (`json:"subtotal_nett_bagi_hasil"`), `category_solds[].IsNonBagiHasil` |
| `backend/pos/src/usecase/sales_session.go` | `subtotalNettBagiHasil(db, ctx, outletID, solds)` — cek brand; Σ `!IsNonBagiHasil` |
| `backend/pos/src/repository/sales_order.go` | `GetCategoriesBySession` seleksi `cc.is_non_bagi_hasil` |
| `backend/franchise/migrations/20261007000000_non_bagi_hasil_rename.*` | rename kolom + key JSONB (`subtotal_nett_non_bagi_hasil` → `subtotal_nett_bagi_hasil`, `is_bagi_hasil` → `is_non_bagi_hasil`) |
| `backend/franchisor/migrations/20261007000000_menu_category_non_bagi_hasil.*` | rename kolom `menu_category.is_bagi_hasil` → `is_non_bagi_hasil` |

> Kalau `item.is_non_bagi_hasil` `undefined` (cache lama) → item dianggap bagi hasil (ikut subtotal).
> Kalau `outlet.brand.is_bagi_hasil` `undefined` (sesi lama) → dianggap bagi hasil juga. Server
> mengoreksi saat online.

---

## 5. Perubahan pos-web

### 5.1 Seed offline — `src/services/offline/shapes.js`

`makeStartSession` (`summary.sales`): `subtotal_nett_bagi_hasil: 0`.

### 5.2 State awal Redux — `src/services/sales/session/slice.js`

`defineInitialState().sessionSummary.summary.sales`: `subtotal_nett_bagi_hasil: 0`.

### 5.3 Bawa `is_non_bagi_hasil` ke payload offline (pola `point_percentage`)

`cart` → `addItem` sudah spread `...catalog`, jadi item dari katalog otomatis membawa
`is_non_bagi_hasil`. **6 mapping item offline** membangun object baru → field ditambah eksplisit,
plus payload `/sales/sync`:

| # | Lokasi | Fungsi | Isi |
|---|---|---|---|
| 1 | `src/pages/authorize/home/checkout.jsx` | `onPayOffline` | `is_non_bagi_hasil: !!item.is_non_bagi_hasil` |
| 2 | `src/pages/authorize/home/checkout.jsx` | `onCreateBillOffline` | idem |
| 3 | `src/pages/authorize/home/checkout.jsx` | `onUpdateBillOffline` | idem |
| 4 | `src/pages/authorize/home/cart.jsx` | `onCreateBillOffline` | idem |
| 5 | `src/pages/authorize/home/cart.jsx` | `onUpdateBillOffline` | idem |
| 6 | `src/services/cart/slice.js` | `convertApiOrderToCartItem` (open bill) | idem |
| 7 | `src/services/offline/syncManager.js` | `mapItemsToSync` (`/sales/sync`) | idem |

`makeCompletedOrder` / `makePendingBill` (`shapes.js`) men-spread item, jadi nilainya ikut tersimpan ke
IndexedDB & cache.

### 5.4 Offline recompute engine — `src/services/sales/session/hook.js`

Di `updateSessionSummary`, cabang `payment` / `deleted_payment`, loop `// --- CATEGORY SOLDS ---`:

- Simpan `is_non_bagi_hasil` + `total_nett` pada tiap row:
  - Row baru: `is_non_bagi_hasil: !!item.is_non_bagi_hasil`,
    `total_nett: item.quantity * (item.unit_nett || 0)`.
  - Row existing: update `total_nett += item.quantity * item.unit_nett * qtyMultiplier`
    (`qtyMultiplier` `-1` untuk `deleted_payment`).
  - `total_charges` **tidak diubah** (tetap `quantity * (unit_nett - unit_discount)`).
- Setelah loop, hitung ulang sekali (assign hasil `reduce`, bukan delta) + rule brand:
  ```js
  const brandIsBagiHasil = updatedSummary?.outlet?.brand?.is_bagi_hasil !== false;

  updatedSummary.summary.sales.subtotal_nett_bagi_hasil = brandIsBagiHasil
    ? (updatedSummary.summary.category_solds || [])
        .filter(row => !row.is_non_bagi_hasil)   // kategori bagi hasil
        .reduce((total, row) => total + (row.total_nett || 0), 0)
    : 0;
  ```

### 5.5 Print Summary — `src/components/ui/summary.jsx`

Blok row "Subtotal Nett Sales" setelah blok Grand Total, gaya `div` flex sama:
`{currencyFormat(data?.summary?.sales?.subtotal_nett_bagi_hasil, false)}`.

### 5.6 Panel Close Session — `src/pages/authorize/home/closeSession.jsx`

```jsx
<List
  title="Subtotal Nett Sales"
  value={currencyFormat(data?.summary?.sales?.subtotal_nett_bagi_hasil || 0)}
/>
```

### 5.7 Detail Shift — `src/pages/authorize/shifts/index.jsx`

Row "Subtotal Nett Sales" setelah row "Grand Total", gaya flex sama,
`currencyFormat(detail?.summary?.sales?.subtotal_nett_bagi_hasil || 0)`.

### 5.8 Spec — `specs/api-contract.md`

§`GET /sales/session/summary`: `subtotal_nett_bagi_hasil` di `sales`, `is_non_bagi_hasil` + `total_nett`
di contoh `category_sold`.

---

## 6. Edge Cases

| Kasus | Perilaku yang diharapkan |
|---|---|
| Sesi lama di `cache_shifts` tanpa field | Dibaca `0` (`|| 0`) |
| Brand non-bagi-hasil | `Subtotal Nett Sales = 0` (baris tetap tampil) |
| Brand bagi hasil | Σ nett kategori bagi hasil (mis. semua kecuali Koperasi) |
| `outlet.brand` tidak ada (sesi/cache lama) | Dianggap bagi hasil → subtotal dihitung; server mengoreksi online |
| Item lama/cache katalog tanpa `is_non_bagi_hasil` | Dianggap **bagi hasil** (`false`) → ikut subtotal; server mengoreksi saat online/sync |
| Kategori "Koperasi" (`is_non_bagi_hasil = true`) | Nett-nya **tidak** ikut subtotal; tetap ada di `Grand Total` |
| Semua kategori bagi hasil | `Subtotal Nett Sales` = `Grand Total` |
| Semua kategori non-bagi-hasil | `Subtotal Nett Sales = 0` (baris tetap tampil) |
| `deleted_payment` | Row `category_solds` minus; subtotal dihitung ulang dari row (bisa negatif, dibiarkan) |
| Custom catalog | Ikut flag dari kategorinya (union query balance) |
| Addon | Tidak dihitung (loop hanya `data.order.items` root) |
| Online | Nilai dibaca langsung dari response `summary()` (server sudah brand-aware) |

---

## 7. Verifikasi

1. **BE `/catalog` GET** → tiap item punya `is_non_bagi_hasil`; `/catalog/{id}` normal & custom juga.
2. **BE login/`profile/me`** → `outlet.brand.is_bagi_hasil` ada.
3. `npm run lint` → 0 error; `npm run build` sukses.
4. **Online:** order campur kategori bagi-hasil & non → tutup sesi → cek baris "Subtotal Nett Sales" di
   panel Close Session, print, Detail Shift; samakan dengan response `summary.sales.subtotal_nett_bagi_hasil`.
5. **Offline brand bagi hasil:** buat order campur → subtotal = Σ bagi hasil; sync → tetap sama.
6. **Offline brand NON-bagi-hasil:** subtotal tampil **0**; sync → tetap 0.
7. **Batal pembayaran offline** (`deleted_payment`) → subtotal turun konsisten.

---

## 8. Risiko / Catatan

- **Cache katalog lama** (`catalog_pricing_<channelId>`) belum punya `is_non_bagi_hasil` sampai refetch
  online → item seperti itu dianggap bagi hasil lokal (server tetap benar).
- **Sesi lokal lama** belum punya `outlet.brand` → dianggap bagi hasil sampai sesi baru; server mengoreksi
  saat online.
- **Perbedaan basis hitung** bila diskon item & kategori bertumpuk: server memakai `unit_nett` setelah fold
  diskon, client memakai `item.unit_nett` dari order payload. Dampaknya hanya angka **offline**.
- Dokumen BE (`franq/docs/feature/category-bagi-hasil-and-nett-sales.md`) menyatakan POS tidak perlu
  diubah — benar untuk **recompute server**, tetapi **tampilan + hitung offline + bawa flag** tetap butuh
  perubahan di `pos-web` seperti di atas.
