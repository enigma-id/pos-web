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

> **Status verifikasi (2026-08-07): O1 & O2 RESOLVED — bukan bug.** Awalnya ditulis P0
> "0% global" & "always undefined". Setelah verifikasi dengan response `/auth/me` &
> `/auth/login` asli (keduanya punya `outlet` top-level dengan `service_charges: 5`),
> **tidak ada bug** — `Auth.session.outlet` tersedia di kondisi normal. Detail di bawah.

### ✅ O1. Service charge — RESOLVED (bukan bug)

**File:** `src/services/auth/slice.js:13-25`, `src/services/auth/hook.js:29-49`, `src/services/cart/hook.js:37,325-329`

**Response API asli (2026-08-07):**

- `/auth/login` → `{ user, outlet: { service_charges: 5 }, access_token }`
- `/auth/me` → `{ user, outlet: { service_charges: 5 } }`

`service_charges: 5` = **persen langsung** (5%). Konfirmasi: summary server `total_service 7500 / total_sales 150000 = 5%` ✓.

**Alur `Auth.session`:**

- `login` (slice:15) → `Auth.session = user` (tanpa outlet) — sesaat
- `getUser` (hook:49) → `dispatch(session(res.data))` → `Auth.session = {user, outlet}` → **`Auth.session.outlet.service_charges = 5`** ✅
- `getUser()` selalu dipanggil di `signin` (hook:32) → outlet tersedia
- `Auth` **tidak di-blacklist** (store.js) → persist → reload app tetap `{user, outlet}` → outlet ada ✅

**Kesimpulan: `Auth.session.outlet.service_charges` tersedia di kondisi normal. Bukan bug.**
Race window (login set user tanpa outlet → getUser async) cuma beberapa ms, non-issue.
Kalau getUser gagal (offline), service charge 0 memang wajar (tidak punya data outlet).

### ✅ O2. `openSession` `outlet_id` — RESOLVED (bukan bug)

**File:** `src/pages/authorize/home/openSession.jsx:39,44`

`outlet_id: sessionAuth?.outlet?.id`, `cashier_id: sessionAuth?.user?.id` — setelah getUser,
`Auth.session = {user, outlet}` → **keduanya tersedia** ✅. `getUser` cuma menambah `outlet`,
tidak menghapus `user`, jadi `session.user.id` tetap konsisten. Bukan bug.

### ✅ O3. Custom catalog online — SOLVED (backend baca `unit_nett`, bukan `unit_price`)

**Status:** solved. Temuan awalnya berdasarkan `specs/api-contract.md:404-410` yang **outdated**.
Verifikasi ke backend asli (`~/Workspaces/franq/backend/pos`):

- `src/handler/rest/sales/order/request_item.go:16-18` — field custom:
  ```go
  UnitNett    float64 `json:"unit_nett"`
  CatalogName string  `json:"catalog_name"`
  ```
- `request_item.go:66-74` — validasi custom pakai `UnitNett` sebagai harga:
  ```go
  if r.UnitNett == 0 { v.SetError(..., "unit price is required for custom catalog") }
  r.catalogPricing = &entity.CatalogPricing{ CatalogID: r.catalog.ID, Price: r.UnitNett }
  ```

→ Backend baca `unit_nett` → **frontend kirim `unit_nett` = benar. Bukan bug.**

### ✅ O4. Addons online — SOLVED (backend default `quantity=1` utk options/checkbox)

**File:** `src/pages/authorize/home/checkout.jsx:904-910`, `src/services/cart/slice.js:9-38`
**Verifikasi backend:** `src/handler/rest/sales/order/request_addon.go:54-60`:

```go
if r.addonGroup.Type == "quantity" {
    if r.Quantity == 0 { v.SetError(..., "quantity is required for quantity type") }
} else {
    r.Quantity = 1   // options/checkbox → default 1
}
```

- Frontend kirim `quantity` undefined utk options/checkbox → backend **default 1** → **benar**.
- Qty scaling addon dilakukan di server (`request_item.go:123` `addon.Quantity = item.Quantity * addon.Quantity`) — bukan client. → **bukan bug.**

**Catatan tambahan dari backend (konteks online):**

