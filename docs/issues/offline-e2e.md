# Offline Mode E2E: Session Summary, Cross-Session Payment, Split Bill & PendingDrawer

## Table of Contents
- [Problem](#problem)
- [Solution Overview](#solution-overview)
- [Field Schema](#field-schema)
- [Flow Detail](#flow-detail)
- [Split Bill](#split-bill)
- [PendingDrawer Behavior](#pendingdrawer-behavior)
- [Summary Compute Rules](#summary-compute-rules)
- [Files Changed](#files-changed)
- [Sync Manager Detail](#sync-manager-detail)
- [Verification Matrix](#verification-matrix)

---

## Problem

**3 masalah utama:**

1. **Summary gak update** — Setiap transaksi offline (savebill, paynow, topup) tidak trigger recalculation ke session summary. Data di shift detail & close session ngaco (hardcode 0, missing payment_methods, topups, dll).

2. **Cross-session payment** — Order A pending di Session A, dibayar di Session B. Summary Session A masih menghitung `outstanding_bill` untuk Order A padahal sudah dibayar. Tidak ada pembeda origin session vs paid session.

3. **PendingDrawer duplikat** — Order A muncul 2x di PendingDrawer: Bills tab (status pending) + Orders tab (status completed). User bingung apakah bill sudah dibayar atau belum.

---

## Solution Overview

### 3 field baru di order blob (IndexedDB)

| Field | Tipe | Di-set kapan | Contoh |
|-------|------|-------------|--------|
| `originSessionSyncId` | string | Saat order **dibuat** (savebill/paynow/split) — **never changes** | `"session-A"` |
| `paidSessionSyncId` | string \|\| null | Saat **payment/checkout** (completed) — null kalo pending | `"session-B"` |
| `isShow` | boolean | Default `true`. Di-set **`false`** jika order sudah dibayar lunas (full payment) | `false` |

### Aturan `isShow`

| Kondisi | `isShow` | items |
|---------|----------|-------|
| Save bill baru | `true` | items asli |
| Paynow full (lunas) — bayar semua items | `false` | items di-update ke empty / dihapus |
| Paynow partial (split) — bayar sebagian items | `true` (masih ada sisa) | items di-update ke sisa |

### Kenapa `isShow`?

Daripada linking complex via `payBillSyncId` atau match by `billName`, `isShow` langsung mengontrol visibility di PendingDrawer & summary. Saat payment:

- **Full payment:** `isShow = false` — pending order gak muncul di Bills tab & gak dihitung outstanding_bill
- **Partial payment (split):** items di-update + pending tetap `isShow = true` — karena masih ada sisa yg belum dibayar

---

## Field Schema

### Order Blob (IndexedDB — `offlineSessions[].orders[]`)

```js
{
  sync_id: "ord-A",
  sessionSyncId: "session-A",
  originSessionSyncId: "session-A",     // BARU — session saat order dibuat
  paidSessionSyncId: "session-B",        // BARU — session saat payment (null kalo pending)
  isShow: true,                          // BARU — false kalo udah dibayar lunas
  originalItems: [                       // BARU — snapshot items asli (untuk split bill)
    { catalog_id: "A", quantity: 10 },
    { catalog_id: "B", quantity: 5 }
  ],
  status: "pending" | "completed",
  code: "2407XXXX",
  salesChannelId: "...",
  paymentMethodId: 0,
  membershipId: null,
  paymentRef: "",
  billName: "Meja 5",
  cashierName: "Naufal",
  discountPercentage: 0,
  discountValue: 0,
  categoryDiscounts: [],
  serviceChargeValue: 0,
  serviceChargePercentage: 0,
  items: [{ catalog_id, catalog_name, quantity, unit_price, addons }],
  totalPayment: 50000,
  paidAt: "ISO",
  isOfflineMode: true,
  refSyncId: ""
}
```

**Aturan `originalItems`:**
| Event | `items` | `originalItems` |
|-------|---------|----------------|
| Save bill baru | items asli | items asli (snapshot) |
| Split — update pending sisa | items sisa | **TETAP** items asli |
| Full payment — `isShow=false` | dihapus / unchanged | unchanged |

### Sync Payload (POST /sales/sync — per order)

```json
{
  "sync_id": "ord-A",
  "origin_session_sync_id": "session-A",
  "paid_session_sync_id": "session-B",
  "is_show": false,
  "original_items": [
    { "catalog_id": "A", "quantity": 10 },
    { "catalog_id": "B", "quantity": 5 }
  ],
  "status": "completed",
  "is_offline_mode": true,
  // ... existing fields
}
```

---

## Flow Detail

### 0. Helper: Hitung sisa items setelah bayar

Sebelum Paynow offline, kita perlu tau item mana yg dibayar vs sisa. Caranya:

```
loadOfflineBill → CartState.bill.originalItems = snapshot items asli
                  (disimpan di cart slice pas load bill)

Pas Paynow offline:
  cartItems = items di cart skrg (yg mau dibayar)
  originalItems = CartState.bill.originalItems (items asli dari save bill)

  paidItems = cartItems (yg dibayar user)
  remainingItems = hitung sisa dari originalItems - paidItems
    ├─ Kalo item ada di original tp ga di cart → qty asli (dihapus user)
    ├─ Kalo item di cart dgn qty lebih kecil → original.qty - paid.qty
    ├─ Kalo item di cart dgn qty sama → 0 (habis)
    └─ Kalo item baru di cart (ga ada di original) → ga masuk remaining

  Kalo remainingItems.length > 0 → PARTIAL PAYMENT (split)
  Kalo remainingItems.length = 0 → FULL PAYMENT
```

### 1. Save Bill (Offline)

**Location:** `checkout.jsx` — `handleSaveBill()` offline path

```js
// Session A
const order = {
  sync_id: uuidv4(),
  originSessionSyncId: syncId,   // session A
  paidSessionSyncId: null,        // pending
  isShow: true,
  status: "pending",
  items: [A:10, B:5],
  ...
};

await appendOrderToSession(syncId, order, userId);
refreshReduxSessions();
recomputeSummary();              // BARU
```

**Effect on summary:**
- `outstanding_bill` += `calcOrderTotal(order)` ✅
- `total_sales` unchanged (pending) ✅

### 2. Paynow Full Payment (Offline)

**Location:** `checkout.jsx` — `handlePay()` offline path

Condition: `remainingItems.length === 0` (semua items dibayar)

```js
// Cart items = semua items asli (ga ada yg dihapus/dikurangin)

// 1. Buat completed order
const completedOrder = {
  sync_id: uuidv4(),
  originSessionSyncId: CartState.bill.originSyncId || syncId,
  paidSessionSyncId: syncId,
  isShow: true,
  status: "completed",
  items: allItems,   // cart items
  ...
};
await appendOrderToSession(syncId, completedOrder, userId);

// 2. Update original pending → isShow = false
//    (kalo ini dari saved bills)
if (CartState.bill?.originSyncId) {
  await updateOrderInSession(CartState.bill.originSyncId, pendingSyncId, { isShow: false }, userId);
}

recomputeSummary();
```

**Effect on summary:**
- `total_sales` += `completedOrder.totalPayment` ✅
- `outstanding_bill` tidak include original pending (isShow=false) ✅
- `payment_methods` += breakdown ✅

### 3. Paynow Partial Payment / Split (Offline)

**Location:** `checkout.jsx` — `handlePay()` offline path

Condition: `remainingItems.length > 0` (ada sisa items)

```js
// Cart items = items yg dibayar skrg (misal A:5)
// remainingItems = items sisa (misal A:5, B:5)

// 1. Buat completed order — items yg dibayar
const completedOrder = {
  sync_id: uuidv4(),
  originSessionSyncId: CartState.bill.originSyncId || syncId,
  paidSessionSyncId: syncId,
  isShow: true,
  status: "completed",
  items: cartItems,            // A:5 (yg dibayar)
  ...
};
await appendOrderToSession(syncId, completedOrder, userId);

// 2. Update original pending items → sisa, originalItems TETAP
await updateOrderInSession(originSessionId, pendingSyncId, {
  items: remainingItems,       // A:5, B:5 (sisa)
  totalPayment: 0,
  // originalItems: TETAP [A:10, B:5] — gak diubah
  // isShow tetap true — masih ada sisa
}, userId);

recomputeSummary();
```

**Effect on summary:**
- `total_sales` += `completedOrder.totalPayment` ✅
- `outstanding_bill` = remaining items (isShow=true, pending) ✅
- `payment_methods` += breakdown ✅

### 4. Paynow Cross-Session (Offline)

**Location:** `checkout.jsx` — `handlePay()` offline path, bill dari Session A di-load di Session B

Deteksi: `CartState.bill.originSyncId` ada, dan != current session syncId

#### Full Payment Cross-Session:
```js
// 1. Buat completed order di Session B
const completedOrder = {
  sync_id: uuidv4(),
  originSessionSyncId: CartState.bill.originSyncId,   // session A
  paidSessionSyncId: syncId,                           // session B
  isShow: true,
  status: "completed",
  items: cartItems,
  ...
};
await appendOrderToSession(syncId, completedOrder, userId);

// 2. Update original pending di Session A → isShow = false
await updateOrderInSession(
  CartState.bill.originSyncId,
  CartState.bill.sync_id,
  { isShow: false },
  userId
);

recomputeSummary();
```

#### Partial Payment Cross-Session:
```js
// 1. Buat completed order di Session B
const completedOrder = {
  sync_id: uuidv4(),
  originSessionSyncId: CartState.bill.originSyncId,   // session A
  paidSessionSyncId: syncId,                           // session B
  isShow: true,
  status: "completed",
  items: cartItems,
  ...
};
await appendOrderToSession(syncId, completedOrder, userId);

// 2. Update original pending di Session A → kurangi items (sisa)
await updateOrderInSession(
  CartState.bill.originSyncId,
  CartState.bill.sync_id,
  { items: remainingItems },   // isShow tetap true
  userId
);

recomputeSummary();
```

**Effect on summary Session A:**
- items di-update ke sisa, `isShow = true` (masih pending)
- `outstanding_bill` = items sisa ✅

**Effect on summary Session B:**
- `total_sales` += completed ✅
- `outstanding_bill_payment` += completed ✅ (origin != paid)

### 5. End Session (Offline)

**Location:** `session/hook.js` — `end()` offline path

Memanggil `computeOfflineSummary()` dengan filter `originSessionSyncId` / `paidSessionSyncId` / `isShow`.

### 6. Topup (Offline)

**Location:** `card.content.jsx` — `handleTopup()` offline path

```js
await appendTopupToSession(syncId, topupItem, userId);
refreshReduxSessions();

// BARU: recompute summary
const fresh = await getAllSessions(userId);
const activeSession = fresh.find(s => s.sync_id === syncId);
if (activeSession) {
  const summary = computeOfflineSummary(activeSession, syncId);
  dispatch(setOfflineSummary(summary));
}
```

---

## Split Bill

### Definisi

Split bill adalah **modify items dari saved bills** lalu paynow. Bukan UI khusus split. Flow-nya:

1. **Save Bill** "Meja 5" A:10, B:5 → pending di IndexedDB
2. **Open bill** → CartState load items A:10, B:5 + simpan `originalItems` snapshot
3. Di checkout, user **hapus/ubah qty items**
4. **Paynow** → bayar items yg ada di cart

### Aturan

| Kondisi | Action ke Original Pending | `isShow` | items |
|---------|---------------------------|----------|-------|
| **Full payment** — semua items dibayar (cart items = original items) | Update `isShow = false` | `false` | unchanged |
| **Partial payment (split)** — hanya sebagian items dibayar | Update items ke **sisa** | `true` | diubah ke sisa |

### Aturan `originalItems`

| Event | `items` | `originalItems` |
|-------|---------|----------------|
| Save bill baru | items asli | **items asli** (snapshot) |
| Split — update pending sisa | items sisa | **TETAP** items asli |
| Full payment — `isShow=false` | dihapus / unchanged | unchanged |

Server compute `pending_qty = sum originalItems.quantity` — tau original pending qty meski items udah di-split.

### Cara Hitung Sisa Items

```
loadOfflineBill → CartState.bill.originalItems = snapshot items asli
                  (disimpan di cart slice pas load bill, attach dari _sessionData)

Pas Paynow offline:
  cartItems = items di cart skrg (yg mau dibayar)
  originalItems = CartState.bill.originalItems (items asli dari save bill)

  paidItems = cartItems
  remainingItems = []

  for each originalItem:
    cartItem = cartItems.find(c => c.catalog_id === originalItem.catalog_id)
    
    if (!cartItem):
      // Item dihapus user → sisa = qty asli
      remainingItems.push({ ...originalItem })
    
    else if (cartItem.quantity < originalItem.quantity):
      // Qty dikurangin → sisa = original.qty - cart.qty
      remainingItems.push({
        ...originalItem,
        quantity: originalItem.quantity - cartItem.quantity
      })
    
    // else: qty sama atau lebih → ga ada sisa (habis dibayar / kelebihan diabaikan)

  // Items baru di cart (tambah sendiri oleh user) — ga masuk remaining
  // Items baru dibayar full, gak ada sisa
```

### Contoh

#### Split same session:

```
Session A:
  SaveBill "Meja 5" → Order 1: A:10, B:5 (pending)

  Buka bill, hapus B, A jadi 5 → Paynow

  Session A blob setelah Paynow:
    Order 1 (pending): items A:5, B:5, isShow=true    ← di-update (sisa)
    Order 2 (completed): items A:5                     ← baru (dibayar)
  
  Summary Session A:
    total_sales = A:5
    outstanding_bill = A:5 + B:5
```

#### Full payment same session:

```
Session A:
  SaveBill "Meja 5" → Order 1: A:10, B:5 (pending)

  Buka bill, semua items sama → Paynow

  Session A blob setelah Paynow:
    Order 1 (pending): isShow=false                     ← di-update
    Order 2 (completed): A:10, B:5                      ← baru

  Summary Session A:
    total_sales = A:10 + B:5
    outstanding_bill = 0 (order 1 isShow=false)
```

#### Split cross-session:

```
Session A:
  SaveBill "Meja 5" → Order 1: A:15, B:10 (pending)

  Buka bill di Session A, bayar A:5 → split
    Order 1: A:10, B:10 (pending, isShow=true)         ← sisa
    Order 2: A:5 (completed)

Session B:
  Buka sisa bill dari A → Order 1: A:10, B:10

  Bayar full:
    Order 3: A:10, B:10 (completed, origin=A, paid=B)
    Order 1 di Session A: isShow=false

  Summary Session A:
    total_sales = A:5
    outstanding_bill = 0 (order 1 isShow=false)

  Summary Session B:
    total_sales = A:10 + B:10
    outstanding_bill_payment = A:10 + B:10 (origin=A, paid=B)
```

---

## PendingDrawer Behavior

### Filtering Rules

```js
// Bills tab: hanya pending yang isShow !== false
const bills = sessions
  .flatMap(s => (s.orders || []).map(o => ({ ...o, _sessionSyncId: s.sync_id })))
  .filter(o => o.status === 'pending' && o.isShow !== false);

// Orders tab: semua completed (isShow irrelevant — completed selalu tampil)
const orders = sessions
  .flatMap(s => (s.orders || []).map(o => ({ ...o, _sessionSyncId: s.sync_id })))
  .filter(o => o.status === 'completed');
```

### Scenario

| Session A | Session B | Bills Tab | Orders Tab |
|-----------|-----------|-----------|------------|
| Order A (pending, isShow=true) | — | ✅ Muncul | — |
| Order A (pending, isShow=false) | Order A (completed) | ❌ Gak muncul | ✅ Muncul |
| Order A (pending, isShow=true, items sisa) | Order B (completed, split) | ✅ Masih muncul sbg sisa | ✅ Muncul |
| — | Order A (completed) | — | ✅ Muncul |

### Diagram

```
                  ┌──────────────────────────┐
                  │     PendingDrawer         │
                  │                           │
                  │  Bills Tab                │
                  │  ┌─────────────────────┐  │
                  │  │ Order A (Session A) │  │  ← isShow = true (masih pending)
                  │  │ Order B (Session A) │  │  ← isShow = true (split sisa)
                  │  └─────────────────────┘  │
                  │                           │
                  │  Orders Tab               │
                  │  ┌─────────────────────┐  │
                  │  │ Order C (Session A) │  │  ← completed normal
                  │  │ Order A (Session B) │  │  ← completed cross-session
                  │  └─────────────────────┘  │
                  └──────────────────────────┘
```

---

## Summary Compute Rules

Rumus final untuk `computeOfflineSummary()`:

```
currentSession = session yg lagi di-summarize

completedOrders = orders WHERE status == 'completed'
                    AND paidSessionSyncId == currentSession

pendingOrders   = orders WHERE status == 'pending'
                    AND originSessionSyncId == currentSession
                    AND isShow !== false

crossSessionOrders = orders WHERE status == 'completed'
                      AND originSessionSyncId != paidSessionSyncId
                      (payment dari session lain)

total_sales            = sum completedOrders.totalPayment
outstanding_bill       = sum pendingOrders.totalPayment
outstanding_bill_pmt   = sum crossSessionOrders.totalPayment
total_discount         = sum completedOrders.discountValue
total_service          = sum completedOrders.serviceChargeValue
total_after_discount   = total_sales - total_discount
grand_total            = total_after_discount

payment_methods        = group by paymentMethodId dari completedOrders
topup_summary          = topups group by payment_type
expected_cash          = cash_started + total_sales + topup_cash
```

---

## Files Changed

| # | File | Perubahan |
|---|------|-----------|
| 1 | `src/services/sales/session/hook.js` | **Export** `computeOfflineSummary()`. Tambah param `currentSessionSyncId`. Filter pake `paidSessionSyncId`/`originSessionSyncId`/`isShow`. Fix `total_service` dari data real (bukan hardcode 0). |
| 2 | `src/pages/authorize/home/checkout.jsx` | **handlePay offline**: compute remainingItems. Full → update isShow=false. Partial → update items sisa. Set `originSessionSyncId`/`paidSessionSyncId`. Ganti inline summary → panggil `computeOfflineSummary()`. **handleSaveBill offline**: set `originSessionSyncId`. Tambah recompute. |
| 3 | `src/pages/authorize/membership/card.content.jsx` | Tambah recompute summary setelah topup offline |
| 4 | `src/pages/authorize/shifts/index.jsx` | Ganti inline hardcoded summary → panggil `computeOfflineSummary()` |
| 5 | `src/services/cart/slice.js` | `loadOfflineBill` — attach `originSyncId` + `originalItems` dari `_sessionData` ke state. Biar handlePay bisa deteksi cross-session & hitung sisa items. |
| 6 | `src/services/offline/syncManager.js` | Mapping tiap order: tambah `origin_session_sync_id`, `paid_session_sync_id`, `is_show`, `original_items` |
| 7 | `src/components/ui/offline/PendingDrawer.jsx` | Filter bills tab: `o.isShow !== false` |

---

## Sync Manager Detail

### Payload Mapping (`syncManager.js`)

```js
orders: (session.orders || []).map(o => ({
  // ... existing fields
  session_sync_id: session.referenceId || session.sync_id,
  // BARU:
  origin_session_sync_id: o.originSessionSyncId || '',
  paid_session_sync_id: o.paidSessionSyncId || '',
  is_show: o.isShow !== false,
  original_items: (o.originalItems || []).map(oi => ({
    catalog_id: oi.catalog_id,
    quantity: oi.quantity || 0,
  })),
  // ... existing fields (code, status, total_payment, dll)
})),
```

### Backend Impact

Request per order nambah 4 field optional:

```json
{
  "sync_id": "ord-A",
  "origin_session_sync_id": "session-A-uuid",
  "paid_session_sync_id": "session-B-uuid",
  "is_show": false,
  "original_items": [
    { "catalog_id": "A", "quantity": 10 },
    { "catalog_id": "B", "quantity": 5 }
  ],
  "status": "completed",
  "is_offline_mode": true,
  // ... existing
}
```

Backend summary computation:
- `total_sales` → filter `paid_session_sync_id` == session ID
- `outstanding_bill` → filter `status = pending` AND `is_show = true`
- `outstanding_bill_payment` → filter `origin_session_sync_id != paid_session_sync_id`
- `original_items` → biar server tau qty asli pending (sebelum split)

---

## Verification Matrix

| # | Skenario | Steps | Expected |
|---|----------|-------|----------|
| 1 | **Save bill offline** | Add items → save bill | `originSessionSyncId` = session aktif. `paidSessionSyncId` = null. summary `outstanding_bill` terisi |
| 2 | **Paynow full same session** | Add items → paynow (no changes) | `isShow=false` di original pending. `total_sales` += payment ✅ |
| 3 | **Paynow partial (split) same session** | Buka bill, hapus/ubah qty → paynow | Original pending items di-update ke sisa (`isShow=true`). Completed order baru untuk yg dibayar. `outstanding_bill` = sisa ✅ |
| 4 | **Paynow full cross-session** | Buka bill Session A di Session B, bayar tanpa ubah items | Session A: `isShow=false`. Session B: completed, `total_sales` terisi, `outstanding_bill_payment` terisi ✅ |
| 5 | **Paynow partial cross-session** | Buka bill Session A di Session B, ubah qty → bayar | Session A: items di-update ke sisa. Session B: completed ✅ |
| 6 | **Split same session** | savebill → modify → paynow | Flow nomor 3 ✅ |
| 7 | **Topup offline** | Topup via card.content | `session.topups[]` bertambah. summary `topups` + `topup_cash` terisi ✅ |
| 8 | **Summary close session** | Buka close session page offline | Semua field akurat ✅ |
| 9 | **Shift detail offline** | Buka shift page offline | Semua field akurat, no hardcode 0 ✅ |
| 10 | **PendingDrawer Bills** | Ada pending + isShow=false | Bills tab: hanya `isShow !== false` ✅ |
| 11 | **PendingDrawer Orders** | Ada completed | Orders tab: semua completed ✅ |
| 12 | **Sync ke server** | Online → auto sync | 3 field baru terkirim ✅ |
| 13 | **Online flow unchanged** | Checkout/topup/close online | Tetap panggil API — tidak berubah ✅ |
