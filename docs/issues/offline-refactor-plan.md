# Offline Services Refactor Plan — Flat Storage, Cache Minimal

## Prinsip Utama

**IndexedDB = satu-satunya sumber data.** PendingDrawer & syncManager baca langsung dari IndexedDB.
**Redux cache = minimal.** Cuma counter + sessionSummary. Gak ada rehydrate `sessions[]`.

```
IndexedDB (flat stores)
  ├── sessions         ← syncManager, PendingDrawer (Tab Shifts)
  ├── order_bills      ← syncManager, PendingDrawer (Tab Bills)
  ├── order_payments   ← syncManager, PendingDrawer (Tab Order)
  ├── topups           ← syncManager, PendingDrawer (Tab Member)
  └── memberships      ← syncManager (via /membership/sync)

Redux Cache (minimal)
  ├── pendingCount     ← write/sync update incremental
  ├── sessionSummary   ← API (online) / computeOfflineSummary (offline)
  ├── offlineSessionEnded ← trigger print
  └── isOnline, apiReachable, isSyncing, lastSyncTime
```

---

## 1. IndexedDB (DB_VERSION 3 → 4)

### Hapus: `offlineSessions`

Data lama — **langsung dihapus** (acceptable karena dev phase).
Kalo mau safe, bisa console.log(dump) dulu di upgrade callback.

### New stores

**sessions:**
```js
{ sync_id, referenceId, open_at, close_at, cash_started, cash_finished,
  latitude, longitude, battery_health, syncStatus, error, createdAt }
```

**order_bills:**
```js
{ sync_id, origin_session_id, sales_channel_id, sales_channel_name,
  payment_method_id, membership_id, payment_ref, bill_name, cashier_name,
  service_charge_value, service_charge_percentage, discount_percentage,
  discount_value, category_discounts, items[], code, status: 'pending',
  total_payment: 0, paid_at: null, is_offline_mode: true, ref_sync_id: '',
  origin_session_sync_id, paid_session_sync_id: null, is_show: true,
  original_items[] }
```
Index: `origin_session_id`

**order_payments:**
```js
{ sync_id, origin_session_id, paid_session_id, sales_channel_id,
  sales_channel_name, payment_method_id, membership_id, payment_ref,
  bill_name, cashier_name, service_charge_value, service_charge_percentage,
  discount_percentage, discount_value, category_discounts, items[], code,
  status: 'completed', total_payment, paid_at, is_offline_mode: true,
  ref_sync_id: '', origin_session_sync_id, paid_session_sync_id, is_show: true,
  original_items[] }
```
Index: `origin_session_id`, `paid_session_id`

**topups:**
```js
{ sync_id, session_sync_id, membership_id, membership_sync_id, nominal,
  payment_type, card_id, member_name, member_code, created_at }
```
Index: `session_sync_id`

**memberships:**
```js
{ sync_id, card_id, name, reff_code }
```

**metadata** — unchanged.

---

## 2. PendingDrawer — Baca IndexedDB Langsung

| Tab | Store | Filter |
|---|---|---|
| **Order** | `order_payments` | status=completed |
| **Bills** | `order_bills` | status=pending, is_show=true |
| **Member** | `topups` + `memberships` | semua |
| **Shifts** | `sessions` | syncStatus≠synced |

Gak perlu `state.Offline.sessions`. Gak perlu rehydrate.

---

## 3. Function Mapping

### Hapus total

| Function | Alasan |
|---|---|
| `appendOrderToSession` | Blob → ganti `createOrderBill` / `createOrderPayment` |
| `removeOrderFromSession` | Blob |
| `updateOrderInSession` | Blob |
| `updateOrderBillName` | Blob |
| `appendTopupToSession` | Blob |
| `appendMembershipToSession` | Blob |
| `updateMembershipInSession` | Blob |
| `getActiveSession` | Gausah — baca dari cache aja |
| `getOrCreateOfflineSession` | Gausah — create langsung kalo perlu |
| `getActiveSessionId` | Redundant |
| `updateSyncResult` | Gausah — pas sync sukses hapus aja |
| `getAllSessions` | Gausah — query IndexedDB langsung |
| `getPendingSessions` | Gausah — syncManager query langsung |
| `getOfflinePendingCount` | Gausah — PendingDrawer hitung sendiri |
| `setSyncStatus` | Gausah — update field langsung via `db.put` |