- **Service charge dihitung server** (`request_create.go:57-61`) dari `session.SalesSession.Outlet.ServiceCharges`, bukan dari request → konfirmasi O1: transaksi online aman walau client display 0.
- **Category discount dihitung server** (`request_create.go:279-291`): `TotalDiscount` dari items, validasi category harus dipakai item.
- **Midtrans/qris**: `request_create.go:183` status dipaksa `pending` utk gateway (callback) — frontend kirim `completed` tapi server override. OK.
- **`is_apk`** (`request_create.go:57`): kalau `is_apk: true` → skip service charge.

### ✅ O5. `onPayOnline` bill — `payment_ref` dari `card` overwrite — INTENDED

**File:** `src/pages/authorize/home/checkout.jsx:944-948`

```js
if (card) {
  payload.membership_id = card?.id;
  payload.card_id = card?.card_id;
  payload.payment_ref = card?.reff_code; // sengaja — ref = kode member card
}
```

Konfirmasi user (2026-08-07): **sengaja** — payment via member card, `payment_ref` = `reff_code`
member. **Bukan bug.**

### ✅ O6. `changeServiceCharge` — FIXED (re-run + guard)

**File:** `src/services/cart/hook.js:325-329`

**Before:**

```js
useEffect(() => {
  if (CartState.meta.service_charge_value === 0) {
    dispatch(changeServiceCharge(sessionOutlet?.service_charges));
  }
}, []);
```

**After (2026-08-07):**

```js
useEffect(() => {
  if (sessionOutlet?.service_charges == null) return;
  dispatch(changeServiceCharge(sessionOutlet.service_charges));
}, [sessionOutlet?.service_charges]);
```

Perubahan:

- Dep `[]` → `[sessionOutlet?.service_charges]` → re-run saat outlet/`service_charges` berubah
- Guard `sc == null` → skip kalau outlet belum ada (cegah `changeServiceCharge(undefined)`)
- Dispatch langsung tanpa kondisi `service_charge_value === 0` → selalu sinkron dengan outlet

### ✅ O7. `onCreateBillOnline` items custom pakai `unit_nett` — SOLVED (sama O3)

### ✅ O8. Offline `discount_categories` include `category` object — SOLVED (harmless)

**File:** `checkout.jsx:150-161` (offline), `checkout.jsx:266-276` (online)

Online kirim `{ category_id, discount_percentage, discount_value }`.
Offline tambah `category` object (ekstra).

**Verifikasi backend** (`request_category_discount.go:11-20`):

```go
type categoryDiscountRequest struct {
    CategoryID         string  `json:"category_id"`
    DiscountPercentage float64 `json:"discount_percentage"`
    DiscountValue      float64 `json:"discount_value"`
}
```

- Backend baca 3 field; `category` object (extra) **diabaikan** (Go unmarshal) → tidak crash.
- Validasi (`:37-39`) butuh minimal satu discount — frontend offline selalu kirim
  `discount_percentage` ATAU `discount_value` (filter `discount_value > 0`) → aman.

**Kesimpulan: bukan bug** — extra `category` harmless, online & offline sama-sama diterima backend.

### ✅ O9. `refund.jsx`/`copy_order.jsx` — online-only — INTENDED

`useOrder().cancel`/`copy` (Refund/CopyOrder) — online-only. Konfirmasi user (2026-08-07):
tombol **hanya muncul saat online** (`history/index.jsx:236` `{isOnline && apiReachable !== false && ...}`),
copy order button di-comment. **Offline tidak ada tombol → tidak ada aksi → aman. Bukan bug.**

### ✅ O10. Create catalog offline — INTENDED (tombol di-gating)

`home/create.jsx` pakai `useCatalog().create` → `POST /catalog` (online-only, tanpa queue).
Tapi tombol `+` (openDrawer) **hanya render saat online**: `home/index.jsx:215`
`{!isOffline && (...)}` → offline tombol gak muncul → gak bisa klik → aman.
**Bukan bug** — gating di UI, konsisten dengan O9.

---

## P0 — Offline Data Loss / Crash

### ✅ 1. `checkAppVersion` — `localStorage.clear()` — NOT A BUG / by design

**File:** `src/utils/checkVersion.jsx:4-11`

```js
if (saved !== APP_VERSION) {
  localStorage.clear(); // cuma localStorage
  localStorage.setItem(STORAGE_KEY, APP_VERSION);
  window.location.replace('/login');
}
```

**Verifikasi (2026-08-07):**

