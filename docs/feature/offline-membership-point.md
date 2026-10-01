# Offline Membership Point Earn — Rencana & Implementasi

**Tanggal:** 2026-09-19
**Branch:** `feat/member-point-payment`
**Scope FE:** `pos-web` (helper + checkout offline + remove order)
**Scope BE:** `franq` — sudah dikerjakan user (`point_percentage` di `/catalog`)
**Status:** **Diimplementasikan.** Mirror offline mengoreksi **angka** `point`/`saldo` + menulis entri
ledger lokal; revert saat order dihapus mengembalikan angka & membuang entri itu. Lint `0 error`,
build sukses. **Belum ada test runtime.**

---

## 1. Masalah

Saat checkout **offline** dengan membership ter-attach, **angka** `point` (dan `saldo`) member tidak
ikut berubah di cache lokal — member kelihatan belum dapat point / saldonya belum terpotong sampai
batch sync jalan (balik online) lalu data member di-fetch ulang.

Ledger/history lokal juga ikut diisi: mirror menulis entri `point_logs`/`saldo_logs` supaya tab
Saldo/Point di drawer tetap ada isinya saat offline. Detail perilakunya di §5.

## 2. Akar Masalah

Sisi server sudah benar — point **memang dihitung saat sync**, bukan saat checkout offline:

| Tempat | Bukti |
|---|---|
| `franq/backend/pos/src/usecase/sales_sync.go` `createOrderInTx` | `membershipUcase.Earned(...)` setelah order completed |
| `.../sales_sync.go` `completeSplitOrderInTx` | `Earned(...)` untuk split bill |
| `.../sales_sync.go` `completeExistingOrderInTx` | `Earned(...)` untuk cross-session |
| `franq/backend/pos/src/usecase/membership.go` `Earned` | hitung dari row `sales_order_item` persisten |
| `.../sales_sync.go` `resolvePointPercentage` | rate di-resolve server dari `category.point_percentage` |

Yang bocor ada di **cache lokal frontend**. `onPayOffline`
(`src/pages/authorize/home/checkout.jsx`, blok `if (selectedMethod?.is_member_payment)`) cuma
mem-mirror 2 hal:

- `pointPay` → potong `point` + unshift `point_logs` `redeem`
- selain itu → potong `saldo` + unshift `saldo_logs` (**array yang salah**, lihat F3)

**Tidak ada mirror untuk `earn`.** Hasilnya, sampai sync + refetch, angka point/saldo tidak
mencerminkan order offline terakhir.

Catatan tambahan: guard `selectedMethod?.is_member_payment` bikin `earn` **juga** tidak ke-mirror untuk
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

## 4. Keputusan

| # | Topik | Keputusan | Alasan |
|---|---|---|---|
| 1 | Sumber kebenaran | **Server tetap authoritative** | `Earned` di sync sudah benar & idempotent (`point_log UNIQUE (reference_id, reference_type)`) |
| 2 | Rate | **`item.point_percentage`** dari `/catalog` (snapshot di cart item) — tanpa fallback | Per item, persis snapshot server; tidak perlu ubah BE |
| 3 | UX offline | **Mirror lokal `earn`**: koreksi angka `point`/`saldo` + entri log lokal | Konsisten dengan pola mirror `redeem`/`saldo` |
| 4 | Ledger lokal | Mirror **menulis** `point_logs`/`saldo_logs` (provisional); revert **menghapus** entri milik order itu — **tanpa** membuat entri baru | Tab Saldo/Point offline ada isinya; ledger server tetap menimpa saat refetch |
| 5 | Cakupan earn | **Hanya `selectedMethod?.is_member_payment`** & bukan `pointPay` | Keputusan user (Q1) |

