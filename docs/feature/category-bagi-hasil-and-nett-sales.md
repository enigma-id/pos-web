# Subtotal Nett Sales (Kategori Non-Bagi-Hasil) — Rencana & Implementasi

**Tanggal:** 2026-10-05
**Branch:** `v2`
**Scope FE:** `pos-web` — tampilkan baris + recompute offline (`updateSessionSummary`) + bawa flag di payload offline
**Scope BE:** `franq` — `is_bagi_hasil` di `/catalog` + brand via `OutletRepository` relation (sudah dikerjakan user)
**Status:** **Diimplementasikan** (FE). `npm run lint` 0 error, build sukses.

---

## 1. Ringkas

Kategori menu bisa ditandai **bagi hasil** (`is_bagi_hasil`). Sesi penjualan menyimpan nilai
**`summary.sales.subtotal_nett_non_bagi_hasil`** = Σ nett dari item yang kategorinya **bukan** bagi hasil.

Aturan **brand**: kalau brand outlet **bukan** bagi hasil → nilai di-set **0**; kalau brand bagi hasil →
Σ nett kategori non-bagi-hasil.

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
| Rumus subtotal (+ brand) | `backend/pos/src/usecase/sales_session.go:401-424` — `subtotalNettNonBagiHasil`: brand non-bagi-hasil / tak ditemukan → **0**; jika brand bagi hasil → Σ `total_nett` untuk `!IsBagiHasil` |
| Flag brand | `backend/pos/entity/brand.go:21` (`IsBagiHasil`); `Outlet.Brand` di `entity/outlet.go:26` |
| Brand ikut di response client | `backend/pos/src/repository/outlet.go:21` — relations `["Brand"]`, dipakai login (`usecase/auth.go`), `/profile/me` (`utility/session.go`) |
| Sumber per kategori | `backend/pos/src/repository/sales_order.go:159-172` — `sum(soi.unit_nett * soi.quantity) as total_nett`, `additional_id IS NULL`, `status='completed'` |
| Dipakai di tiap event order | `sales_session.go` created/updated/checkout/cancelled, dan offline-sync `sales_sync.go` |
| `is_bagi_hasil` per kategori | POS `GET /category` → `backend/pos/entity/category.go:18`; `GET /catalog` → `entity/pricing.go:10` |
| Migrasi & backfill | `backend/franchise/migrations/20261005000000_brand_bagi_hasil.*`, `20261006000100_category_bagi_hasil.*`, `backend/franchisor/migrations/20261006000000_franchisor_bagi_hasil.*` |

Temuan penting:

- `GET /catalog` sudah join `category` (`backend/pos/src/usecase/catalog.go:99`), dan `cat.is_bagi_hasil`
  sudah ditambahkan ke `entity.Pricing` + keempat query (`Get` field/fieldCustom, `Show` custom/non-custom;
  union balance 11 vs 11).
- Brand tidak pernah masuk ke client sebelumnya; sekarang `outlet.brand.is_bagi_hasil` ikut karena
  `OutletRepository` memuat relasi `Brand`.

### 2.1 Definisi & formula

```
brand_bagi_hasil            ? Σ total_nett(non-bagi-hasil) : 0
total_nett(per kategori)    = Σ(unit_nett × quantity)   -- item root, additional_id IS NULL
```

- Satuan `unit_nett` = harga setelah diskon, sebelum pajak (konsisten dengan `sales.subtotal_nett`).
- Addon tidak dihitung (`additional_id IS NULL`), sama seperti `category_solds`.
- Flag kategori di-resolve dari kondisi `category` **saat rekalkulasi** di server; di sisi offline kita
  memakai **snapshot `item.is_bagi_hasil`** dari `/catalog` (pola `point_percentage`).
- Flag brand di-resolve dari `outlet.brand.is_bagi_hasil` (dibawa dari login/`profile/me`).
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
| 4 | Sumber flag kategori (offline) | **Snapshot `item.is_bagi_hasil`** dari `GET /catalog` → cart → order (pola `point_percentage`, **tanpa fallback**) | Snapshot per item; item lama tanpa field dianggap `false` |
| 5 | Sumber flag brand (offline) | **`outlet.brand.is_bagi_hasil`** (dibawa dari login/`profile/me`, tersimpan di sesi lokal) | Mengikuti rule brand server |
| 6 | Rule brand (offline) | **Ikuti server**: brand bukan bagi hasil → `0`; brand bagi hasil → Σ | Biar offline = online |
| 7 | Metode offline | **Hitung ulang dari `category_solds`** tiap kali (assign hasil `reduce`, bukan delta) | Menghindari drift saat tambah/hapus order |
| 8 | Nilai 0 / negatif | **Baris selalu tampil**; nilai negatif **dibiarkan apa adanya** (server mengoreksi saat online) | Konsisten & sederhana |
| 9 | Sesi lama | Semua pembacaan pakai `|| 0` | Sesi di `cache_shifts` belum punya field ini |