- `localStorage.clear()` **tidak menyentuh IndexedDB** (`pos-offline-queue-${userId}`) → queue transaksi offline **tetap aman**.
- Setelah login ulang, `signin` (auth/hook.js:35-37) langsung panggil `syncPendingSessions()` → IDB langsung sync. Konfirmasi user: disengaja.
- Yang hilang cuma cache display (history/bills/shifts offline) + logout paksa — wajar saat deploy versi baru.

**Kesimpulan: bukan bug.** Data transaksi di IDB tidak hilang; cache display ilang = expected saat deploy.

---

### ✅ 2. Split payment offline — NOT A BUG (double-charge salah klaim)

**File:** `src/pages/authorize/home/checkout.jsx:821-856` (`onPayOfflineSplit`)

**Re-verifikasi (2026-08-07):** klaim awal "double charge" **salah**. Trace alur split:

1. `createOrderPayment` (line 829) — porsi yang dibayar → entry **baru** di `order_payments`,
   `ref_sync_id` = bill asli, `sync_id` baru, `id` kosong.
2. `updateOrderBill` (line 850) — sisa item → **UPDATE bill asli in-place** (`queue.js:173-205`
   `db.put({...existing, ...payload})`), tidak bikin entri baru, tidak hapus.

Setelah split, IDB punya 2 entri **beda peran** (bukan dobel):
| Store | sync_id | Isi | Status |
|---|---|---|---|
| order_bills | original | sisa item (belum bayar) | pending |
| order_payments | baru | item yang dibayar | completed + ref_sync_id |

- Bill asli **MEMANG harus tetap ada** di split (mewakili sisa yang belum dibayar) — di-update, bukan dihapus.
- Yang harus dihapus hanya di alur **bayar penuh** — dan itu sudah `deleteOrderBill` (line 781). ✅

**Kesimpulan: bukan bug.** Risiko nyata bukan di sini, tapi di **#8 `checkPartialPaid` id mismatch** —
kalau deteksi `isPending` salah → bisa masuk cabang split/payAndDelete yang salah.

---

### ✅ 3. `setBillItems` — NOT A BUG (dua jalur, tujuan berbeda)

**File:** `src/services/cart/slice.js:459-498`

**Re-verifikasi (2026-08-07):** klaim awal "line 495 menimpa, diskon hilang" **salah**.
Juga koreksi: bukan "dead code" — ini **dua jalur dengan sumber berbeda**:

- **Blok A (482-491):** `state.discount.category` dari **`category_discounts`** (diskon kategori
  eksplisit dari server): `{ id, name, discount_type, discount_value }`.
- **Blok B (495):** `state.discount.category` dari **`extractUniqueCategories(allItems)`** —
  diskon kategori diturunkan dari `item.unit_discount` per-item (slice.js:46-54).
  `convertApiOrderToCartItem` (256-257) sudah set `unit_discount`/`discount_percentage`/`is_discount_percentage`.

Server simpan diskon kategori di 2 tempat (`item.discount_value` per-item + `category_discounts`
array) → kedua jalur valid, sumber beda. **Diskon tidak hilang — dua-duanya menangani kasus yang sama.**

**Kesimpulan: bukan bug.** Tidak perlu fix.

---

### ✅ 4. `session/hook.js` topup block — ALREADY FIXED (Rev-21)

**File:** `src/services/sales/session/hook.js:256-288`

**Re-verifikasi (2026-08-07):** temuan awal (`newTotalPaid`/`newCount` undefined → ReferenceError)
**sudah di-fix** di commit `7ff3f6b` (Rev-21):

```diff
- if (data.type === 'topup') {
+ if (data.type === 'topup' || data.type === 'deleted_topup') {
-   ...total_paid ... + data?.total_charges;
+   ...total_nominal ... + data?.topup_nominal;
-   if (newTotalPaid <= 0 || newCount <= 0) {
+   if (newTotalNominal <= 0) {
```

- `newTotalPaid`/`newCount` dihapus → pakai `newTotalNominal` (benar).
- Bonus: `deleted_topup` juga di-handle.

**Kesimpulan: bukan bug — sudah fixed.** (Audit awal di titik sebelum Rev-21.)

---

### ✅ 5. `session/hook.js` update block — NOT A BUG (session hasSession selalu di cache)

**File:** `src/services/sales/session/hook.js:242-254`

**Re-verifikasi (2026-08-07):** klaim awal "showShifts null → crash" **overclaim**.

