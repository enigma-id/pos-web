# POS Web — Audit Findings (2026-08-06)

Audit menyeluruh branch `offlineModesFix` (Rev-1 → Rev-21) terhadap **semua 117 file `src/`**,
termasuk **online path** (bukan hanya offline). Konteks: arsitektur offline+online parity
(IDB flat stores sebagai source, Redux minimal, localStorage cache fallback, syncManager kontinu).
Referensi: `BE-pos-offline-sync.md`, `offline-data-consistency.md`, `offline-session-mode.md`,
`phase-2-checkout-offline.md`, `specs/api-contract.md`.

**Semua 5 known bug lama (per 2026-08-05) sudah fixed:**
`cleanupLocalStorageCache` undefined, `updateMembership ...data`, typo `sales_chnanel_id`,
guard `isSyncingInternal`, `mapCategoryDiscountsToSync item.*`. ✅

> **Catatan scope:** temuan #1-14 & #15-21 = offline flow. Temuan **O1-O10 = online path**
> (bagian baru). Yang paling fatal dari semua temuan adalah **O1 (service charge 0% global)** —
> mempengaruhi transaksi online DAN offline.

---

## Online Path Findings (O1-O10)

### 🔴 O1. `Auth.session` shape konflik → `outlet` undefined → **service charge 0% GLOBAL**

**File:** `src/services/auth/slice.js:15,23`, `src/services/auth/hook.js:49`, `src/services/cart/hook.js:37,327`, `src/services/cart/slice.js:277-293`

Konteks: `state.Auth.session` di-set dari **dua sumber berbeda**:
- `login` (slice:15): `state.session = action.payload.user` → session = **objek user**
- `getUser` (hook:49): `dispatch(session(res.data))` → session = **`{user, sales_session}`** (wrapper)

Kedua-duanya, `user` **tidak punya properti `outlet`** — contract `specs/api-contract.md:26-36`
menunjukkan user hanya punya `outlet_id`. Outlet ada di `sales_session.outlet` (login response line 52).

Alur bug:
```js
// cart/hook.js:37
const sessionOutlet = useSelector(state => state?.Auth?.session?.outlet);  // ALWAYS undefined
// cart/hook.js:327
dispatch(changeServiceCharge(sessionOutlet?.service_charges));             // undefined
// cart/slice.js:277-293
if (state.meta.service_charge_percentage > 0) { ... }                      // undefined → false → 0
```

**Dampak: SERVICE CHARGE SELALU 0%** untuk semua transaksi (online + offline), walau outlet
memiliki `service_charges` (mis. `0.1` = 10%). Grand total undercharged. Ini bug global, bukan
cuma offline. (`offline-data-consistency.md:179` mendokumentasikan `service_charges: 0.1` = 10%,
jadi jelas nilai itu harusnya terpakai.)

**Fix:** ambil service charge dari `SalesSession.sessionSummary?.outlet?.service_charges`
(atau `session?.sales_session?.outlet`), bukan `session.outlet`. Alternatif: konsistenkan
`Auth.session` (jangan overwrite dari dua sumber shape beda).

### 🔴 O2. `openSession` — `outlet_id: sessionAuth?.outlet?.id` → undefined

**File:** `src/pages/authorize/home/openSession.jsx:39`

Sama akar dengan O1: `sessionAuth.outlet` tidak ada. Payload open session:
```js
outlet_id: sessionAuth?.outlet?.id,   // undefined
outlet: sessionAuth?.outlet,           // undefined
```
Contract `POST /sales/session` (line 226+) mungkin derive outlet dari token, tapi kalau server
require `outlet_id` → session di-create tanpa outlet (atau reject). Risiko data integrity session.

**Fix:** ambil outlet dari `sessionSummary?.outlet` / `sales_session.outlet` (set di
`setSummary(res?.data?.sales_session)`), atau dari `session.user` properti yang benar.

### 🟠 O3. Custom catalog online — kirim `unit_nett`, contract minta `unit_price`

**File:** `src/pages/authorize/home/checkout.jsx:187,286,380,481,601,906`

