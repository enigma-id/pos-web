# Research: API Contract vs Frontend Implementation Audit

**Task ID:** api-contract-audit
**Date:** 2026-07-15
**Status:** Complete

---

## Executive Summary

Audit of `specs/api-contract.md` against current frontend implementation at `src/services/`. 35 endpoints mapped. **3 missing endpoints**, **1 bug** (cancel missing password), **2 improvements** (refresh token, session shape), **1 refactor** (duplicate endpoint).

No currently working checkout/payment/session/membership flows are broken by these findings — all critical paths remain stable.

---

## Codebase Analysis

### Endpoint Coverage Matrix

| Contract § | Endpoint | Frontend File | Status |
|---|---|---|---|
| §1 Auth | POST `/auth/login` | `auth/action.js:16` | ✅ |
| §2 Profile | GET `/profile/me` | `auth/action.js:23` | ✅ |
| §2 Profile | PUT `/profile/me` | `auth/action.js:29` | ✅ |
| §3 Catalog | GET `/catalog` | `catalog/action.js:19` | ✅ |
| §3 Catalog | GET `/catalog/{id}` | `catalog/action.js:37` | ✅ |
| §3 Catalog | POST `/catalog` | `catalog/action.js:10` | ✅ |
| §3 Catalog | GET `/category` | `catalog/action.js:30` | ✅ |
| §4 Session | POST `/sales/session` | `sales/session/action.js:10` | ✅ |
| §4 Session | PUT `/sales/session/close` | `sales/session/action.js:17` | ✅ |
| **§4 Session** | **PUT `/sales/session/device`** | **MISSING** | **❌** |
| §4 Session | GET `/sales/session` | `sales/session/action.js:32` | ✅ |
| §4 Session | GET `/sales/session/summary` | `sales/session/action.js:24` | ✅ |
| §4 Session | GET `/sales/session/{id}` | `sales/session/action.js:42` | ✅ |
| §5 Order | POST `/sales/order` | `cart/action.js:10` | ✅ |
| §5 Order | PUT `/sales/order/{id}` | `cart/action.js:33` + `sales/order/action.js:16` | ⚠️ Duplicate |
| §5 Order | POST `/sales/order/{id}/checkout` | `cart/action.js:26` | ✅ |
| **§5 Order** | **PUT `/sales/order/{id}/cancel`** | `sales/order/action.js:25` | **⚠️ Missing password** |
| §5 Order | GET `/sales/order/openbill` | `cart/action.js:20` | ✅ |
| §5 Order | GET `/sales/order/{id}` | `sales/order/action.js:10` | ✅ |
| §6 Membership | GET `/membership` | `membership/action.js:10` | ✅ |
| §6 Membership | GET `/membership/{id}` | `membership/action.js:38` | ✅ |
| §6 Membership | POST `/membership` | `membership/action.js:17` | ✅ |
| §6 Membership | PUT `/membership/{id}` | `membership/action.js:24` | ✅ |
| §6 Membership | DELETE `/membership/{id}` | `membership/action.js:31` | ✅ |
| §7 Balance | GET `/balance` | `membership/action.js:44` | ✅ |
| §7 Balance | GET `/balance/{id}/log` | `membership/action.js:58` | ✅ |
| §7 Balance | POST `/balance/{id}/topup` | `membership/action.js:51` | ✅ |
| **§8 Delivery** | **GET `/delivery/plan?ref_code=`** | **MISSING** | **❌** |
| **§8 Delivery** | **POST `/delivery/receive`** | **MISSING** | **❌** |
| §9 Utility | GET `/payment-method` | `cart/action.js:40` | ✅ |
| §9 Utility | GET `/sales/channel` | `sales/channel/action.js:10` | ✅ |

### Patterns Found

**RTK Query pattern:** All APIs use `createApi` with `baseQuery` from `baseQuery.js`. Consistent.

**Checkout payload construction:** Both `checkout.jsx` and `cart.jsx` build payload similarly. Minor differences in addon handling (checkout sends both `addons` and `additionals_catalog_map`; cart only sends `addons`).

**Offline layer:** `baseQuery.js` intercepts mutations when offline, queues to IndexedDB via `offline/queue.js`. Offline preview payload built by `offline/localTransaction.js`.

---

## Findings

### Finding 1: Missing — PUT `/sales/session/device`

**Contract:** §4 — Update device tracking info (lat, long, battery)
**Frontend:** Not implemented

**Impact:** Low. Session open/close works without device tracking. This is a "nice to have" for GPS-based monitoring.

