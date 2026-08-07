# POS — Offline Mode Sync

## Problem

POS sudah punya `IsOfflineMode` di `SalesOrder` untuk skip validasi saldo member. Tapi **belum ada mekanisme sync** — device bisa offline/online berkali-kali, data yang numpuk harus dikirim ke server.

## Scope

- **Service:** `backend/pos/` (service-pos)
- **Database:** `db_franchise` (shared dengan franchise-api)
- **Endpoint:** `POST /sales/sync`

### Proses bisnis yang ditangani

| Proses | Online | Offline Sync |
|--------|--------|--------------|
| Open session | ✅ | ✅ |
| Create order (pending) | ✅ | ✅ |
| Checkout order (pending→completed) | ✅ | ✅ |
| Split payment & update order qty | ✅ | ✅ (via `ref_sync_id` + `id`) |
| Close session | ✅ | ✅ |
| Stock ingredient deduction | ✅ | ✅ (inline dalam Tx) |
| Saldo member deduction | ✅ | ✅ (inline dalam Tx) |
| Session summary recalculation | ✅ | ✅ (aggregated 1x di akhir) |
| Create member | ✅ | ✅ |
| Topup member | ✅ | ✅ (bonus recalculate via gRPC) |

### Strategy

- **Sync adalah mekanisme kontinu.** Bisa dipanggil berkali-kali. Device offline → queue. Online → sync. Offline lagi → queue lagi. Online → sync lagi.
- Tiap request `/sales/sync` isinya **apapun yang numpuk sejak terakhir sync**.
- **1 transaksi database** per request. Rollback jika gagal.
- **Idempotent** via `sync_id` — retry aman.
- **Skip individual events** (`pos:sales.order.created` dll). Semua side effect di-handle inline.

---

## Endpoint

### `POST /sales/sync`

### Request

```json
{
  "session": {
    "sync_id": "550e8400-e29b-41d4-a716-446655440000",
    "id": "a1b2c3d4-...",
    "open_at": "2026-07-23T08:00:00Z",
    "cash_started": 200000,
    "latitude": -6.2,
    "longitude": 106.8,
    "battery_health": "85%",
    "close_at": "2026-07-23T17:00:00Z",
    "cash_finished": 1500000
  },
  "orders": [
    {
      "sync_id": "660e8400-e29b-41d4-a716-446655440001",
      "id": "",
      "session_sync_id": "550e8400-e29b-41d4-a716-446655440000",
      "sales_channel_id": "...",
      "payment_method_id": "...",
      "membership_id": "...",
      "payment_ref": "",
      "bill_name": "John Doe",
      "discount_percentage": 0,
      "discount_value": 0,
      "items": [
        {
          "catalog_id": "...",
          "catalog_name": "",
          "quantity": 2,
          "unit_price": 0,
          "addons": []
        }
      ],
      "category_discounts": [],
      "status": "completed",
      "total_payment": 50000,
      "paid_at": "2026-07-23T10:30:00Z",
      "is_offline_mode": true,
      "ref_sync_id": ""
    }
  ]
}
```

**Field notes:**

| Field | Wajib? | Keterangan |
|-------|--------|------------|
| `session` | Tidak | `null`/omit = orders-only sync |
| `session.sync_id` | Ya | Idempotency key, client-generated UUID |
| `session.id` | Tidak | Ada = refer ke existing server session. Tidak ada = session baru (create) |
| `session.open_at` | Jika session baru | Diabaikan jika `session.id` ada |
| `session.close_at` | Tidak | Ada = close session setelah orders diproses |
| `orders[].sync_id` | Ya | Idempotency key per order |
| `orders[].id` | Tidak | Ada = update existing order (split payment, qty change). Tidak ada = order baru |
| `orders[].session_sync_id` | Ya | `session.sync_id` (session baru) **atau** `session.id` (session existing) |
| `orders[].ref_sync_id` | Tidak | Ada = split payment, mengacu ke sync_id order lain di batch yang sama |
| `orders[].code` | Tidak | Ada = pake dari client (offline). Kosong = server generate (online) |
| `orders[].is_offline_mode` | Ya | `true` = skip membership saldo check |
| `memberships[]` | Tidak | Array of member baru |
| `memberships[].card_id` | Ya | Unique per brand |
| `memberships[].name` | Ya | Nama member |
| `topups[]` | Tidak | Array of topup |
| `topups[].membership_id` | Ya | Server UUID |
| `topups[].session_sync_id` | Ya | Refer session untuk saldo_log + summary |
| `topups[].nominal` | Ya | > 0 |
| `topups[].payment_type` | Ya | `cash` atau `transfer` |