Item custom online: `base.unit_nett = item?.unit_nett`.
Contract Item Request (`specs/api-contract.md:404-410`): custom pakai **`unit_price`**.

```js
// checkout.jsx:906
if (item?.is_custom) {
  base.catalog_name = item?.name;
  base.unit_nett = item?.unit_nett;   // server mungkin baca unit_price → 0
}
```

**Dampak:** kalau backend membaca `unit_price` untuk custom item → **harga custom item 0** di order.
(Offline `localTransaction.js` juga pakai `unit_nett` — konsisten dengan bug yang sama.)

**Fix:** kirim `unit_price` (bukan `unit_nett`) untuk custom item, di semua path online.

### 🟠 O4. Addons online — shape mismatch dengan contract

**File:** `src/pages/authorize/home/checkout.jsx:904-910`, `src/services/cart/slice.js:9-38`

Online kirim `base.addons = item?.additionals_flat` yang berasal dari `flattenAdditionals`:
```js
{ addon_group, addon_group_id, addon_item_id, name, unit_nett, quantity }
```
Contract addon (`specs/api-contract.md:411-415`) minta:
```js
{ addon_group_id, addon_item_id, quantity }
```

Masalah:
- `quantity` hanya di-set untuk type `'quantity'` (slice.js:31) — options/checkbox → **`quantity` undefined** → server default 1 → options dihitung qty 1 (mungkin OK), tapi kalau server pakai `quantity` → double-count.
- `unit_nett` vs `unit_price` beda nama.
- `addon_group` (nested object) tidak ada di contract → backend tolerate? tidak pasti.

**Dampak:** addon online bisa salah harga/qty di server.

### 🟠 O5. `onPayOnline` bill — `payment_ref` dari `card` overwrite

**File:** `src/pages/authorize/home/checkout.jsx:944-948`

```js
if (card) {
  payload.membership_id = card?.id;
  payload.card_id = card?.card_id;
  payload.payment_ref = card?.reff_code;   // overwrite payment_ref user-typed
}
```
Kalau payment via NFC card, `payment_ref` di-overwrite dengan `reff_code` — mungkin intended
(member payment). Bukan bug fatal, cuma catatan.

### 🟡 O6. `changeServiceCharge` jalan sekali di `useEffect([])`

**File:** `src/services/cart/hook.js:325-329`

`changeServiceCharge` hanya dipanggil saat mount cart hook. Kalau outlet/service_charges
berubah setelah login (atau di-load asinkron), nilai tidak refresh. (Terikat O1 — source-nya
undefined anyway.)

### 🟡 O7. `onCreateBillOnline` items custom pakai `unit_nett` — sama O3

### 🟢 O8. Offline `discount_categories` include `category` object — online tidak

**File:** `checkout.jsx:150-161` (offline), `checkout.jsx:266-276` (online)

Online kirim `{ category_id, discount_percentage, discount_value }` (sesuai contract).
Offline tambah `category` object. Contract Category Discount (`api-contract.md:423-429`) minta
tanpa `category` → online **benar**, offline **ekstra field** (tolerated backend, tapi tidak konsisten).

### 🟢 O9. `refund.jsx`/`copy_order.jsx` — online-only tanpa gating offline

`useOrder().cancel`/`copy` (dipanggil Refund/CopyOrder) — tidak ada path offline. Tombol
di-gating di UI (`isOnline && apiReachable !== false`) di history/bills, jadi aman saat ini,
tapi kalau dipanggil offline → fetch error tanpa fallback.

### 🟢 O10. Dead code online-path

- `specs/api-contract.md` menyebut `POST /catalog`, `/category` — `home/create.jsx` (create catalog) pakai `useCatalog().create` → online-only, tidak ada gating/queue offline. Kalau offline klik create catalog → error. (Minor — biasanya online-only operation.)

---

## P0 — Offline Data Loss / Crash

### 1. `checkAppVersion` — `localStorage.clear()` wipe semua offline cache saat deploy

**File:** `src/utils/checkVersion.jsx:4-11`

```js
if (saved !== APP_VERSION) {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, APP_VERSION);
  window.location.replace("/login");
}
```

