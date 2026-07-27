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

### `sessions`

```js
{
  sync_id,        // UUID kalo start offline
  referenceId,    // server ID kalo start online / setelah sync
  open_at,
  close_at,
  cash_started,
  cash_finished,
  latitude,
  longitude,
  battery_health,
  syncStatus,     // 'pending' | 'syncing' | 'synced' | 'failed'
  error,
  createdAt
}
```

### `order_bills`

```js
{
  sync_id,
  origin_session_id,        // FK: sessions.sync_id / referenceId
  sales_channel_id,
  sales_channel_name,
  payment_method_id,
  membership_id,
  payment_ref,
  bill_name,
  cashier_name,
  service_charge_value,
  service_charge_percentage,
  discount_percentage,
  discount_value,
  category_discounts,
  items,
  code,
  status: 'pending',
  total_payment: 0,
  paid_at: null,
  is_offline_mode: true,
  ref_sync_id: '',
  origin_session_sync_id,
  paid_session_sync_id: null,
  is_show: true,
  original_items,
}
```
Index: `origin_session_id`

### `order_payments`

```js
{
  sync_id,
  origin_session_id,        // FK: sessions — asal bill
  paid_session_id,          // FK: sessions — yg bayar
  sales_channel_id,
  sales_channel_name,
  payment_method_id,
  membership_id,
  payment_ref,
  bill_name,
  cashier_name,
  service_charge_value,
  service_charge_percentage,
  discount_percentage,
  discount_value,
  category_discounts,
  items,
  code,
  status: 'completed',
  total_payment,
  paid_at,
  is_offline_mode: true,
  ref_sync_id: '',
  origin_session_sync_id,
  paid_session_sync_id,
  is_show: true,
  original_items,
}
```
Index: `origin_session_id`, `paid_session_id`

### `topups`

```js
{
  sync_id,
  session_sync_id,      // FK: sessions
  membership_id,
  membership_sync_id,
  nominal,
  payment_type,
  card_id,
  member_name,
  member_code,
  created_at
}
```
Index: `session_sync_id`

### `memberships`

```js
{
  sync_id,
  card_id,
  name,
  reff_code
}
```

### `metadata` (unchanged)

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
| `appendOrderToSession(syncId, order, userId)` | Blob — ganti `createOrderBill` / `createOrderPayment` |
| `removeOrderFromSession(syncId, oSyncId, userId)` | Blob |
| `updateOrderInSession(syncId, oSyncId, data, userId)` | Blob |
| `updateOrderBillName(syncId, oSyncId, name, userId)` | Blob |
| `appendTopupToSession(syncId, topup, userId)` | Blob |
| `appendMembershipToSession(syncId, membership, userId)` | Blob |
| `updateMembershipInSession(syncId, cardId, data, userId)` | Blob |
| `getActiveSession(userId)` | Gausah — cache aja |
| `getOrCreateOfflineSession(authSession, userId)` | Gausah — create aja kalo perlu |
| `getActiveSessionId(authSession, userId)` | Gausah — redundant |
| `updateSyncResult(syncId, result, userId)` | Gausah — pas sync sukses hapus aja |

### New functions (flat)

| Function | Store | Notes |
|---|---|---|
| `createOfflineSession(data, userId)` | `sessions` | CREATE — generate uuid + struktur |
| `closeSession(syncId, { cash_finished, ... }, userId)` | `sessions` | UPDATE close_at, cash_finished, syncStatus |
| `deleteOfflineSession(syncId, userId)` | all | CASCADE hapus session + semua related entities |
| `createOrderBill(data, userId)` | `order_bills` | CREATE |
| `createOrderPayment(data, userId)` | `order_payments` | CREATE |
| `updateOrderBill(syncId, data, userId)` | `order_bills` | UPDATE |
| `updateOrderPayment(syncId, data, userId)` | `order_payments` | UPDATE |
| `deleteOrderBill(syncId, userId)` | `order_bills` | DELETE |
| `deleteOrderPayment(syncId, userId)` | `order_payments` | DELETE |
| `createTopup(data, userId)` | `topups` | CREATE |
| `createMembership(data, userId)` | `memberships` | CREATE |
| `updateMembership(cardId, data, userId)` | `memberships` | UPDATE |