> **Keputusan final (2026-09-19):**
> - **Q1** — mirror `earn` **hanya** untuk member payment (bukan cash/transfer).
> - **Q2** — order yang di-remove dari queue **wajib** me-revert angka point/saldo lokal (§6).
> - **Q3** — bug pre-existing ikut dibenerin: `saldo_logs = point_logs` di `checkout.jsx`, dan
>   `unit_discount` hilang di `cart.jsx onCreateBillOffline`.
> - **Q4** — **opsi (a)**: tidak ada auto-refresh setelah sync; reconciliation menumpang overwrite
>   `saveMembershipList` saat halaman membership dibuka (§7).
> - **P2 (F2)** — **opsi (a) full fix**: gate mirror + `resetCart` pada persist sukses, via `.then()`
>   biar urutan `updateSessionSummary` tidak berubah (§8).
> - **Ledger offline** — mirror **menulis** entri log lokal (`earn`/`redeem`/`Sales`); saat order
>   dihapus, revert **membuang** entri itu (match `reference_id`), bukan membuat entri kompensasi.
>   List cache tetap men-strip `saldo_logs` **dan** `point_logs` (§5) — ini menggantikan keputusan Q3
>   "bound `point_logs`".
> - **Invariant baru** — *setiap mirror lokal wajib punya revert pasangannya* (P6/F12).

---

## 5. Perilaku Ledger (Saldo/Point History) saat Offline

- Tab **Saldo** (`history.jsx`) dan **Point** (`point-history.jsx`) sama-sama punya fallback offline:
  `setLogs(membership?.saldo_logs || [])` / `setLogs(membership?.point_logs || [])`.
- Objek `membership` yang dipakai adalah yang dikirim `drawer.detail.jsx` ke kedua section tersebut —
  berasal dari list cache `cache_membership`.
- **Saat checkout offline (mirror)**, entri log lokal ditulis: `redeem` (point) atau `earn` (point) +
  `Sales` (saldo). Jadi kedua tab **terisi** oleh aktivitas offline.
- **Saat order dihapus**, entri log milik order itu (`reference_id` sama) dibuang kembali — jadi tidak
  ada sisa "jejak" order yang dibatalkan.
- Di sisi lain, `saveMembershipList` (`utils/cache.js`) melewati `boundMembershipList` → **`stripLogs`**
  yang membuang `saldo_logs` **dan** `point_logs` dari setiap member saat list di-fetch dari server.
  Artinya entri lokal provisional hilang saat refetch online — dan memang itu yang diinginkan
  (ledger server yang menang).

> Perbaikan konsistensi: sebelumnya **hanya** `saldo_logs` yang di-strip, sehingga Point tampil tapi
> Saldo kosong (asimetris). Sekarang keduanya diperlakukan sama.

---

## 6. Implementasi (FE)

### 6.1 Helper kalkulasi point lokal — `src/services/offline/helper.js`

```js
export function computeEarnedPoint(items) {
  let total = 0;

  for (const item of items || []) {
    const rate = Number(item?.point_percentage ?? 0);
    if (rate <= 0) continue;

    const unitBill = Math.max(0, Number(item?.unit_nett || 0) - Number(item?.unit_discount || 0));
    const qty = Number(item?.quantity || 0);

    // floor per item — sama seperti SQL server (floor(unit_bill * quantity * point_percentage / 100))
    total += Math.floor((unitBill * qty * rate) / 100);
  }

  return total;
}
```

Rate murni dari `item.point_percentage` (snapshot `/catalog`). Item lama yang belum punya field itu
dianggap rate 0 → tidak dapat point lokal (server tetap menghitungnya saat sync).

### 6.2 Helper mirror/revert bersama — `src/services/offline/membershipMirror.js` (BARU)

Dipakai checkout **dan** `layout.jsx` (DRY). Guard sama untuk dua-duanya: `is_member_payment`.
Kode di bawah disingkat (`logEntry()` mengisi `id: uuidv4()`, `membership_id`, `reference_code`,
`created_at`).

```js
export function mirrorMembershipOrder(order) {
  const customer = order?.membership;
  if (!customer || !isMemberPayment(order)) return null;

  return updateCache(customer, clone => {
    const totalCharges = Number(order?.total_charges || 0);
    const refId = order?.id || order?.sync_id;

    if (order?.is_point) {
      clone.point = (clone.point || 0) - totalCharges;
      clone.point_logs.unshift(logEntry({ nominal: -totalCharges, refId, type: 'redeem' }));
      return;
    }

    const earned = computeEarnedPoint(order?.items);
    if (earned > 0) {
      clone.point = (clone.point || 0) + earned;
      clone.point_logs.unshift(logEntry({ nominal: earned, refId, type: 'earn' }));
    }

    clone.saldo = (clone.saldo || 0) - totalCharges;
    clone.saldo_logs.unshift(logEntry({ nominal: -totalCharges, refId, type: 'Sales' }));
  });
}

export function revertMembershipOrder(order) {
  const customer = order?.membership;
  if (!customer || !isMemberPayment(order)) return null;

  return updateCache(customer, clone => {
    const totalCharges = Number(order?.total_charges || 0);
    const refId = order?.id || order?.sync_id;

    // Buang entri ledger milik order ini — jangan bikin entri kompensasi.
    const dropLogs = logs => {
      if (refId == null) return logs || [];
      return (logs || []).filter(log => log?.reference_id !== refId);
    };

    if (order?.is_point) {
      clone.point = (clone.point || 0) + totalCharges;
      clone.point_logs = dropLogs(clone.point_logs);
      return;
    }

    const earned = computeEarnedPoint(order?.items);
    if (earned > 0) clone.point = (clone.point || 0) - earned;

    clone.point_logs = dropLogs(clone.point_logs);
    clone.saldo = (clone.saldo || 0) + totalCharges;
    clone.saldo_logs = dropLogs(clone.saldo_logs);
  });
}
```