`VITE_APP_VERSION` berubah ("sandbox" → "V2", dst.) setiap deploy. `localStorage.clear()` menghapus:

- **Semua cache offline**: `cache_openbills`, `cache_order_history`, `cache_shifts`, `cache_membership`, `cache_catalog`, `cache_sales`, `cache_table_*`
- **`redux-persist`** (`persist:root`) → logout paksa semua user

**Dampak:** transaksi offline yang sudah ada di cache (belum sync) **hilang dari UI**.
IDB (`pos-offline-queue-${userId}`) **tidak** ikut terhapus, tapi cache fallback display hilang
→ order/bill/history/shift tampak "hilang" walau masih ada di IDB. Ditambah logout massal.

**Fix yang disarankan:**
- Jangan `localStorage.clear()`; hapus hanya key persist yang bukan cache, atau
- Clear cache dengan **safelist** — hapus `cache_*` DAN `persist:root` tapi **jangan** sentuh IDB, lalu **jangan redirect paksa** kalau user punya pending queue.

---

### 2. Split payment offline — double charge server

**File:** `src/pages/authorize/home/checkout.jsx:801-872` (`onPayOfflineSplit`)

Alur split: order bill asli (pending) diupdate via `updateOrderBill`, dan payment baru
(completed) dibuat via `createOrderPayment`. `dataOfflineToOnline.sync_id` diganti uuid baru,
`id` dikosongkan.

**Bug:** order bill **asli yang pending tidak pernah dihapus** dari IDB (`deleteOrderBill` tidak dipanggil).
Saat sync, keduanya terkirim:
- `order_bills` lama (pending, `ref_sync_id: ''`) → server buat order baru
- `order_payments` baru (completed, `ref_sync_id = sync_id lama`) → server buat order bayar

**Dampak:** transaksi **dobel** di server (2 order, 1 sisa pending + 1 payment).

**Fix:** panggil `deleteOrderBill(CartState?.bill?.sync_id, userId)` di jalur split — sama seperti
`onPayOfflinePayAndDeleteBill` (checkout.jsx:756-799). Hapus juga dari `cache_openbills` via `deleteOpenBills`.

---

### 3. `setBillItems` — `category_discounts` dibuang, diskon kategori hilang

**File:** `src/services/cart/slice.js:459-498`

```js
state.discount.category = category_discounts.map(...);  // line 482-491 — DIISI
...
state.discount.category = extractUniqueCategories(allItems);  // line 495 — DITIMPA
```

Line 482-491 mengisi `state.discount.category` dari `category_discounts` payload, tapi
**line 495 langsung menimpa** dengan hasil `extractUniqueCategories(allItems)` yang hanya
menurunkan dari `item.unit_discount` (bukan kategori). Kode line 482-491 **dead**.

**Dampak:** buka bill (offline & online) yang punya diskon kategori → diskon hilang →
`subtotal`/`grand_total` salah → **transaksi amount salah saat checkout**.

**Fix:** hilangkan line 495 (atau merge — `extractUniqueCategories` hanya untuk default saat
tidak ada `category_discounts`). Perhatikan juga `unit_discount` sudah di-set di `convertApiOrderToCartItem`
dari `item.discount_value`, jadi sumber diskon kategori dobel.

---

### 4. `session/hook.js` topup block — `newTotalPaid`/`newCount` undefined → ReferenceError

**File:** `src/services/sales/session/hook.js:256-288`

```js
if (topupIdx >= 0) {
  const newTotalNominal = ... + data?.total_charges;   // line 269

  if (newTotalPaid <= 0 || newCount <= 0) {             // line 272 — UNDEFINED
    updatedSummary.summary.topups.splice(topupIdx, 1);
  } else {
    updatedSummary.summary.topups[topupIdx] = {
      ...updatedSummary.summary.topups[topupIdx],
      total_nominal: newTotalNominal,
    };
  }
}
```

`newTotalPaid`/`newCount` tidak pernah didefinisikan → **ReferenceError** di jalur
`updateSessionSummary({ type: 'topup' })` yang dipanggil dari `card.content.jsx:102`
(topup offline). **Topup offline → summary crash** (payment berhasil, summary gagal).