### Response

```json
{
  "session": {
    "sync_id": "550e8400-e29b-41d4-a716-446655440000",
    "id": "a1b2c3d4-...",
    "is_new": true
  },
  "orders": [
    {
      "sync_id": "660e8400-e29b-41d4-a716-446655440001",
      "id": "e5f6g7h8-...",
      "is_new": true
    }
  ]
}
```

`is_new` = `true` jika baru dibuat, `false` jika sudah ada (idempotent hit). Topups & memberships tanpa sync_id — `card_id` unique constraint handle dedup, topup additive.

---

## Case Scenarios

### Ringkasan Siklus

```
Device offline → queue operasi lokal
Device online  → POST /sales/sync (kirim queue)
Device offline → queue lagi
Device online  → POST /sales/sync (kirim queue baru)
...
```

Setiap panggilan `/sales/sync` independent dan idempotent.

---

### Case 1: Open Online → Order Campuran → Close Offline

**Status di server:** Session sudah ada (online). Order 1 sudah ada (online). Order 2-4 & close hanya di device.

Device kirim 1 request: sync orders + close session.

```json
POST /sales/sync
{
  "session": {
    "sync_id": "sess-close-1",
    "id": "<real-session-uuid-dari-server>",
    "close_at": "2026-07-23T17:00:00Z",
    "cash_finished": 500000
  },
  "orders": [
    {
      "sync_id": "ord-2",
      "session_sync_id": "<real-session-uuid-dari-server>",
      ...
    },
    {
      "sync_id": "ord-3",
      "session_sync_id": "<real-session-uuid-dari-server>",
      ...
    },
    {
      "sync_id": "ord-4",
      "session_sync_id": "<real-session-uuid-dari-server>",
      ...
    }
  ]
}
```

Server detek `session.id` ada → pake session existing. Orders pake session UUID asli. 1 request, 1 Tx.

---

### Case 2: Open Offline → Order Online → Close Offline

3 tahap, terselip online di tengah.

**Tahap 1 — Sync session open:**

```json
POST /sales/sync
{
  "session": {
    "sync_id": "sess-1",
    "open_at": "2026-07-23T08:00:00Z",
    "cash_started": 200000,
    "latitude": -6.2,
    "longitude": 106.8
  },
  "orders": []
}
```

Response: `{ session: { sync_id: "sess-1", id: "<server-uuid>", is_new: true }, orders: [] }`

**Tahap 2 — Order online:**

Device pake `<server-uuid>` hasil sync sebagai session_id. Order 1,2,3 dibuat via `POST /sales/order` (online).

**Tahap 3 — Sync session close:**

```json
POST /sales/sync
{
  "session": {
    "sync_id": "sess-close-1",
    "id": "<server-uuid>",
    "close_at": "2026-07-23T17:00:00Z",
    "cash_finished": 1500000
  },
  "orders": []
}
```

Server detek `session.id` ada → update close.

---

### Case 3: Multiple Sessions (2x Open-Close)

Device mencatat 2 sesi terpisah. 2 request sync.

```json
POST /sales/sync
{
  "session": { "sync_id": "sess-A", "open_at": "...", ... },
  "orders": [
    { "sync_id": "ord-A1", "session_sync_id": "sess-A", ... }
  ]
}
```