`showShifts` (cache.js:342) return null kalau session gak ada di `cache_shifts`. Tapi
**session aktif (hasSession) selalu ada di `cache_shifts`**, via 2 jalur:

1. `openSession.jsx:61` `saveShifts` — saat session dibuka offline
2. `session/hook.js:82` `setCache(SHIFTS_CACHE_KEY, serverData)` — saat `session()` fetch online
   (dipanggil App.jsx pre-fetch saat login online)

`onBillSelected` cuma bisa dipanggil saat `hasSession` (UI gating) → bill pakai session yang
hasSession → session itu selalu di-cache → `showShifts` ketemu → **tidak crash.**

**Kesimpulan: bukan bug.** `showShifts` null cuma di edge case session dari device lain / stale
(rare, non-issue).

---

## P1 — Behavior / Sync Salah

### ✅ 6. `setWaring` — FIXED (typo → `setWarning`)

**File:** `src/pages/authorize/home/cart.jsx:70`, `checkout.jsx:146`

**Before:** `dispatch(setWaring('Please open session.'))` — `setWaring` (typo) tidak ada di slice →
ReferenceError saat Save Bill offline tanpa session.

**After (2026-08-07):**

- `cart.jsx`: tambah `import { setWarning } from '../../../services/offline'` + ganti `setWaring` → `setWarning`
- `checkout.jsx`: ganti `setWaring` → `setWarning` (import sudah ada line 24)
- `grep setWaring` → bersih (0 hasil).

---

### ✅ 7. `syncStatus` vs `is_synced` campur — FIXED (konsisten `is_synced`)

Sessions dulu pakai `syncStatus` (index queue.js:43) tapi **tidak pernah di-set**; orders/payments/topups pakai `is_synced`. Akibat: `usePendingQueueCount` hitung semua session pending (inflasi), `PendingDrawer` tombol Retry tidak muncul.

**Fix (2026-08-07) — konsisten `is_synced` di sessions:**
| File | Perubahan |
|---|---|
| `queue.js` `startSession` | `is_synced: false` |
| `queue.js` `closeSession` insert-fallback (server) | `is_synced: false` |
| `queue.js` `closeSession` offline close | `is_synced: false` |
| `usePendingQueueCount.js:36` | `!s.is_synced` |
| `cache.js:55` (computePendingCount) | `if (s.is_synced) return` |
| `PendingDrawer.jsx:57` | `!s.is_synced` |

Index `syncStatus` di DB (v5) dibiarkan (legacy, tidak merusak).

---

### ✅ 8. `checkPartialPaid` — NOT A BUG (id match benar)

**File:** `src/services/offline/helper.js:31-91`, dipanggil `checkout.jsx:696`

**Re-verifikasi (2026-08-07):** klaim awal "id mismatch" **salah**. Kunci: `CartState.bill`
dan `CartState.items.bill` adalah **dua hal berbeda**:

- `selectedBill(data)` (cart/hook.js:263) → `CartState.bill = data` **asli** (server/queue bill) →
  `CartState.bill.items` = **item server asli, punya `id`**.
- `setBillItems` (slice:473) → `CartState.items.bill` = hasil `convertApiOrderToCartItem`
  (punya `order_item_id`, utk display/edit).

`checkPartialPaid(payload.items, CartState.bill.items)`:
- `oldItems` = `CartState.bill.items` (server asli) → `oldItem.id` = server UUID.
- `reqItems` = `payload.items` → item dari bill: `ir.id = item.order_item_id` = server UUID (sama).
- Item bill sama → id cocok → `notPay=true`; qty sama → tidak pending. Item baru → `uuidv4()`
  → masuk pending (benar).

**Kesimpulan: bukan bug.** Logika match benar. Ini juga konfirmasi #2 (double-charge) memang
tidak ada — bill penuh → `PayAndDeleteBill` → hapus bill.

---

### ✅ 9. Offline membership — `id` undefined — NOT A BUG (sudah di-guard)

Membership offline (`createMembership`/`createTopup` cache) payload `{ sync_id, card_id, name, reff_code, saldo }` — **tidak ada `id`** (server UUID). Tapi **sudah di-guard**:

- `history.jsx:186` → `if (!isOffline && membership?.id) showMember(membership?.id)` → offline / id undefined → **tidak fetch** `/membership/undefined`. Offline render dari `membership.saldo_logs` (line 182-183).
- `update.jsx:141-142` → `if (!isOffline) show(id)` → offline tidak fetch. Offline update pakai `updateMembership` (queue IDB, tidak butuh id server). Tombol Remove di-gating `!isOffline` (line 223).
- `drawer.detail.jsx:50` `HistorySection id={membership?.id}` → aman karena history.jsx guard internal.