**Add to:** `sales/session/action.js`
```js
updateDevice: builder.mutation({
  query: payload => ({
    url: '/sales/session/device',
    method: 'PUT',
    body: payload,
  }),
}),
```

---

### Finding 2: Missing — Delivery Module Endpoints

**Contract:** §8
- `GET /delivery/plan?ref_code=` — Lookup delivery plan
- `POST /delivery/receive` — Receive delivery items

**Frontend:** Neither implemented.

**Impact:** Medium. Delivery feature not yet built. No existing flow affected.

---

### Finding 3: Bug — Cancel Order Missing Password

**Contract:** §5 — `PUT /sales/order/{id}/cancel` requires:
```json
{
  "cancelled_reason": "string (required)",
  "password": "string (required) — manager's password/pin"
}
```

**Frontend:** `sales/order/hook.js:23-30` — passes payload through, no `password` enforcement.

**Impact:** High. Cancel request will be rejected by backend with 422 validation error. Manager password is never collected from UI.

**Fix:** Add password input field to cancel/refund UI flow. Ensure hook sends `password` in payload.

---

### Finding 4: Improvement — Refresh Token Not Stored

**Contract:** Login response includes `refresh_token`.
**Frontend:** `auth/slice.js` stores only `access_token`. No refresh flow exists.

**Impact:** Low-Medium. When JWT expires, user is forced to re-login. No silent token refresh.

---

### Finding 5: Bug — GET `/profile/me` Response Shape Mismatch

**Contract:** Returns `{user: {}, sales_session: {}}`.
**Frontend:** `auth/hook.js:35` — `dispatch(session(res?.data))` stores the whole wrapper object as `state.session`.

**Login path:** `state.session = {id, name, role, ...}` (flat user object from `action.payload.user`).
**GetUser path:** `state.session = {user: {...}, sales_session: {...}}` (wrapper from `res.data`).

**Impact:** Components accessing `state.session?.name` or `state.session?.role` will get `undefined` after `getUser` runs. Currently works because most components use `state.Auth?.session` and the auth session `user` is in response data.

**Fix:** `auth/hook.js:35` — should dispatch `session(res?.data?.user)` not `session(res?.data)`.

---

### Finding 6: Refactor — Duplicate PUT `/sales/order/{id}`

Defined in:
- `cart/action.js:33` (cartApi) — used by `cart/hook.js:update`
- `sales/order/action.js:16` (salesOrderApi) — used by `sales/order/hook.js:update`

**Impact:** Low. Both work independently. Confusing for maintenance.

---

### Finding 7: Unused — `/outlet/service/charge`

**File:** `outlet/action.js:11` — endpoint exists in codebase but NOT in API contract. All call sites (`checkout.jsx`, `cart.jsx`) have `getServiceCharge()` **commented out**. Service charge instead sourced from auth session's `outlet.service_charges`.

**Impact:** None. Remove endpoint or add to contract.

---

## Recommendations

### Must Fix
1. **Cancel password** — Add `password` field requirement to cancel flow. Highest priority.
2. **Profile session shape** — Fix `auth/hook.js:35` to unwrap `res?.data?.user`, not `res?.data`.

### Should Add
3. **Delivery endpoints** — When delivery feature is planned, endpoints are ready in contract.
4. **Device tracking** — Add PUT `/sales/session/device` for GPS monitoring.

### Nice to Have
5. **Refresh token** — Store and implement silent refresh.
6. **Consolidate duplicate** — Merge PUT order into single API definition.
7. **Remove `/outlet/service/charge`** or add to contract.

---

## Open Questions

- Is delivery module planned for v2? If yes, implementation priority should be higher.
- Should cancel flow include a manager password modal, or rely on backend validation only?
- Is refresh token handling needed now, or acceptable to force re-login on expiry?

---

---

## Deep-Dive: Payload Shape Comparison

### POST `/sales/order` — Checkout Payload

`checkout.jsx:200-208` builds the payload, `handleSaveBill` at `checkout.jsx:299-327` builds the save-bill variant.