**Fix:** hapus kondisi `newTotalPaid`/`newCount`, cukup `if (newTotalNominal <= 0)` splice.

---

### 5. `session/hook.js` update block — `showShifts` null → crash

**File:** `src/services/sales/session/hook.js:242-254`

```js
if (data.type === 'update') {
  if (!(data.id === updatedSummary.id || data.sync_id === updatedSummary.sync_id)) {
    let existing = showShifts(data);      // bisa null (cache_shifts tidak punya session)
    existing.summary.sales.outstanding_bill += data.outstanding_bill;  // crash
```

`showShifts` (cache.js:342) return `null` kalau `findIndex === -1` (session tidak ada di
`cache_shifts` — mis. bill berasal dari server session yang belum di-cache offline, atau
session dari device lain).

**Dampak:** `updateSessionSummary({type:'update'})` dipanggil dari `onPayOfflinePayAndDeleteBill`
(checkout.jsx:793) & `onUpdateBillOffline` (checkout.jsx:445) → **ReferenceError** saat session
tidak ada di cache.

**Fix:** guard `if (!existing) return;` setelah `showShifts`.

---

## P1 — Behavior / Sync Salah

### 6. `setWaring` — undefined function → ReferenceError

**File:** `src/pages/authorize/home/cart.jsx:70`, `checkout.jsx:146`

```js
dispatch(setWaring('Please open session.'));
```

`setWaring` tidak di-import dan tidak didefinisikan (yang ada `setWarning` di slice). 
**ReferenceError** saat Save Bill offline tanpa session terbuka.

**Fix:** import `setWarning` dari `services/offline/slice`.

---

### 7. `syncStatus` vs `is_synced` campur — count pending salah

Sessions pakai `syncStatus` (index dibuat di queue.js:43), orders/payments/topups pakai `is_synced`.
`startSession`/`closeSession` (queue.js) **hanya set `sync_type`, tidak pernah set `syncStatus`**.

Akibat:
- `PendingDrawer.jsx:57` `hasPendingOrFailed` cek `s.syncStatus === 'pending'||'failed'` → **selalu false** (field undefined) → tombol Retry di header drawer tidak muncul walau ada session pending.
- `usePendingQueueCount.js:36` `sessions.filter(s => s.syncStatus !== 'synced')` → **semua session dihitung pending** (inflasi count) walau hanya referensi server.
- Tab Shifts di PendingDrawer count = `data.sessions.length` (semua, termasuk referensi synced).

**Fix:** konsisten — buang `syncStatus`, pakai `is_synced` untuk semua store (dan index `syncStatus` di queue.js upgrade DB), atau set `syncStatus` dengan benar.

---

### 8. `checkPartialPaid` — id mismatch, split payment salah cabang

**File:** `src/services/offline/helper.js:31-91`, dipanggil `checkout.jsx:699`

`checkPartialPaid(payload.items, CartState?.bill?.items)`:
- `reqItems` (payload.items) dibangun dari `CartState.items` → `id: item?.order_item_id || uuidv4()` (baru digenerate, `uuidv4()` acak)
- `oldItems` (bill items) punya `id` = `order_item_id` asli dari server

Match `ir.id === oldItem.id` (helper.js:46) → untuk item cart yang id-nya `uuidv4()` baru,
**tidak cocok** → `notPay=false` semua → `isPending` salah → **cabang PayAndDelete vs Split salah**.

**Dampak:** item yang benar-benar diubah qty-nya tidak terdeteksi → payment "split" salah jalur
(atau tidak split saat harusnya, atau split saat tidak harus).

**Fix:** match berdasarkan `catalog_id` + qty (bukan id), atau pastikan `payload.items` memakai
`order_item_id` yang sama dengan bill items.

---

### 9. Offline membership — `id` undefined → fetch `/membership/undefined`

Membership offline (`createMembership`/`createTopup` cache) payload hanya `{ sync_id, card_id, name, reff_code, saldo }` — **tidak ada `id`** (server UUID).