### New functions (flat)

| Function | Store | Notes |
|---|---|---|
| `createOfflineSession(data, userId)` | sessions | CREATE |
| `closeSession(syncId, data, userId)` | sessions | UPDATE close_at, cash_finished, syncStatus |
| `deleteOfflineSession(syncId, userId)` | all | CASCADE — hapus session + orders + topups by FK |
| `createOrderBill(data, userId)` | order_bills | CREATE |
| `createOrderPayment(data, userId)` | order_payments | CREATE |
| `updateOrderBill(syncId, data, userId)` | order_bills | UPDATE |
| `updateOrderPayment(syncId, data, userId)` | order_payments | UPDATE |
| `deleteOrderBill(syncId, userId)` | order_bills | DELETE |
| `deleteOrderPayment(syncId, userId)` | order_payments | DELETE |
| `createTopup(data, userId)` | topups | CREATE |
| `createMembership(data, userId)` | memberships | CREATE |
| `updateMembership(cardId, data, userId)` | memberships | UPDATE |

---

## 4. Write Pattern — Update Cache Incremental

Tiap write → IndexedDB + update Redux cache incremental. Gak ada `getAllSessions()` re-read. Gak ada `setSessions()`.

### Open Session

```js
const doc = await createOfflineSession(data, userId);
dispatch(setSessions([...sessions, doc]));
dispatch(setPendingCount(pendingCount + 1));
```

### Create Order Bill (save bill offline) — cart.jsx

```js
const order = { sync_id: orderId, origin_session_id: originId, items, billName: ticket, status: 'pending', ... };
await createOrderBill(order, userId);

dispatch(setPendingCount(pendingCount + 1));
dispatch(setSessionSummary(computeOfflineSummary(updatedSession, sessionId, user)));

// Push ke localStorage bills cache
const BILLS_CACHE_KEY = 'cache_openbills';
const existing = getCache(BILLS_CACHE_KEY) || [];
setCache(BILLS_CACHE_KEY, [...existing, { ...order, is_offline_mode: true, offline_queued: true }]);
```

### Create Order Payment (pay offline) — checkout.jsx

```js
const payment = { sync_id: orderId, origin_session_id, paid_session_id, status: 'completed', ... };
await createOrderPayment(payment, userId);

dispatch(setPendingCount(pendingCount + 1));
dispatch(setSessionSummary(computeOfflineSummary(updatedSession, sessionId, user)));

// Push ke localStorage history cache
setCache(HISTORY_CACHE_KEY, [{ ...payment, is_offline_mode: true, offline_queued: true }, ...existing]);
```

### Update Order Bill (re-save offline)

```js
await updateOrderBill(orderId, { items, billName, ... }, userId);
dispatch(setSessionSummary(computeOfflineSummary(updatedSession, sessionId, user)));
```

### Create Topup — card.content.jsx

```js
await createTopup({ session_sync_id: id, nominal, ... }, userId);
dispatch(setPendingCount(pendingCount + 1));
dispatch(setSessionSummary(computeOfflineSummary(updatedSession, sessionId, user)));
```

### Create / Update Membership — create.jsx / update.jsx

```js
await createMembership({ card_id, name, ... }, userId);
dispatch(setPendingCount(pendingCount + 1));
```

### Close Session

```js
await closeSession(syncId, { cash_finished, ... }, userId);
dispatch(setSessionSummary(computeOfflineSummary(updatedSession, sessionId, user)));
dispatch(setOfflineSessionEnded(true));
```

---

## 5. computeOfflineSummary

Dari `session/hook.js:51-117` — computed dari session object dgn orders[]:

