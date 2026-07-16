# Implementation Tasks: API Contract Remediation

**Task ID:** api-contract-audit
**Created:** 2026-07-15
**Status:** Ready for Implementation

---

## Summary

| Metric | Value |
|--------|-------|
| Total Tasks | 14 |
| Estimated Effort | ~6.5 hours |
| Phases | 5 |

---

## Phase 1: Low-Risk Bug Fixes

**Goal:** Fix session state shape bug and consolidate duplicate PUT `/sales/order/{id}` endpoint. No behavioral change — pure correctness fixes.

**Effort:** 30 min

### Task 1.1: Fix Session Shape in auth/hook.js

**Description:** Change `dispatch(session(res?.data))` → `dispatch(session(res?.data?.user))` at `auth/hook.js:36`. The `login()` path correctly stores `res?.data?.user` but `getUser()` stores the wrapper `{user, sales_session}`. Fix makes both paths consistent.

**Files to modify:**
- `src/services/auth/hook.js` — line 36, 1-char change (`.user` accessor)

**Acceptance Criteria:**
- [ ] `state.session` is flat user object after both `login()` and `getUser()`
- [ ] `session?.name` and `session?.role` return expected values regardless of auth path
- [ ] Service charge read at line 38 (`res?.data?.sales_session?.outlet?.service_charges`) still works — reads from raw `res`, not Redux
- [ ] No regression in login, logout, profile refresh

**Effort:** 10 min
**Priority:** High
**Dependencies:** None

---

### Task 1.2: Fix PUT `/sales/order/{id}` Parameter Convention in sales/order/action.js

**Description:** Fix `sales/order/action.js:16` to use canonical `({ id, payload }) => body: payload` instead of `({ id, ...payload }) => body: { ...payload }`. Current `...payload` destructure wraps `{ id, payload }` call pattern into `body: { payload: {...} }` — double-wrapping bug.

**Files to modify:**
- `src/services/sales/order/action.js` — line 15-23, change query fn signature

**Acceptance Criteria:**
- [ ] `update` mutation uses `query: ({ id, payload }) => ({ url: /sales/order/${id}, method: 'PUT', body: payload })`
- [ ] `sales/order/hook.js:33-35` call `updateMutation({ id, payload })` sends correct body (not double-wrapped)
- [ ] `cart/hook.js:242` call to same mutation works identically

**Effort:** 10 min
**Priority:** High
**Dependencies:** None

---

### Task 1.3: Remove Duplicate PUT `/sales/order/{id}` from cart/action.js

**Description:** Remove the `update` endpoint definition (lines 32-38) and its export (`useUpdateMutation`) from `cart/action.js`. The canonical definition now lives in `sales/order/action.js`.

**Files to modify:**
- `src/services/cart/action.js` — remove lines 32-38 (update endpoint), remove line 53 (export)

**Acceptance Criteria:**
- [ ] `cart/action.js` no longer defines `update` endpoint
- [ ] `useUpdateMutation` no longer exported from `cart/action.js`
- [ ] `cartApi` reducer path unchanged — other endpoints unaffected

**Effort:** 5 min
**Priority:** High
**Dependencies:** Task 1.2 (must fix canonical first)

---

### Task 1.4: Update cart/hook.js Import to Use sales/order/action

**Description:** Change line 8 import from `useUpdateMutation` (from `'./action'`) to import from `'../sales/order/action'`. The hook at line 242 calls `useUpdateMutation` — this must now resolve from the canonical service.

**Files to modify:**
- `src/services/cart/hook.js` — line 8 import

**Acceptance Criteria:**
- [ ] `useUpdateMutation` imported from `'../sales/order/action'` not `'./action'`
- [ ] All call sites (`cart/hook.js:242`) still work with same `{ id, payload }` convention
- [ ] No unused imports left in cart/hook.js

**Effort:** 5 min
**Priority:** High
**Dependencies:** Task 1.3

---

## Phase 2: Offline Hardening

**Goal:** Harden offline sync against token expiry (401), prevent orphan bills from save-bill+checkout collision, and reset retry counter per sync session.

**Effort:** 1.5 hr

### Task 2.1: Harden 401 Handling in syncManager.js

**Description:** In `syncManager.js`, when `processItem()` receives 401 status, dispatch `logout()` action from auth slice to clear Redux auth state, set offline error message, and redirect to login page via `window.location.href = '/'`. Failed items remain in IndexedDB queue (status: `failed`).

