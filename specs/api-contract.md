# API Contract: SukaBread POS

> **Source:** `D:\Enigma\franq\backend\pos`
> **Base URL:** Configurable via `REST_SERVER` env var (e.g., `https://api.onward.co.id/pos`)
> **Auth:** JWT Bearer token in `Authorization` header (except `/auth/login`)
> **Content-Type:** `application/json`

---

## 1. Authentication

### POST `/auth/login`

Public endpoint. No auth required.

#### Request
```json
{
  "identifier": "string (required)",
  "password": "string (required)"
}
```

#### Response `200`
```json
{
  "user": {
    "id": "uuid",
    "brand_id": "uuid",
    "outlet_id": "uuid",
    "username": "string",
    "name": "string",
    "role": "string — e.g. 'kasir', 'manager'",
    "is_active": true,
    "last_activity_at": "datetime|null",
    "created_at": "datetime",
    "updated_at": "datetime"
  },
  "sales_session": {
    "id": "uuid|null",
    "outlet_id": "uuid",
    "cashier_id": "uuid",
    "transaction_date": "date",
    "started_at": "datetime",
    "finished_at": "datetime|null",
    "cash_started": 0.0,
    "cash_finished": 0.0,
    "status": "opened|closed",
    "latitude": 0.0,
    "longitude": 0.0,
    "battery_health": "string|null",
    "outlet": {},
    "cashier": {}
  },
  "access_token": "string (JWT)",
  "refresh_token": "string (JWT)"
}
```

#### Notes
- Login uses **username only** (NOT card ID) — queries `users` table by username
- Jika user tidak memiliki sales session aktif → `sales_session` = `null`
- Jika user memiliki sales session aktif → `sales_session` berisi session yg sedang berjalan

---

## 2. Profile

All endpoints require Bearer token.

### GET `/profile/me`

Returns current user + optional active sales session. **No tokens returned** (tokens only in login response).

#### Response `200`
```json
{
  "user": {},
  "sales_session": {}
}
```

### PUT `/profile/me`

Update profile name/password.

#### Request
```json
{
  "name": "string (required)",
  "password": "string (optional, min 6 chars)",
  "confirm_password": "string (optional, must match password)"
}
```

#### Response `200`
```json
{
  "id": "uuid",
  "name": "string"
}
```

---

## 3. Catalog

All endpoints require Bearer token. Pricing is filtered by outlet + sales channel.

### GET `/catalog`

Query params:

| Param | Type | Description |
|-------|------|-------------|
| `page` | int | Page number (default 1) |
| `limit` | int | Items per page (default 10) |
| `sales_channel_id` | uuid | **Required** — Filter by sales channel |
| `category_id` | uuid | Filter by category |
| `q` | string | Search by name/code |

#### Response `200`
```json
{
  "data": [
    {
      "id": "uuid",
      "category_id": "uuid",
      "category_name": "string",
      "code": "string",
      "name": "string",
      "image": "string (URL)",
      "is_custom": false,
      "is_vatable": false,
      "is_additional": false,
      "base_price": 0.0,
      "unit_price": 0.0
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPage": 10
  }
}
```

### GET `/catalog/{id}`

#### Response `200`
```json
{
  "id": "uuid",
  "category_id": "uuid",
  "category_name": "string",
  "code": "string",
  "name": "string",
  "image": "string",
  "is_custom": false,
  "is_vatable": false,
  "is_additional": false,
  "base_price": 0.0,
  "unit_price": 0.0,
  "addons": [
    {
      "id": "uuid",
      "name": "string",
      "type": "string — e.g. 'quantity'",
      "items": [
        {
          "id": "uuid",
          "code": "string",
          "name": "string",
          "image": "string",
          "unit_price": 0.0
        }
      ]
    }
  ]
}
```

### POST `/catalog`

Create custom catalog item. Auto-generates pricing for ALL sales channels + `catalog_outlet` entry.

#### Request
```json
{
  "category_id": "uuid (required)",
  "name": "string (required)",
  "price": 0.0 (required, > 0),
  "image": "string (optional)"
}
```

### GET `/category`

Query params: `page`, `limit`, `status` (active/inactive)

#### Response `200`
```json
{
  "data": [
    {
      "id": "uuid",
      "ref_id": "uuid",
      "brand_id": "uuid",
      "name": "string",
      "is_active": true,
      "created_at": "datetime",
      "updated_at": "datetime"
    }
  ],
  "meta": {}
}
```

