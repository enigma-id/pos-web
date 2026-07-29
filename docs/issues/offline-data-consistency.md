# Offline/Online Data Consistency

> Memperbaiki inkonsistensi shape data antara offline cache (localStorage + IndexedDB) dengan server schema.

## Implementation Rules

1. **Ada issues / error** → `console.log(data)` dulu, jangan tebak-nebak
2. **Data missing atau gak tampil sesuai** → konfirmasi ke Naufal, jangan asumsi

## Target Shape

Semua offline data (cache, IDB, success modal) harus sama persis dengan response server:

<details>
<summary>Bill (Order) — server schema</summary>

```
Bill:
  id:                          string (UUID_ZERO)
  sync_id:                     string (UUID)
  ref_id:                      string (UUID_ZERO)
  session_id:                  string (UUID_ZERO)
  sales_channel_id:            string (UUID)
  payment_method_id:           string (UUID_ZERO)
  membership_id:               string (UUID_ZERO)
  code:                        string
  payment_ref:                 string
  bill_name:                   string
  subtotal_tax:                number
  subtotal_taxed:              number
  subtotal_gross:              number
  subtotal_nett:               number
  total_bill:                  number
  discount_percentage:         number
  discount_value:              number
  service_charge_percentage:   number
  service_charge_value:        number
  total_charges:               number
  total_payment:               number
  cost_goods:                  number
  status:                      "pending" | "completed"
  is_discount_percentage:      boolean
  cancelled_reason:            string
  cancelled_by:                string
  cancelled_at:                string (DATE_ZERO)
  paid_at:                     string (DATE_ZERO)
  paid_session_id:             string (UUID_ZERO)
  created_at:                  string (ISO)
  updated_at:                  string (ISO)
  is_category_discount:        boolean
  is_offline_mode:             boolean
  is_synced:                   boolean
  session:                     Session
  sales_channel:               SalesChannel
  items:                       Item[]
  category_discounts:          CategoryDiscount[]
  payment:                     Payment
```

</details>

<details>
<summary>Payment — server schema</summary>

```
Payment:
  id:              string (UUID)
  transaction_id:  string (UUID)
  amount:          number
  status:          string ("settlement")
  method:          string ("cash")
  created_at:      string (ISO)
```

</details>

<details>
<summary>Item — server schema</summary>

```
Item:
  id:                    string (UUID_ZERO)
  order_id:              string (UUID)
  catalog_id:            string (UUID)
  catalog_name:          string
  category_name:         string
  unit_base:             number
  unit_gross:            number
  discount_percentage:   number
  discount_value:        number
  is_discount_percentage: boolean
  unit_nett:             number
  unit_tax:              number
  unit_taxed:            number
  unit_bill:             number
  quantity:              number
  catalog:               Catalog
  addons:                Addon[]
```

</details>

<details>
<summary>Addon — server schema</summary>

```
Addon:
  id:                    string (UUID_ZERO)
  order_id:              string (UUID)
  additional_id:         string (UUID_ZERO)
  addon_group_id:        string (UUID)
  catalog_id:            string (UUID)
  catalog_name:          string
  category_name:         string
  unit_base:             number
  unit_gross:            number
  discount_percentage:   number
  discount_value:        number
  is_discount_percentage: boolean
  unit_nett:             number
  unit_tax:              number
  unit_taxed:            number
  unit_bill:             number
  quantity:              number
  addon_group:           { id, name, type }
  catalog:               { id, name, unit_price }
```

</details>

<details>
<summary>CategoryDiscount — server schema</summary>

```
CategoryDiscount:
  category_id:            string
  is_discount_percentage: boolean
  discount_percentage:    number
  discount_value:         number
  category:               { name: string }
```

</details>

<details>
<summary>Session — server schema</summary>

