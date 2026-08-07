# Offline E2E — Flow Simulation

Simulasi End-to-End untuk semua skenario transaksi offline: save bill, split bill, paynow, cross-session payment, topup, end session, dan sync.

---

## Daftar Skenario

- [Skenario 1: Save Bill → Split → Paynow Sisa → End](#skenario-1-save-bill--split--paynow-sisa--end-session)
- [Skenario 2: Cross-Session Payment (Full)](#skenario-2-cross-session-payment-full)
- [Skenario 3: Split Cross-Session](#skenario-3-split-cross-session)
- [Skenario 4: Topup Offline + End](#skenario-4-topup-offline--end-session)
- [Skenario 5: Mixed — Save Bill, Topup, Paynow, Split, Cross-Session](#skenario-5-mixed-complex-flow)

---

## Skenario 1: Save Bill → Split → Paynow Sisa → End Session

**User flow:** Session A, save bill "Meja 5" items A:10, B:5. Buka bill, bayar A:5 (split). Sisa A:5, B:5. Bayar sisa full. End session.

### Step 1: Save Bill

```
Cart: [A:10, B:5]
↓ "Save Bill"

Order 1 (pending):
  sync_id: "ord-1"
  originSessionSyncId: "session-A"
  paidSessionSyncId: null
  isShow: true
  originalItems: [A:10, B:5]
  items: [A:10, B:5]
  billName: "Meja 5"
  status: "pending"
  totalPayment: 0
```

**Blob IndexedDB Session A:**
```js
{
  sync_id: "session-A",
  orders: [Order 1],
  topups: [],
  syncStatus: "pending"
}
```

**Summary:**
```
outstanding_bill = calc(A:10 + B:5)
total_sales = 0
```

**PendingDrawer Bills Tab:** ✅ Order 1 muncul

---

### Step 2: Split — Bayar Sebagian

Buka bill "Meja 5" → hapus B, qty A jadi 5 → Paynow Cash Rp50.000

```
Cart: [A:5]
Original bill: [A:10, B:5]

remainingItems = hitung sisa:
  A: 10 - 5 = 5 → sisa A:5 ✅
  B: dihapus dari cart → sisa B:5 ✅

remainingItems = [A:5, B:5]   ← masih ada sisa → PARTIAL PAYMENT
```

**Append completed order:**
```js
Order 2 (completed):
  sync_id: "ord-2"
  originSessionSyncId: "session-A"
  paidSessionSyncId: "session-A"
  isShow: true
  originalItems: []                    // completed → kosong
  items: [A:5]
  status: "completed"
  totalPayment: 50000
  billName: "Meja 5"
  paymentMethodId: 0                   // Cash
```

**Update Order 1 (sisa):**
```js
Order 1 (pending):
  items: [A:5, B:5]                    // di-update
  originalItems: [A:10, B:5]           // TETAP!
  isShow: true                         // masih ada sisa
  totalPayment: 0
```

**Blob Session A setelah step 2:**
```js
{
  sync_id: "session-A",
  orders: [
    { ...Order 1, items: [A:5, B:5], originalItems: [A:10, B:5], isShow: true },
    { ...Order 2, items: [A:5], originalItems: [], isShow: true,
      paidSessionSyncId: "session-A" }
  ],
  syncStatus: "pending"
}
```

**Summary:**
```
total_sales = 50.000 ✅
outstanding_bill = calc(A:5 + B:5) ✅
payment_methods = Cash: 50.000 ✅
expected_cash = cash_started + 50.000 ✅
```

**PendingDrawer:**
- **Bills:** Order 1 (A:5, B:5) ✅
- **Orders:** Order 2 (A:5) ✅

---

### Step 3: Bayar Sisa Full

Buka bill "Meja 5" lagi → items A:5, B:5 → Paynow Cash Rp50.000

```
Cart: [A:5, B:5]
Original bill items: [A:5, B:5]

remainingItems = hitung sisa:
  A: cart 5 == original 5 → habis ✅
  B: cart 5 == original 5 → habis ✅

remainingItems = [] → FULL PAYMENT
```

**Append completed order:**
```js
Order 3 (completed):
  sync_id: "ord-3"
  originSessionSyncId: "session-A"
  paidSessionSyncId: "session-A"
  isShow: true
  originalItems: []
  items: [A:5, B:5]
  status: "completed"
  totalPayment: 50000
```

**Update Order 1 — isShow = false:**
```js
Order 1 (pending):
  isShow: false                        // lunas!
  items: [A:5, B:5]                    // unchanged
  originalItems: [A:10, B:5]           // TETAP
```

**Blob Session A setelah step 3:**
```js
{
  sync_id: "session-A",
  orders: [
    { ...Order 1, isShow: false },
    Order 2,
    Order 3
  ]
}
```

**Summary:**
```
total_sales = 50.000 + 50.000 = 100.000 ✅
outstanding_bill = 0 ✅ (isShow=false)
payment_methods = Cash: 100.000 ✅
```

**PendingDrawer:**
- **Bills:** — ❌ (Order 1 isShow=false)
- **Orders:** Order 2 + Order 3 ✅

---

### Step 4: End Session

```
closeSession → end({ cash_finished: 200000 })
  → updateSessionClose(session-A, { cash_finished: 200000 })
  → computeOfflineSummary(session-A, "session-A")
```

**computeOfflineSummary result:**
```js
{
  started_at: "...",
  finished_at: "...",
  cash_started: 200000,
  cash_finished: 200000,
  cashier: { name: "Naufal" },
  summary: {
    sales: {
      total_sales: 100000,
      total_discount: 0,
      total_after_discount: 100000,
      total_service: 0,
      grand_total: 100000,
      outstanding_bill: 0,           // isShow=false
      outstanding_bill_payment: 0    // origin == paid (same session)
    },
    cash: {
      expected_cash: 200000 + 100000 + 0 = 300000,
      topup_cash: 0
    },
    payment_methods: [
      { payment_method_id: 0, total_paid: 100000, count: 2, name: "Cash" }
    ],
    topups: []
  },
  orders: [Order1, Order2, Order3]
}
```

---

### Step 5: Sync ke Server

Online → `syncPendingSessions()` → POST /sales/sync

```json
POST /sales/sync
{
  "session": {
    "sync_id": "session-A",
    "id": "",
    "open_at": "2026-07-27T08:00:00Z",
    "close_at": "2026-07-27T17:00:00Z",
    "cash_started": 200000,
    "cash_finished": 200000
  },
  "orders": [
    {
      "sync_id": "ord-1",
      "status": "pending",
      "items": [{ "catalog_id": "A", "quantity": 5 }, { "catalog_id": "B", "quantity": 5 }],
      "original_items": [{ "catalog_id": "A", "quantity": 10 }, { "catalog_id": "B", "quantity": 5 }],
      "is_show": false,
      "origin_session_sync_id": "session-A",
      "paid_session_sync_id": ""
    },
    {
      "sync_id": "ord-2",
      "status": "completed",
      "items": [{ "catalog_id": "A", "quantity": 5 }],
      "original_items": [],
      "is_show": true,
      "origin_session_sync_id": "session-A",
      "paid_session_sync_id": "session-A"
    },
    {
      "sync_id": "ord-3",
      "status": "completed",
      "items": [{ "catalog_id": "A", "quantity": 5 }, { "catalog_id": "B", "quantity": 5 }],
      "original_items": [],
      "is_show": true,
      "origin_session_sync_id": "session-A",
      "paid_session_sync_id": "session-A"
    }
  ]
}
```

**Server menerima:**
- `ord-1`: pending, is_show=false → **tidak dihitung** outstanding_bill ✅
- `ord-1 original_items`: A:10, B:5 → server tau original qty sebelum split ✅
- `ord-2 + ord-3`: paid_session_sync_id = session-A → **total_sales** += 100.000 ✅
- Semua origin == paid → **outstanding_bill_payment** = 0 ✅

---

## Skenario 2: Cross-Session Payment (Full)

**User flow:** Session A save bill. Online sync Session A. Session B bayar full.

### Step 1: Session A — Save Bill

```
Order 1 (pending):
  originSessionSyncId: "session-A"
  paidSessionSyncId: null
  isShow: true
  originalItems: [A:10, B:5]
  items: [A:10, B:5]
  billName: "Meja 5"
```

### Step 2: Session A — Sync Online

```
POST /sales/sync (Session A):
  orders: [{
    sync_id: "ord-1",
    status: "pending",
    items: [A:10, B:5],
    original_items: [A:10, B:5],
    is_show: true
  }]
```

**Response:**
```json
{
  "session": { "sync_id": "session-A", "id": "server-sess-A" },
  "orders": [{ "sync_id": "ord-1", "id": "server-ord-1" }]
}
```

Session A dihapus dari IndexedDB ✅ — data sudah di server.

### Step 3: Session B — Paynow Bill dari A

Buka saved bills (merge server + pending) → pilih "Meja 5"
→ Items di-cart: [A:10, B:5]
→ Paynow Cash Rp150.000

```
deteksi: CartState.bill sync_id = "server-ord-1" atau "ord-1"
         current session = "session-B"
         origin sync != current → CROSS-SESSION ✅

cartItems: [A:10, B:5]
remainingItems: [] → FULL PAYMENT

// Ball bill asli sudah di-sync dan dihapus dari IndexedDB
// Tidak ada pending order di IndexedDB untuk di-update isShow=false
// Hanya buat completed order di Session B
```

**Append completed order di Session B:**
```js
Order 2 (completed):
  sync_id: "ord-2"
  originSessionSyncId: "session-A"      // dari bill asli
  paidSessionSyncId: "session-B"        // session aktif
  isShow: true
  items: [A:10, B:5]
  status: "completed"
  totalPayment: 150000
```

**Blob Session B:**
```js
{
  sync_id: "session-B",
  orders: [Order 2],
  syncStatus: "pending"
}
```

**Summary Session B:**
```
total_sales = 150.000 ✅
outstanding_bill = 0
outstanding_bill_payment = 150.000 ✅ (origin=A, paid=B)
```

**PendingDrawer:**
- **Bills:** — ✅
- **Orders:** Order 2 ✅

### Step 4: Session B — Sync

```
POST /sales/sync (Session B):
  orders: [{
    sync_id: "ord-2",
    status: "completed",
    items: [A:10, B:5],
    original_items: [],
    is_show: true,
    origin_session_sync_id: "session-A",
    paid_session_sync_id: "session-B",
    session_sync_id: "server-sess-B"
  }]
```

**Server:**
- `origin_session_sync_id` (A) != `paid_session_sync_id` (B) → **cross-session payment**
- `total_sales` Session B += 150.000 ✅
- `outstanding_bill_payment` Session B += 150.000 ✅

---

## Skenario 3: Split Cross-Session

**User flow:** Session A save bill A:15, B:10. Bayar A:5 (split). Sisa A:10, B:10. Session B bayar sisa.

### Step 1: Session A — Save Bill

```
Order 1 (pending):
  originSessionSyncId: "session-A"
  isShow: true
  originalItems: [A:15, B:10]
  items: [A:15, B:10]
```

### Step 2: Session A — Split Bayar A:5

Buka bill → qty A jadi 5 → Paynow Rp50.000

```
remainingItems: [A:10, B:10] ← A:15-5=10, B tetap 10
```

**Append Order 2 (completed) + update Order 1 (sisa):**
```js
Order 2 (completed):           // baru
  originSessionSyncId: "session-A"
  paidSessionSyncId: "session-A"
  items: [A:5]

Order 1 (pending):             // di-update
  items: [A:10, B:10]          // sisa
  originalItems: [A:15, B:10]  // TETAP
  isShow: true
```

### Step 3: Session A — End

```
Summary Session A:
  total_sales = 50.000 ✅
  outstanding_bill = calc(A:10 + B:10) ✅
  outstanding_bill_payment = 0
```

### Step 4: Session B — Bayar Sisa

Buka saved bills → ketemu "Meja 5" (pending, isShow=true)
→ Items: [A:10, B:10] → Paynow full Rp150.000

```
deteksi: bill dari Session A → CROSS-SESSION

remainingItems: [] → FULL PAYMENT
```

**Append Order 3 di Session B:**
```js
Order 3 (completed):
  originSessionSyncId: "session-A"    // tetap!
  paidSessionSyncId: "session-B"      // session aktif
  items: [A:10, B:10]
  totalPayment: 150000
```

**Update Order 1 di Session A — isShow = false:**
```js
Order 1 (pending):
  isShow: false                        // lunas!
  items: [A:10, B:10]
  originalItems: [A:15, B:10]          // TETAP
```

**Summary Session B:**
```
total_sales = 150.000 ✅
outstanding_bill_payment = 150.000 ✅ (origin=A, paid=B)
```

**Summary Session A (sebelum sync):**
```
total_sales = 50.000 ✅
outstanding_bill = 0 ✅ (isShow=false)
```

### Step 5: Sync Session A & B

```json
// Session A sync
POST /sales/sync
{
  "orders": [
    { "sync_id": "ord-1", "status": "pending", "items": [A:10,B:10],
      "original_items": [A:15,B:10], "is_show": false,
      "origin_session_sync_id": "session-A", "paid_session_sync_id": "" },
    { "sync_id": "ord-2", "status": "completed", "items": [A:5],
      "original_items": [], "is_show": true,
      "origin_session_sync_id": "session-A", "paid_session_sync_id": "session-A" }
  ]
}
```

```json
// Session B sync
POST /sales/sync
{
  "orders": [{
    "sync_id": "ord-3", "status": "completed", "items": [A:10,B:10],
    "original_items": [], "is_show": true,
    "origin_session_sync_id": "session-A", "paid_session_sync_id": "session-B"
  }]
}
```

**Server:**
- Session A: total_sales=50.000, outstanding_bill=0 (is_show=false) ✅
- Session B: total_sales=150.000, outstanding_bill_pmt=150.000 ✅
- ord-1 original_items A:15,B:10 → server tau ini split dari 15 ✅

---

## Skenario 4: Topup Offline + End Session

**User flow:** Session A topup member Rp100.000 cash. End session.

### Step 1: Topup

```
CardContent → isOffline → handleTopup()

topupItem = {
  sync_id: "top-1",
  session_sync_id: "session-A",
  membership_id: "member-123",
  nominal: 100000,
  payment_type: "cash",
  member_name: "Budi",
  member_card_id: "123456"
}

appendTopupToSession("session-A", topupItem)
→ session.topups.push(topupItem)
```

**Blob Session A:**
```js
{
  sync_id: "session-A",
  orders: [],
  topups: [{ nominal: 100000, payment_type: "cash", ... }]
}
```

**Summary setelah recompute:**
```
topups = [{ type: "cash", total_nominal: 100000 }]
total_sales = 0
expected_cash = cash_started + 0 + 100000 = cash_started + 100k ✅
topup_cash = 100000 ✅
```

### Step 2: End Session

```
Summary:
  topups: [{ type: "cash", total_nominal: 100000 }]
  cash.topup_cash: 100000
  cash.expected_cash: cash_started + total_sales + topup_cash
```

### Step 3: Sync

```json
POST /sales/sync
{
  "topups": [{
    "membership_id": "member-123",
    "nominal": 100000,
    "payment_type": "cash",
    "card_id": "123456",
    "member_name": "Budi"
  }]
}
```

---

## Skenario 5: Mixed (Complex Flow)

**User flow:** Satu session berisi save bill, topup, paynow, split, dan cross-session payment.

### Session A — Aktivitas

| Step | Action | Items | Amount | Result |
|------|--------|-------|--------|--------|
| 1 | Save Bill "Meja 5" | A:10, B:5 | — | Order 1 (pending) |
| 2 | Topup Budi | — | Rp100.000 | topup-1 |
| 3 | Paynow (no bill) | C:3 | Rp30.000 | Order 2 (completed) |
| 4 | Split "Meja 5" → bayar A:5 | A:5 (paid), sisa A:5, B:5 | Rp50.000 | Order 3 (completed), Order 1 di-update |
| 5 | Bayar sisa "Meja 5" | A:5, B:5 | Rp50.000 | Order 4 (completed), Order 1 isShow=false |
| 6 | Topup Siti | — | Rp50.000 | topup-2 |

### Blob Final Session A

```js
{
  sync_id: "session-A",
  session: { open_at, cash_started: 200000, close_at, cash_finished },
  orders: [
    // Order 1 — pending asli, sekarang isShow=false
    {
      sync_id: "ord-1",
      originSessionSyncId: "session-A",
      paidSessionSyncId: null,
      isShow: false,                   // lunas
      originalItems: [A:10, B:5],      // snapshot asli
      items: [A:5, B:5],               // sisa terakhir (sebelum isShow=false)
      status: "pending",
      billName: "Meja 5",
      totalPayment: 0
    },
    // Order 2 — paynow langsung
    {
      sync_id: "ord-2",
      originSessionSyncId: "session-A",
      paidSessionSyncId: "session-A",
      isShow: true,
      items: [C:3],
      status: "completed",
      totalPayment: 30000
    },
    // Order 3 — split partial (A:5)
    {
      sync_id: "ord-3",
      originSessionSyncId: "session-A",
      paidSessionSyncId: "session-A",
      isShow: true,
      items: [A:5],
      status: "completed",
      totalPayment: 50000
    },
    // Order 4 — bayar sisa full
    {
      sync_id: "ord-4",
      originSessionSyncId: "session-A",
      paidSessionSyncId: "session-A",
      isShow: true,
      items: [A:5, B:5],
      status: "completed",
      totalPayment: 50000
    }
  ],
  topups: [
    { nominal: 100000, payment_type: "cash", member_name: "Budi" },
    { nominal: 50000, payment_type: "transfer", member_name: "Siti" }
  ]
}
```

### Summary Session A

```
completedOrders (paidSessionSyncId == "session-A"):
  ord-2: 30.000
  ord-3: 50.000
  ord-4: 50.000
total_sales = 130.000 ✅

pendingOrders (originSessionSyncId == "session-A" AND isShow != false):
  → 0 pending (Order 1 isShow=false)
outstanding_bill = 0 ✅

outstanding_bill_payment (origin != paid):
  → semua origin == paid (same session)
outstanding_bill_payment = 0 ✅

payment_methods:
  Cash: 30.000 + 50.000 + 50.000 = 130.000 ✅

topups: [
  { type: "cash", total_nominal: 100000 },
  { type: "transfer", total_nominal: 50000 }
]
topup_cash = 100.000 ✅

expected_cash = cash_started + total_sales + topup_cash
             = 200.000 + 130.000 + 100.000 = 430.000 ✅
```

### PendingDrawer

- **Bills:** — (Order 1 isShow=false) ✅
- **Orders:** ord-2, ord-3, ord-4 ✅
- **Shifts:** Session A ✅
- **Member:** topup-1, topup-2 ✅

### Sync Payload

```json
POST /sales/sync
{
  "session": { "sync_id": "session-A", "close_at": "..." },
  "orders": [
    {
      "sync_id": "ord-1",
      "status": "pending",
      "items": [A:5, B:5],
      "original_items": [A:10, B:5],
      "is_show": false,
      "origin_session_sync_id": "session-A",
      "paid_session_sync_id": ""
    },
    {
      "sync_id": "ord-2",
      "status": "completed",
      "items": [C:3],
      "original_items": [],
      "is_show": true,
      "origin_session_sync_id": "session-A",
      "paid_session_sync_id": "session-A"
    },
    {
      "sync_id": "ord-3",
      "status": "completed",
      "items": [A:5],
      "original_items": [],
      "is_show": true,
      "origin_session_sync_id": "session-A",
      "paid_session_sync_id": "session-A"
    },
    {
      "sync_id": "ord-4",
      "status": "completed",
      "items": [A:5, B:5],
      "original_items": [],
      "is_show": true,
      "origin_session_sync_id": "session-A",
      "paid_session_sync_id": "session-A"
    }
  ],
  "topups": [
    { "nominal": 100000, "payment_type": "cash", "member_name": "Budi" },
    { "nominal": 50000, "payment_type": "transfer", "member_name": "Siti" }
  ]
}
```

**Server interpretation:**
- `total_sales` = 30.000 + 50.000 + 50.000 = 130.000 ✅
- `outstanding_bill` = 0 (is_show=false) ✅
- `outstanding_bill_payment` = 0 (origin == paid semua) ✅
- `original_items` ord-1: A:10, B:5 → tau original pending ✅
- `topups`: 100.000 cash + 50.000 transfer ✅
- `expected_cash` = 200.000 + 130.000 + 100.000 = 430.000 ✅

---

## Field Rule Summary

| Field | Pending | Completed |
|-------|---------|-----------|
| `originSessionSyncId` | session saat dibuat (tetap) | session saat dibuat (tetap) |
| `paidSessionSyncId` | `null` | session saat payment |
| `isShow` | `true` (masih aktif) / `false` (lunas) | `true` |
| `originalItems` | snapshot items asli (TETAP) | `[]` (kosong) |
| `items` | current sisa | items yg dibayar |