> **Penting — basis hitung:** `updateCache()` mengambil **entri cache terkini** dulu lewat
> `showMembership(customer?.card_id)` — pola yang sama dipakai `layout.jsx` & `card.content.jsx` —
> baru di-clone. Kalau tidak ketemu di cache, fallback ke `customer` (snapshot order).
> **Bukan** dari `order.membership`, karena itu snapshot saat order dibuat — dan
> `perbaharuiMembership` menimpa **semua** field (`{ ...existing, ...clone }`). Dengan basis snapshot
> lama, nilai hasil hitung akan menimpa nilai terbaru di cache.
>
> Contoh nyata (bug yang ditemukan saat uji): cache `point = 413.900` → pay `+5.800` = `419.700`.
> Saat order dihapus, revert dulu memakai snapshot (`413.900`) sehingga menulis `413.900 − 5.800 =
> 408.100`. Setelah fix: basis `419.700` → `419.700 − 5.800 = 413.900` (benar).
>
> Pola ini sama dengan yang sudah dipakai `card.content.jsx` (topup): `showMembership()` → mutate →
> `perbaharuiMembership()`.

### 6.3 Bawa `point_percentage` ke payload offline

`point_percentage` otomatis nempel di cart item yang di-add dari katalog (`cart/hook.js` spread
`...catalog` → `cart/slice.js`). Tapi mapping item offline **membangun object baru**, jadi field-nya
ditambah eksplisit di **6 tempat**:

| # | Lokasi | Dipakai oleh |
|---|---|---|
| 1 | `checkout.jsx` `onPayOffline` | checkout offline (pay) |
| 2 | `checkout.jsx` `onCreateBillOffline` | save bill dari checkout |
| 3 | `checkout.jsx` `onUpdateBillOffline` | update bill dari checkout |
| 4 | `cart.jsx` `onCreateBillOffline` | save bill dari cart (+ `unit_discount` yang hilang — F7) |
| 5 | `cart.jsx` `onUpdateBillOffline` | update bill dari cart |
| 6 | `cart/slice.js` `convertApiOrderToCartItem` | **open bill** → `setBillItems` → `CartState.items.bill` |

Nomor 6 adalah yang paling gampang kelewat: bill yang dibuka masuk ke cart lewat mapper ini, dan
sebelum diperbaiki `point_percentage`-nya hilang — jadi bill yang dibayar offline tidak dapat point.

`makeCompletedOrder` / `makePendingBill` men-spread item, jadi begitu field-nya ada di mapping, nilainya
ikut tersimpan ke IndexedDB & cache. Payload `/sales/sync` juga mengirim `point_percentage` per item
(`syncManager.js` `mapItemsToSync`).

### 6.4 Revert saat order di-remove — `src/components/ui/layout.jsx`

`handleRemoveOffline` `type === 'payment'` di **dua** handler (wrapper `Layout` & Navbar) memanggil
`revertMembershipOrder(queueItem)` — mengembalikan angka **dan** membuang entri log milik order itu
(match `reference_id`); **tidak** membuat entri log baru:

- `is_point` → `point += total_charges`, buang `point_logs` dengan `reference_id` itu
- bukan point & earned > 0 → `point -= earned`
- `is_member_payment` & bukan point → `saldo += total_charges`, buang `saldo_logs` dengan `reference_id` itu

Sekaligus menutup gap pre-existing: sebelumnya remove `payment` sama sekali tidak mengembalikan saldo.