Akibat:
- `drawer.detail.jsx:50` `HistorySection id={membership?.id}` → `history.jsx:187` `showMember(undefined)` → `triggerShow(undefined)` → **fetch `/membership/undefined`** → error.
- `update.jsx` `update({ id: membership?.id ... })` → `/membership/undefined` → error.

**Dampak:** buka detail/update member yang **dibuat offline** (belum sync) → error fetch.

**Fix:** gating offline — kalau `!membership?.id` (masih pending sync), render dari cache
(saldo_logs dari `membership.saldo_logs`), nonaktifkan tombol yang butuh id.

---

### 10. Cache tidak di-cleanup setelah sync — entri stale/duplikat

**File:** `src/services/offline/syncManager.js` (hapus row IDB sukses, tapi tidak sentuh localStorage)

Setelah `/sales/sync` sukses, row IDB dihapus (`db.delete`), tapi:
- `cache_openbills` — tidak dihapus untuk bills yang jadi payment
- `cache_order_history` — tidak dihapus untuk orders yang synced
- `cache_shifts` — session synced masih tersisa

Satu-satunya cleanup manual ada di `layout.jsx` (saat user klik Remove di PendingDrawer).
Cache cleanup function (`deleteOpenBills`, `deleteOrderHistory`) **tidak dipanggil di syncManager**.

**Dampak:** setelah sync, buka History/Bills/Shifts offline → **entri lama masih muncul duplikat**
sampai cache ditimpa fetch online.

**Fix:** setelah `db.delete` sukses di syncManager, panggil `deleteOpenBills`/`deleteOrderHistory`
untuk order yang synced + hapus session yang synced dari `cache_shifts`.

---

### 11. Addon options/checkbox — quantity fraksi → subtotal salah

**File:** `src/services/cart/slice.js:213,233` (`convertApiOrderToCartItem`)

```js
quantity: add.quantity / item.quantity,   // options/checkbox → qty = 1/item.qty → fraksi
```

Untuk addon group `type: 'options'`/`'checkbox'`, server simpan `add.quantity` (biasanya 1).
Dibagi `item.quantity` → **fraksi** (mis. item qty 3 → addon qty 0.333). Lalu
`calculateAdditionalsPerItem` (line 271) `child.quantity` dipakai untuk subtotal → **salah**.

Untuk `type: 'quantity'`, addon qty = `addon.qty * item.qty` (dari makePendingBill) →
`add.quantity / item.quantity` = benar (kembali ke addon.qty).

**Dampak:** bill item dengan addon options/checkbox → subtotal addon salah saat edit/re-open bill.

**Fix:** `type: 'options'`/`'checkbox'` → `quantity: 1` (jangan dibagi). Hanya `type: 'quantity'` yang dibagi.

---

## P2 — Display / Drift

### 12. Receipt / OrderDetails — cashier offline kosong

`receipt.jsx:40`, `order.jsx:29`: `data?.session?.cashier?.name`.
Order offline `session` = `sessionSummary` (Redux) yang punya `cashier` di **root**, bukan
`session.cashier`. → **cashier kosong** di receipt/order detail offline.

**Fix:** `data?.session?.cashier?.name || data?.cashier?.name || '-'`.

---

### 13. Topup offline — bonus saldo drift + payment_type kosong

**File:** `src/pages/authorize/membership/card.content.jsx:35-111`

- `useBonuses` dari `schemaBonus` (useMaster). Kalau offline & belum pernah cache bonus schema
  (pre-fetch App.jsx hanya saat login online), `schemaBonus = []` → bonus **tidak dihitung offline**,
  tapi server hitung bonus saat sync → **saldo server ≠ cache**.
- `payloadBonus` (line 76-83) **tidak punya `sync_id`** — dan bonus tidak di-queue ke IDB
  (`createTopup` hanya untuk topup, bonus hanya di cache saldo). Setelah sync, `saldo_logs`
  cache tidak match server.
- `payment_type: method` tanpa validasi → bisa empty → sync topup `payment_type: ''` → server reject.

