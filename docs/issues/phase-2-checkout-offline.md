# Phase 2: Checkout — Save Bill + Payment Offline

## Goal

Order management di dalam session blob. Checkout payment dan save bill berfungsi penuh saat offline. History cache injection jalan. PendingDrawer baca dari sessions[].

## Clarifications (2026-07-25)

### 1. UseEffect Skip — Detail Retain vs Skip

Ada 2 tempat efek jalan:

**A. Inline di `handlePay` / `handleSaveBill` — JALAN semua:**
- `appendOrderToSession()` → append ke session blob
- Inject history cache (`setCache(HISTORY_CACHE_KEY, ...)`)
- `dispatch(setWarning(...))` → toast notification
- `openModal(<SuccessModal ...>)` → sukses modal
- `dispatch(resetCart())` + `setSelectedMethod(paymentMethod[0])`
- `dispatch(refreshOfflineSessions())` + `updatePendingCount()`

Semua efek ini jalan **langsung di handlePay**, sebelum `return`.

**B. `useEffect` yang nge-trigger pas `checkoutResult.isSuccess` — SKIP otomatis:**
Alasan: offline path `return` duluan di handlePay, gak pernah manggil mutation API (`checkout()` / `closeBill()`). Jadi `checkoutResult.isSuccess` gak pernah jadi `true`. Tapi boleh tambah guard `if (data?.offline_queued) return` buat jaga.

Efek yg di-skip:
- `show(id)` — fetch bill detail dari API (gak relevan, data lokal)
- `updateQueueItem` legacy — dihapus
- `checkout()` / `closeBill()` mutation API
- Set `selectedMethod` (udah di inline)

**Pattern:**
```
handlePay:
  if (isOffline):
    # A. Semua efek inline jalan
    return  # ⛔️ balik — gak trigger useEffect
  else:
    # Online: mutation API → checkoutResult → useEffect normal
```

### 2. Split Bill Offline

Split bill → 2 entries di session.orders[] dengan linking key `refSyncId`:

- **Order 1 / Master** → items **sisa** (yg TIDAK dibayar), `status: "pending"` → muncul di open bills + PendingDrawer tab Bills
- **Order 2 / Child** → items yg **dibayar sekarang**, `status: "completed"` → history cache + PendingDrawer tab Orders

```js
const refId = uuidv4(); // linking key — sama di kedua entry

// Order 1 — sisa items
const orderMaster = {
  sync_id: uuidv4(),
  sessionSyncId: activeSyncId,
  billName,
  items: [...sisaItemsDiCart],  // sisanya setelah split
  status: "pending",
  refSyncId: refId,
  totalPayment: sisaTagihan,
  isOfflineMode: true,
  // ...
};

// Order 2 — dibayar skrg
const orderPaid = {
  sync_id: uuidv4(),
  sessionSyncId: activeSyncId,
  billName,
  items: [...itemsDibayar],
  status: "completed",
  refSyncId: refId,
  totalPayment: ygDibayar,
  paidAt: new Date().toISOString(),
  isOfflineMode: true,
  // ...
};

// Urutan: master dulu, child setelahnya
await appendOrderToSession(activeSyncId, orderMaster, userId);
await appendOrderToSession(activeSyncId, orderPaid, userId);

// History cache — cuma orderPaid (completed)
const history = await getCache(HISTORY_CACHE_KEY) || [];
await setCache(HISTORY_CACHE_KEY, [historyEntryOrderPaid, ...history]);
```

Dampak:
- **PendingDrawer**: master → tab Bills (`status: pending`), paid → tab Orders (`status: completed`)
- **mergeOfflineBills**: cuma `status === 'pending' && billName` → master doang muncul di open bills
- **History cache**: orderPaid doang yg di-inject
- **Sync**: backend detect `refSyncId` → tau ini pasangan split

---

## Files Changed (Phase 2)