### 6.5 Robustness cache — `src/utils/cache.js`

- `getMembersipCacheRaw()` selalu balikin objek `{ data: [] }` (bukan array polos) → caller tidak
  throw saat cache kosong/corrupt (F4).
- `perbaharuiMembership` pakai `isSameMember` (tidak self-match ke `undefined`); match by `id` **atau**
  `card_id`, tidak ketemu → `null`. **Tidak** ada fallback ke `cache_membership_search` (dibiarkan).
- `boundMembershipList` → `stripLogs` membuang `saldo_logs` + `point_logs` (F6 + §5).

### 6.6 Receipt menampilkan angka terbaru

`SuccessModal` → `Receipt` menampilkan "Saldo Member"/"Point Member" dari
`data.membership.saldo` / `data.membership.point` (`receipt.jsx:188-197`). Dua hal yang dulu bikin
angkanya masih lama:

1. Mirror memutasi **clone**, bukan `data.membership` (pre-existing).
2. Setelah gating P2, mirror jalan **setelah** `handleModalPrint`.

Perbaikan di `checkout.jsx` `onPayOffline`: `handleModalPrint` dipindah ke dalam
`Promise.resolve(persist).then()` **setelah** mirror, dan hasil mirror dipasang ke **salinan** order
(bukan mutasi):

```js
let printData = dataOfflineToOnline;

try {
  const updated = mirrorMembershipOrder(dataOfflineToOnline);
  if (updated) printData = { ...dataOfflineToOnline, membership: updated };
} catch (err) { /* DEV log */ }

handleModalPrint(printData);
```

> **Kenapa salinan, bukan `dataOfflineToOnline.membership = updated`?**
> `updateSessionSummary` (dipanggil lebih dulu) men-`push` `dataOfflineToOnline` ke Redux
> (`updatedSummary.orders.push(data.order)`). Immer membekukan seluruh state hasil — termasuk objek
> yang di-push by reference — jadi mutasi setelahnya melempar
> `TypeError: Cannot assign to read only property 'membership'`. Ini juga menjelaskan kenapa mutasi
> `sync_id` di `onPayOfflineSplit` aman: terjadi **sebelum** `updateSessionSummary`.

**Perubahan perilaku (flag):** modal "Payment saved locally" sekarang **baru muncul setelah persist
sukses** — sebelumnya bisa muncul walau `createOrderPayment` gagal.

Aman untuk data: `printData` hanya dipakai Receipt; dokumen yang sudah ditulis ke IDB tidak berubah,
dan payload sync cuma memakai `membership_id`/`membership_sync_id`.

---

## 7. Q4 — Refresh membership setelah sync

> **Diputuskan: opsi (a)** — tanpa auto-refresh. `syncManager` tetap tidak menyentuh
> `cache_membership`; angka provisional dibersihkan saat halaman membership refetch (overwrite
> `saveMembershipList`).

**Pertanyaan:** setelah data offline ke-sync, apakah device auto narik ulang data member?

Kondisi sekarang (**F10**): `syncManager` tidak menyentuh `cache_membership`. Refresh hanya lewat
`lastSyncTime` (`index.jsx:55`) / prefetch `App.jsx` / tombol manual.

| Opsi | Isi | Trade-off |
|---|---|---|
| **(a) Tidak usah** ← **diputuskan** | Begitu online + halaman membership dibuka, `saveMembershipList` **menimpa seluruh** cache dengan data server → angka provisional bersih | Nol kode tambahan |
| (b) Auto-refresh tiap sync sukses | Instan setelah sync | Perlu penanda entri lokal (mana provisional) |

Opsi (b) ditolak karena sync bisa **parsial**: `lastSyncTime` tetap di-advance saat `hadPendingData`
walau ada grup yang gagal, jadi overwrite data server akan menghapus efek order yang belum ke-sync.

---

## 8. Prasyarat dari Audit

- **P2 (F2) — DIPUTUSKAN (a) full fix:** `checkout.jsx` tidak lagi `await` mentah; helper persist
  sekarang `return true/false`, dan mirror + `resetCart` dijalankan di `Promise.resolve(persist).then()`
  setelah persist sukses. Urutan `updateSessionSummary` (`type:'payment'` di tail vs `type:'update'`
  dari dalam helper) **tidak** berubah. `handleModalPrint` juga dipindah ke dalam `.then()` setelah
  mirror supaya Receipt membaca angka terbaru (§6.6). Behavior change — flag di PR.
  - Helper persist return `false` **hanya** kalau `createOrderPayment` gagal (order tidak masuk queue).
    Kalau `deleteOrderBill`/`updateOrderBill` yang gagal, order sudah masuk queue → return `true`.