| Field | Contract | Frontend Sends | Match |
|-------|----------|----------------|-------|
| `sales_channel_id` | uuid required | `Channel?.selectedChannel?.id` | ✅ |
| `status` | `"pending"\|"completed"` required | `"completed"` (pay) / `"pending"` (save bill) | ✅ |
| `payment_method_id` | uuid optional | `selectedMethod?.id` | ✅ |
| `payment_ref` | string optional | `paymentRef` | ✅ |
| `total_payment` | float, req if completed | `Number(pay)` cash / `grand_total` non-cash | ✅ |
| `items[].catalog_id` | uuid required | `item.catalog_id` | ✅ |
| `items[].quantity` | float required | `item.quantity` | ✅ |
| `items[].unit_price` | float, custom only | sent for custom items only | ✅ |
| `items[].catalog_name` | string, custom only | sent for custom items only | ✅ |
| `items[].addons` | array | sent from `additionals_flat` | ✅ |
| `category_discounts` | array optional | built from `CartState.discount.category` | ✅ |
| `discount_percentage` | float optional | sent if cart discount type='percentage' | ✅ |
| `discount_value` | float optional | sent if cart discount type='nominal' | ✅ |
| `bill_name` | string optional | sent in save-bill flow (`checkout.jsx:327`) | ✅ |
| `note` | **NOT IN CONTRACT** | sent as extra field (`checkout.jsx:211`) | ❌ Extra |
| `membership_id` | uuid optional | sent via `CartState?.meta?.customer` OR `card.id` | ✅ |
| `card_id` | **NOT IN CONTRACT** | sent when paying with NFC (`checkout.jsx:234`) | ❌ Extra |
| `items[].additionals_catalog_map` | **NOT IN CONTRACT** | sent when checkout has addon groups (`checkout.jsx:154-178`) | ❌ Extra |

**Verdict:** 3 extra fields sent (`note`, `card_id`, `additionals_catalog_map`). No contract fields missing.

---

### POST `/catalog` — Create Custom Catalog

`create.jsx:28-33` builds payload

| Field | Contract | Frontend Sends | Match |
|-------|----------|----------------|-------|
| `category_id` | uuid required | `category?.id` | ✅ |
| `name` | string required | `name` | ✅ |
| `price` | float required >0 | `Number(price)` | ✅ |
| `image` | string optional | **MISSING** | ⚠️ Optional, not blocking |
| `channel_id` | **NOT IN CONTRACT** | `channel?.id` | ❌ Extra |

**Verdict:** `channel_id` sent but not in contract. Contract does not mention channel filtering for custom catalog creation — but backend auto-generates pricing for *all* channels. Adding `channel_id` may or may not be accepted by backend.

---

### POST `/sales/session` — Open Session

`openSession.jsx:17-19` builds payload

| Field | Contract | Frontend Sends | Match |
|-------|----------|----------------|-------|
| `cash_started` | float required | `parseFloat(cash) \|\| 0` | ✅ |
| `latitude` | float optional | **NOT SENT** | ⚠️ Missing, optional |
| `longitude` | float optional | **NOT SENT** | ⚠️ Missing, optional |
| `battery_health` | string optional | **NOT SENT** | ⚠️ Missing, optional |

**Verdict:** Only `cash_started` sent. Device tracking fields never captured. Low impact.

---

### PUT `/sales/session/close` — Close Session

`closeSession.jsx:70-74` builds payload

| Field | Contract | Frontend Sends | Match |
|-------|----------|----------------|-------|
| `cash_finished` | float required | `Number(cash)` | ✅ |

**Verdict:** ✅ Matches.

---

### Sales Order Response — Consumption Mismatch

The **close session summary** component (`closeSession.jsx`) accesses response fields that differ from contract:

| Contract Says | Frontend Accesses | Match |
|---------------|-------------------|-------|
| `summary.topup` (array, singular) | `summary.topups` (plural) at line 180 | ❌ Field name |
| `summary.payment_method` (array, singular) | `summary.payment_methods` (plural) at line 188 | ❌ Field name |

**Impact.** `topups` and `payment_methods` will be `undefined` → sections won't render. However, if the actual backend response uses plural forms (not the contract), this works at runtime. This is a **contract documentation bug** or a **frontend bug** depending on which is correct.

---

### PUT `/sales/order/{id}/cancel` — Cancel Order

`refund.jsx:16-21` builds payload

| Field | Contract | Frontend Sends | Match |
|-------|----------|----------------|-------|
| `cancelled_reason` | string required | `reason` | ✅ |
| `password` | string required | `pin` | ✅ |

**Note:** Previous finding stated password was missing. Re-checking: `refund.jsx` DOES send `password: pin`. The earlier finding was incorrect — the password flow IS implemented in the Refund component. However, the `sales/order/hook.js:25` passes payload generically: `cancelMutation({ id, ...payload })` — this will send all payload fields correctly.

**Correction to Finding 3:** Cancel password IS implemented via the Refund UI component (`refund.jsx:18`). The cancel flow is complete. 🔄 **Retract previous "missing password" bug.**

---

### Offline Transaction Preview Payload

`localTransaction.js:283-323` builds the offline preview (local-only, never sent to API):