**Implementation location:** Inside `processItem()` at line 120-126 (current 401 handling block), replace with:
```js
if (status === 401) {
  await markFailed(item, 'Authentication expired. Please login again.');
  if (storeRef) {
    storeRef.dispatch(logout());
    storeRef.dispatch(setOfflineError(
      'Session expired during sync. Pending items saved. Please login again.'
    ));
  }
  setTimeout(() => { window.location.href = '/'; }, 1500);
  return { ok: false, stop: true };
}
```

**Files to modify:**
- `src/services/offline/syncManager.js` — import `logout` from auth slice, replace 401 block

**Acceptance Criteria:**
- [ ] 401 during sync dispatches `logout()` and `setOfflineError()`
- [ ] User redirected to `/` after 1.5s delay
- [ ] Previously failed items remain in IndexedDB (status: `failed`)
- [ ] Non-401 errors still handled by existing retry logic
- [ ] No regression in normal sync flow

**Effort:** 30 min
**Priority:** High
**Dependencies:** None

---

### Task 2.2: Prevent Orphan Bills — Dedup Checkout Over Save-Bill in queue.js

**Description:** In `addToQueue()`, after the existing save-bill merge block (line 131), add logic to detect checkout requests (`status: completed` on `/sales/order` URL) and remove any matching pending save-bill with same `ticket` name. Uses `db.getAll()` to scan queue, filters by URL ends-with `open-bill`, deletes matches.

**Implementation:** Add code block after line 131 in `src/services/offline/queue.js`.

**Files to modify:**
- `src/services/offline/queue.js` — add dedup block after line 131

**Acceptance Criteria:**
- [ ] When checkout (`status: completed`, URL contains `/sales/order`) added to queue, matching pending save-bill (same `ticket`, URL ends-with `open-bill`) is removed
- [ ] Existing save-bill merge logic (by `catalog_id` + `addons`) preserved
- [ ] No-op when no matching pending bill found
- [ ] No exception when `ticketName` is undefined or `request.body` is missing

**Effort:** 30 min
**Priority:** Medium
**Dependencies:** None

---

### Task 2.3: Ensure ticket Field in Checkout Payload for Offline Dedup

**Description:** Verify `checkout.jsx:handlePay()` includes `ticket` field in the checkout payload when cart has a pending bill reference (`CartState.bill` is set). If missing, add it. The dedup in Task 2.2 relies on matching `ticket` between save-bill and checkout.

**Files to modify:**
- `src/pages/authorize/home/checkout.jsx` — verify/add `ticket` in payload builder

**Acceptance Criteria:**
- [ ] Checkout payload includes `ticket` field when cart references a pending bill
- [ ] Backend accepts optional `ticket` field in checkout (no validation error)
- [ ] No change to checkout flow when no pending bill exists
- [ ] Existing `handleSaveBill` (line 327) already sends `ticket` — unchanged

**Effort:** 15 min
**Priority:** Medium
**Dependencies:** Task 2.2

---

### Task 2.4: Reset retryCount Per Sync Session

**Description:** In `syncManager.js:processItem()`, before entering the retry loop (line 106), reset `item.retryCount = 0` and persist to IndexedDB via `updateQueueItem`. This ensures each sync session gets a full budget of MAX_RETRY (3) attempts regardless of previous failures.

**Files to modify:**
- `src/services/offline/syncManager.js` — add retryCount reset at line 106

**Acceptance Criteria:**
- [ ] `retryCount` reset to 0 before retry loop in `processItem()`
- [ ] Reset persisted to IndexedDB via `updateQueueItem()`
- [ ] MAX_RETRY=3 still enforced — no infinite loops
- [ ] `retryFailedItem()` (line 230) still independently resets `retryCount: 0`
- [ ] No performance impact — single IndexedDB `put` per item

**Effort:** 15 min
**Priority:** Medium
**Dependencies:** None

---

## Phase 3: New Endpoints

**Goal:** Add missing API endpoints from contract that have no frontend implementation yet. API layer only — no UI required.

**Effort:** 1 hr

### Task 3.1: Add updateDevice Mutation to sales/session/action.js

**Description:** Add `updateDevice` builder mutation for `PUT /sales/session/device` endpoint. Accepts `{ latitude, longitude, battery_health }` payload per contract §4. Export `useUpdateDeviceMutation`. No GPS/battery auto-capture — just the API layer.

**Files to modify:**
- `src/services/sales/session/action.js` — add mutation + export

