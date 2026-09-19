# Offline Membership Point Earn — Rencana Implementasi

**Tanggal:** 2026-09-19
**Branch:** `feat/member-point-payment`
**Scope FE:** `pos-web` (helper + checkout offline)
**Scope BE:** `franq` — sudah dikerjakan user (`point_percentage` di `/catalog`)
**Status:** Final — BE sudah lengkap & balance (§3.1); Q1–Q4 + P2 (F2) sudah diputuskan, siap implementasi

---

## 1. Masalah

Saat checkout **offline** dengan membership ter-attach, saldo **point** member tidak bertambah dan
tab **Point** di drawer membership tetap kosong — seolah member tidak dapat point. Setelah batch
sync jalan (balik online) dan data member di-fetch ulang, point-nya baru muncul.

## 2. Akar Masalah

Sisi server sudah benar — point **memang dihitung saat sync**, bukan saat checkout offline:

| Tempat | Bukti |
|---|---|
| `franq/backend/pos/src/usecase/sales_sync.go` `createOrderInTx` | `membershipUcase.Earned(...)` setelah order completed |
| `.../sales_sync.go` `completeSplitOrderInTx` | `Earned(...)` untuk split bill |
| `.../sales_sync.go` `completeExistingOrderInTx` | `Earned(...)` untuk cross-session |
| `franq/backend/pos/src/usecase/membership.go` `Earned` | hitung dari row `sales_order_item` persisten |
| `.../sales_sync.go` `resolvePointPercentage` | rate di-resolve server dari `category.point_percentage` |

Jadi yang bocor ada di **cache lokal frontend**. `onPayOffline`
(`src/pages/authorize/home/checkout.jsx`, blok `if (selectedMethod?.is_member_payment)`) cuma
mem-mirror 2 hal:

- `pointPay` → potong `point` + unshift `point_logs` `redeem`
- selain itu → potong `saldo` + unshift `saldo_logs`

**Tidak ada mirror untuk `earn`.** Padahal `PointHistorySection`
(`src/pages/authorize/membership/point-history.jsx`, `if (isOffline) setLogs(membership?.point_logs)`)
dan drawer detail (`data = showResult?.data?.data || membership`) saat offline membaca dari cache.
Hasilnya: sampai sync + refetch, member kelihatan "belum dapat point".