---

## 4. Sales Session

All endpoints require Bearer token.

### POST `/sales/session`

Open a new sales session. Records device info for tracking.

#### Request
```json
{
  "cash_started": 0.0 (required),
  "latitude": 0.0 (optional),
  "longitude": 0.0 (optional),
  "battery_health": "string (optional)"
}
```

#### Response `200`
```json
{
  "id": "uuid",
  "outlet_id": "uuid",
  "cashier_id": "uuid",
  "transaction_date": "date",
  "started_at": "datetime",
  "cash_started": 0.0,
  "latitude": 0.0,
  "longitude": 0.0,
  "battery_health": "string",
  "status": "opened"
}
```

### PUT `/sales/session/close`

Close current sales session.

#### Request
```json
{
  "cash_finished": 0.0
}
```

#### Response `200`
```json
{
  "id": "uuid",
  "status": "closed",
  "cash_finished": 0.0,
  "finished_at": "datetime"
}
```

### PUT `/sales/session/device`

Update device tracking info for current active session. Records history in `sales_session_device_log` table.

#### Request
```json
{
  "latitude": 0.0 (optional),
  "longitude": 0.0 (optional),
  "battery_health": "string (optional)"
}
```

#### Response `200`
```json
{
  "message": "Device info updated"
}
```

### GET `/sales/session`

Query params: `page`, `limit`, `status`, `outlet_id`, `cashier_id`, `start_date`, `end_date`

Returns paginated sessions.

### GET `/sales/session/summary`

Returns current active session with full summary data.

#### Response `200`
```json
{
  "id": "uuid",
  "outlet_id": "uuid",
  "cashier_id": "uuid",
  "transaction_date": "date",
  "started_at": "datetime",
  "finished_at": "datetime|null",
  "cash_started": 0.0,
  "cash_finished": 0.0,
  "status": "opened",
  "latitude": 0.0,
  "longitude": 0.0,
  "battery_health": "string|null",
  "outlet": {},
  "cashier": {},
  "summary": {
    "sales": {
      "total_sales": 0.0,
      "total_discount": 0.0,
      "total_after_discount": 0.0,
      "total_service": 0.0,
      "grand_total": 0.0,
      "outstanding_bill": 0.0,
      "outstanding_bill_payment": 0.0
    },
    "payment_method": [
      {
        "name": "string",
        "total_paid": 0.0
      }
    ],
    "category_sold": [
      {
        "category_name": "string",
        "total_qty": 0.0,
        "total_charges": 0.0
      }
    ],
    "topup": [
      {
        "type": "string — 'topup'|'bonus'",
        "total_nominal": 0.0
      }
    ],
    "cash": {
      "expected_cash": 0.0,
      "topup_cash": 0.0
    }
  }
}
```

#### Summary Structure

| Field | Source | Description |
|-------|--------|-------------|
| `sales` | Aggregated from orders | Total sales, discounts, service charge, grand total, outstanding bills |
| `payment_method` | Grouped by payment method | Per-method totals from completed orders |
| `category_sold` | Grouped by category | Quantity and charges per product category |
| `topup` | Grouped by type | Member top-up and bonus totals |
| `cash` | Calculated | Expected cash = grand total (cash) - topup disbursed; topup cash = cash topups |

### GET `/sales/session/{id}`

Returns session with orders.

---

## 5. Sales Order

All endpoints require Bearer token. Most require active sales session.

### Pricing Calculation

| Component | Formula |
|-----------|---------|
| `unit_base` | Unit price from pricing |
| `unit_bill` | Quantity × unit_base (before tax) |
| `unit_taxed` | = `unit_bill` (tax base amount) |
| `unit_tax` | `unit_taxed` × 0.11 (PPN 11%) — only if `catalog.is_vatable` |
| `unit_nett` | `unit_bill` + `unit_tax` — if not vatable, = `unit_bill` |
| `unit_gross` | `unit_nett` / 1.1 (for rounding reconciliation) |
| Discount | Applied to `unit_nett` before totaling |
| Service charge | `outlet.service_charges` % applied to total after discount |
| Addon pricing | addon quantity = item quantity × addon quantity; unit_price × addon quantity |