```js
{
  started_at, finished_at,
  cash_started, cash_finished,
  cashier: { name },
  summary: {
    sales: {
      total_sales,              // sum completedOrders.totalPayment
      total_discount,           // sum completedOrders.discountValue
      total_service,            // sum completedOrders.serviceChargeValue
      total_after_discount,
      grand_total,
      outstanding_bill,         // sum pendingOrders.totalPayment
      outstanding_bill_payment, // sum crossSessionOrders.totalPayment
    },
    cash: {
      expected_cash,            // cash_started + total_sales + topupCash
      topup_cash,
    },
    payment_methods: [{ payment_method_id, total_paid, count, name }],
    topups: [{ type, total_nominal }],
  },
  orders
}
```

Sama seperti implementasi existing — hanya di-refactor jadi query flat stores untuk dapetin updated session object.

---

## 6. Redux Cache — Minimal

| Field | Diisi dari |
|---|---|
| `pendingCount` | Increment/decrement pas write & sync |
| `failedCount` | Dari sync result |
| `sessionSummary` | API (online) / computeOfflineSummary (offline) |
| `offlineSessionEnded` | Flag trigger print |
| `isOnline`, `apiReachable` | Network listener |
| `isSyncing` | syncManager state |
| `lastSyncTime` | Sync result timestamp |
| `warning`, `error` | UI messages |

**Hapus dari Redux state:** `sessions[]`, `activeSyncId`.

**Rename di `state.Cart.bill`:**

| Lama | Baru |
|---|---|
| `from_offline_queue` | `is_offline_mode` |
| `queue_id` | `sync_id` |
| `originSyncId` | `origin_session_sync_id` |

### Clear sessionSummary

| Skenario | Action |
|---|---|
| Start session baru | `dispatch(clearSessionSummary())` |
| Close session (offline) | Set dulu buat print, lalu `dispatch(clearSessionSummary())` |
| Close session (online) | Setelah API sukses → `dispatch(clearSessionSummary())` |
| Logout | `dispatch(clearSessionSummary())` |
| App pertama buka (session expired) | `dispatch(clearSessionSummary())` |

### offlineSessionEnded — unchanged

Cuma trigger print di `closeSession.jsx:168-173`.

---

## 7. Bills & History — localStorage, Gak Merge IndexedDB

| Page | Online | Offline | Cache Key |
|---|---|---|---|
| **History** | GET /sales/order/history → cache | Baca cache | `cache_order_history` |
| **Bills** | GET /sales/order/openbill → cache | Baca cache | `cache_openbills` |

**`mergeOfflineBills()`** di `cart/hook.js` — **dihapus total**.

Pas checkout offline:
- Status pending (save bill) → push ke `cache_openbills` dgn `is_offline_mode: true, offline_queued: true`
- Status completed (payment) → push ke `cache_order_history` dgn `is_offline_mode: true, offline_queued: true`

Pas sync sukses → filter hapus dari cache by `offline_queued: true` atau `is_offline_mode: true`.

---

## 8. syncManager — Urutan: Memberships Dulu, Baru Sales

**Urutan:**
1. POST /membership/sync — dulu, biar server dapet member IDs
2. POST /sales/sync — baru, bawa orders + topups (grouped by session)