- **P3 (F4/F5) — sebagian:** F4 selesai (lihat §6.5); **F5 sengaja dibiarkan** — `perbaharuiMembership`
  tidak fallback ke `cache_membership_search`.
- **P4 (F7/F8) — selesai:** `point_percentage` masuk ke 5 mapping; `unit_discount` ditambah di
  create-bill `cart.jsx`.
- **P5 (F6) — diganti:** bukan lagi "bound `point_logs`", tapi **strip** `saldo_logs` + `point_logs`
  (§5).
- **P6 (F12) — ditetapkan:** *setiap mirror lokal wajib punya revert pasangannya.*

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

**Selisih ini aman** karena angka lokal cuma untuk tampilan offline — begitu online, nilai server
yang dipakai.

---

## Edge Cases

| Kasus | Perilaku yang diharapkan |
|---|---|
| Bayar pakai point (`pointPay`) | `point -= total_charges`; tidak mirror earn (server juga `IsPoint` → skip) |
| Order tanpa membership | Tidak ada mirror |
| Bayar cash/transfer + membership | **Tidak** di-mirror (Q1: hanya member payment) |
| Item dari cache katalog lama (tanpa `point_percentage`) | Rate dianggap 0 → tidak dapat point lokal; server tetap menghitungnya saat sync |
| Custom catalog | Ikut dapat rate dari kategorinya (§3.1) |
| Addon | Tidak dapat point (helper cuma loop item root, bukan `addons`) |
| Split bill | Earn dihitung dari `dataOfflineToOnline.items` (item yang dibayar) |
| Bill disimpan offline lalu dibayar | Butuh `point_percentage` ikut ke-save di `cart.jsx` (§6.3) |
| Order di-remove dari queue | Angka point/saldo dikembalikan + entri log milik order itu dibuang (match `reference_id`) (§6.4, F1) |
| Tab Saldo/Point saat offline | Terisi entri lokal hasil mirror; begitu online, cache di-strip & ledger diambil dari API (§5) |
| Member tidak ada di cache utama (ketemu via search online) | Mirror/revert no-op (return `null`) — tidak ada fallback ke `cache_membership_search` (§6.5, F5) |
| `cache_membership` kosong/corrupt | `getMembersipCacheRaw` balikin `{ data: [] }` → tidak throw (§6.5, F4) |
| `createOrderPayment` gagal | Mirror + `resetCart` tidak jalan (§8, F2) |
| Refetch online | Angka + ledger dari server menimpa cache lokal (source of truth) |

---

## Alternatif yang Dipertimbangkan

| Opsi | Plus | Minus | Keputusan |
|---|---|---|---|
| **A. Server-only** (tanpa mirror lokal) | Paling aman, akurat 100% | Angka point/saldo telat berubah sampai sync + refetch | ❌ |
| **B. Mirror lokal pakai `item.point_percentage` dari `/catalog`** | Angka langsung benar, rate per item (mirror snapshot server) | Perlu bawa field di payload offline | ✅ **dipilih** |
| **C. Mirror pakai map cache `categories` saja** | Tanpa bawa field per item | Rate global per kategori, bukan snapshot item | ❌ (tidak dipakai) |
| **D. Server balikin `point_earned` di response `/sales/sync`** | Akurat, tanpa hitung lokal | Tetap telat sampai sync; perlu ubah kontrak response | ⏸ opsi lanjutan |

---

## Files Changed