---

## 4. Perubahan BE (franq) — sudah ada

| File | Perubahan |
|---|---|
| `backend/pos/entity/pricing.go` | + `IsBagiHasil bool \`bun:"is_bagi_hasil" json:"is_bagi_hasil"\`` |
| `backend/pos/src/usecase/catalog.go` `Get` `fieldSelect` | + `cat.is_bagi_hasil` |
| `backend/pos/src/usecase/catalog.go` `Get` `fieldCustomSelect` | + `cat.is_bagi_hasil` (**union balance**, 11 vs 11) |
| `backend/pos/src/usecase/catalog.go` `Show` `queryCatalog` (non-custom) | + `cat.is_bagi_hasil` |
| `backend/pos/src/usecase/catalog.go` `Show` `queryCustom` | + `cat.is_bagi_hasil` |
| `backend/pos/entity/brand.go` | + `IsBagiHasil` |
| `backend/pos/src/repository/outlet.go` | relations `["Brand"]` → `outlet.brand.is_bagi_hasil` ikut di login & `/profile/me` |
| `backend/pos/src/usecase/sales_session.go` | `subtotalNettNonBagiHasil(db, ctx, outletID, solds)` — cek brand, non-bagi-hasil → 0 |

Response `/catalog` & `/catalog/{id}` mengembalikan entity `Pricing` langsung, jadi field-nya otomatis
ke-expose ke FE. Query addon sengaja **tanpa** flag (addon tidak dihitung).

> Kalau `item.is_bagi_hasil` `undefined` (cache lama) → item dianggap non-bagi-hasil.
> Kalau `outlet.brand.is_bagi_hasil` `undefined` (sesi lama) → dianggap **bagi hasil** (subtotal tetap
> dihitung); server mengoreksi saat online.

---

## 5. Perubahan pos-web

### 5.1 Seed offline — `src/services/offline/shapes.js`

`makeStartSession` (`summary.sales`): tambah `subtotal_nett_non_bagi_hasil: 0`.

### 5.2 State awal Redux — `src/services/sales/session/slice.js`

`defineInitialState().sessionSummary.summary.sales`: tambah `subtotal_nett_non_bagi_hasil: 0`.

### 5.3 Bawa `is_bagi_hasil` ke payload offline (pola `point_percentage`)

`cart` → `addItem` sudah spread `...catalog`, jadi item dari katalog otomatis membawa `is_bagi_hasil`.
**6 mapping item offline** membangun object baru → field ditambah eksplisit, plus payload `/sales/sync`:

| # | Lokasi | Fungsi | Isi |
|---|---|---|---|
| 1 | `src/pages/authorize/home/checkout.jsx` | `onPayOffline` | `is_bagi_hasil: !!item.is_bagi_hasil` |
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

- Simpan `is_bagi_hasil` + `total_nett` pada tiap row:
  - Row baru: `is_bagi_hasil: !!item.is_bagi_hasil`,
    `total_nett: item.quantity * (item.unit_nett || 0)`.
  - Row existing: update `total_nett += item.quantity * item.unit_nett * qtyMultiplier`
    (`qtyMultiplier` `-1` untuk `deleted_payment`).
  - `total_charges` **tidak diubah** (tetap `quantity * (unit_nett - unit_discount)`).
- Setelah loop, hitung ulang sekali (assign hasil `reduce`, bukan delta) + rule brand:
  ```js
  const brandIsBagiHasil = updatedSummary?.outlet?.brand?.is_bagi_hasil !== false;

  updatedSummary.summary.sales.subtotal_nett_non_bagi_hasil = brandIsBagiHasil
    ? (updatedSummary.summary.category_solds || [])
        .filter(row => !row.is_bagi_hasil)
        .reduce((total, row) => total + (row.total_nett || 0), 0)
    : 0;
  ```