```js
syncPendingSessions():
  const db = await ensureDB(userId);

  // ===== 1. MEMBERSHIPS → POST /membership/sync =====
  const memberships = await db.getAll('memberships');
  for (const m of memberships) {
    const payload = {
      sync_id: m.sync_id || m.card_id,
      card_id: m.card_id,
      name: m.name || '',
      reff_code: m.reff_code || '',
    };

    const result = await baseQuery(
      { url: '/membership/sync', method: 'POST', body: payload, __skipOfflineQueue: true },
      fakeApi, {}
    );

    if (!result?.error) {
      await db.delete('memberships', m.sync_id);
    }
  }

  // ===== 2. SESSIONS / ORDERS / TOPUPS → POST /sales/sync =====
  const sessions = await db.getAll('sessions');
  const pendingSessions = sessions.filter(s => s.syncStatus === 'pending');

  for (const session of pendingSessions) {
    const bills = await db.getAllFromIndex('order_bills', 'origin_session_id', session.sync_id);
    const payments = await db.getAllFromIndex('order_payments', 'paid_session_id', session.sync_id);
    const topups = await db.getAllFromIndex('topups', 'session_sync_id', session.sync_id);

    // Compose payload
    const payload = {};
    const hasReference = !!session.referenceId;
    const isClosed = !!session.close_at;

    // Session — hanya dikirim kalo ada close_at (sesi selesai) atau start offline (tanpa referenceId)
    if (isClosed || !hasReference) {
      payload.session = {
        sync_id: session.sync_id,
        open_at: session.open_at,
        close_at: session.close_at,
        cash_started: session.cash_started,
        cash_finished: session.cash_finished,
        latitude: session.latitude,
        longitude: session.longitude,
        battery_health: session.battery_health,
      };
    }

    // Orders (order_bills + order_payments)
    payload.orders = [
      ...mapBillsToSync(bills, session),
      ...mapPaymentsToSync(payments, session),
    ];

    // Topups
    payload.topups = mapTopupsToSync(topups, session);

    // Kirim
    const result = await baseQuery(
      { url: '/sales/sync', method: 'POST', body: payload, __skipOfflineQueue: true },
      fakeApi, {}
    );

    // Sync sukses → HAPUS dari IndexedDB (server dedup by sync_id — gausah simpan serverId)
    if (!result?.error) {
      for (const bill of bills) await db.delete('order_bills', bill.sync_id);
      for (const pay of payments) await db.delete('order_payments', pay.sync_id);
      for (const topup of topups) await db.delete('topups', topup.sync_id);
      await db.delete('sessions', session.sync_id);

      // Hapus offline entries dari localStorage cache
      for (const key of ['cache_order_history', 'cache_openbills']) {
        const cached = JSON.parse(localStorage.getItem(key) || '[]');
        const cleaned = cached.filter(e => !e?.offline_queued && !e?.is_offline_mode);
        localStorage.setItem(key, JSON.stringify(cleaned));
      }
    }
  }
```

### Helper functions

```js
const mapBillsToSync = (bills, session) => bills.map(b => ({
  sync_id: b.sync_id,
  sales_channel_id: b.sales_channel_id,
  sales_channel_name: b.sales_channel_name || '',
  payment_method_id: b.payment_method_id || null,
  membership_id: b.membership_id || null,
  payment_ref: b.payment_ref || '',
  bill_name: b.bill_name || '',
  cashier_name: b.cashier_name || '',
  service_charge_value: b.service_charge_value || 0,
  service_charge_percentage: b.service_charge_percentage || 0,
  discount_percentage: b.discount_percentage || 0,
  discount_value: b.discount_value || 0,
  category_discounts: (b.category_discounts || []).map(cd => ({
    category_id: cd.category_id || cd.id,
    discount_percentage: cd.discount_percentage,
    discount_value: cd.discount_value,
  })),
  items: ((b.status === 'pending' && b.original_items?.length > 0)
    ? b.original_items : (b.items || [])).map(item => ({
    catalog_id: item.catalog_id,
    catalog_name: item.catalog_name || '',
    quantity: item.quantity || 0,
    unit_price: item.unit_price || 0,
    addons: (item.addons || []).map(a => ({
      addon_group_id: a.addon_group_id,
      addon_item_id: a.addon_item_id,
      catalog_name: a.catalog_name || '',
      unit_price: a.unit_price || 0,
      quantity: a.quantity || 1,
    })),
  })),
  code: b.code || '',
  status: b.status || 'pending',
  total_payment: b.total_payment || 0,
  paid_at: b.paid_at || null,
  is_offline_mode: true,
  ref_sync_id: b.ref_sync_id || '',
  session_sync_id: session.referenceId || session.sync_id,
  origin_session_sync_id: b.origin_session_sync_id || '',
  paid_session_sync_id: b.paid_session_sync_id || '',
  is_show: b.is_show !== false,
  original_items: (b.original_items || []).map(oi => ({
    catalog_id: oi.catalog_id,
    catalog_name: oi.catalog_name || '',
    quantity: oi.quantity || 0,
    unit_price: oi.unit_price || 0,
    ...(oi.addons?.length > 0 ? {
      addons: oi.addons.map(a => ({
        addon_group_id: a.addon_group_id,
        addon_item_id: a.addon_item_id,
        catalog_name: a.catalog_name || '',
        unit_price: a.unit_price || 0,
        quantity: a.quantity || 1,
      }))
    } : {}),
    ...(oi.is_custom ? { is_custom: true } : {}),
  })),
}));

const mapPaymentsToSync = (payments, session) => payments.map(p => ({
  sync_id: p.sync_id,
  // ... sama persis kayak mapBillsToSync, bedanya status='completed'
  status: p.status || 'completed',
  session_sync_id: session.referenceId || session.sync_id,
  origin_session_sync_id: p.origin_session_sync_id || '',
  paid_session_sync_id: p.paid_session_sync_id || '',
}));

const mapTopupsToSync = (topups, session) => topups.map(t => ({
  session_sync_id: session.referenceId || t.session_sync_id || session.sync_id,
  membership_id: t.membership_id,
  membership_sync_id: t.membership_sync_id || null,
  nominal: t.nominal || 0,
  payment_type: t.payment_type || 'cash',
  card_id: t.card_id || '',
  member_name: t.member_name || '',
  member_code: t.member_code || '',
  created_at: t.created_at,
}));
```