| # | File | Change |
|---|------|--------|
| 1 | `src/services/offline/queue.js` | Hapus backward compat `getQueue`, `updateQueueItem`, dll. Tambah `appendOrderToSession()` |
| 2 | `src/services/cart/hook.js` | `bill()` baca dari sessions. `mergeOfflineBills()` dari `getAllSessions()`. `onBillSelected()` dari session blob |
| 3 | `src/pages/authorize/home/checkout.jsx` | Offline handlePay/handleSaveBill: append ke session blob langsung, inject history cache |
| 4 | `src/components/ui/offline/PendingDrawer.jsx` | Baca dari `state.Offline.sessions[]`, flatten orders per tab |
| 5 | `src/services/offline/slice.js` | Hapus `items[]` + `setQueueItems` backward compat (PendingDrawer ganti ke sessions) |
| 6 | `src/services/sales/order/hook.js` | History cache: hapus `removeFromQueue` reference (no-op anyway) |
| 7 | `src/pages/authorize/bills/index.jsx` | Already menggunakan `billData` — hanya perlu pastikan data dari session blob |
| 8 | `src/pages/authorize/home/saveBill.jsx` | Already menggunakan `billData` — no change needed |

---

## 1. `src/services/offline/queue.js` — Hapus Backward Compat + Tambah appendOrderToSession

### Hapus

```js
getQueue()            // ❌ — return [] di Phase 1
getQueueByStatus()    // ❌
getQueueItem()        // ❌
updateQueueItem()     // ❌
addToQueue()          // ❌
removeFromQueue()     // ❌
clearQueue()          // ❌
```

### Tambah

```js
/**
 * Append order ke session.orders[].
 * order shape:
 * {
 *   sync_id: "uuid",
 *   sessionSyncId: "sync_id",
 *   salesChannelId: "...",
 *   paymentMethodId: 0,
 *   membershipId: null,
 *   paymentRef: "",
 *   billName: "",
 *   discountPercentage: 0,
 *   discountValue: 0,
 *   categoryDiscounts: [],
 *   items: [{ catalog_id, catalog_name, quantity, unit_price, addons }],
 *   status: "pending" | "completed",
 *   totalPayment: 0,
 *   paidAt: "ISO",
 *   isOfflineMode: true,
 *   refSyncId: ""
 * }
 */
export const appendOrderToSession = async (syncId, order, userId) => {
  const db = await ensureDB(userId);
  const existing = await db.get(STORES.offlineSessions, syncId);
  if (!existing) throw new Error(`Session not found: ${syncId}`);

  // Ensure orders is array
  if (!Array.isArray(existing.orders)) {
    existing.orders = [];
  }

  existing.orders.push(order);

  await db.put(STORES.offlineSessions, existing);
  return existing;
};
```

---

## 2. `src/services/cart/hook.js` — bill() Dari Session Blob

### mergeOfflineBills — Source Berubah

**Sebelum:**
```js
queueItems = await getQueue(userId);  // return [] di Phase 1
```

**Sesudah:**
```js
import { getAllSessions } from '../offline/queue';

const mergeOfflineBills = async (serverData) => {
  if (!userId) return serverData;

  let sessions = [];
  try {
    sessions = await getAllSessions(userId);
  } catch {
    return serverData;
  }

  // Flatten semua orders dari semua session, filter pending + punya bill_name
  const offlineOrders = sessions
    .flatMap(s => (s.orders || []).map(o => ({ ...o, _sessionSyncId: s.sync_id })))
    .filter(o => o.status === 'pending' && o.billName);

  if (offlineOrders.length === 0) return serverData;

  // Collect server tickets for dedup
  const serverTickets = new Set(
    serverData.map(b => b?.ticket || b?.bill_name).filter(Boolean)
  );

  // Transform session orders → API response shape
  const transformed = offlineOrders
    .filter(order => {
      const ticket = order.billName;
      return ticket && !serverTickets.has(ticket);
    })
    .map(order => ({
      id: order.sync_id,
      bill_name: order.billName || '',
      ticket: order.billName || '',
      total_charges: order.totalPayment || 0,
      code: `OFF-${order.sync_id?.slice(0, 8)}`,
      ordered_at: order.paidAt || order.createdAt,
      created_at: order.paidAt || order.createdAt,
      items: order.items || [],
      membership: order.membershipId ? { id: order.membershipId } : null,
      session: null,
      discount_value: order.discountValue || 0,
      service_charge_value: 0,
      total_payment: order.totalPayment || 0,
      payment_method: order.paymentMethodId ? { id: order.paymentMethodId } : null,
      payment_ref: order.paymentRef || '',
      subtotal_nett: order.totalPayment || 0,
      subtotal_gross: order.totalPayment || 0,
      note: '',
      from_queue: true,
      queue_id: order.sync_id,          // keep field name for compatibility
      offline_queued: true,
    }));

  return [...serverData, ...transformed];
};
```