```
Session:
  id:                string (UUID)
  sync_id:           string (UUID_ZERO)
  outlet_id:         string (UUID)
  cashier_id:        string (UUID)
  transaction_date:  string (ISO date)
  started_at:        string (ISO datetime)
  finished_at:       string (ISO / null)
  cash_started:      number
  cash_finished:     number
  status:            "opened" | "closed"
  latitude:          number
  longitude:         number
  battery_health:    string
  is_synced:         boolean
  created_at:        string (ISO)
  updated_at:        string (ISO / DATE_ZERO)
  outlet:            Outlet
  cashier:           Cashier

Outlet:
  id:               string (UUID)
  ref_id:           string (UUID)
  brand_id:         string (UUID)
  outlet_type_id:   string (UUID)
  name:             string
  recipient_name:   string
  phone:            string
  address:          string
  region_id:        string (UUID)
  service_charges:  number (0.1 = 10%)
  is_active:        boolean
  created_at:       string (ISO)
  updated_at:       string (ISO / DATE_ZERO)
  brand:            Brand

Cashier:
  id:                string (UUID)
  brand_id:          string (UUID)
  outlet_id:         string (UUID)
  username:          string
  name:              string
  role:              string ("cashier" | "manager")
  is_active:         boolean
  last_activity_at:  string (ISO / null)
  created_at:        string (ISO)
  updated_at:        string (ISO / DATE_ZERO)

Brand:
  id:         string (UUID)
  ref_id:     string (UUID)
  name:       string
  address:    string
  phone:      string
  email:      string
  logo_url:   string
  is_active:  boolean
  created_at: string (ISO)
  updated_at: string (ISO / DATE_ZERO)
```

</details>

<details>
<summary>SessionSummary — server schema</summary>

```
SessionSummary:
  id:         string (UUID)
  session_id: string (UUID)
  sales:      SalesSummary
  payment_methods: PaymentMethodSummary[]
  category_solds: CategorySold[]
  topups:     TopupSummary[]
  cash:       CashSummary
  updated_at: string (ISO)

SalesSummary:
  total_sales:              number
  total_discount:           number
  total_after_discount:     number
  total_service:            number
  grand_total:              number
  outstanding_bill:         number
  outstanding_bill_payment: number

PaymentMethodSummary:
  name:       string
  total_paid: number

CategorySold:
  category_name: string
  total_qty:     number
  total_charges: number

TopupSummary:
  type:          string ("cash" | "transfer")
  total_nominal: number

CashSummary:
  expected_cash: number
  topup_cash:    number
```

</details>

## Zero-value Convention

| Type | Value |
|------|-------|
| UUID | `00000000-0000-0000-0000-000000000000` |
| Datetime | `0001-01-01T00:00:00Z` |
| String | `""` |
| Number | `0` |
| Boolean | `false` |

## Fields yang HARUS DIHAPUS

Semua field ini gak ada di server schema. Hapus dari `cache_openbills`, `cache_order_history`, dan `SuccessModal`.

| Field | Alasan |
|-------|--------|
| `needs_sync` | Ganti `is_synced: false` |
| `from_queue` | Pakai `is_offline_mode` |
| `offline_meta` | Internal, hapus |
| `is_show` / `isShow` | IDB-only, hapus dari cache |
| `original_items` / `originalItems` | IDB-only untuk split payment |
| `new_items` | UI-only success modal, bukan bill schema |
| `cashier_name` / `cashierName` (root) | Cashier di `session.cashier.name` |
| `payment_method_name` / `paymentMethodName` | Server cuma punya `payment_method_id` |
| `sales_channel_name` / `salesChannelName` | Ada di `sales_channel.name` |
| `origin_session_sync_id` | IDB-only |
| `paid_session_sync_id` | IDB-only |
| `itemSnapshot` | CartState lokal |
| `description` (item) | Gak ada di item schema |
| `billName` / `cashierName` / etc | HARAM camelCase |
| `totalPayment` / `paidAt` / etc | HARAM camelCase |

## Rules