---

## 4. Write Pattern

Tiap write → **IndexedDB + update Redux cache incremental**. Gak ada `getAllSessions()` re-read. Gak ada `setSessions()`.

### Open Session

```js
const doc = await createOfflineSession(data, userId);
dispatch(setPendingCount(pendingCount + 1));
```

### Create Order Bill (save bill) — cart.jsx

```js
const order = { sync_id: orderId, origin_session_id, items, billName, ... };
await createOrderBill(order, userId);

dispatch(setPendingCount(pendingCount + 1));

// 🔁 Recalculate sessionSummary
const session = { /* updated session dari locals, bukan re-read */ };
dispatch(setSessionSummary(computeOfflineSummary(session, sessionId, user)));
```

### Create Order Payment (pay) — checkout.jsx

```js
const payment = { sync_id: orderId, origin_session_id, paid_session_id, ... };
await createOrderPayment(payment, userId);

dispatch(setPendingCount(pendingCount + 1));
dispatch(setSessionSummary(computeOfflineSummary(updatedSession, sessionId, user)));
```

### Update Order Bill (re-save) — checkout.jsx

```js
await updateOrderBill(orderId, { items, billName, ... }, userId);

// 🔁 Recalculate sessionSummary dari updated data
dispatch(setSessionSummary(computeOfflineSummary(updatedSession, sessionId, user)));
```

### Create Topup — card.content.jsx

```js
await createTopup({ session_sync_id, nominal, ... }, userId);
dispatch(setPendingCount(pendingCount + 1));
dispatch(setSessionSummary(computeOfflineSummary(updatedSession, sessionId, user)));
```

### Create Membership — create.jsx

```js
await createMembership({ card_id, name, ... }, userId);
dispatch(setPendingCount(pendingCount + 1));
// Membership gak affect sessionSummary
```

### Close Session

```js
await closeSession(syncId, { cash_finished, ... }, userId);
dispatch(setSessionSummary(computeOfflineSummary(updatedSession, sessionId, user)));
dispatch(setOfflineSessionEnded(true));
```

---

## 5. Redux Cache — Minimal

### Hapus dari `state.Offline`

- `sessions[]` — gak perlu, PendingDrawer baca IndexedDB langsung
- `activeSyncId` — redundant, detect dari `sessions.find(s => !s.close_at)`

### Rename di `state.Cart.bill`

| Lama | Baru | File |
|---|---|---|
| `from_offline_queue` | `is_offline_mode` | cart/slice.js, cart.jsx, checkout.jsx, cart/hook.js |
| `queue_id` | `sync_id` | sama + localTransaction.js |
| `originSyncId` | `origin_session_sync_id` | sama |

### sessionSummary — Dua Sumber

| Kondisi | Sumber |
|---|---|
| Online | `GET /sales/session/summary` → `res.data` |
| Offline | `computeOfflineSummary(session, sessionId, user)` |

Clear sessionSummary: start baru, close session, logout, session expired.

### offlineSessionEnded

Gak diubah. Cuma trigger print di closeSession.

```js
// closeSession.jsx
useEffect(() => {
  if (offlineEnded && sessionSummary) {
    handleOpenPrintSummary(sessionSummary);
    dispatch(clearOfflineSessionEnded());
  }
}, [offlineEnded, sessionSummary]);
```

---

## 5. Bills & History Page — Sama-sama dari localStorage

**Konsep:** Sama kayak history, bills juga baca offline dari `localStorage`. Gak ada merge dari IndexedDB.

### Flow

| Page | Online | Offline | Cache Key |
|---|---|---|---|
| **History** | `GET /sales/order/history` → simpan `cache_order_history` | Baca `cache_order_history` | `cache_order_history` |
| **Bills** | `GET /sales/order/openbill` → simpan `cache_openbills` | Baca `cache_openbills` | `cache_openbills` |

### Hapus `mergeOfflineBills()`

`cart/hook.js:mergeOfflineBills()` — **dihapus**. Bills page gausah merge data IndexedDB.