### onBillSelected — Offline Bill dari Session

**Sebelum:** `getQueue(userId)` untuk cari item

**Sesudah:** `getAllSessions(userId)` → cari order by sync_id

```js
const onBillSelected = async data => {
  if (isBillSelected.current) return;
  isBillSelected.current = true;

  try {
    // Queue item → use local data, no server fetch
    if (data?.from_queue) {
      const orderId = data?.queue_id || data?.id;
      let orderItem = null;
      if (orderId) {
        try {
          const sessions = await getAllSessions(userId);
          for (const s of sessions) {
            const found = (s.orders || []).find(o => o.sync_id === orderId);
            if (found) {
              orderItem = { ...found, _sessionData: s };
              break;
            }
          }
        } catch {}
      }

      if (orderItem) {
        dispatch(loadOfflineBill(orderItem));
      }
      return;
    }

    const res = await showOrder({ id: data?.id }).unwrap();
    if (res?.message === 'success') {
      billItems({ items: res?.data?.items, category_discounts: res?.data?.category_discounts });
      dispatch(selectedBill(res?.data));
      showSetDiscount(res?.data);
    }
  } catch (error) {
    dispatch($failure(error));
  } finally {
    isBillSelected.current = false;
  }
};
```

---

## 3. `src/pages/authorize/home/checkout.jsx` — Offline Flow

### handlePay — Deteksi Offline, Append ke Session Blob

```
handlePay(card):
  ├─ Build payload items, discount, payment info (SAMA seperti skrg)
  │
  ├─ isOffline?
  │    └─ YA:
  │       ├─ Baca activeSyncId dari Redux (state.Offline.activeSyncId || state.SalesSession.activeSyncId)
  │       ├─ Kalo ga ada → dispatch(setWarning('No active session')) → return
  │       ├─ Build order shape untuk session blob:
  │       │   {
  │       │     sync_id: uuidv4(),
  │       │     sessionSyncId: activeSyncId,
  │       │     salesChannelId: Channel.selectedChannel.id,
  │       │     paymentMethodId: selectedMethod.id,
  │       │     membershipId: payload.membership_id || null,
  │       │     paymentRef: paymentRef,
  │       │     billName: billName,
  │       │     discountPercentage: payload.discount_percentage || 0,
  │       │     discountValue: payload.discount_value || 0,
  │       │     categoryDiscounts: payload.category_discounts || [],
  │       │     items: allItems mapped (termasuk catalog_name, unit_price dari cart state),
  │       │     status: "completed",
  │       │     totalPayment: payload.total_payment,
  │       │     paidAt: new Date().toISOString(),
  │       │     isOfflineMode: true,
  │       │     refSyncId: "",
  │       │   }
  │       ├─ appendOrderToSession(activeSyncId, order, userId)
  │       ├─ Inject ke history cache:
  │       │   HISTORY_CACHE_KEY = 'cache_order_history'
  │       │   historyEntry = {
  │       │     id: order.sync_id,
  │       │     code: `OFF-${order.sync_id.slice(0, 8)}`,
  │       │     total_charges: order.totalPayment,
  │       │     bill_name: order.billName,
  │       │     created_at: order.paidAt,
  │       │     status: 'completed',
  │       │     payment_method: { id: selectedMethod.id, name: selectedMethod.name },
  │       │     total_payment: order.totalPayment,
  │       │     payment_ref: paymentRef,
  │       │     items: order.items,
  │       │     membership: null,
  │       │     discount_value: order.discountValue,
  │       │     service_charge_value: CartState?.meta?.service_charge_value || 0,
  │       │     subtotal_nett: order.totalPayment,
  │       │     from_queue: true,
  │       │     offline_queued: true,
  │       │     offline_meta: { order_sync_id: order.sync_id },
  │       │   }
  │       │   setCache(HISTORY_CACHE_KEY, [historyEntry, ...existing])
  │       ├─ Update Redux:
  │       │   refresh offlineSessions + pendingCount
  │       │   dispatch(setWarning('Payment saved offline. It will sync when online.'))
  │       ├─ Show success modal:
  │       │   openModal(<SuccessModal data={order} backToMenu />)
  │       └─ Reset cart
  │
  └─ TIDAK (online):
       ├─ Panggil checkout() atau closeBill() seperti biasa
       └─ Efek2 yg ada (checkoutResult.isSuccess) tetap jalan
```