| Poin | Aturan |
|------|--------|
| **Field** | snake_case, sesuai server schema |
| **UUID kosong** | `00000000-0000-0000-0000-000000000000`, bukan `""` |
| **Date kosong** | `0001-01-01T00:00:00Z`, bukan `null` |
| **status pending** | `"pending"`, bukan `"completed"` |
| **is_synced** | Ada di semua cache entry, bukan `needs_sync` |
| **Display default** | ✅ `\|\| '-'` / `\|\| 0` / `\|\| 'Cash'` — Safe |
| **Field alternatif** | ❌ `\|\| item?.catalog_name` / `\|\| item?.description` — HARAM |
| **Session `finished_at`** | Operator closes → `ISO`. Not yet → `null`, bukan `0001-01-01T00:00:00Z` |

### Pelanggaran paling umum

```
❌ needs_sync: true           → ganti is_synced: false
❌ status: 'completed'        → pake 'pending' untuk save-bill belum bayar
❌ paid_at: new Date()        → pake DATE_ZERO untuk pending
❌ id: ''                     → pake UUID_ZERO
❌ billName / discountValue   → bill_name / discount_value
❌ item?.catalog_name         → item?.catalog?.name || '-'
❌ item?.description          → item?.catalog?.name || '-'
❌ data?.session?.name        → data?.session?.cashier?.name || '-'
❌ data?.bill_name || note    → data?.bill_name || '-'
❌ add?.unit_price            → add?.unit_nett
❌ add?.catalog_name          → add?.catalog?.name
```

## Files to Modify

**Total: 19 files** (11 pages, 8 components)

### New files

| File | Isi |
|------|-----|
| `src/services/offline/constants.js` | `UUID_ZERO`, `DATE_ZERO` |
| `src/services/offline/shapes.js` | Builder functions untuk setiap shape |

### Pages (11)

| File | Perubahan |
|------|-----------|
| `src/pages/authorize/home/checkout.jsx` | 7 site konstruksi data — pake `shapes.js` |
| `src/pages/authorize/home/cart.jsx` | 4 site — pake `shapes.js` |
| `src/pages/authorize/home/saveBill.jsx` | Line 61: `bill?.needs_sync` → `bill?.is_synced === false`. Line 65: `bill?.ordered_at \|\| bill?.created_at` → `bill?.created_at \|\| '-'` |
| `src/pages/authorize/home/updateBillName.jsx` | Line 14: `data?.billName \|\| data?.bill_name` → `data?.bill_name \|\| '-'` |
| `src/pages/authorize/bills/index.jsx` | Consumer `Receipt`, `Kitchen`, `OrderDetails` — no change, fix di component |
| `src/pages/authorize/history/index.jsx` | Consumer `Receipt`, `Kitchen`, `OrderDetails` — no change |
| `src/pages/authorize/shifts/index.jsx` | Consumer `Receipt`, `Kitchen`, `OrderDetails`, `Summary` — no change |
| `src/pages/authorize/membership/card.content.jsx` | Topup — `createTopup` call, shape udah snake_case ✅ |
| `src/pages/authorize/membership/history.jsx` | Consumer `OrderDetails` — no change |
| `src/pages/authorize/home/detail.jsx` | Catalog detail — `catalog?.unit_price`, gak ada bill field ✅ |
| `src/pages/authorize/home/index.jsx` | Gak ada bill field ✅ |

### Components (8)

| File | Perubahan |
|------|-----------|
| `src/components/ui/receipt.jsx` | Hapus fallback field alternatif |
| `src/components/ui/order.jsx` | Hapus fallback field alternatif |
| `src/components/ui/kitchen.jsx` | Hapus fallback field alternatif |
| `src/components/ui/offline/PendingDrawer.jsx` | Hapus fallback field alternatif |
| `src/components/ui/copy_order.jsx` | Line 45-46: ✅ udah `\|\| '-'`, aman. Line 49: ✅ `detail?.total_charges` |
| `src/components/ui/summary.jsx` | Session summary — ✅ pake `data?.cashier?.name`, `data?.summary?.sales?.*` |
| `src/components/ui/table/list.jsx` | Session table — ✅ `row?.cashier?.name`, `row?.status` |
| `src/components/ui/keypad.jsx` | Gak ada bill field ✅ |