```json
POST /sales/sync
{
  "session": { "sync_id": "sess-B", "open_at": "...", ... },
  "orders": [
    { "sync_id": "ord-B1", "session_sync_id": "sess-B", ... }
  ]
}
```

Masing-masing 1 request per session. Isolated transaction.

---

### Case 4: Split Payment (Online + Offline Campuran)

| Step | Proses | Status | Endpoint |
|------|--------|--------|----------|
| 1 | Open session: A-0, B-0, C-0 | ❌ Offline | `POST /sales/sync` |
| 2 | Order 1: A-10, B-15, C-30 | ✅ Online | `POST /sales/order` |
| 3 | Split: Order 1 sisa A-5, B-15. Order 2 (baru) A-5, C-30 payment | ❌ Offline | `POST /sales/sync` |
| 4 | Order 3: A-60, B-70 | ✅ Online | `POST /sales/order` |
| 5 | Split: Order 3 sisa A-50, B-20. Order 5 (baru) A-10, B-50 pending | ❌ Offline | `POST /sales/sync` |
| 6 | Split: Order 5 sisa A-5, B-5, C-5. Order 6 (baru) A-10, B-45, C-25 payment | ✅ Online | `POST /sales/order/{id}/checkout` |
| 7 | Close session | ✅ Online | `PUT /sales/session/close` |

**Split offline (step 3):**

```json
POST /sales/sync
{
  "session": null,
  "orders": [
    {
      "sync_id": "split-1a",
      "session_sync_id": "<server-session-uuid>",
      "id": "<order-1-server-uuid>",
      "items": [
        { "catalog_id": "A", "quantity": 5 },
        { "catalog_id": "B", "quantity": 15 }
      ],
      "status": "pending"
    },
    {
      "sync_id": "split-1b",
      "session_sync_id": "<server-session-uuid>",
      "id": "",
      "items": [
        { "catalog_id": "A", "quantity": 5 },
        { "catalog_id": "C", "quantity": 30 }
      ],
      "status": "completed",
      "total_payment": ...,
      "ref_sync_id": "split-1a",
      "is_offline_mode": true
    }
  ]
}
```

Server update Order 1 qty items. Create Order 2 (baru, `RefID = Order 1`).

---

### Case 5: Multi-Split Bertahap (Offline → Online → Offline)

| Step | Waktu | Aksi | Detail |
|------|-------|------|--------|
| 1 | ❌ Offline | Open session | Session ID temp |
| 2 | ❌ Offline | Create Order 1 | A-60, B-70, pending |
| 3 | ❌ Offline | Create Order 2 | A-10, B-20, pending |
| 4 | ❌ Offline | Create Order 3 | A-10, B-30, pending |
| **— online —** | | | |
| 5 | ✅ **Sync 1** | `POST /sales/sync` | Session + Order 1,2,3 → dapet server UUID |
| 6 | ✅ Online | `POST /sales/order` | Order 4: A-30, B-40, completed |
| **— offline —** | | | |
| 7 | ❌ Offline | Split Order 3 | A-5, B-5 dibayar. Sisa Order 3: A-5, B-25 |
| 8 | ❌ Offline | Bayar sisa Order 3 | A-5, B-25 dibayar |
| **— online —** | | | |
| 9 | ✅ **Sync 2** | `POST /sales/sync` | Split + pay results |

**Sync 1 (step 5):** — session + 3 orders pending

```json
POST /sales/sync
{
  "session": {
    "sync_id": "sess-1",
    "open_at": "2026-07-23T08:00:00Z",
    "cash_started": 200000
  },
  "orders": [
    {
      "sync_id": "ord-1",
      "session_sync_id": "sess-1",
      "items": [
        { "catalog_id": "A", "quantity": 60 },
        { "catalog_id": "B", "quantity": 70 }
      ],
      "status": "pending"
    },
    {
      "sync_id": "ord-2",
      "session_sync_id": "sess-1",
      "items": [
        { "catalog_id": "A", "quantity": 10 },
        { "catalog_id": "B", "quantity": 20 }
      ],
      "status": "pending"
    },
    {
      "sync_id": "ord-3",
      "session_sync_id": "sess-1",
      "items": [
        { "catalog_id": "A", "quantity": 10 },
        { "catalog_id": "B", "quantity": 30 }
      ],
      "status": "pending"
    }
  ]
}
```