**Kesimpulan: bukan bug** — semua jalur fetch sudah di-guard offline / undefined id.

**Fix:** gating offline — kalau `!membership?.id` (masih pending sync), render dari cache
(saldo_logs dari `membership.saldo_logs`), nonaktifkan tombol yang butuh id.

---

### ✅ 10. Cache tidak di-cleanup setelah sync — NOT A BUG (auto-refresh via lastSyncTime)

**File:** `src/services/offline/syncManager.js`, halaman history/bills/shifts/membership

**Re-verifikasi (2026-08-07):** klaim "cache stale/duplikat" **salah**. Alur:

- `syncManager.js:330-331` → `setLastSyncTime(now)` di-dispatch **di akhir sync** (setelah semua group diproses).
- Semua halaman `useEffect(..., [lastSyncTime])` → re-fetch dari server:
  - `history/index.jsx:65`, `bills/index.jsx:70`, `shifts/index.jsx:108`, `membership/index.jsx:47`.
- **Summary juga auto-refresh**: `layout.jsx:376-378` `useEffect(() => summary(), [lastSyncTime])` →
  `session/hook.js:54-56` fetch server → `dispatch(setSummary(res.data))` → `sessionSummary` Redux fresh.
- Re-fetch sukses → `setCache(...)` di hook → **cache ditimpa data server fresh**.

Cache otomatis ter-refresh setelah sync — tidak perlu manual delete. Edge case: kalau re-fetch
gagal (masih offline sesaat), cache lama bertahan — display sementara, bukan bug.

**Kesimpulan: bukan bug.**

---

### ✅ 11. Addon options/checkbox — quantity fraksi — NOT A BUG (normalisasi balik benar)

**File:** `src/services/cart/slice.js:213,233` (`convertApiOrderToCartItem`)

```js
quantity: add.quantity / item.quantity
```

**Re-verifikasi (2026-08-07):** klaim "fraksi → subtotal salah" **salah**. Ini **normalisasi balik yang benar**:

- Backend simpan addon qty **scaled** = `item.Quantity * addon.Quantity` (`request_item.go:123`).
- Options/checkbox: backend set addon qty `= 1` (`request_addon.go:59-60`) → DB `item.qty * 1` = scaled.
- Frontend `/ item.quantity` → normalisasi balik: `(item.qty * 1) / item.qty` = **1** (options), `(item.qty * userQty) / item.qty` = **userQty** (quantity type) → **keduanya benar**.

**Kesimpulan: bukan bug.** Division hanya masalah kalau `item.quantity = 0`, tapi server qty ≥ 1.

---

## P2 — Display / Drift

### ✅ 12. Receipt / OrderDetails — cashier offline kosong — NOT A BUG

`receipt.jsx:40`, `order.jsx:29`: `data?.session?.cashier?.name`.

**Re-verifikasi (2026-08-07):** klaim "cashier offline kosong" **salah**. Salah interpretasi akses:

- `data?.session?.cashier?.name` = `session.cashier.name` (cashier di **root session**), BUKAN
  `session.session.cashier.name`.
- `data.session` (offline) = `sessionSummary`, dan `sessionSummary.cashier` = user object (di-set
  `makeStartSession` spread `openSession.jsx:44` `cashier: sessionAuth?.user`) → `.name` ada ✅.
- Online: `data.session.cashier.name` juga ada (server session cashier root).

**Kesimpulan: bukan bug** — cashier tampil benar untuk online & offline. Sumber salah: gua
mengira `data.session` butuh `.session.cashier`, padahal `.cashier` di root.

---

### ✅ 13. Topup offline — bonus drift — NOT A BUG (praktis tak terjadi)

**File:** `src/pages/authorize/membership/card.content.jsx:35-111`

**Re-verifikasi (2026-08-07):**
- `payloadBonus` **sudah punya `sync_id`** (line 81) & `reference_id` (line 85).
- Bonus tidak di-queue ke IDB (hanya cache saldo); server `processTopups` (sales_sync.go) hitung
  bonus sendiri dari nominal.