| # | File | Perubahan |
|---|---|---|
| 1 | `src/services/offline/helper.js` | + `computeEarnedPoint()` (rate murni dari `item.point_percentage`) |
| 2 | `src/services/offline/membershipMirror.js` **(baru)** | `mirrorMembershipOrder()` (koreksi angka + entri log lokal) / `revertMembershipOrder()` (kembalikan angka + buang entri log order itu) |
| 3 | `src/pages/authorize/home/checkout.jsx` | Item mapping `onPayOffline` / `onCreateBillOffline` / `onUpdateBillOffline` `+ point_percentage`; mirror lama (yang bug `saldo_logs = point_logs`) diganti panggilan helper; gate P2; `printData` (salinan) untuk receipt |
| 4 | `src/pages/authorize/home/cart.jsx` | Item mapping create-bill & update-bill `+ point_percentage` (+ `unit_discount` yang hilang — F7) |
| 5 | `src/services/cart/slice.js` | `convertApiOrderToCartItem` (open bill) `+ point_percentage` |
| 6 | `src/components/ui/layout.jsx` | Revert di `handleRemoveOffline` `type='payment'` — **dua** handler — F1 |
| 7 | `src/utils/cache.js` | `getMembersipCacheRaw` → `{ data: [] }`; `isSameMember` di `perbaharuiMembership` (match `id`/`card_id`, tanpa fallback search); `stripLogs` (saldo+point) |

**Tidak berubah:** `point-history.jsx`, `drawer.detail.jsx`, `queue.js`, `syncManager.js`,
`entity/pricing.go` & `Catalog.Get`/`Show` (sudah dikerjakan user).

### Perubahan di luar scope (di-flag)

Dikerjakan sekalian saat membersihkan lint (repo sebelumnya **94 error** pre-existing):

- **Bug `no-undef`:** `showShifts` dipakai tapi tidak diimpor di `sales/session/hook.js` (ditambah
  import + null-guard); `order(...)` tidak ada di scope di `bills/index.jsx` (diganti `bill(...)`);
  `reboot?.()` tidak ada di scope di `membership/update.jsx` (diganti `onRefresh?.()`).
- `eslint.config.js`: `dev-dist` masuk `globalIgnores` (build output Vite PWA).
- Hapus unused import/var & `catch (e) {}` → `catch {}` di ±25 file; import-order auto-fix di file
  yang tersentuh.

---

## Verifikasi

1. **BE `/catalog` GET** (dengan custom catalog ada) → tidak error, tiap item punya
   `point_percentage`. Cek juga `/catalog/{id}` untuk item normal & custom.
2. **Checkout offline, bayar saldo (member payment)** → `point` naik `floor(unit_bill × qty × rate/100)`
   (kalau rate > 0) + entri `point_logs` `earn`; `saldo` turun `total_charges` + entri `saldo_logs`
   `Sales`; receipt "Saldo Member"/"Point Member" menampilkan angka **setelah** transaksi (§6.6).
3. **Checkout offline, bayar cash + customer ter-attach** → tidak ada perubahan cache member (Q1).
4. **Checkout offline, bayar pakai point** → `point` turun `total_charges` + entri `point_logs`
   `redeem`; tidak ada `earn`.
5. **Save bill offline lalu dibayar offline** → point tetap terhitung (bukti `point_percentage` ikut ke-save).
6. **Order tanpa member** → tidak ada perubahan cache member.
7. **Addon** → tidak menyumbang point.
8. **Remove order `payment` dari PendingDrawer** → angka `point`/`saldo` kembali seperti sebelum order,
   dan entri log milik order itu hilang (tanpa entri kompensasi baru) — di kedua handler.
9. **`createOrderPayment` gagal** → mirror tidak jalan & cart tidak ter-reset.
10. **Balik online + sync + refetch** → angka & ledger dari server.
11. `npm run lint` → 0 error; `npm run build` sukses.

---

## Risiko / Catatan

- **Selisih formula** kalau diskon item & kategori bertumpuk — dampaknya hanya angka offline, hilang
  begitu online. (Detail di §Catatan Formula.)
- **Cakupan dipersempit (Q1):** order cash + member **tidak** di-mirror; server tetap menghitungnya
  saat sync.
- **Cache katalog lama** (localStorage `catalog_pricing_<channelId>`) belum punya `point_percentage`
  sampai refetch online → item seperti itu tidak dapat point lokal (server tetap mencatatnya).
- **Ledger lokal provisional:** entri log hasil order offline muncul di tab Saldo/Point, lalu hilang
  saat refetch online (di-strip / ditimpa API).
- **Bukan cakupan:** perhitungan `point_earned` di order/receipt online, settlement HO, dan perbaikan
  saldo/point yang sudah telanjur tidak tercatat.

---

## Lampiran — Hasil Audit (F1–F14)