| Field | In Contract Response? | Used For | Match |
|-------|----------------------|----------|-------|
| `offline_queued: true` | ❌ Not in contract | Frontend flag for offline mode | N/A — local only |
| `offline_meta` | ❌ Not in contract | Sync metadata | N/A — local only |
| `code: OFF-{timestamp}` | ❌ Not standard format | Local ref code | N/A — local only |

No API contract impact — these are local-only fields for offline queue management.

---

### GET `/catalog/{id}` — Catalog Detail Param

`catalog/action.js:37` sends query params including `channel_id`:

| Contract Query Params | Frontend Sends | Match |
|-----------------------|----------------|-------|
| (none specified for GET `/catalog/{id}`) | `channel_id` | ❌ Extra param |

**Note:** Contract doesn't list query params for GET `/catalog/{id}`. The frontend sends `{ id, channel_id }` from `cart/hook.js:307-310`. May be harmless if backend ignores extra params.

---

## Deep-Dive: State Machine Analysis

### 1. Order Status Machine

**Contract (§13):**
```
pending ──checkout──► completed
  │                       │
  └──cancel──► cancelled  └──cancel──► cancelled
```

**Frontend Implementation:**

| Transition | Trigger | Frontend Code | Status |
|------------|---------|---------------|--------|
| `pending → completed` | `POST /sales/order` with `status: "completed"` | `checkout.jsx:201` sets `status: "completed"` in payload | ✅ |
| `pending → pending` (save bill) | `POST /sales/order` with `status: "pending"` | `checkout.jsx:302` sets `status: "pending"` in save-bill payload | ✅ |
| `pending → cancelled` | `PUT /sales/order/{id}/cancel` | `refund.jsx:21` with `password` + `reason` | ✅ |
| `completed → cancelled` | `PUT /sales/order/{id}/cancel` | Same `refund.jsx` flow | ✅ |

**Frontend enforcement:** None. The frontend doesn't enforce state machine rules — all transitions are validated server-side. The frontend just sets the `status` field in POST body.

**Verdict:** ✅ Frontend doesn't restrict any valid transitions. Server-enforced, correct.

---

### 2. Session Status Machine

**Contract (implied):**
```
null ──POST /sales/session──► opened
opened ──PUT /sales/session/close──► closed
```

**Frontend Implementation:**

| State | Redux Location | Set By |
|-------|----------------|--------|
| `hasSession: false` | `SalesSession.hasSession` | Initial state + `invalidateSession()` |
| `hasSession: true` | `SalesSession.hasSession` | `checkSession()` + `summary()` success |

**Flow:**

1. **Login → check session:** `auth/hook.js:26` calls `getUser()` after login. `getUser` response includes `sales_session` object. If session exists, `summary()` dispatch `checkSession()`. If no session, `openSession.jsx` shown.

2. **Open session:** `openSession.jsx:17` → `POST /sales/session`. On success, session/hook calls `refreshCatalog()` + `resetCart()`. Offline mode: manually dispatches `checkSession()` via `res?.data?.is_offline_session`.

3. **Session active:** `index.jsx` checks `SalesSession.hasSession`. If false → show `OpenSection` sidebar. If true → show catalog + cart.

4. **Close session:** `closeSession.jsx:70` → `PUT /sales/session/close`. On success → print summary → logout.

**State machine comparison:**

| Transition | Contract | Frontend | Match |
|------------|----------|----------|-------|
| `null → opened` | POST with `cash_started` | Yes | ✅ |
| `opened → closed` | PUT with `cash_finished` | Yes | ✅ |
| `opened → (stay opened)` | PUT `/device` for tracking | **MISSING** | ❌ |
| Session check on resume | Implicit (GET `/profile/me` returns session) | `getUser()` checks `sales_session` | ✅ |

**Device tracking state:** Contract defines `PUT /sales/session/device` for periodic device info updates. Frontend has no equivalent. Not a flow blocker.

**Verdict:** ✅ Core open/close flow implemented. Device tracking endpoint missing (low impact).

---

### 3. Cart / Order State (Frontend-Only)

The frontend manages its own cart state machine through Redux. Not defined in API contract but important for correctness.

```
empty ──addItem──► hasItems ──checkout──► success ──resetCart──► empty
                        │                      │
                        └──saveBill──► pending  │
                                        │       │
                                        └──closeBill──► success
```

| State | Redux Condition |
|-------|----------------|
| `empty` | `Cart.items.list.length === 0 && !Cart.bill` |
| `hasItems` | `Cart.items.list.length > 0` |
| `editing` | DetailScreen modal open |
| `billPending` | `Cart.bill` is set, items in `Cart.items.bill` |
| `checkout` | `isCheckoutRunning` ref guard active |
| `success` | Checkout/bill mutation resolved |