Catatan tambahan: guard `selectedMethod?.is_member_payment` bikin earn **juga** tidak ke-mirror untuk
order yang dibayar **cash/transfer tapi ada membership** — padahal server tetap memberi point
(keputusan #3 di `docs/feature/membership_point.md`: "Bayar pakai saldo/kartu tetap dapat point").

## 3. Perubahan BE yang Sudah Ada

User sudah menambah rate ke response `/catalog` (`franq`, uncommitted):

| File | Perubahan |
|---|---|
| `backend/pos/entity/pricing.go` | + `PointPercentage float64 \`bun:"point_percentage" json:"point_percentage"\`` |
| `backend/pos/src/usecase/catalog.go` `Get` | `fieldSelect` + `cat.point_percentage` |
| `backend/pos/src/usecase/catalog.go` `Show` | `queryCatalog` (non-custom) + `cat.point_percentage` |

Response `/catalog` & `/catalog/{id}` mengembalikan entity `Pricing` langsung
(`handler/rest/catalog/request_get.go` → `rest.NewResponseBody(data,...)`), jadi field-nya otomatis
ke-expose ke FE. Ini **lebih baik** dari rencana awal (pakai cache `categories`): rate-nya per item,
persis seperti snapshot `sales_order_item.point_percentage` di server.

### 3.1 Verifikasi BE (sudah balance ✅)

`Get` dibangun dari `UNION ALL` antara query katalog biasa (`fieldSelect`) dan query custom
(`fieldCustomSelect`). Keduanya sekarang sama-sama membawa `cat.point_percentage` dan **urutan
kolomnya match** (10 vs 10):

```
fieldSelect       : id, code, name, image, is_custom, category_id, category_name,
                    point_percentage, unit_nett, addons_json        → 10 kolom
fieldCustomSelect : id, code, name, image, is_custom, category_id, category_name,
                    point_percentage, unit_nett, addons_json        → 10 kolom
```

Ketiga jalur lain yang menghasilkan `entity.Pricing` juga sudah lengkap:

| Query | Status |
|---|---|
| `Get` non-custom (`fieldSelect`) | ✅ `cat.point_percentage` |
| `Get` custom (`fieldCustomSelect`) | ✅ `cat.point_percentage` |
| `Show` custom (`queryCustom`) | ✅ `cat.point_percentage` |
| `Show` non-custom (`queryCatalog`) | ✅ `cat.point_percentage` |

Query addon (`Show` → `queryAddons`, di-unmarshal ke `mx.Addons`) sengaja **tanpa**
`point_percentage` — addon memang tidak dapat point di server (`additional_id IS NULL`), dan
scan-nya lewat JSON jadi tidak error.

> Konsekuensi: karena custom catalog juga punya `category_id` + join `category`, custom item
> **ikut dapat rate** dari kategorinya. Kalau memang custom item mau dipaksa 0, tinggal hardcode
> `0.0 as point_percentage` (bukan menghapus kolomnya — union harus tetap balance).

---

## Keputusan

| # | Topik | Usulan | Alasan |
|---|---|---|---|
| 1 | Sumber kebenaran | **Server tetap authoritative** | `Earned` di sync sudah benar & idempotent (`point_log UNIQUE (reference_id, reference_type)`) |
| 2 | Rate | **`item.point_percentage`** dari `/catalog` (snapshot di cart item), fallback ke cache `categories` kalau kosong | Per item, sama seperti snapshot server; tidak perlu ubah BE |
| 3 | UX offline | **Optimistic local mirror `earn`** di `onPayOffline` | Konsisten dengan pola mirror `redeem`/`saldo` yang sudah ada |
| 4 | Sifat entri lokal | **Provisional** — begitu online, tab Point pakai API & drawer pakai `show()` | Divergensi lokal tidak pernah permanen |
| 5 | Cakupan earn | **Hanya `selectedMethod?.is_member_payment`** & bukan `pointPay` | Keputusan user (Q1) |

> **Keputusan final (2026-09-19):**
> - **Q1** — mirror `earn` **hanya** untuk member payment (bukan cash/transfer). Satu guard yang sama
>   dengan redeem/saldo.
> - **Q2** — order yang di-remove dari queue **wajib** me-revert point/saldo lokal (§6).
> - **Q3** — bug pre-existing **ikut dibenerin**: `checkout.jsx:746` (`saldo_logs = point_logs`),
>   `unit_discount` hilang di `cart.jsx onCreateBillOffline`, dan bound `point_logs`.
> - **Q4** — **opsi (a)**: tidak ada auto-refresh; reconciliation menumpang overwrite
>   `saveMembershipList` saat halaman membership dibuka (§4).
> - **P2 (F2)** — **opsi (a) full fix**: gate mirror + `resetCart` pada persist sukses, via `.then()`
>   biar urutan `updateSessionSummary` tidak berubah (§7).

---

## Rencana Implementasi (FE)

### 1. Helper kalkulasi point lokal — `src/services/offline/helper.js`

```js
/**
 * Mirror MembershipUsecase.Earned (server): per item root, floor(unit_bill * qty * rate/100),
 * lalu dijumlahkan. Addon TIDAK dapat point (server: additional_id IS NULL).
 *
 * Rate diambil dari item.point_percentage (dari /catalog), fallback ke rateByCategory
 * (cache `categories`) untuk item lama yang belum punya field-nya.
 *
 * @param {Array}  items           item order offline: { point_percentage, category_id, unit_nett, unit_discount, quantity }
 * @param {Object} rateByCategory  map category_id -> point_percentage (fallback)
 * @returns {number} total point earned (integer, floor per item)
 */
export function computeEarnedPoint(items, rateByCategory = {}) {
  let total = 0;

  for (const item of items || []) {
    const rate = Number(item?.point_percentage ?? rateByCategory[item?.category_id] ?? 0);
    if (rate <= 0) continue;

    const unitBill = Math.max(0, Number(item?.unit_nett || 0) - Number(item?.unit_discount || 0));
    const qty = Number(item?.quantity || 0);

    // floor per item — sama seperti SQL server (floor(unit_bill * quantity * point_percentage / 100))
    total += Math.floor((unitBill * qty * rate) / 100);
  }

  return total;
}

/** Fallback: map category_id -> point_percentage dari cache `categories`. */
export function buildPointRateMap(categories = []) {
  return (categories || []).reduce((acc, cat) => {
    if (cat?.id != null) acc[cat.id] = Number(cat?.point_percentage || 0);
    return acc;
  }, {});
}
```

### 2. Bawa `point_percentage` ke payload offline

`point_percentage` **sudah otomatis nempel** di cart item item yang di-add dari katalog, karena
`cart/hook.js:100` (`{ ...catalog, from_bill: false }`) → `cart/slice.js:355` (`{ ...catalog, ... }`)
men-spread seluruh field katalog (termasuk `point_percentage` dari response `/catalog`).

Tapi mapping item offline **membangun object baru** (tidak spread), jadi field-nya harus ditambah
eksplisit di 2 tempat:

- `src/pages/authorize/home/checkout.jsx` → mapping item di `onPayOffline` (sekitar L573–605)
- `src/pages/authorize/home/cart.jsx` → mapping item saat **save bill** (sekitar L88–107), biar bill
  yang disimpan offline tetap bawa rate-nya waktu dibayar (ambil dari `CartState.bill`)

```js
const base = {
  id: item?.order_item_id || uuidv4(),
  catalog_id: item.catalog_id,
  category_id: item.category_id,
  category_name: item.category_name,
  point_percentage: item.point_percentage || 0,   // <-- BARU (mirror snapshot server)
  quantity: item.quantity,
  unit_nett: item.unit_nett,
  // ...
};
```

`makeCompletedOrder` / `makePendingBill` men-spread item (`...item`), jadi begitu masuk sini
field-nya ikut tersimpan ke IndexedDB & localStorage cache.

### 3. Mirror `earn` di checkout offline — `src/pages/authorize/home/checkout.jsx`

Ganti blok mirror yang sekarang (sekitar L727–761) dengan versi yang **memisahkan** earn dari
saldo/redeem:

```js
// Import tambahan
import { getCatalogCacheValue } from '../../../utils/cache';
import { buildPointRateMap, computeEarnedPoint } from '../../../services/offline/helper';

// ... setelah `const dataOfflineToOnline = makeCompletedOrder(payload);` dan setelah order
// di-persist ke IDB (onPayOfflineDirectPay / PayAndDeleteBill / Split) — sebelum resetCart.

const customer = payload?.membership;
// Q1: mirror HANYA untuk member payment (bukan cash/transfer).
if (selectedMethod?.is_member_payment && customer) {
  const cloneMembership = JSON.parse(JSON.stringify(customer));

  // 1) EARN — hanya member payment & bukan bayar pakai point (server juga skip saat is_point).
  if (!pointPay) {
    const rateMap = buildPointRateMap(getCatalogCacheValue('categories') || []);
    const earned = computeEarnedPoint(dataOfflineToOnline?.items, rateMap);

    if (earned > 0) {
      cloneMembership.point = (cloneMembership.point || 0) + earned;
      cloneMembership.point_logs = cloneMembership.point_logs || [];
      cloneMembership.point_logs.unshift({
        id: uuidv4(),
        nominal: earned,
        membership_id: customer?.id,
        reference_id: dataOfflineToOnline?.id || dataOfflineToOnline?.sync_id,
        reference_type: 'earn',
        reference_code: dataOfflineToOnline?.code,
        created_at: new Date(),
      });
    }
  }

  // 2) REDEEM / SALDO — tetap hanya untuk member payment (seperti sekarang)
  if (selectedMethod?.is_member_payment) {
    if (pointPay) {
      cloneMembership.point = (cloneMembership.point || 0) - dataOfflineToOnline?.total_charges;
      cloneMembership.point_logs = cloneMembership.point_logs || [];
      cloneMembership.point_logs.unshift({
        id: uuidv4(),
        nominal: -1 * dataOfflineToOnline?.total_charges,
        membership_id: customer?.id,
        reference_id: dataOfflineToOnline?.id || dataOfflineToOnline?.sync_id,
        reference_type: 'redeem',
        reference_code: dataOfflineToOnline?.code,
        created_at: new Date(),
      });
    } else {
      cloneMembership.saldo -= dataOfflineToOnline?.total_charges;
      cloneMembership.saldo_logs = cloneMembership.saldo_logs || [];
      cloneMembership.saldo_logs.unshift({
        nominal: -1 * dataOfflineToOnline?.total_charges,
        membership_id: customer?.id,
        reference_type: 'Sales',
        reference_code: dataOfflineToOnline?.code,
        created_at: new Date(),
      });
    }
  }

  try {
    perbaharuiMembership(cloneMembership);
  } catch (err) {
    // ignore
  }
}
```

Perubahan perilaku yang perlu di-flag:

- **Keputusan Q1:** cakupan **tidak** diperluas — mirror tetap hanya untuk
  `selectedMethod?.is_member_payment`. Guard-nya sama seperti kode sekarang, isinya cuma ditambah `earn`.
- `perbaharuiMembership` match by `id` **atau** `card_id` (`utils/cache.js:469`), jadi member yang
  dibuat offline (belum punya `id` server) tetap ke-update — **tapi** lihat F4/F5 (bisa no-op senyap).

### 4. Q4 — Refresh membership setelah sync (`src/services/offline/syncManager.js`)

> **Diputuskan (2026-09-19): opsi (a)** — tanpa auto-refresh. `syncManager` tetap tidak menyentuh
> `cache_membership`; angka provisional dibersihkan saat halaman membership refetch (overwrite
> `saveMembershipList`). Lihat alasan di akhir sub-bab.

**Pertanyaan:** setelah data offline ke-sync ke server, apakah device auto narik ulang data member
biar angka `point`/`saldo` = versi server?

Kondisi sekarang (**F10**): `syncManager` tidak menyentuh `cache_membership`. Refresh cuma lewat
`lastSyncTime` saat halaman membership dibuka (`index.jsx:55`) atau prefetch `App.jsx:38-52`.

| Opsi | Isi | Trade-off |
|---|---|---|
| **(a) Tidak usah** ← **diputuskan** | Begitu online + halaman membership dibuka, `saveMembershipList` **menimpa seluruh** cache dengan data server → entri lokal provisional otomatis bersih | Nol kode tambahan; point server tampil saat halaman membership dibuka |
| (b) Auto-refresh tiap sync sukses | Instan setelah sync | Perlu penanda entri lokal (mana provisional) biar tidak flicker/duplikat |

**Diputuskan: (a)** — reconciliation-nya sudah "gratis" lewat overwrite `saveMembershipList`.
Opsi (b) ditolak karena sync bisa **parsial**: `lastSyncTime` tetap di-advance saat `hadPendingData`
walau ada grup yang gagal (`syncManager.js:351-354`), jadi overwrite data server akan menghapus efek
order yang belum ke-sync dari tampilan. (b) baru layak kalau entri lokal punya penanda provisional —
pekerjaan terpisah, di luar scope.

### 5. `point-history.jsx` / `drawer.detail.jsx`

**Tidak berubah.** Keduanya sudah benar: offline baca `membership.point_logs` (yang sekarang akan
berisi entri `earn`), online baca API. (Detail: lampiran **F9**.)

### 6. WAJIB — revert mirror saat order di-remove dari queue

Temuan **F1** di lampiran: `handleRemoveOffline` (`layout.jsx:110-186`
dan duplikatnya `layout.jsx:286-360`) **tidak** me-revert membership untuk `type === 'payment'`.
Kalau mirror `earn` ditambah tanpa pasangan revert-nya, point lokal bakal inflated sampai refetch
online. Tambahkan di **kedua** handler:

- `is_point` → kembalikan point redeem (`point += total_charges`, log `revert`)
- bukan point & `point_earned > 0` → tarik point earn (`point -= point_earned`, log `revert_earn`)
- `is_member_payment` & bukan point → kembalikan `saldo`

Pakai **satu helper bersama** dengan checkout (DRY), jangan duplikasi inline. Ini sekalian menutup
gap pre-existing: sekarang remove `payment` sama sekali tidak mengembalikan saldo.

### 7. Prasyarat lain dari audit

- **P2 (F2) — DIPUTUSKAN (a) full fix:** mutasi membership sekarang jalan walau `createOrderPayment`
  nanti gagal (helper dipanggil tanpa `await`, `checkout.jsx:698/700/703`). Gate mirror membership
  **dan** `resetCart()` pada persist sukses, memakai `.then()` dari promise persist — **jangan**
  `await` mentah di 698/700/703, karena itu membalik urutan `updateSessionSummary`
  (`type:'payment'` tail 708 vs `type:'update'` dari dalam helper 838/897) dan mengubah math summary
  + tulis `cache_shifts`. Behavior change, flag di PR.
- **P3 (F4/F5):** `perbaharuiMembership` bisa **no-op senyap**: `getMembersipCacheRaw` balikin `[]`
  kalau key kosong → `existing.data` undefined → throw di-swallow `try/catch`. Juga member yang
  ketemu via search online cuma masuk `cache_membership_search` yang **tidak pernah dibaca**.
  Robustkan akses cache sebelum dipakai mirror.
- **P4 (F7/F8):** `point_percentage` harus masuk ke **semua 5** item mapping (checkout: pay /
  create-bill / update-bill; cart: create-bill / update-bill). `unit_discount` hilang di
  `cart.jsx onCreateBillOffline` (F7) → **diputuskan ikut dibenerin** (Q3).
- **P5 (F6):** `point_logs` tidak di-bound oleh `boundMembershipList` (cuma `saldo_logs`) dan
  `cache_membership` ada di `EVICTABLE_CACHE_KEYS` → **diputuskan: bound `point_logs`** (Q3).
- **P6 (F12):** tetapkan invariant baru: *setiap mirror lokal wajib punya revert pasangannya.*

---

## Catatan Formula

Server (`MembershipUsecase.Earned`) menghitung dari row persisten:

```
item.point_earned  = floor(unit_bill × quantity × point_percentage / 100)
order.point_earned = Σ item.point_earned        -- hanya item root (additional_id IS NULL)
```

`unit_bill` server = `unit_nett` yang sudah di-fold diskon item & kategori
(`foldCategoryDiscount` di `sales_sync.go`). Mirror lokal memakai
`unit_nett - unit_discount` dari cart item. Untuk kasus umum (diskon item normal) angkanya sama;
untuk kombinasi diskon kategori + diskon item yang bertumpuk bisa ada selisih kecil.

**Selisih ini aman** karena entri lokal cuma untuk tampilan offline — begitu online, nilai server
yang dipakai (tab Point ambil dari API, bukan dari cache).

---

## Edge Cases

| Kasus | Perilaku yang diharapkan |
|---|---|
| Bayar pakai point (`pointPay`) | Tidak mirror earn (server juga `IsPoint` → skip) |
| Order tanpa membership | Tidak ada mirror |
| Bayar cash/transfer + membership | **Tidak** di-mirror (Q1: hanya member payment) |
| Item dari cache katalog lama (belum ada `point_percentage`) | Fallback ke cache `categories`; kalau tetap 0 → skip |
| Custom catalog | Ikut dapat rate dari kategorinya (§3.1) |
| Addon | Tidak dapat point (helper cuma loop item root, bukan `addons`) |
| Split bill | Earn dihitung dari `dataOfflineToOnline.items` (item yang dibayar) |
| Bill disimpan offline lalu dibayar | Butuh `point_percentage` ikut ke-save di `cart.jsx` (§2); `unit_discount` hilang di cart-create → basis point overstate (F7) |
| Order di-remove dari queue | Mirror (earn/redeem/saldo) di-revert di `handleRemoveOffline` (§6, F1) |
| Member tidak ada di cache utama (ketemu via search online) | Mirror no-op senyap — robustkan dulu (§7 P3, F5) |
| `cache_membership` kosong/corrupt | `getMembersipCacheRaw` balikin `[]` → wajib handle `existing.data === undefined` (§7 P3, F4) |
| `createOrderPayment` gagal | Saat ini mirror jalan duluan (F2) → pindah ke dalam helper persist (§7 P2) |
| Refetch online | Nilai server menimpa entri lokal (source of truth) |

---

## Alternatif yang Dipertimbangkan

| Opsi | Plus | Minus | Keputusan |
|---|---|---|---|
| **A. Server-only** (tanpa mirror lokal) | Paling aman, akurat 100% | UX telat: point baru muncul setelah sync + refetch | ❌ |
| **B. Mirror lokal pakai `item.point_percentage` dari `/catalog`** | Instan, rate per item (mirror snapshot server), konsisten dengan mirror redeem/saldo | Perlu bawa field di payload offline | ✅ **dipilih** |
| **C. Mirror pakai map cache `categories` saja** | Tanpa bawa field per item | Rate global per kategori, bukan snapshot item; item lama tetap ambigu | ⏸ jadi fallback di B |
| **D. Server balikin `point_earned` di response `/sales/sync`** | Akurat, tanpa hitung lokal | Tetap telat sampai sync; perlu ubah kontrak response | ⏸ opsi lanjutan |

---

## Files Changed

| # | File | Perubahan |
|---|---|---|
| 1 | `pos-web/src/services/offline/helper.js` | + `computeEarnedPoint()`, `buildPointRateMap()` |
| 2 | `pos-web/src/pages/authorize/home/checkout.jsx` | Item mapping `onPayOffline` + `point_percentage`; blok mirror membership: pisah earn dari redeem/saldo |
| 3 | `pos-web/src/pages/authorize/home/cart.jsx` | Item mapping create-bill & update-bill + `point_percentage` (+ `unit_discount` yang hilang — F7) |
| 4 | `pos-web/src/components/ui/layout.jsx` | Revert mirror di `handleRemoveOffline` `type='payment'` — **dua** handler (110-186 & 286-360) — F1 |
| 5 | `pos-web/src/utils/cache.js` | Robustkan akses cache (`getMembersipCacheRaw` balikin `[]`, `perbaharuiMembership` no-op) — F4; opsional bound `point_logs` — F6 |

**Tidak berubah:** `point-history.jsx`, `drawer.detail.jsx`, `queue.js`, `syncManager.js`,
`entity/pricing.go` & `Catalog.Get`/`Show` (sudah dikerjakan user).

---

## Hasil Audit

Temuan lengkap ada di **lampiran** dokumen ini (F1–F14 + register invariant). Yang **wajib** masuk
scope sebelum implementasi: **F1** (§6), **F4/F5** (§7 P3), **F8** (§7 P4).

---

## Verifikasi

1. **BE `/catalog` GET** (dengan custom catalog ada) → tidak error, dan tiap item punya
   `point_percentage`. Cek juga `/catalog/{id}` untuk item normal & custom.
2. **Checkout offline, bayar saldo (member payment)**
   - `membership.point` naik sesuai `floor(unit_bill × qty × rate/100)`; `point_logs` berisi entri `earn`.
   - `saldo` turun `total_charges`; `saldo_logs` ada entri `Sales`.
3. **Checkout offline, bayar cash + customer ter-attach** → `point` tetap naik, `saldo` tidak berubah.
4. **Checkout offline, bayar pakai point (`pointPay`)** → `point` turun `total_charges`, **tidak** ada entri `earn`.
5. **Save bill offline lalu dibayar offline** → point tetap terhitung (bukti `point_percentage` ikut ke-save).
6. **Order tanpa member** → tidak ada perubahan cache member.
7. **Addon** → tidak menyumbang point.
8. **Balik online + sync** → `GET /balance/{id}/point_log` mengembalikan entri `earn` dari server.
9. **Refetch online** → drawer menampilkan `point` dari server (bukan cache lokal).
10. `yarn lint` bersih + `yarn build` sukses.

---

## Risiko / Catatan

- **Selisih formula** kalau diskon item & kategori bertumpuk — dampaknya hanya tampilan offline,
  hilang begitu online. (Detail di §Catatan Formula.)
- **Cakupan dipersempit (Q1):** mirror `earn` hanya untuk member payment. Konsekuensinya order
  cash + member **tidak** menampilkan point di device sampai refetch online — server tetap
  menghitungnya saat sync.
- **Cache katalog lama** (localStorage `catalog_pricing_<channelId>`) belum punya `point_percentage`
  sampai refetch online → fallback `categories` dipakai; kalau keduanya kosong, point tidak di-mirror
  (server tetap mencatatnya saat sync).
- **Entri lokal `earn` bukan ledger server** (pakai `uuidv4()` lokal) sehingga tidak benturan dengan
  `point_log UNIQUE (reference_id, reference_type)` server.
- **Bukan cakupan:** perhitungan `point_earned` di order/receipt online, settlement HO, dan
  perbaikan saldo/point yang sudah telanjur tidak tercatat.

---

## Lampiran — Hasil Audit (F1–F14)

> Digabung dari `offline-membership-point-audit.md` (2026-09-19) supaya keputusan & bukti tinggal
> di satu file. Metode: pembacaan statis (3 parallel sweep). **Belum ada test runtime** — semua
> klaim dari kode/dokumen, bukan eksekusi.

### A.1 Jalur tulis offline (inventory)

Semua jalur digerbang `isOffline = !isOnline || apiReachable === false`
(`checkout.jsx:65-68`, `cart.jsx:34-37`).

| Jalur | Fungsi | IDB | localStorage | Membership cache |
|---|---|---|---|---|
| Pay langsung | `onPayOfflineDirectPay` (`checkout.jsx:772-789`) | `createOrderPayment` (774) | `cache_order_history` via `saveOrderHistory` (784) | ✗ (di parent) |
| Pay + hapus bill | `onPayOfflinePayAndDeleteBill` (791-844) | `createOrderPayment` (793) → `deleteOrderBill` (804) | `saveOrderHistory` (815), `deleteOpenBills` (823) | ✗ (di parent) |
| Pay split | `onPayOfflineSplit` (846-904) | `createOrderPayment` (854) → `updateOrderBill` (876) | `saveOrderHistory` (864), `updateOpenBills` (890) | ✗ (di parent) |
| Save bill (cart) | `onCreateBillOffline` (`cart.jsx:69-186`) | `createOrderBill` (158) | `cache_openbills` via `saveOpenBills` (169) | ✗ |
| Update bill (cart) | `onUpdateBillOffline` (`cart.jsx:273-424`) | `updateOrderBill` (364) | `updateOpenBills` (375) | ✗ |

**Mutasi membership lokal HANYA ada di satu tempat:** `onPayOffline` tail (`checkout.jsx:727-761`),
dan cuma jalan kalau `selectedMethod?.is_member_payment`. `onCreateBillOffline` / `onUpdateBillOffline`
**tidak** menyentuh membership sama sekali.

`updateSessionSummary` (`sales/session/hook.js:113-305`) di samping dispatch `updateSummary` (301)
juga menulis `cache_shifts` lewat `updateShifts` (304).

### A.2 Register invariant offline

| # | Invariant | Sumber |
|---|---|---|
| I1 | 1 request `/sales/sync` = 1 session, **atomic** + **idempotent** via `sync_id` | `BE-pos-offline-sync.md:32-34`, `offline-session-mode.md:5` |
| I2 | **Memberships disync SEBELUM sales** (biar server punya member id) | `offline-refactor-plan.md:296-299` |
| I3 | **Server = source of truth**; kalau sync balik data beda, server yang menang | `specs/.../offline-first-architecture/spec.md:225-226` |
| I4 | Sync sukses → **hapus dari IndexedDB** (tanpa simpan mapping server id) | `offline-refactor-plan.md:109,369-374` |
| I5 | Cache localStorage di-refresh lewat `lastSyncTime` → halaman re-fetch & cache ditimpa data server | `offline-audit-findings.md:369-380` |
| I6 | Full payment → `deleteOrderBill`; **split → update in place, jangan hapus** | `offline-audit-findings.md:222-223` |
| I7 | 401 saat sync → **mark failed**, jangan force-logout | `specs/.../offline-queue-per-user/plan.md:188,255` |
| I8 | snake_case wajib; fallback field alternatif (`|| item?.catalog_name`) **HARAM** | `offline-data-consistency.md:284-297` |
| I9 | `is_offline_mode=true` → **server skip cek saldo membership** | `BE-pos-offline-sync.md:103` |
| I10 | Tidak ada merge multi-device | `specs/.../offline-first-architecture/spec.md:225` |

**Catatan:** tidak ada satu pun dokumen yang mengatur **revert membership saat order di-remove dari
queue**, dan **point offline tidak terdokumentasi sama sekali** → invariant baru ditetapkan di §7 P6.

### A.3 Temuan (F1–F14)

**F1 — HIGH — Remove order `payment` TIDAK revert membership lokal.**
`layout.jsx:110-186` (wrapper `Layout`) dan **duplikat** `layout.jsx:286-360` (Navbar)
`handleRemoveOffline`: `bill` → hapus IDB + `deleteOpenBills` + koreksi summary (tanpa membership);
`payment` → hapus IDB + `deleteOrderHistory` + koreksi summary (tanpa membership); `topup` →
**satu-satunya** yang revert (`saldo -= nominal` + splice log, 162-183).
**Dampak:** mirror point/saldo drift kalau user hapus order dari PendingDrawer. Revert topup pun
rapuh: `splice(logsIdx, 1)` dengan `logsIdx = -1` menghapus elemen terakhir (171-173), dan lookup
log pakai `sync_id` yang tidak ditulis oleh mirror saldo (lihat F3). → **§6**

**F2 — HIGH — Helper persist tidak di-`await`, mirror jalan walau write gagal.**
`checkout.jsx:698/700/703` memanggil `onPayOffline*` tanpa `await`; tail `onPayOffline`
(summary + mirror + `resetCart`) tetap lanjut sinkron (706-768). Helper baru lanjut setelah
`await createOrderPayment` selesai. **Dampak:** kalau `createOrderPayment` gagal
(`handleModalError` di 776), cache membership **sudah** termutasi dan cart sudah di-reset. → **§7 P2**

**F3 — MED — Bug existing di blok mirror saldo (`checkout.jsx:744-754`).**
`cloneMembership.saldo_logs = cloneMembership.point_logs || []` (sumber array SALAH) dan entri Sales
tanpa `sync_id` (padahal revert topup di `layout.jsx:171` mencari by `sync_id`). → **Q3**

**F4 — HIGH — `perbaharuiMembership` gampang no-op / throw senyap.**
`utils/cache.js:432-483`: `getMembersipCacheRaw()` balikin `[]` (array polos) kalau key kosong/corrupt
→ `existing.data` `undefined` → `showMembership`/`perbaharuiMembership` throw; caller dibungkus
`try/catch` kosong (`checkout.jsx:756-760`, `layout.jsx:176/350`) → gagal senyap.
`perbaharuiMembership` merge-only: match `id` **atau** `card_id` (470); tidak ketemu → `return null`
tanpa insert (473). Match `===` pada `undefined` bisa self-match ke entri pertama. → **§7 P3**

**F5 — MED — `cache_membership_search` ditulis tapi TIDAK pernah dibaca.**
`membership/hook.js:40,49` menulis saat search **online**; satu-satunya referensi lain cuma daftar
eviction `cache.js:43`. `getMember` offline **selalu** baca `cache_membership` utama (hook.js:60-62).
**Dampak:** member yang ditemukan via search online tidak ada di cache utama → mirror no-op (F4). → **§7 P3**

**F6 — MED — `point_logs` tidak di-bound, `cache_membership` masuk daftar eviction.**
`boundMembershipList` hanya strip `saldo_logs` (`cache.js:405-411`); batas 200 member / 1.5 MB
(402-403); `cache_membership` ada di `EVICTABLE_CACHE_KEYS` (`cache.js:43`) → `QuotaExceededError`
bisa menghapus **seluruh** cache membership. → **§7 P5**

**F7 — MED — `cart.jsx onCreateBillOffline` item mapping kehilangan `unit_discount`.**
Mapping `cart.jsx:88-107` tidak menyertakan `unit_discount`; versi checkout (`checkout.jsx:574-592`)
menyertakan. Padahal `makePendingBill` (`shapes.js:69-76`) & `recalculateDiscountCategory`
(`helper.js:10`) menghitung dari `item.unit_discount`. → **Q3**

**F8 — MED — `point_percentage` nol match di seluruh `src`.**
Item dari katalog otomatis membawa field-nya (spread `...catalog` di `cart/hook.js:100` →
`cart/slice.js:355`), tapi item yang dibaca balik dari bill tergantung mapping bill. → **§2 + §7 P4**

**F9 — MED — `point-history` fetch tanpa guard offline.**
`point-history.jsx:45-49` memanggil `pointLog({ id })` tanpa cek offline; andalan effect `isOffline`
(140-144) menimpa `logs` dengan `membership?.point_logs`. `drawer.detail.jsx:113-114` mengirim prop
`membership` (bukan `data` server) ke ledger. → **§5 (tidak berubah)**

**F10 — MED — Tidak ada refresh membership otomatis setelah sync.**
`syncManager.js` tidak menyentuh `cache_membership` (cuma POST memberships 163-218 + hapus IDB
191-193). Refresh hanya lewat `lastSyncTime` (`index.jsx:55`) / `App` prefetch (`App.jsx:38-52`) /
tombol manual. → **§4 (Q4 = a, tidak berubah)**

**F11 — INFO — `handleRemoveOffline` diduplikasi.** `layout.jsx:110-186` & `286-360` byte-for-byte
mirip; tiap perubahan remove **wajib** di dua tempat. → **§6**

**F12 — INFO — Dokumen offline punya drift.** `needs_sync` vs `is_synced` →
`offline-audit-findings.md:315-325` menang (pakai `is_synced`). Blob model vs flat store: doc lama
camelCase, doc baru snake_case. `offline-data-consistency.md:179` (service charge) outdated.
Retry/remove UX di `phase-2-checkout-offline.md:519-521` sengaja dibiarkan terbuka. → **§7 P6**

**F13 — INFO — Server skip validasi saldo untuk order offline.** `BE-pos-offline-sync.md:103`:
`is_offline_mode=true` → skip cek saldo; validasi final di server saat sync. Mirror lokal **bukan**
validasi; jangan dijadikan gate.

**F14 — LOW — Timing: `onPayOfflineSplit` memutasi objek sebelum await.**
`checkout.jsx:850-852` mengubah `ref_sync_id / sync_id / id` **sebelum** `await` pertama (854).
Karena dipanggil tanpa `await`, mutasi terjadi **sebelum** tail `onPayOffline` (mirror) jalan →
`reference_id` mirror pakai `sync_id` baru. Perlu disengaja & didokumentasikan.

### A.4 Belum diaudit / belum diverifikasi

- **Runtime:** semua statis. Belum pernah jalanin offline mode, belum tes sync beneran ke BE.
- Belum dibaca full: `sales/order/hook.js`, `services/topup/*`, `pages/authorize/topup/*`, `master`
  (payment method cache), `sales/cart` slices di luar item mapping.
- Belum cek perilaku IndexedDB quota / eviction di device nyata.
- BE `franq`: `point_percentage` sudah lolos `go build`, tapi endpoint `/catalog` belum dipanggil
  beneran (belum verifikasi SQL union di DB).