Tax logic:
- `catalog.is_vatable` flag controls whether PPn 11% is applied
- Non-vatable items: `unit_tax = 0`, `unit_nett = unit_bill`

### Shared Payload Types

#### Item Request
```json
{
  "id": "uuid (optional, for update)",
  "catalog_id": "uuid (required)",
  "quantity": 1.0 (required, > 0),
  "unit_price": 0.0 (optional, for custom catalog only),
  "catalog_name": "string (optional, for custom catalog only)",
  "addons": [
    {
      "addon_group_id": "uuid (required)",
      "addon_item_id": "uuid (required)",
      "quantity": 1.0 (optional, default 1)
    }
  ]
}
```

#### Category Discount Request
```json
{
  "category_id": "uuid (required)",
  "discount_percentage": 0.0 (optional),
  "discount_value": 0.0 (optional)
}
```

Validates: category must be used by items in order, prevents duplicate category discounts.

#### Sales Order Response
```json
{
  "id": "uuid",
  "session_id": "uuid",
  "sales_channel_id": "uuid",
  "payment_method_id": "uuid|null",
  "membership_id": "uuid|null",
  "code": "string — ORD-YYYYMMDD-XXXX",
  "ref_id": "uuid|null",
  "bill_name": "string",
  "status": "pending|completed|cancelled",
  "discount_percentage": 0.0,
  "discount_value": 0.0,
  "service_charge_percentage": 0.0,
  "service_charge_value": 0.0,
  "subtotal_tax": 0.0,
  "subtotal_taxed": 0.0,
  "subtotal_gross": 0.0,
  "subtotal_nett": 0.0,
  "total_bill": 0.0,
  "total_charges": 0.0,
  "total_payment": 0.0,
  "cost_goods": 0.0,
  "is_discount_percentage": false,
  "is_category_discount": false,
  "cancelled_reason": "string|null",
  "cancelled_by": "uuid|null",
  "cancelled_at": "datetime|null",
  "paid_at": "datetime|null",
  "paid_session_id": "uuid|null",
  "created_at": "datetime",
  "updated_at": "datetime",
  "session": {},
  "sales_channel": {},
  "payment_method": {},
  "membership": {},
  "paid_session": {},
  "items": [
    {
      "id": "uuid",
      "catalog_id": "uuid",
      "additional_id": "uuid|null",
      "catalog_name": "string",
      "category_name": "string",
      "unit_base": 0.0,
      "unit_gross": 0.0,
      "unit_nett": 0.0,
      "unit_taxed": 0.0,
      "unit_tax": 0.0,
      "unit_bill": 0.0,
      "quantity": 1.0,
      "discount_percentage": 0.0,
      "discount_value": 0.0,
      "is_discount_percentage": false,
      "addons": [
        {
          "addon_group_id": "uuid",
          "addon_item_id": "uuid",
          "quantity": 1.0,
          "unit_price": 0.0,
          "total_price": 0.0
        }
      ]
    }
  ],
  "category_discounts": [
    {
      "category_id": "uuid",
      "category_name": "string",
      "discount_percentage": 0.0,
      "discount_value": 0.0
    }
  ],
  "payment": {}
}
```

### POST `/sales/order`

Create new order. **Requires active sales session.**

#### Request
```json
{
  "sales_channel_id": "uuid (required)",
  "payment_method_id": "uuid (optional)",
  "membership_id": "uuid (optional)",
  "payment_ref": "string (optional)",
  "bill_name": "string (optional)",
  "status": "pending|completed (required)",
  "discount_percentage": 0.0 (optional),
  "discount_value": 0.0 (optional),
  "total_payment": 0.0 (required if status=completed),
  "items": [
    {
      "catalog_id": "uuid (required)",
      "quantity": 1.0 (required),
      "unit_price": 0.0 (optional, for custom catalog),
      "catalog_name": "string (optional, for custom catalog)",
      "addons": []
    }
  ],
  "category_discounts": []
}
```

#### Checkout flow (when status=completed):
- Gateway payments (midtrans/qris) → status set to `pending`, wait for callback
- Cash/other → status set to `completed` immediately
- Jika order completed + membership_id diisi → deduct membership saldo (saldo_log reference_type = "sales")
- Sales session summary JSONB diperbarui

### PUT `/sales/order/{id}`