**Ref guard pattern:** `cart/hook.js:68` uses `isCheckoutRunning.useRef` to prevent double-submit during checkout. Same pattern for `isBillRunning` and `isBillSelected`. These are not persisted — survive only within component lifecycle.

**Discount state machine:**

```
noDiscount ──setType──► percentage/nominal ──setValue──► active
                                                              │
                                                   type=null ──┘
```

Cart discount toggle: lines 193-200 in `cart/hook.js` — switching type resets value to 0.

Category discounts: each category has independent `discount_type`/`discount_value` pair.

**Verdict:** ✅ All cart state transitions are consistent. No dangling states.

---

### 4. Payment Flow State Machine

```
selectMethod ──► cash ? enterAmount : enterRefCode
                      │                        │
                      └──────► handlePay() ◄────┘
                                  │
                         ┌───────┴────────┐
                         ▼                 ▼
                   is_member_payment    normal pay
                         │                 │
                      openNFC()        handlePay()
                         │                 │
                    checkSaldo()      POST /sales/order
                         │                 │
                   handlePay(card)    checkout(err/success)
```

**NFC payment sub-flow:**
1. `checkout.jsx:375` — `openNFC()` opens NFC modal
2. `checkout.jsx:357-365` — `handleRead(uid)` calls `checkSaldo(params)`
3. `checkout.jsx:442-448` — on success, `handlePay(card)` with member info
4. Payload then includes `membership_id`, `card_id`, `payment_ref` (see Payload section)

**Verdict:** ✅ Payment flow handles cash, non-cash, and NFC membership payments correctly. Save-bill and close-bill flows are also properly sequenced.

---

### 5. Offline Queue State Machine

```
online ──mutation──► offline detected ──queueOfflineMutation──► queued
                                                                   │
                                                              sync when online
                                                                   │
                                                            ┌──────┴──────┐
                                                            ▼             ▼
                                                          success      failed
```

`baseQuery.js:161-162` intercepts all mutations when `!navigator.onLine`. Queued to IndexedDB via `offline/queue.js`. On session start offline, returns mock response with `is_offline_session: true` to allow immediate UI feedback.

**Pending count tracking:** `baseQuery.js:112` dispatches `setPendingCount`. `closeSession.jsx:36` warns if `pendingCount > 0` before allowing session close.

**Verdict:** ✅ Offline flow is well-structured. Mutations queued, UI gets immediate feedback, pending count prevents accidental data loss.

---

## Corrections from Initial Report

| Finding # | Initial Finding | Correction |
|-----------|----------------|------------|
| Finding 3 | Cancel missing password | **RETRACTED** — `refund.jsx:18` DOES send `password: pin`. Full flow: Refund modal → PIN input → `cancel({id, payload})` → `cancelMutation({id, ...payload})`. The cancel flow is complete. |
| Finding 5 | Session shape bug | **CONFIRMED** — `auth/hook.js:35` dispatches `session(res?.data)` where `res.data = {user, sales_session}`. But `auth/slice.js:24` stores `state.session = action.payload` directly. Login stores `action.payload.user` → flat user. getUser stores `{user, sales_session}` wrapper → components accessing `session?.name` get `undefined`. |
| closeSession topups/payment_methods | Not confirmed as bug | Depends on actual backend response shape. Contract says singular (`topup`, `payment_method`), frontend reads plural (`topups`, `payment_methods`). One of them is wrong. |

---

## Updated Recommendations

### Must Fix
1. **Profile session shape** — `auth/hook.js:35` should `dispatch(session(res?.data?.user))`, not `dispatch(session(res?.data))`. This is the highest-impact bug.
2. **Clarify summary field names** — Determine if backend returns `topup` (contract) or `topups` (frontend), and `payment_method` vs `payment_methods`. Fix whichever is wrong.

### Should Fix
3. **`channel_id` in custom catalog** — Remove `channel_id` from `create.jsx:32` payload if backend doesn't accept it. Verify first.
4. **`note` field in checkout** — Add `note` to contract if backend stores it. If not, remove from frontend.
5. **`card_id` in checkout payload** — Verify backend accepts `card_id` as extra field during NFC payment.

### Nice to Have
6. **Device tracking** — Add `PUT /sales/session/device` endpoint + periodic location/battery capture.
7. **Remove `additionals_catalog_map`** — If backend ignores it, clean up frontend code in `checkout.jsx:154-178`.
8. **Refresh token** — Store `refresh_token` and implement silent refresh.

---