**Acceptance Criteria:**
- [ ] `updateDevice: builder.mutation({ query: payload => ({ url: '/sales/session/device', method: 'PUT', body: payload }) })` added
- [ ] `useUpdateDeviceMutation` exported
- [ ] Existing 5 endpoints unaffected
- [ ] No changes to `sales/session/hook.js` (not called from UI yet)

**Effort:** 15 min
**Priority:** Low
**Dependencies:** None

---

### Task 3.2: Create delivery/action.js — Delivery Module API Layer

**Description:** Create new file `src/services/delivery/action.js` with RTK Query `deliveryApi` defining:
- `getPlan`: builder.query for `GET /delivery/plan?ref_code=` with params
- `receive`: builder.mutation for `POST /delivery/receive` with body payload

Export `useLazyGetPlanQuery` and `useReceiveMutation`.

**Files to create:**
- `src/services/delivery/action.js` — NEW

**Acceptance Criteria:**
- [ ] `deliveryApi` created with `reducerPath: 'deliveryApi'` and `baseQuery`
- [ ] `getPlan` query defined with `ref_code` param
- [ ] `receive` mutation defined
- [ ] Both endpoints exported
- [ ] Follows same pattern as existing API services (sales/session/action.js, etc.)

**Effort:** 20 min
**Priority:** Low
**Dependencies:** None

---

### Task 3.3: Create delivery/hook.js — Delivery Module Hooks

**Description:** Create new file `src/services/delivery/hook.js` with `useDelivery` hook wrapping `useLazyGetPlanQuery` and `useReceiveMutation`. Exposes `getPlan(refCode)`, `receive(payload)`, `planResult`, `receiveResult`. Error handling with console.error + re-throw.

**Files to create:**
- `src/services/delivery/hook.js` — NEW

**Acceptance Criteria:**
- [ ] `useDelivery` hook defined with `getPlan` and `receive` wrappers
- [ ] Both return unwrapped promise (`.unwrap()`)
- [ ] Errors caught, logged to console.error, re-thrown
- [ ] Follows same pattern as `useSession` in `sales/session/hook.js`

**Effort:** 20 min
**Priority:** Low
**Dependencies:** Task 3.2

---

## Phase 4: Backend-Verified Changes

**Goal:** Remove `channel_id` from custom catalog POST payload. Verified that backend ignores `channel_id` — remove from frontend to align with contract.

**Effort:** 30 min

### Task 4.1: Remove channel_id from Custom Catalog Create Flow

**Description:** Remove `channel_id` from POST `/catalog` payload in `create.jsx`. Changes:
- Remove `channel` state variable (line 22)
- Remove `channel_id: channel?.id` from payload (line 32)
- Remove channel dropdown UI (lines ~130-178)
- Remove channel dropdown ref (line 13)
- `getChannel()` trigger can be removed (lines 42-43)

**Files to modify:**
- `src/pages/authorize/home/create.jsx` — remove channel state, payload field, dropdown UI, ref

**Acceptance Criteria:**
- [ ] POST `/catalog` payload no longer includes `channel_id`
- [ ] Channel dropdown removed from CreateSection UI
- [ ] No dead code or dangling refs
- [ ] Custom catalog creation still works (name, price, category selection preserved)
- [ ] No regression in catalog detail or pricing (already uses `sales_channel_id` as query param, separate concern)

**Effort:** 30 min
**Priority:** Medium
**Dependencies:** None

---

## Phase 5: Verification & Testing

**Goal:** Verify all changes work correctly, with focus on addons catalog functionality — the most complex data flow affected by FR-7 and FR-5 changes.

**Effort:** 1.5 hr

### Task 5.1: Verify Addons Catalog Data Flow

**Description:** End-to-end verification that addons data still flows correctly through the system after all changes. Addons are loaded via catalog detail API and used in item detail modal, cart, and checkout. This is the most complex data path and must not regress.

**Verify these paths still produce correct output:**

**Path 1 — Catalog Detail → Addons Selection:**
- `catalog/action.js:getCatalogDetail` hits `GET /catalog/{id}?sales_channel_id=` — returns `detail.addons[]`
- `detail.jsx` maps addons into UI, user selects addon items
- `detail.jsx:79` builds item with `{..., addons: additionals, subtotal}`

**Path 2 — Cart Addons Handling:**
- `cart.jsx:flattenAdditionals()` (line 46) normalizes addon data → `{ addon_group_id, addon_item_id, quantity }`
- `cart.jsx:97` assigns `base.addons = flattened` for bill/new items