### Services (5)

| File | Perubahan |
|------|-----------|
| `src/services/cart/slice.js` | `loadOfflineBill` — tambah field item yg hilang |
| `src/services/offline/queue.js` | Tambah `is_synced`, snake_case |
| `src/services/offline/localTransaction.js` | Hapus `description`, `offline_meta`, ID pake `UUID_ZERO` |
| `src/services/offline/syncManager.js` | Migration data lama + hapus fallback `\|\|` |
| `src/services/sales/session/hook.js` | Standarisasi `updateSessionSummary` + shifts cache |

## Consumer Fix Detail

### `receipt.jsx`

```
Line 39 — ❌ data?.session?.cashier?.name || data?.session?.name
           ✅ data?.session?.cashier?.name || '-'

Line 79 — ❌ item?.catalog?.name || item?.catalog_name
           ✅ item?.catalog?.name || '-'

Line 95 — ❌ addon?.catalog?.name || addon?.catalog_name
           ✅ addon?.catalog?.name || '-'

Line 103-104 — ❌ addon?.quantity * addon?.unit_nett
                  : item?.quantity * addon?.unit_nett
                ✅ addon?.quantity * addon?.unit_nett

Line 172 — ✅ data?.payment_method?.name || 'Cash' — keep
```

### `order.jsx`

```
Line 24 — ❌ data?.bill_name || data?.note
           ✅ data?.bill_name || '-'

Line 46 — ❌ item?.catalog?.name || item?.catalog_name || item?.description
           ✅ item?.catalog?.name || '-'

Line 69 — ❌ addon?.catalog_name
           ✅ addon?.catalog?.name || '-'

Line 70 — ✅ addon?.unit_nett || 0 — keep
Line 136 — ✅ data?.payment_method?.name || 'Cash' — keep
```

### `kitchen.jsx`

```
Line 45 — ❌ data?.session?.cashier?.name || data?.session?.name
           ✅ data?.session?.cashier?.name || '-'

Line 111 — ❌ item?.catalog?.name || item?.catalog_name || item?.description
            ✅ item?.catalog?.name || '-'

Line 119 — ❌ addon?.catalog_name
            ✅ addon?.catalog?.name || '-'
```

### `PendingDrawer.jsx`

```
Line 281 — ❌ preview?.cashier?.name || preview?.session?.cashier?.name || '-'
            ✅ preview?.cashier?.name || '-'

Line 285 — ❌ p.unit_nett || p.unit_price || 0
            ✅ p.unit_nett || 0

Line 286 — ❌ a.unit_nett || a.unit_price || 0
            ✅ a.unit_nett || 0

Line 412 — ❌ preview?.bill_name || item?.bill_name || cashierName
            ✅ preview?.bill_name || '-'

Line 439 — ❌ product.catalog?.name || product.catalog_name || product.description || 'Unknown Item'
            ✅ product.catalog?.name || '-'

Line 449 — ❌ add.catalog_name || add.catalog?.name || add.name || ''
            ✅ add.catalog?.name || '-'

Line 450 — ❌ add.unit_price || add.unit_nett || 0
            ✅ add.unit_nett || 0
```

## Verification

1. Buat bill offline → cek `cache_openbills`: snake_case, `status: 'pending'`, `paid_at = DATE_ZERO`, UUID = `UUID_ZERO`, gak ada `needs_sync`/`from_queue`/camelCase
2. Bayar bill offline → cek `cache_order_history`: consistent shape
3. Buka PendingDrawer → semua item/addon render tanpa error
4. Print receipt & kitchen → semua field muncul bener
5. Sync online → server accept