Update existing order items. **Full replacement** — items not included will be deleted.

#### Request
```json
{
  "bill_name": "string",
  "discount_percentage": 0.0,
  "discount_value": 0.0,
  "items": [],
  "category_discounts": []
}
```

### POST `/sales/order/{id}/checkout`

Checkout/process payment for an order. **Requires active sales session.**

#### Request
```json
{
  "payment_method_id": "uuid (required)",
  "membership_id": "uuid (optional)",
  "payment_ref": "string (optional)",
  "bill_name": "string (optional)",
  "discount_percentage": 0.0 (optional),
  "discount_value": 0.0 (optional),
  "total_payment": 0.0 (required, must be >= subtotal + service charge - discount),
  "items": [
    {
      "id": "uuid (optional, for partial pay)",
      "catalog_id": "uuid (required)",
      "quantity": 1.0 (required),
      "addons": []
    }
  ],
  "category_discounts": []
}
```

#### Payment Methods & Status Logic

| Provider | Status Set By Backend | Note |
|----------|----------------------|------|
| `midtrans` | `pending` | Wait for callback from franq-payment-gateway |
| `qris` | `pending` | Wait for callback from franq-payment-gateway |
| Others (cash, etc.) | `completed` | Immediate |

#### Partial Payment

If items in checkout differ from original order:
- Paid items → cloned to a new completed order (`ref_id` links back to original)
- Remaining items → stay as pending on original order

### PUT `/sales/order/{id}/cancel`

Cancel order. **Requires manager password.** Reverts membership saldo deduction if applicable.

#### Request
```json
{
  "cancelled_reason": "string (required)",
  "password": "string (required) — manager's password/pin"
}
```

#### Response `200`
```json
{
  "message": "Order cancelled successfully"
}
```

### GET `/sales/order/openbill`

List all pending (unpaid) orders for current session.

Query params: `page`, `limit`

### GET `/sales/order/{id}`

Get full order detail with items, addons, category discounts, membership, paid session, and payment info.

---

## 6. Membership

All endpoints require Bearer token.

### GET `/membership`

Query params: `page`, `limit`, `q` (search by name or card_id)

### GET `/membership/{id}`

### POST `/membership`

#### Request
```json
{
  "card_id": "string (required, unique per brand)",
  "name": "string (required, unique per brand)",
  "reff_code": "string (optional)"
}
```

### PUT `/membership/{id}`

#### Request
```json
{
  "name": "string (required)",
  "reff_code": "string (optional)"
}
```

### DELETE `/membership/{id}`

Soft delete.

#### Response `200`
```json
{
  "message": "Member deleted successfully"
}
```

---

## 7. Balance (Member Topup)

All endpoints require Bearer token.

### GET `/balance`

Query params: `card_id` — lookup by card ID

Returns membership balance info.

### GET `/balance/{id}/log`

Query params: `page`, `limit`

Returns balance mutation history (saldo_log).

### POST `/balance/{id}/topup`

**Requires active sales session.**

#### Flow
1. gRPC call to franchisor-api to get bonus percentage
2. Creates `saldo_log` entry for top-up nominal
3. Creates `saldo_log` entry for bonus (if bonus percentage > 0)
4. Publishes `MembershipTopup` event via RabbitMQ
5. Updates sales session summary JSONB

#### Request
```json
{
  "nominal": 0.0 (required, > 0),
  "payment_type": "cash|transfer (required)"
}
```

---

## 8. Delivery Module

All endpoints require Bearer token.

### GET `/delivery/plan?ref_code=`

Look up delivery plan by reference code from franchisor. No session required.

#### Query Params
| Param | Type | Description |
|-------|------|-------------|
| `ref_code` | string | **Required** — Delivery reference code |

#### Response `200`
```json
{
  "data": {
    "ref_code": "string",
    "status": "string",
    "items": []
  }
}
```

### POST `/delivery/receive`

Receive delivery items for a delivery plan. **Requires active sales session.**

#### Request
```json
{
  "ref_code": "string (required)"
}
```

#### Response `200`
```json
{
  "message": "Delivery received successfully"
}
```

---

## 9. Utility Endpoints

All endpoints require Bearer token.

### GET `/payment-method`

Returns list of payment methods for the brand.