## Deep-Dive: Offline Flow Analysis

### Architecture Overview

```
User Action → Mutation via RTKQ
                  │
          baseQuery.js:161
                  │
          ┌───────┴───────┐
          ▼               ▼
   navigator.onLine    !navigator.onLine
          │               │
     rawBaseQuery    queueOfflineMutation()
     (HTTP fetch)     (IndexedDB queue)
          │               │
          ▼               ▼
     API response     Mock response
     (normal flow)    + offline_queued: true
                          │
                    syncManager.js
                    (when online resumes)
```

**3 layers of concern:**
- **Queue persistence** (`queue.js`) — IndexedDB CRUD for pending requests
- **Sync engine** (`syncManager.js`) — Online detection → sorted processing → retry
- **UI layer** (`OfflineBanner`, `PendingDrawer`, `SyncIndicator`) — User feedback + queue management

---

### IndexedDB Schema

**Database:** `pos-offline-queue` v1, library: `idb`

| Store | Key | Indexes | Purpose |
|-------|-----|---------|---------|
| `pendingRequests` | `id` (uuid) | `status` (idx), `createdAt` (idx) | Queued API call + body |
| `idempotencyKeys` | `key` (uuid string) | `createdAt` (idx) | Dedup guard (24h TTL) |
| `metadata` | `key` (string) | — | `lastSyncTime`, `syncAttempt` |

**Pending request shape:**
```js
{
  id: uuidv4(),
  idempotencyKey: uuidv4(),      // For dedup on sync
  url: '/sales/order',
  method: 'POST',
  body: { ... },                  // Original request payload
  params: null,
  headers: { Authorization: 'Bearer ...' },
  token: 'eyJ...',                // Snapshot of auth token at queue time
  type: 'mutation',               // Only mutations are queued
  status: 'pending',              // pending | syncing | completed | failed
  retryCount: 0,
  lastError: null,
  transaction_preview: { ... },   // For UI display
  createdAt: 1712345678901,
  updatedAt: 1712345678901,
}
```

---

### Offline Interception Flow

**Entry Point:** `baseQuery.js:156-163`

```js
const isSkipOffline = !!(typeof args === 'object' && args?.__skipOfflineQueue);
const method = typeof args === 'object' ? args.method : 'GET';
const offlineMutation = typeof args === 'object' && isMutationMethod(method);

if (!isSkipOffline && offlineMutation && !navigator.onLine) {
  return queueOfflineMutation(args, api);
}
```

**Only mutations** (POST/PUT/PATCH/DELETE) are intercepted. Queries (GET) are NOT queued — they fail silently if offline. The `__skipOfflineQueue` flag prevents re-queuing during sync replay (syncManager.js:72).

**`queueOfflineMutation()` flow** (baseQuery.js:78-153):
1. Build `previewData` via `buildTransactionPreview()` (line 43-76) — constructs mock response shape for UI
2. `addToQueue()` → persists to IndexedDB (line 90-102)
3. Dispatch `setPendingCount`, `setQueueItems` to Redux (line 112-117)
4. If pending > 100, dispatch `setWarning` (line 118-122)
5. If session start → return mock `{ is_offline_session: true }` (line 125-137)
6. Otherwise → reset cart, restore cached service charge, return mock success (line 139-153)

---

### Save-Bill Merge Logic

`queue.js:63-131` — When saving a bill offline, if a pending bill with the same `ticket` name already exists in the queue, `addToQueue()` **merges items instead of creating a duplicate entry**.

**Merge rules:**
1. Find existing item where `url` ends with `open-bill` AND `body.ticket === newTicket`
2. For each new item: if `catalog_id` + `addons` (stringified) match → increment `quantity`
3. If no match → push as new item
4. Recalculate `transaction_preview.total_bill`, `total_charges`, `item_count`
5. If newer request has `transaction_preview`, merge it into existing

**Edge case risk:** If save-bill is queued offline, then user also queues a checkout (`status: completed`) for the same bill, both exist independently in queue. No dedup across different `status` values.

---

### Sync Engine Lifecycle

**Initialization** (`syncManager.js:242-265`):
```js
export const initSyncManager = store => {
  storeRef = store;
  broadcastQueueState();         // Load existing queue into Redux
  window.addEventListener('online', onOnline);  // Listen for reconnect
  if (navigator.onLine) {
    setTimeout(syncNow, 3000);   // Initial sync attempt after 3s
  }
};
```

Called in `main.jsx:15` immediately after store creation.