### handleSaveBill — Deteksi Offline, Append Pending ke Session Blob

```
handleSaveBill(ticket):
  ├─ Build payload (SAMA seperti skrg)
  │
  ├─ isOffline?
  │    └─ YA:
  │       ├─ Baca activeSyncId dari Redux
  │       ├─ Build order shape dengan status "pending"
  │       ├─ appendOrderToSession(activeSyncId, order, userId)
  │       ├─ Refresh Redux offline sessions
  │       └─ dispatch(setWarning('Bill saved offline.'))
  │
  └─ TIDAK (online):
       └─ Panggil checkout() seperti biasa
```

### Efek checkoutResult / closeBillResult — Skip untuk Offline

Di useEffect yg handle checkoutResult/closeBillResult:

```js
React.useEffect(() => {
  const checkoutData = checkoutResult?.data?.data || {};
  const closeBillData = closeBillResult?.data?.data || {};
  const isQueued = Boolean(checkoutData?.offline_queued || closeBillData?.offline_queued);

  if (checkoutResult?.isSuccess || closeBillResult?.isSuccess) {
    // Skip efek2 lama untuk offline (updateQueueItem, dll)
    // Semua offline flow udah di handle di handlePay langsung
    if (isQueued) return;   // <-- skip, karena offline flow direct

    setSelectedMethod(paymentMethod[0]);
    const id = checkoutData?.id || closeBillData?.id;
    if (id) show(id);
  }
}, [checkoutResult?.isSuccess, closeBillResult?.isSuccess]);
```

### Import Berubah

```js
// HAPUS:
import { buildOfflineTransactionPayload, updateQueueItem, setWarning, setQueueItems, getQueue } from '../../../services/offline';

// TAMBAH:
import { appendOrderToSession } from '../../../services/offline/queue';
import { setOfflineSessionEnded } from '../../../services/offline/slice';
```

---

## 4. `src/components/ui/offline/PendingDrawer.jsx` — Baca dari sessions[]

### Sebelum

```js
const items = useSelector(state => state?.Offline?.items || []);
```

### Sesudah

```js
const sessions = useSelector(state => state?.Offline?.sessions || []);

// Flatten semua orders dari sessions, tambah metadata session
const items = React.useMemo(() => {
  return sessions.flatMap(s => {
    const sessionOrders = (s.orders || []).map(o => ({
      ...o,
      _sessionSyncId: s.sync_id,
      _sessionStatus: s.syncStatus,
      _sessionError: s.error,
      _sessionCreatedAt: s.createdAt,
    }));

    const sessionTopups = (s.topups || []).map(t => ({
      ...t,
      _sessionSyncId: s.sync_id,
      _sessionStatus: s.syncStatus,
      _type: 'topup',
    }));

    // Session info for Shifts tab
    const sessionInfo = {
      id: s.sync_id,
      _type: 'session',
      _sessionSyncId: s.sync_id,
      _sessionStatus: s.syncStatus,
      status: s.syncStatus,
      body: {
        cash: s.session.cash_started,
        cash_finished: s.session.cash_finished,
      },
      transaction_preview: {
        code: `SESS-${s.sync_id?.slice(0, 8)}`,
        created_at: s.session.open_at,
        cashier: { name: '' },
        session: s.session,
      },
    };

    return [...sessionOrders, ...sessionTopups, sessionInfo];
  });
}, [sessions]);
```