**Kenapa praktis tidak terjadi drift:** `schemaBonus` selalu tersedia saat offline karena login
selalu online:
1. Login → `App.jsx:40` `getSchemaBonus()` → fetch server → `setCache('cache_schema_bonus')`.
2. Buka topup modal → `card.content.jsx:155` `getSchemaBonus()` → offline baca cache
   (`master/hook.js:35-37`).
3. `schemaBonus` client (dari cache) == server gRPC → bonus client & server konsisten.

Offline tanpa cache schema bonus praktis mustahil (harus login dulu = online). `payment_type`
dari `method` (bisa kosong) → potensi reject, tapi UI pilihan method ada (cash/transfer).

**Kesimpulan: bukan bug** (login selalu online → cache schema bonus selalu terisi sebelum offline).

---

### ✅ 14. Shifts offline — order list tidak muncul — NOT A BUG

**File:** `src/pages/authorize/shifts/index.jsx:429`, `src/utils/cache.js`

**Re-verifikasi (2026-08-07):** klaim "shifts offline gak bisa lihat order" **salah**.

- `cache_shifts` diisi 3 cara: `saveShifts` (open session), `updateShifts` (hook:293), `setCache`
  (hook:82, dari `session()` fetch online).
- **Session yang dipake transaksi** → `updateSessionSummary` (`type:'payment'`) nambah
  `updatedSummary.orders` (hook:219-225) → `updateShifts` → cache_shifts **dengan orders** →
  shift detail offline `detail.orders.map` → **order muncul** ✅.
- Session tanpa transaksi → orders kosong (wajar). Session server → detail butuh `GET
  /sales/session/{id}` (online); list `GET /sales/session` tanpa orders → detail offline terbatas
  (wajar, online-only fetch).

**Kesimpulan: bukan bug.** Offline shifts menampilkan orders dari session yang punya transaksi
(via updateShifts); session server detail butuh online fetch (expected).

---

## P3 — Kosmetik / Dead Code