### 5.5 Print Summary — `src/components/ui/summary.jsx`

Blok row "Subtotal Nett Sales" setelah blok Grand Total, gaya `div` flex sama:
`{currencyFormat(data?.summary?.sales?.subtotal_nett_non_bagi_hasil, false)}`.

### 5.6 Panel Close Session — `src/pages/authorize/home/closeSession.jsx`

```jsx
<List
  title="Subtotal Nett Sales"
  value={currencyFormat(data?.summary?.sales?.subtotal_nett_non_bagi_hasil || 0)}
/>
```

### 5.7 Detail Shift — `src/pages/authorize/shifts/index.jsx`

Row "Subtotal Nett Sales" setelah row "Grand Total", gaya flex sama,
`currencyFormat(detail?.summary?.sales?.subtotal_nett_non_bagi_hasil || 0)`.

### 5.8 Spec — `specs/api-contract.md`

§`GET /sales/session/summary`: tambah `subtotal_nett_non_bagi_hasil` di `sales`, `is_bagi_hasil` +
`total_nett` di contoh `category_sold`.

---

## 6. Edge Cases

| Kasus | Perilaku yang diharapkan |
|---|---|
| Sesi lama di `cache_shifts` tanpa field | Dibaca `0` (`|| 0`) |
| Brand non-bagi-hasil | `Subtotal Nett Sales = 0` (baris tetap tampil) |
| Brand bagi hasil | Σ nett kategori non-bagi-hasil |
| `outlet.brand` tidak ada (sesi/cache lama) | Dianggap bagi hasil → subtotal tetap dihitung; server mengoreksi online |
| Item lama/cache katalog tanpa `is_bagi_hasil` | Dianggap non-bagi-hasil (`false`); server mengoreksi saat online/sync |
| Kategori bagi hasil ("Koperasi") | Nett-nya **tidak** ikut subtotal; tetap ada di `Grand Total` |
| Semua kategori non-bagi-hasil (brand bagi hasil) | `Subtotal Nett Sales` = `Grand Total` |
| `deleted_payment` | Row `category_solds` minus; subtotal dihitung ulang dari row (bisa negatif, dibiarkan) |
| Custom catalog | Ikut flag dari kategorinya (union query balance) |
| Addon | Tidak dihitung (loop hanya `data.order.items` root) |
| Online | Nilai dibaca langsung dari response `summary()` (server sudah brand-aware) |

---

## 7. Verifikasi

1. **BE `/catalog` GET** → tiap item punya `is_bagi_hasil`; `/catalog/{id}` normal & custom juga.
2. **BE login/`profile/me`** → `outlet.brand.is_bagi_hasil` ada.
3. `npm run lint` → 0 error; `npm run build` sukses.
4. **Online:** order campur kategori bagi-hasil & non → tutup sesi → cek baris "Subtotal Nett Sales" di
   panel Close Session, print, Detail Shift; samakan dengan response `summary.sales.subtotal_nett_non_bagi_hasil`.
5. **Offline brand bagi hasil:** buat order campur → subtotal = Σ non-bagi-hasil; sync → tetap sama.
6. **Offline brand NON-bagi-hasil:** subtotal tampil **0**; sync → tetap 0.
7. **Batal pembayaran offline** (`deleted_payment`) → subtotal turun konsisten.

---

## 8. Risiko / Catatan

- **Cache katalog lama** (`catalog_pricing_<channelId>`) belum punya `is_bagi_hasil` sampai refetch online
  → item seperti itu dihitung non-bagi-hasil lokal (server tetap benar).
- **Sesi lokal lama** belum punya `outlet.brand` → dianggap bagi hasil sampai sesi baru; server mengoreksi
  saat online.
- **Perbedaan basis hitung** bila diskon item & kategori bertumpuk: server memakai `unit_nett` setelah fold
  diskon, client memakai `item.unit_nett` dari order payload. Dampaknya hanya angka **offline**.
- Dokumen BE (`franq/docs/feature/category-bagi-hasil-and-nett-sales.md`) menyatakan POS tidak perlu
  diubah — benar untuk **recompute server**, tetapi **tampilan + hitung offline + bawa flag** tetap butuh
  perubahan di `pos-web` (dan `is_bagi_hasil` di `/catalog` + relasi brand) seperti di atas.