```js
// ✅ BARU — cart/hook.js bill()
const BILLS_CACHE_KEY = 'cache_openbills';

const bill = async (search = '') => {
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  const apiDead = apiReachable === false;

  if (!isOffline && !apiDead) {
    const res = await triggerBill(search ? { search } : {}).unwrap();
    setCache(BILLS_CACHE_KEY, res?.data || []);
    setMergedBillData(res?.data || []);
    return;
  }

  const cached = getCache(BILLS_CACHE_KEY) || [];
  setMergedBillData(cached);
};
```

### Push dari checkout

Udah jalan untuk history (`cache_order_history`) di `checkout.jsx:379-417`. Tinggal nambahin push `cache_openbills` pas save bill offline di `cart.jsx`:

---

## 6. syncManager — Compose Payload + Hapus pas Sync Sukses

**Urutan:**
1. **POST /membership/sync** — dulu, biar server dapet member IDs
2. **POST /sales/sync** — baru, bawa orders + topups dgn membership_sync_id yg valid

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
      fakeApi,
      {}
    );

    if (!result?.error) {
      await db.delete('memberships', m.sync_id);
    }
  }

  // ===== 2. SESSIONS → POST /sales/sync =====
  const sessions = await db.getAll('sessions');
  const pendingSessions = sessions.filter(s => s.syncStatus === 'pending');

  for (const session of pendingSessions) {

  const sessions = await db.getAll('sessions');
  const pendingSessions = sessions.filter(s => s.syncStatus === 'pending');

  for (const session of pendingSessions) {
    const bills = await db.getAllFromIndex('order_bills', 'origin_session_id', session.sync_id);
    const payments = await db.getAllFromIndex('order_payments', 'paid_session_id', session.sync_id);
    const topups = await db.getAllFromIndex('topups', 'session_sync_id', session.sync_id);

    // ===== COMPOSE PAYLOAD /sales/sync =====
    const payload = {
      session: {
        sync_id: session.sync_id,
        id: session.referenceId || '',
        open_at: session.open_at,
        close_at: session.close_at,
        cash_started: session.cash_started,
        cash_finished: session.cash_finished,
        latitude: session.latitude,
        longitude: session.longitude,
        battery_health: session.battery_health,
      },
      session: null, // session hanya dikirim kalo punya close_at atau start offline
      // session dikirim kalo: !!session.close_at || !session.referenceId

      orders: [
        // order_bills (pending / save bill)
        ...bills.map(b => ({
          sync_id: b.sync_id || '',
          id: b.serverId || '',
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
        })),

        // order_payments (completed / paid)
        ...payments.map(p => ({
          sync_id: p.sync_id || '',
          id: p.serverId || '',
          sales_channel_id: p.sales_channel_id,
          sales_channel_name: p.sales_channel_name || '',
          payment_method_id: p.payment_method_id || null,
          membership_id: p.membership_id || null,
          payment_ref: p.payment_ref || '',
          bill_name: p.bill_name || '',
          cashier_name: p.cashier_name || '',
          service_charge_value: p.service_charge_value || 0,
          service_charge_percentage: p.service_charge_percentage || 0,
          discount_percentage: p.discount_percentage || 0,
          discount_value: p.discount_value || 0,
          category_discounts: (p.category_discounts || []).map(cd => ({
            category_id: cd.category_id || cd.id,
            discount_percentage: cd.discount_percentage,
            discount_value: cd.discount_value,
          })),
          items: (p.items || []).map(item => ({
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
          code: p.code || '',
          status: p.status || 'completed',
          total_payment: p.total_payment || 0,
          paid_at: p.paid_at || null,
          is_offline_mode: true,
          ref_sync_id: p.ref_sync_id || '',
          session_sync_id: session.referenceId || session.sync_id,
          origin_session_sync_id: p.origin_session_sync_id || '',
          paid_session_sync_id: p.paid_session_sync_id || '',
          is_show: p.is_show !== false,
          original_items: (p.original_items || []).map(oi => ({
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
        })),
      ],
      memberships: [], // → pindah ke /membership/sync
      topups: topups.map(t => ({
        session_sync_id: session.referenceId || t.session_sync_id || session.sync_id,
        membership_id: t.membership_id,
        membership_sync_id: t.membership_sync_id || null,
        nominal: t.nominal || 0,
        payment_type: t.payment_type || 'cash',
        card_id: t.card_id || '',
        member_name: t.member_name || '',
        member_code: t.member_code || '',
        created_at: t.created_at,
      })),
    };

    // Kirim session hanya kalo ada close_at (sesi selesai) atau start offline (tanpa referenceId)
    const hasReference = !!session.referenceId;
    const isClosed = !!session.close_at;
    if (!isClosed && hasReference) {
      payload.session = null;
    }

    // ===== POST /sales/sync =====
    const result = await baseQuery(
      { url: '/sales/sync', method: 'POST', body: payload, __skipOfflineQueue: true },
      fakeApi,
      {}
    );

    if (!result?.error) {
      // ===== SYNC SUKSES — HAPUS DARI INDEXEDDB =====
      for (const bill of bills) await db.delete('order_bills', bill.sync_id);
      for (const pay of payments) await db.delete('order_payments', pay.sync_id);
      for (const topup of topups) await db.delete('topups', topup.sync_id);
      await db.delete('sessions', session.sync_id);

      // ✅ Hapus offline entries dari localStorage cache
      const history = JSON.parse(localStorage.getItem(HISTORY_CACHE_KEY) || '[]');
      localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(history.filter(e => !e?.offline_queued)));

      const openBills = JSON.parse(localStorage.getItem(BILLS_CACHE_KEY) || '[]');
      localStorage.setItem(BILLS_CACHE_KEY, JSON.stringify(openBills.filter(b => !b?.offline_queued)));
    }
  }

  // ===== MEMBERSHIPS → POST /membership/sync =====
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
      fakeApi,
      {}
    );

    if (!result?.error) {
      await db.delete('memberships', m.sync_id);
    }
  }
```

---

## 7. Files to Modify

| File | Change |
|---|---|
| `src/services/offline/queue.js` | Restructure 5 stores, CRUD, DB v4 |
| `src/services/offline/syncManager.js` | Query flat stores, compose payload |
| `src/services/offline/index.js` | Update exports |
| `src/services/offline/slice.js` | Hapus sessions, activeSyncId. Tambah clearSessionSummary |
| `src/services/offline/cache.js` | **New** — helpers cache incremental |
| `src/pages/authorize/home/cart.jsx` | createOrderBill + cache dispatch |
| `src/pages/authorize/home/checkout.jsx` | createOrderPayment + cache dispatch |
| `src/pages/authorize/home/closeSession.jsx` | sessionSummary dari cache |
| `src/pages/authorize/membership/card.content.jsx` | createTopup + cache dispatch |
| `src/pages/authorize/membership/change-card.jsx` | updateMembership + cache dispatch |
| `src/pages/authorize/membership/create-manual.jsx` | createMembership + cache dispatch |
| `src/pages/authorize/membership/create.jsx` | createMembership + cache dispatch |
| `src/pages/authorize/membership/update.jsx` | createMembership + updateMembership + cache dispatch |
| `src/services/sales/session/hook.js` | Hapus getActiveSession, activeSyncId, getAllSessions re-read |
| `src/services/auth/hook.js` | Adjust import |
| `src/services/cart/hook.js` | `mergeOfflineBills()` dihapus. `bill()` pattern sama kayak `history()` — online API, offline localStorage |
| `src/services/cart/slice.js` | Rename fields |
| `src/services/offline/localTransaction.js` | Rename queue_id→sync_id |
| `src/components/ui/layout.jsx` | Hapus setSessions, refreshQueue dari IndexedDB |
| `src/components/ui/offline/PendingDrawer.jsx` | **Baca IndexedDB langsung** — 5 store query |

---

## 8. Verification

1. `yarn build`
2. Start offline → cek IndexedDB `sessions` store
3. Save bill → cek `order_bills` store + pendingCount naik
4. Pay bill → cek `order_payments` store
5. Topup → cek `topups` store
6. Membership → cek `memberships` store
7. Buka PendingDrawer → data dari IndexedDB langsung
8. Refresh browser → PendingDrawer masih isi (dari IndexedDB)
9. Close session → sessionSummary + print
10. Online → syncManager compose payload