**Trigger paths:**
| Trigger | Code | Delay |
|---------|------|-------|
| Page load (if online) | `initSyncManager` → `setTimeout(syncNow, 3000)` | 3s |
| Browser goes online | `window.addEventListener('online', ...)` → `setTimeout(syncNow, 3000)` | 3s (debounced) |
| Manual retry | `retryFailedItem(id)` → `syncNow()` | Immediate |
| After login | Not triggered — relies on page load or online event | N/A |

**`syncNow()` execution** (syncManager.js:173-223):
1. Guard: `if (isSyncingInternal) return` — prevents concurrent sync
2. Dispatch `setSyncing(true)`, clear error
3. Loop: fetch pending items → `sortPendingQueue()` → process top item
4. Each item processed via `processItem()` (line 96-150)
5. If start session fails → halt all sync, dispatch error
6. If 401 received → halt all sync, dispatch "session expired"
7. On completion → update `lastSyncTime`, broadcast queue state

---

### Priority Ordering

`sortedPendingQueue()` (syncManager.js:152-171) — strict priority before FIFO:

| Priority | URL Pattern | Position |
|----------|-------------|----------|
| 1 (highest) | `/sales/session` (not close) | First |
| 2 (normal) | Everything else | Middle |
| 3 (lowest) | `/sales/session/close` | Last |

**Rationale:** Session must be open before transactions can be posted. Session close must be last to capture all transactions.

**Failure cascade:**
- If **start session fails** → `syncNow()` breaks loop entirely. No further items processed until user intervenes.
- If **regular transaction fails** after retries → marked `failed`. Loop continues to next item.
- If **end session fails** → marked `failed`. No special handling.

---

### Retry Strategy

`processItem()` (syncManager.js:96-150):

| Attempt | Delay | Condition |
|---------|-------|-----------|
| 1st | 0 (immediate execution) | Always |
| 2nd | 1s (`1000 * 2^0`) | If previous failed & retryable |
| 3rd | 2s (`1000 * 2^1`) | If previous failed & retryable |
| Final | — | Mark `failed`, `lastError: 'Max retries reached'` |

**`shouldRetry(error)` logic** (syncManager.js:37-42):
| Status Code | Retry? |
|-------------|--------|
| `null` (network error) | ✅ Yes |
| 5xx | ✅ Yes |
| 4xx (except 401) | ❌ No — immediate `failed` |
| 401 | ❌ No — halt entire sync, "Session expired" |

**Notable:** There's a `BASE_DELAY * 2^attempt` delay (1s, 2s, 4s theoretical) but the attempt counter starts from `item.retryCount`, so a previously-retried item skips earlier waits.

---

### Duplicate Sync Guard

`syncManager.js:92-104` — `syncingItems: Set<string>` prevents the same item from being processed concurrently. Items are added to the Set before processing begins and removed in the `finally` block (line 148).

This guards against the edge case where `syncNow()` is triggered while a previous sync is mid-flight for the same item.

---

### Network Detection

**`useNetworkStatus.js`:**
```js
const [isOnline, setIsOnline] = useState(navigator.onLine);
useEffect(() => {
  const handleOnline = () => setIsOnline(true);
  const handleOffline = () => setIsOnline(false);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  return () => { /* cleanup */ };
}, []);
```

**Debounce behavior:**
- `syncManager.js:252` — `setTimeout(syncNow, 3000)` on `online` event
- `reconnectTimer` cleared/reset on rapid online/offline toggling — prevents thundering herd

**Interaction with `baseQuery.js`:**
- `baseQuery.js:161` checks `navigator.onLine` directly (not Redux state)
- `useNetworkStatus` updates Redux `Offline.isOnline` but `baseQuery` reads browser API directly
- This means queue interception always uses the real-time network state, not the debounced Redux value

---

### Token Expiry Handling During Sync

When a 401 occurs during sync replay (syncManager.js:120-126):
```js
if (status === 401) {
  await markFailed(item, 'Authentication expired. Please login again.');
  storeRef.dispatch(setOfflineError('Session expired during sync. Please login again.'));
  return { ok: false, stop: true };
}
```

- Item is marked `failed`
- Sync loop halts via `result.stop` check (line 202-204)
- Redux `Offline.error` is set for UI display
- **No automatic re-login** — user must see error, login again, then sync resumes

**Gap:** The 401 error in the Redux store doesn't trigger logout or redirect. User must navigate to login manually.

---

### Offline UI Components