Response mapping:
```json
{
  "session": { "sync_id": "sess-1", "id": "sess-uuid-1", "is_new": true },
  "orders": [
    { "sync_id": "ord-1", "id": "ord-uuid-1", "is_new": true },
    { "sync_id": "ord-2", "id": "ord-uuid-2", "is_new": true },
    { "sync_id": "ord-3", "id": "ord-uuid-3", "is_new": true }
  ]
}
```

**Order 4 Online (step 6):** — pake endpoint `POST /sales/order` biasa, refer `session_id = "sess-uuid-1"`.

**Sync 2 (step 9):** — split + bayar Order 3 secara offline

```json
POST /sales/sync
{
  "session": null,
  "orders": [
    {
      "sync_id": "split-3a",
      "session_sync_id": "sess-uuid-1",
      "id": "ord-uuid-3",
      "items": [
        { "catalog_id": "A", "quantity": 5 },
        { "catalog_id": "B", "quantity": 25 }
      ],
      "status": "pending"
    },
    {
      "sync_id": "pay-3a",
      "session_sync_id": "sess-uuid-1",
      "id": "",
      "items": [
        { "catalog_id": "A", "quantity": 5 },
        { "catalog_id": "B", "quantity": 5 }
      ],
      "status": "completed",
      "ref_sync_id": "split-3a",
      "total_payment": ...,
      "is_offline_mode": true
    },
    {
      "sync_id": "pay-3b",
      "session_sync_id": "sess-uuid-1",
      "id": "",
      "items": [
        { "catalog_id": "A", "quantity": 5 },
        { "catalog_id": "B", "quantity": 25 }
      ],
      "status": "completed",
      "ref_sync_id": "split-3a",
      "total_payment": ...,
      "is_offline_mode": true
    }
  ]
}
```

Proses server `split-3a`:
- `id = ord-uuid-3` → update qty item A: 10→5, B: 30→25
- RecalculateByOrderID

Proses `pay-3a` & `pay-3b`:
- `ref_sync_id = split-3a` → `RefID = ord-uuid-3`
- Insert baru + stock minus + saldo minus
- RecalculateByOrderID

**Ringkasan API calls:**
| Step | Endpoint | Isi |
|------|----------|-----|
| 5 | `POST /sales/sync` | session + Order 1,2,3 pending |
| 6 | `POST /sales/order` | Order 4 completed |
| 9 | `POST /sales/sync` | split + 2x pay Order 3 |

Total: **2x sync** + **1x order online**.

---

## Sync Flow (Internal)

```
func Sync(ctx, req) → (resp, error) {
    // 1. Resolve session
    if req.Session != nil {
        if req.Session.ID != "" {
            sessionUUID = req.Session.ID       // case: session existing
        } else {
            existing = sessionRepo.FindBySyncID(req.Session.SyncID)
            if existing != nil {
                sessionUUID = existing.ID       // idempotent
            } else {
                sessionUUID = ""                // session baru
            }
        }
    }

    // 2. Resolve orders idempotency
    for each order in req.Orders {
        existing = orderRepo.FindBySyncID(order.SyncID)
        if existing != nil {
            mapping[order.SyncID] = existing.ID
        }
    }

    // 3. Begin transaction
    Tx.Begin()

    // -- Session phase --
    if req.Session != nil {
        if sessionUUID == "" {
            Insert sales_session with sync_id
            Insert session_summary
            Insert device_log
        }
        if req.Session.CloseAt != "" {
            Update session: finished_at, cash_finished, status='closed'
        }
    }

    // -- Orders phase --
    for each order in req.Orders (yg baru) {
        Resolve sessionUUID dari session_sync_id (UUID langsung atau map dari sync_id)
        Map ref_sync_id → real RefID (split payment)
        if order.id ada → update qty items order existing
        else → insert order baru + items + category_discounts
        RecalculateByOrderID
        stockLogUsecase.SalesOrderCreated  → stock minus
        if completed + membership:
            membershipUsecase.Used → saldo minus
    }

    // -- Summary phase --
    Recalculate session summary 1x (aggregated SQL)
    Update session_summary row

    Tx.Commit()

    // 4. Return mapping
    return { session: { sync_id, id, is_new }, orders: [...] }
}
```