**Path 3 — Checkout Payload with Addons:**
- `checkout.jsx:146` sends `base.addons` from `item?.additionals_flat` (items added via bill/cart)
- `checkout.jsx:154` sends `additionals_catalog_map` from `item?.addons` (rich addon data from catalog detail)

**Path 4 — Offline Queue Addons:**
- Offline queue stores item payload with `addons` field
- `localTransaction.js:buildOfflineTransactionPayload()` preserves addon structure

**Files to verify (no changes unless bug found):**
- `src/pages/authorize/home/detail.jsx`
- `src/pages/authorize/home/cart.jsx`
- `src/pages/authorize/home/checkout.jsx`
- `src/services/catalog/action.js`
- `src/services/catalog/hooks.js`
- `src/services/offline/localTransaction.js`

**Acceptance Criteria:**
- [ ] Catalog detail returns addons data with `addons[]` → `{ id, type, name, items: [{ id, name, price }] }`
- [ ] Item detail modal renders addon groups, user can select/quantity addon items
- [ ] Cart displays selected addons with correct labels and pricing
- [ ] Checkout payload includes both `addons` (flat) and `additionals_catalog_map` (rich) where applicable
- [ ] Offline-queued checkout retains addon data in preview
- [ ] No console errors in addons flow

**Effort:** 45 min
**Priority:** High
**Dependencies:** Task 4.1 (FR-7 channel_id removal could affect catalog detail response)

---

### Task 5.2: Regression Test — Checkout, Payment, Session, Membership

**Description:** Manual smoke test of all core flows after all changes applied. Verify no breakage from FR-1, FR-5, FR-7, FR-8, FR-9, FR-10.

**Test scenarios:**
1. **Login + Session:** Login → open session → verify session state shape is consistent (`session?.name`, `session?.role`)
2. **Catalog browse:** Browse catalog by category, search, view item detail with addons
3. **Cart + Checkout:** Add items with addons → cart displays correctly → checkout with cash payment
4. **Discount flow:** Apply per-category discount, cart-level discount — verify in checkout payload
5. **Membership:** Member search, NFC payment, saldo deduction
6. **Bill flow:** Save bill offline → open bill → checkout → verify single order on server
7. **Session close:** Close session → verify summary data
8. **Offline queue:** Go offline → create transaction → verify queue → come online → verify sync

**Acceptance Criteria:**
- [ ] All 8 test scenarios pass
- [ ] No console errors in any flow
- [ ] API payloads match contract (no `channel_id` in catalog POST, correct `PUT /sales/order/{id}` body)
- [ ] Offline items sync correctly after reconnection
- [ ] 401 during sync redirects to login (via simulated expiry)

**Effort:** 45 min
**Priority:** High
**Dependencies:** All Phase 1-4 tasks

---

## Quick Reference Checklist

- [ ] Task 1.1: Fix session shape in auth/hook.js
- [ ] Task 1.2: Fix PUT order param convention in sales/order/action.js
- [ ] Task 1.3: Remove duplicate PUT order from cart/action.js
- [ ] Task 1.4: Update cart/hook.js import to sales/order/action
- [ ] Task 2.1: Harden 401 handling in syncManager.js
- [ ] Task 2.2: Prevent orphan bills — dedup checkout in queue.js
- [ ] Task 2.3: Ensure ticket field in checkout payload
- [ ] Task 2.4: Reset retryCount per sync session
- [ ] Task 3.1: Add updateDevice mutation to sales/session/action.js
- [ ] Task 3.2: Create delivery/action.js
- [ ] Task 3.3: Create delivery/hook.js
- [ ] Task 4.1: Remove channel_id from create.jsx
- [ ] Task 5.1: Verify addons catalog data flow
- [ ] Task 5.2: Regression test all core flows

---

## Dependency Graph

```
Phase 1                  Phase 2                  Phase 3                  Phase 4
Task 1.1 (no deps)       Task 2.1 (no deps)       Task 3.1 (no deps)       Task 4.1 (no deps)
Task 1.2 (no deps)       Task 2.2 (no deps)                                    |
    |                    Task 2.3 → Task 2.2                                    v
    v                    Task 2.4 (no deps)                               Phase 5
Task 1.3 → Task 1.2                                                       Task 5.1 → Task 4.1
    ↓                                                                      Task 5.2 → all tasks
Task 1.4 → Task 1.3
```

## Next Steps

1. Review task breakdown
2. Run `/implement api-contract-audit` to start execution
3. Tasks execute in order: Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

---

*Tasks created with SDD 4.0*