| #   | Temuan                                                                                                                                    | Lokasi                                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 15  | Debug `console.log` di prod — **FIXED** (2026-08-07)                                                                                       | layout.jsx(18), checkout(4), customer(2), membership pages(11), syncManager(19) dihapus/`// ignore`. Yang legit (error log, DEV-gated baseQuery) dibiarkan. Build OK. |
| 16  | `setPendingCount` tidak pernah di-dispatch — `Offline.pendingCount` selalu 0 — **FIXED** (2026-08-07)                                      | `usePendingQueueCount.refresh()` sekarang `dispatch(setPendingCount(total))` → Redux sinkron → heartbeat syncManager jalan + `offlinePendingCount` bills/history bener. Build OK. |
| 17  | Dead code — **FIXED** (2026-08-07): `localTransaction.js` dihapus, `incrementSyncAttempt`/`resetMetadata`/`getAllMetadata` (queue.js) + barrel export dihapus | tidak ada pemakai (verified); grep bersih. Build OK.                                                                                                |
| 18  | `useTable` + seluruh `table/` (useTable, table.config, TableRender, CardRender, CardList, Pagination, TableTool, TableWrapper, `tableApi`) | tidak ada importer; masih di-register store.js → bundle bloat. **User pilih: biarkan.**                                                               |
| 19  | `CopyOrder` (`copy_order.jsx`)                                                                                                            | **DIPAKAI** — tombol "copy order" di bills/index.jsx:249-253 (gating `!isOffline`), `useOrder().copy` ada (order/action.js:38, hook.js:84). NOT dead.  |
| 20  | `preview.jsx` (PrintWindow lama), `config.js` (`CONFIG.apiURL` hardcode)                                                                  | tidak dipakai. **User pilih: biarkan.**                                                                                                              |
| 21  | `refund.jsx` `useOrder().cancel` — online-only, gating di UI (`isOnline && apiReachable !== false`)                                      | offline tombol tidak muncul → aman. CopyOrder juga gating `!isOffline`. NOT a bug.                                                                    |
| 22  | PendingDrawer icon refresh selalu muncul (dari fix #7 `!is_synced`) — **FIXED** (2026-08-07)                                              | Icon refresh harus muncul **cuma saat sync gagal**, bukan sekadar pending. syncManager track `hadSyncFailure` → `setFailedCount(1/0)`; PendingDrawer `hasPendingOrFailed` pakai `Offline.failedCount > 0`. Build OK. |
| 23  | `showFailoverModal` (closeSession.jsx) — dead code (tidak pernah dipanggil) — **FIXED** (2026-08-07)                                       | Modal "Pending Sync Warning" tidak pernah di-trigger dari flow End Session (hanya recursive). Dihapus + dependensi mati (`syncPendingSessions` import, `pendingCount`/`refreshQueueCount`, state `syncing`). Auto-sync jalan (offline→online). Build OK. |

---

## Ringkasan — Prioritas Fix

### Urutan rekomendasi

**Online path — SEMUA RESOLVED / BUKAN BUG (verified ke backend asli):**

1. ~~**O1**~~ — **RESOLVED** — `Auth.session.outlet.service_charges` tersedia; server hitung service charge sendiri (`request_create.go:57-61`)
2. ~~**O2**~~ — **RESOLVED** — outlet & user tersedia setelah getUser
3. ~~**O3**~~ — **SOLVED** — backend baca `unit_nett` (`request_item.go:16-18`)
4. ~~**O4**~~ — **SOLVED** — backend default `quantity=1` utk options/checkbox (`request_addon.go:54-60`)
5. ~~**O7**~~ — **SOLVED** — sama O3
6. ~~**O5**~~ — **INTENDED** — `payment_ref = card.reff_code` by design (payment member card)
7. ~~**O6**~~ — **FIXED** — re-run useEffect + guard (`cart/hook.js`)
8. ~~**O8**~~ — **SOLVED** — extra `category` object harmless (backend abaikan)

**Offline P0 (paling fatal):** 5. ~~**P0 #1**~~ — **NOT A BUG** — `localStorage.clear()` aman (IDB tidak kena; sync otomatis saat login ulang) 6. ~~**P0 #2**~~ — **NOT A BUG** — split payment update in-place (`updateOrderBill`), bukan double-charge. Risiko nyata ada di #8 (checkPartialPaid id mismatch) 7. ~~**P0 #3**~~ — **NOT A BUG** — `extractUniqueCategories` turunkan diskon dari `item.unit_discount` (sudah set di convert); diskon tidak hilang. Line 482-491 dead code saja 8. ~~**P0 #4**~~ — **ALREADY FIXED** (Rev-21 `7ff3f6b`) — `newTotalPaid`/`newCount` sudah diganti `newTotalNominal` 9. ~~**P0 #5**~~ — **NOT A BUG** — session hasSession selalu di-cache (`saveShifts` offline / `setCache` via `session()` online) → `showShifts` tidak null

**Offline P1-P3:** 10. ~~**P1 #6**~~ — **FIXED** — `setWaring` → `setWarning` (cart.jsx + checkout.jsx) 11. ~~**P1 #7**~~ — **FIXED** — konsisten `is_synced` di sessions (queue.js, usePendingQueueCount, cache, PendingDrawer) 12. ~~**P1 #8**~~ — **NOT A BUG** — `checkPartialPaid` match `CartState.bill.items` (server asli, punya id) dengan benar 13. ~~**P1 #9**~~ — **NOT A BUG** — fetch sudah di-guard `!isOffline && membership?.id` (history.jsx, update.jsx) 14. ~~**P1 #10**~~ — **NOT A BUG** — cache auto-refresh via `lastSyncTime` (semua halaman re-fetch server) 15. ~~**P1 #11**~~ — **NOT A BUG** — normalisasi balik `add.quantity/item.quantity` benar (backend simpan scaled). 16. ~~**P2 #12-14**~~ — **NOT A BUG** — cashier display (root), topup bonus (schema selalu terisi), shifts offline (orders via updateShifts). 17. ~~**P3 #15-21**~~ — #15 debug logs, #16 pendingCount, #17 dead code, #22 icon refresh, #23 showFailoverModal — semua **FIXED**. #18-21 biarkan/not-a-bug.

### Catatan

- **IDB vs localStorage**: fix P0 #1 tidak menghapus IDB, tapi cache fallback display hilang → pesan konfirmasi ke user sebelum clear.
- **Prioritas paling fatal data loss (offline)**: #2 (double charge), #3 (amount salah), #1 (wipe cache), #4 (crash topup), #5 (crash update bill).
- **`service_charges` = persen langsung** (mis. `5` = 5%), bukan fraksi. **Dokumen `offline-data-consistency.md:179` ("0.1 = 10%") outdated** — perlu dikoreksi.
- Semua fix sebaiknya di-verify manual di alur online & offline→online (ikuti `offline-e2e.md`).