### Membership & Topup handling

Membership create & topup **diluar** session/orders Tx (independent operations).

```go
// 1. MEMBERSHIPS — insert langsung
for each membership in req.Memberships {
    mx := &entity.Membership{
        BrandID:   sessionUser.BrandID,
        CardID:    membership.CardID,
        Name:      membership.Name,
    }
    membershipUsecase.Create(mx)
    // card_id unique constraint handle duplicate → error kalo duplikat
}

// 2. TOPUPS — reuse existing Topup (gRPC bonus + Tx + event)
for each topup in req.Topups {
    // Resolve session from session_sync_id
    // Reuse MembershipUsecase.Topup()
    //   → gRPC GetTopupBonus → Tx: insert saldo_log + bonus_log → recalc saldo
    //   → publish pos:membership.topup → subscriber update session summary
    membershipUsecase.Topup(membership, nominal, paymentType, session)
}
```

---

## Idempotency

`sync_id` adalah UUID v4 yang digenerate client. Unique constraint di DB.

| Skenario | Deteksi | Action |
|----------|---------|--------|
| Session sync_id sudah ada | `sessionRepo.FindBySyncID()` | Skip insert, return existing mapping |
| Order sync_id sudah ada | `orderRepo.FindBySyncID()` | Skip insert, return existing mapping |
| Retry payload sama | Semua sync_id exist | Return mapping dengan `is_new: false` |

---

## Entity Changes

### `entity/sales_session.go`

```go
type SalesSession struct {
    // ... existing fields ...
    SyncID uuid.UUID `bun:"sync_id,unique,nullzero" json:"sync_id"`
}
```

### `entity/sales_order.go`

```go
type SalesOrder struct {
    // ... existing fields ...
    SyncID uuid.UUID `bun:"sync_id,unique,nullzero" json:"sync_id"`
}
```

---

## DB Migration

### `backend/franchise/migrations/20260723000000_offline_sync.up.sql`

```sql
ALTER TABLE sales_session ADD COLUMN sync_id UUID UNIQUE;
ALTER TABLE sales_order ADD COLUMN sync_id UUID UNIQUE;
```

### `backend/franchise/migrations/20260723000000_offline_sync.down.sql`

```sql
ALTER TABLE sales_session DROP COLUMN sync_id;
ALTER TABLE sales_order DROP COLUMN sync_id;
```

---

## File Changes

| File | Action |
|------|--------|
| `backend/pos/entity/sales_session.go` | Modify — add `SyncID` field |
| `backend/pos/entity/sales_order.go` | Modify — add `SyncID` field |
| `backend/franchise/migrations/20260723000000_offline_sync.up.sql` | **New** |
| `backend/franchise/migrations/20260723000000_offline_sync.down.sql` | **New** |
| `backend/pos/src/usecase/factory.go` | Modify — add `SalesSync *SalesSyncUsecase` |
| `backend/pos/src/usecase/sales_sync.go` | **New** — core sync logic |
| `backend/pos/src/handler/rest/sales/sync/handler.go` | **New** — route registration |
| `backend/pos/src/handler/rest/sales/sync/request_sync.go` | **New** — request struct, validation, execute |
| `backend/pos/src/handler.go` | Modify — register sync routes |
| `backend/pos/src/usecase/sales_sync.go` | Modify — add membership + topup processing |
| `backend/pos/src/handler/rest/sales/sync/request_sync.go` | Modify — add membership + topup req/resp |
| `docs/issues/pos-offline-sync.md` | Modify — this doc |