**Fix:** validasi `method` wajib pilih; catat bonus sebagai saldo_log dengan `sync_id`; pertimbangkan
jangan menambah bonus di cache sampai sync (atau sync bonus eksplisit).

---

### 14. Shifts offline — order list tidak muncul

`cache_shifts` diisi `saveShifts` (open) & `updateShifts` (close) dari `makeStartSession` yang
**tidak punya `orders` array**. `shifts/index.jsx:429` `detail?.orders?.map` → undefined → order
tidak dirender. Jadi **shifts offline tidak bisa lihat/buka order dalam session**.

---

## P3 — Kosmetik / Dead Code

| # | Temuan | Lokasi |
|---|---|---|
| 15 | Debug `console.log` di prod | `customer.jsx:88`, `history.jsx:222`, `card.content.jsx:88,99`, `layout.jsx:87,93,211,217,298`, `syncManager.js` (banyak), `membership/index.jsx:88` |
| 16 | `setPendingCount` tidak pernah di-dispatch — `Offline.pendingCount` selalu 0 | `bills/index.jsx:84`, `history/index.jsx:79` baca `Offline.pendingCount` → re-fetch offline mati |
| 17 | Dead code — `localTransaction.js` (`buildOfflineTransactionPayload`), `incrementSyncAttempt`/`resetMetadata`/`getAllMetadata` (queue.js) | tidak ada pemakai |
| 18 | Dead code — seluruh `table/` (useTable, table.config, TableRender, CardRender, CardList, Pagination, TableTool, TableWrapper, `tableApi`) | tidak ada importer; masih di-register store.js → bundle bloat |
| 19 | Dead code — `CopyOrder` (`copy_order.jsx`) | `useOrder().copy` tidak ada di hook/action; button di-comment |
| 20 | Dead code — `preview.jsx` (PrintWindow lama), `config.js` (`CONFIG.apiURL` hardcode) | tidak dipakai |
| 21 | `copy_order.jsx`, `refund.jsx` `useOrder().copy`/`cancel` — online-only, tanpa gating offline | kalau di-uncomment, tidak ada path offline |

---

## Ringkasan — Prioritas Fix

### Urutan rekomendasi

**Online path (paling fatal, fix dulu):**
1. **O1** service charge 0% global — source `session.outlet` undefined → ganti ke `sessionSummary.outlet` / `sales_session.outlet`
2. **O2** `openSession` `outlet_id` undefined — sama akar O1
3. **O3** custom catalog online kirim `unit_nett` vs contract `unit_price`
4. **O4** addons online shape mismatch (quantity missing utk options/checkbox)

**Offline P0:**
5. **P0 #1** `checkAppVersion` — ganti `localStorage.clear()`
6. **P0 #2** split double-charge — tambah `deleteOrderBill` + `deleteOpenBills`
7. **P0 #3** `setBillItems` — jangan timpa `category_discounts`
8. **P0 #4** topup `newTotalPaid`/`newCount` — hapus kondisi undefined
9. **P0 #5** `showShifts` null — tambah guard

**Offline P1-P3:**
10. **P1 #6** `setWaring` → `setWarning`
11. **P1 #7** `syncStatus`/`is_synced` konsisten
12. **P1 #8** `checkPartialPaid` id mismatch
13. **P1 #9** offline membership `id` undefined
14. **P1 #10** cache cleanup setelah sync
15. **P1 #11** addon options qty fraksi
16. **P2 #12-14** display/drift
17. **P3 #15-21** debug logs + dead code cleanup

### Catatan

- **IDB vs localStorage**: fix P0 #1 tidak menghapus IDB, tapi cache fallback display hilang → pesan konfirmasi ke user sebelum clear.
- **Prioritas paling fatal data loss**: O1 (service charge undercharge semua transaksi), #2 (double charge), #3 (amount salah), #1 (wipe cache).
- **O1 adalah yang paling berdampak** — mempengaruhi SEMUA transaksi (online + offline), bukan hanya alur tertentu.
- Semua fix sebaiknya di-verify manual di alur online & offline→online (ikuti `offline-e2e.md`).