#### Response `200`
```json
{
  "data": [
    {
      "id": "uuid",
      "ref_id": "uuid",
      "brand_id": "uuid",
      "name": "string — e.g. 'Tunai', 'QRIS', 'Midtrans'",
      "provider": "string — e.g. 'midtrans', 'qris', ''",
      "type": "string — e.g. 'cash', 'digital'",
      "account_name": "string",
      "account_number": "string",
      "is_member_payment": false,
      "is_active": true
    }
  ]
}
```

### GET `/sales/channel`

Returns list of sales channels for the brand.

#### Response `200`
```json
{
  "data": [
    {
      "id": "uuid",
      "ref_id": "uuid",
      "brand_id": "uuid",
      "name": "string — e.g. 'Dine In', 'Take Away', 'Delivery'",
      "is_active": true
    }
  ]
}
```

---

## 10. Error Response Format

### Validation Error
```json
{
  "code": 422,
  "status": "Unprocessable Entity",
  "errors": {
    "field_name": "error message",
    "field_name2": "error message"
  }
}
```

### Unauthorized
```json
{
  "code": 401,
  "status": "Unauthorized",
  "errors": {}
}
```

### Forbidden
```json
{
  "code": 403,
  "status": "Forbidden",
  "errors": {}
}
```

### Not Found
```json
{
  "code": 404,
  "status": "Not Found",
  "errors": {}
}
```

---

## 11. Entity Relationship Summary

```
Brand 1──N Outlet 1──N SalesSession 1──N SalesOrder
  │                      │   ├── SalesSessionSummary (JSONB)
  │                      │   └── SalesSessionDeviceLog
  │                      │                    ├── SalesOrderItem 1──N SalesOrderItemAddon
  │                      │                    ├── SalesOrderCategoryDiscount
  │                      │                    └── Payment (from franq-payment-gateway)
  │                      └── Cashier (User)
  │
  ├──N Category 1──N Catalog
  │                       ├── CatalogOutlet (per outlet)
  │                       ├── CatalogPricing (per sales channel)
  │                       ├── CatalogAddonGroup 1──N CatalogAddonItem
  │                       └── CatalogIngredient
  │
  ├──N SalesChannel
  ├──N PaymentMethod
  ├──N Membership 1──N SaldoLog
  ├──N User
  └──N DeliveryReceive ─── DeliveryPlan (via gRPC to franchisor-api)
```

---

## 12. Auth Header

```
Authorization: Bearer <access_token>
```

JWT Claims (`PosSessionClaims`):
```json
{
  "user_id": "uuid",
  "username": "string",
  "display_name": "string",
  "brand_id": "uuid",
  "outlet_id": "uuid",
  "role": "string"
}
```

Claims extend `common.SessionClaims` from the engine framework.

---

## 13. Business Logic Notes

### Tax (PPN 11%)
- Rate: 11% (flat)
- Applied only when `catalog.is_vatable = true`
- `unit_taxed = unit_bill` (tax base = bill amount)
- `unit_tax = unit_taxed × 0.11`
- `unit_nett = unit_bill + unit_tax` (for vatable items)
- `unit_nett = unit_bill` (for non-vatable items)
- `unit_gross = unit_nett / 1.1` (for rounding reconciliation)

### Service Charge
- Percentage sourced from `outlet.service_charges` field
- Applied to total after discount

### Category Discounts
- Must validate category is used by at least one item in the order
- Prevents duplicate category discounts (only one discount per category)
- Supports both percentage and fixed value discounts

### Custom Catalog Items
- Auto-generates pricing entries for ALL sales channels
- Auto-creates `catalog_outlet` entry for the outlet
- Uses `unit_price` and `catalog_name` from item request instead of base catalog

### Membership Balance
- Checkout with membership → deducts balance (saldo_log with `reference_type = "sales"`)
- Cancel order → reverts the deduction
- Topup → calls franchisor-api via gRPC for bonus %, creates saldo_log entries, publishes `MembershipTopup` event

### Order Status Flow
```
pending ──checkout──► completed
  │                       │
  └──cancel──► cancelled  └──cancel──► cancelled
```

### Partial Payment
When items in checkout differ from original:
- Paid items cloned to new completed order with `ref_id` pointing to original
- Remaining items stay `pending` on original order

---

*Document generated from `D:\Enigma\franq\backend\pos` source code (all .go files). Updated 2026-07-06.*