> Digabung dari `offline-membership-point-audit.md` (2026-09-19) supaya keputusan & bukti tinggal di
> satu file. Metode: pembacaan statis (3 parallel sweep). **Belum ada test runtime** — semua klaim
> dari kode/dokumen, bukan eksekusi. **Nomor baris di bawah adalah snapshot saat audit**, bukan
> kondisi akhir setelah implementasi.

### A.1 Jalur tulis offline (inventory)

Semua jalur digerbang `isOffline = !isOnline || apiReachable === false`.

| Jalur | Fungsi | IDB | localStorage | Membership cache |
|---|---|---|---|---|
| Pay langsung | `onPayOfflineDirectPay` | `createOrderPayment` | `cache_order_history` via `saveOrderHistory` | ✗ (di parent) |
| Pay + hapus bill | `onPayOfflinePayAndDeleteBill` | `createOrderPayment` → `deleteOrderBill` | `saveOrderHistory`, `deleteOpenBills` | ✗ (di parent) |
| Pay split | `onPayOfflineSplit` | `createOrderPayment` → `updateOrderBill` | `saveOrderHistory`, `updateOpenBills` | ✗ (di parent) |
| Save bill (cart) | `onCreateBillOffline` (`cart.jsx`) | `createOrderBill` | `cache_openbills` via `saveOpenBills` | ✗ |
| Update bill (cart) | `onUpdateBillOffline` (`cart.jsx`) | `updateOrderBill` | `updateOpenBills` | ✗ |

**Mutasi membership lokal** hanya lewat tail `onPayOffline`, dan cuma jalan kalau
`selectedMethod?.is_member_payment` (sekarang melalui `mirrorMembershipOrder`).
`onCreateBillOffline` / `onUpdateBillOffline` **tidak** menyentuh membership sama sekali.

`updateSessionSummary` (`sales/session/hook.js`) di samping dispatch `updateSummary` juga menulis
`cache_shifts` lewat `updateShifts`.

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
| I11 | *(baru)* Setiap mirror lokal wajib punya revert pasangannya | ditetapkan di §8 P6 |

**Catatan:** tidak ada satu pun dokumen lama yang mengatur **revert membership saat order di-remove
dari queue**, dan **point offline tidak terdokumentasi sama sekali**.

### A.3 Temuan (F1–F14)

**F1 — HIGH — Remove order `payment` TIDAK revert membership lokal.** *Selesai — §6.4.*
`layout.jsx` (wrapper `Layout` + duplikat di Navbar) `handleRemoveOffline`: `bill` → hapus IDB +
`deleteOpenBills` + koreksi summary; `payment` → hapus IDB + `deleteOrderHistory` + koreksi summary
(**tanpa** membership); `topup` → satu-satunya yang revert.
**Dampak:** mirror point/saldo drift kalau user hapus order dari PendingDrawer. Revert topup pun
rapuh: `splice(logsIdx, 1)` dengan `logsIdx = -1` menghapus elemen terakhir, dan lookup log pakai
`sync_id` yang tidak ditulis oleh mirror saldo (lihat F3).
**Perbaikan:** `revertMembershipOrder()` mengembalikan angka `point`/`saldo` **dan** membuang entri log
milik order itu (match `reference_id`) — tanpa entri kompensasi baru.

**F2 — HIGH — Helper persist tidak di-`await`, mirror jalan walau write gagal.** *Selesai — §8 P2.*
`onPayOffline*` dipanggil tanpa `await`; tail `onPayOffline` (summary + mirror + `resetCart`) lanjut
sinkron. **Dampak:** kalau `createOrderPayment` gagal, cache membership sudah termutasi dan cart
sudah di-reset.

**F3 — MED — Bug mirror saldo lama (`checkout.jsx`).** *Selesai — Q3.*
`cloneMembership.saldo_logs = cloneMembership.point_logs || []` (sumber array SALAH) dan entri Sales
tanpa `sync_id`. Blok lama ini sudah dihapus; mirror sekarang lewat helper dan **setiap** entri log
selalu membawa `reference_id` — itu yang dipakai revert untuk membuang entri.

**F4 — HIGH — `perbaharuiMembership` gampang no-op / throw senyap.** *Selesai — §6.5.*
`getMembersipCacheRaw()` dulu balikin `[]` (array polos) kalau key kosong/corrupt → `existing.data`
`undefined` → throw, di-swallow `try/catch` kosong oleh caller. Match `===` pada `undefined` juga
bisa self-match ke entri pertama.