### getApiCategory — Update untuk Data Baru

```js
const getApiCategory = (item) => {
  if (item._type === 'topup') return 'topup';
  if (item._type === 'session') return 'shifts';
  if (item.status === 'pending') return 'bills';
  if (item.status === 'completed') return 'order';
  return 'other';
};
```

### getApiType

```js
const getApiType = (item) => {
  if (item._type === 'topup') return 'topup';
  if (item._type === 'session') return item.body?.cash_finished ? 'close session' : 'start session';
  if (item.status === 'pending') return 'save bill';
  if (item.status === 'completed') return 'checkout';
  return 'order';
};
```

### Transaction Preview — Baca Langsung dari Order

Untuk tab orders/bills:

```js
const preview = {
  id: item.sync_id,
  code: `OFF-${item.sync_id?.slice(0, 8)}`,
  bill_name: item.billName || '',
  channel: { name: '-' },
  payment_method: { id: item.paymentMethodId, name: item.paymentMethodId === 0 ? 'Cash' : '-' },
  total_charges: item.totalPayment || 0,
  total_bill: item.totalPayment || 0,
  item_count: item.items?.length || 0,
  created_at: item.paidAt || item._sessionCreatedAt,
  items: item.items || [],
  cashier: { name: '-' },
};
```

### Retry/Remove — Per-Session

```js
const onRetry = async (itemId) => {
  // Cari session yg punya order ini
  const session = sessions.find(s => s.sync_id === itemId || (s.orders || []).some(o => o.sync_id === itemId));
  if (session) {
    // Retry seluruh session
    await import('../../../services/offline/syncManager').then(m => m.syncPendingSessions());
  }
};

const onRemove = async (itemId) => {
  // Hapus order dari session, atau hapus seluruh session
  // Tergantung UX desire — simplest: delete entire session
};
```

---

## 5. `src/services/offline/slice.js` — Hapus `items[]` Backward Compat

```js
// HAPUS dari initialState:
items: [],             // ❌ — no longer needed

// HAPUS:
setQueueItems: () => { /* backward compat — no-op */ }
```

### PendingDrawer Updated import path

PendingDrawer sekarang import `sessions` bukan `items`:

```js
const sessions = useSelector(state => state?.Offline?.sessions || []);
const failedCount = sessions.filter(s => s.syncStatus === 'failed').length;
const pendingCount = sessions.filter(s => s.syncStatus === 'pending').length;
```

---

## 6. `src/services/sales/order/hook.js` — Minor

`removeFromQueue()` sudah no-op. Hapus aja import/reference kalo ada.

Tidak ada perubahan signifikan — history cache tetap pake `cache_order_history` dengan entry dari checkout.jsx.

---

## 7. Files No Change

| File | Alasan |
|------|--------|
| `src/pages/authorize/bills/index.jsx` | Udah pake `billData` dari useCart, tinggal nunggu hook diubah |
| `src/pages/authorize/home/saveBill.jsx` | Udah pake `billData` |
| `src/services/cart/slice.js` | `loadOfflineBill` perlu update? Mungkin minor — tunggu test. |

---

## Verification Phase 2

1. **Checkout offline** → order append ke session.orders[], history cache ✅
2. **Save bill offline** → order status "pending" di session.orders[] ✅
3. **Open bills offline** → merge server + offline pending dari sessions ✅
4. **Select offline bill** → load dari session blob ✅
5. **Split bill offline** → 2 orders, ref_sync_id pasangan ✅
6. **PendingDrawer** → flatten orders from sessions[], 4 tabs ✅
7. **History cache** → offline checkout muncul di history ✅
8. **Remove backward compat** → getQueue dll dihapus ✅
9. **Checkout online tetap jalan** → mutation API ✅
10. **Save bill online tetap jalan** → mutation API ✅