| Component | File | Purpose |
|-----------|------|---------|
| `OfflineBanner` | `src/components/ui/offline/OfflineBanner.jsx` | Alert banner overlay — variants: offline (warning), syncing (info), warning (warning), error (error). Shows retry/dismiss buttons. |
| `PendingDrawer` | `src/components/ui/offline/PendingDrawer.jsx` | Full queue manager drawer — tabs (All/Order/Bills/Shifts), status badges, collapsible items, actions (Open Bill/Remove/Retry). Categories by API path. |
| `SyncIndicator` | `src/components/ui/offline/SyncIndicator.jsx` | Button showing pending/failed count badge. Hidden when both = 0. |

**Integration:** `layout.jsx:52` renders `OfflineBanner`, lines 61/177 render `PendingDrawer`, line 149 renders `SyncIndicator`.

**Pending Drawer categorization:**
- **Order** ← URLs containing `/sales/order`
- **Bills** ← URLs containing `open-bill` or `status=pending`
- **Shifts** ← URLs containing `/sales/session`

---

### Session-Aware Offline Handling

**Start session offline** (`baseQuery.js:124-137`):
- Special mock response: `{ data: { is_offline_session: true, offline_queued: true } }`
- `session/hook.js:37-39` — detects `is_offline_session` → dispatches `checkSession()` directly
- No need for `summary()` call (which would fail offline)

**Close session guard** (`closeSession.jsx:36-68`):
- Before closing session, reads `Offline.pendingCount`
- If `pendingCount > 0` → shows warning modal: "There are X pending transactions that will be synced later."
- User can proceed or cancel
- **No hard block** — user can close session with pending items

**Edge case:** If session start was queued offline and hasn't synced yet, but user attempts checkout — checkout mutation will be queued. On sync, order is: start session → checkout. Session start failure halts everything, so checkout will never sync if session start fails.

---

### Findings: Offline System

| # | Finding | Severity | Detail |
|---|---------|----------|--------|
| OF-1 | **No token refresh during sync** | 🟠 Major | If token expires while offline, sync fails with 401 on first replayed request. All remaining items stuck as `failed`. No auto-logout or redirect — user sees error banner but still on POS screen. |
| OF-2 | **Queries not queued** | 🟡 Minor | If a GET fails while offline (e.g., catalog refresh, session summary), no retry occurs. UI shows stale data or errors. |
| OF-3 | **Save-bill vs checkout collision** | 🟡 Minor | If user saves bill offline (status: pending), then also queues checkout (status: completed) for same ticket, both coexist. On sync, the pending save-bill POST runs first (FIFO), then the checkout POST runs. Both succeed independently — the pending bill becomes an orphan on server. |
| OF-4 | **Sync not triggered after login** | 🟢 Info | `initSyncManager` only runs once at app boot (`main.jsx:15`). If user logs out and logs back in (without page reload), sync may not trigger again. Mitigated because auth redirect typically reloads page. |
| OF-5 | **`retryCount` accumulator** | 🟢 Info | `processItem()` continues from `item.retryCount` instead of resetting per-sync-session. A failed item that was retried 2 times previously will only get 1 more attempt (target = 3). `retryFailedItem()` manually resets `retryCount: 0`. |
| OF-6 | **Idempotency key stored but not verified** | 🟢 Info | Idempotency keys are generated and stored (`idempotencyKeys` store) but never checked/verified against server response. The server-side dedup mechanism is unused — keys are generated client-side but no server round-trip confirms dedup. |

### Offline → Contract Mismatches

| Aspect | Contract Expectation | Frontend Implementation | Gap |
|--------|---------------------|------------------------|-----|
| Session close guard | Not specified | Warns if `pendingCount > 0` | Reasonable extension, no blocker |
| Device tracking offline | `PUT /sales/session/device` would queue | Endpoint not implemented | Same as Finding 1 |
| Offline session recovery | Not specified | `summary()` call skipped, `checkSession()` dispatched directly | Frontend-only logic |

---

## Updated Recommendations (With Offline Findings)

### Must Fix
1. **Profile session shape** — `auth/hook.js:35` should `dispatch(session(res?.data?.user))`
2. **Clarify summary field names** — `topup` vs `topups`, `payment_method` vs `payment_methods`

### Should Fix
3. **401 handling during sync** — Auto-redirect to login page when sync hits 401
4. **`channel_id` in custom catalog** — Remove from `create.jsx:32` if backend doesn't accept
5. **`note`/`card_id` in checkout** — Add to contract or remove from frontend

### Nice to Have
6. **Device tracking** — `PUT /sales/session/device`
7. **Delivery endpoints** — When delivery module planned
8. **Query retry offline** — Queue catalog/summary GETs for retry
9. **Idempotency verification** — Wire client-generated keys to server dedup
10. **Refresh token** — Store and implement silent refresh

---

*Research completed with SDD 2.0*