---

## 9. Files to Modify

| File | Change |
|---|---|
| `src/services/offline/queue.js` | 5 stores, CRUD, DB v4. Hapus blob functions |
| `src/services/offline/syncManager.js` | Query flat, compose payload, hapus rehydrate |
| `src/services/offline/index.js` | Update exports |
| `src/services/offline/slice.js` | Hapus sessions[], activeSyncId. Tambah clearSessionSummary |
| `src/services/offline/cache.js` | **New** — helpers cache incremental |
| `src/pages/authorize/home/cart.jsx` | createOrderBill + cache dispatch + push localStorage |
| `src/pages/authorize/home/checkout.jsx` | createOrderPayment + cache dispatch |
| `src/pages/authorize/home/closeSession.jsx` | sessionSummary dari cache |
| `src/pages/authorize/membership/card.content.jsx` | createTopup + cache dispatch |
| `src/pages/authorize/membership/change-card.jsx` | updateMembership + cache dispatch |
| `src/pages/authorize/membership/create-manual.jsx` | createMembership + cache dispatch |
| `src/pages/authorize/membership/create.jsx` | createMembership + cache dispatch |
| `src/pages/authorize/membership/update.jsx` | createMembership + updateMembership + cache dispatch |
| `src/services/sales/session/hook.js` | Hapus getActiveSession, activeSyncId, re-read |
| `src/services/auth/hook.js` | Adjust import |
| `src/services/cart/hook.js` | `mergeOfflineBills()` dihapus, `bill()` offline baca localStorage |
| `src/services/cart/slice.js` | Rename fields |
| `src/services/offline/localTransaction.js` | Rename queue_id→sync_id |
| `src/components/ui/layout.jsx` | Hapus setSessions, refreshQueue |
| `src/components/ui/offline/PendingDrawer.jsx` | Baca IndexedDB langsung (5 store) |

---

## 10. Verification

1. `yarn build`
2. Start offline → cek IndexedDB `sessions` store
3. Save bill → cek `order_bills` store + pendingCount naik + cache_openbills terisi
4. Pay bill → cek `order_payments` store + cache_order_history terisi
5. Topup → cek `topups` store
6. Membership → cek `memberships` store
7. Buka PendingDrawer → data dari IndexedDB langsung
8. Refresh browser → PendingDrawer masih isi (dari IndexedDB)
9. Bills page → data dari cache_openbills (gak merge IndexedDB)
10. History page → data dari cache_order_history
11. Close session → sessionSummary + print
12. Online → sync: /membership/sync dulu, baru /sales/sync → hapus IndexedDB + localStorage cache