**F5 — MED — `cache_membership_search` ditulis tapi TIDAK pernah dibaca.** *Tidak diperbaiki —
dibiarkan (keputusan user).*
`membership/hook.js` menulis saat search **online**; `getMember` offline **selalu** baca
`cache_membership` utama. **Dampak:** member yang ditemukan via search online tidak ada di cache
utama → mirror/revert no-op (return `null`). Fallback ke cache search sempat ditambahkan lalu
dicabut supaya `perbaharuiMembership` tetap sederhana.

**F6 — MED — logs tidak di-bound, `cache_membership` masuk daftar eviction.** *Selesai — §5/§6.5.*
Dulu `boundMembershipList` hanya strip `saldo_logs`; batas 200 member / 1.5 MB; `cache_membership`
ada di `EVICTABLE_CACHE_KEYS` → `QuotaExceededError` bisa menghapus **seluruh** cache membership.
Sekarang `stripLogs` membuang `saldo_logs` **dan** `point_logs`.

**F7 — MED — `cart.jsx onCreateBillOffline` item mapping kehilangan `unit_discount`.** *Selesai — Q3.*
Padahal `makePendingBill` (`shapes.js`) & `recalculateDiscountCategory` (`helper.js`) menghitung dari
`item.unit_discount`.

**F8 — MED — `point_percentage` nol match di seluruh `src`.** *Selesai — §6.3.*
Item dari katalog otomatis membawa field-nya (spread `...catalog`), tapi item yang dibaca balik dari
bill tergantung mapping bill → ditambah eksplisit di semua mapping.

**F9 — MED — `point-history` fetch tanpa guard offline.**
`point-history.jsx` memanggil `pointLog({ id })` tanpa cek offline; andalan effect `isOffline` menimpa
`logs` dengan `membership?.point_logs`. `drawer.detail.jsx` mengirim prop `membership` (bukan `data`
server) ke ledger. **Catatan:** entri lokal hasil mirror muncul di tab ini saat offline; lalu
`saveMembershipList` men-strip `point_logs` saat refetch online (§5). Kode-nya **tidak** diubah.

**F10 — MED — Tidak ada refresh membership otomatis setelah sync.** *Diputuskan Q4 = (a).*
`syncManager.js` tidak menyentuh `cache_membership`. Refresh hanya lewat `lastSyncTime` /
prefetch `App.jsx` / tombol manual.

**F11 — INFO — `handleRemoveOffline` diduplikasi.** Dua salinan byte-for-byte mirip; tiap perubahan
remove **wajib** di dua tempat (termasuk revert mirror).

**F12 — INFO — Dokumen offline punya drift.** `needs_sync` vs `is_synced` → pakai `is_synced`. Blob
model vs flat store: doc lama camelCase, doc baru snake_case. Retry/remove UX di
`phase-2-checkout-offline.md` sengaja dibiarkan terbuka.

**F13 — INFO — Server skip validasi saldo untuk order offline.** `is_offline_mode=true` → skip cek
saldo; validasi final di server saat sync. Mirror lokal **bukan** validasi; jangan dijadikan gate.

**F14 — LOW — Timing: `onPayOfflineSplit` memutasi objek sebelum await.** `ref_sync_id / sync_id / id`
diubah **sebelum** `await` pertama. Karena dipanggil tanpa `await`, mutasi terjadi **sebelum** tail
`onPayOffline` (mirror) jalan → `reference_id` entri log mirror memakai `sync_id` baru — konsisten
dengan `queueItem` yang tersimpan, jadi revert tetap match.

### A.4 Belum diaudit / belum diverifikasi

- **Runtime:** semua statis. Belum pernah jalanin offline mode, belum tes sync beneran ke BE.
- Belum dibaca full: `services/topup/*`, `pages/authorize/topup/*`, `master` (payment method cache),
  `sales/cart` slices di luar item mapping.
- Belum cek perilaku IndexedDB quota / eviction di device nyata.
- Sisa warning lint repo-wide (bukan error): `import/order` & `react-hooks/exhaustive-deps` di file
  yang tidak tersentuh.
- BE `franq`: `point_percentage` sudah lolos `go build`, tapi endpoint `/catalog` belum dipanggil
  beneran (belum verifikasi SQL union di DB).
