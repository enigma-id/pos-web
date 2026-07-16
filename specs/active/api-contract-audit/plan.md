# Technical Plan: API Contract Remediation

**Task ID:** api-contract-audit
**Status:** Ready for Implementation
**Based on:** spec.md (FR-1, FR-3, FR-4, FR-5, FR-7, FR-8, FR-9, FR-10)
**Skipped:** FR-2 (topup/payment_method), FR-6 (checkout extra fields), FR-11 (idempotency keys), FR-12 (outlet/service/charge)

---

## 1. System Architecture

### Affected File Map

```
src/
├── services/
│   ├── auth/
│   │   ├── hook.js           ← FR-1: fix session dispatch shape
│   │   └── slice.js          ← (no change needed)
│   ├── cart/
│   │   ├── action.js         ← FR-5: remove duplicate PUT /sales/order/{id}
│   │   └── hook.js           ← FR-5: re-import from sales/order/action
│   ├── sales/
│   │   ├── session/
│   │   │   └── action.js     ← FR-3: add PUT /sales/session/device
│   │   └── order/
│   │       ├── action.js     ← FR-5: canonical PUT /sales/order/{id}
│   │       └── hook.js       ← FR-5: verify usage
│   ├── catalog/
│   │   └── action.js         ← FR-7: remove channel_id (if backend doesn't accept)
│   ├── delivery/
│   │   ├── action.js         ← FR-4: NEW — GET /delivery/plan, POST /delivery/receive
│   │   └── hook.js           ← FR-4: NEW — hooks
│   └── offline/
│       ├── queue.js          ← FR-9: add checkout vs save-bill dedup
│       ├── syncManager.js    ← FR-8: 401 → dispatch logout/redirect
│       │                     ← FR-10: reset retryCount per sync session
│       └── slice.js          ← FR-8: (no change needed)
├── pages/authorize/home/
│   ├── checkout.jsx          ← FR-9: add ticket tracking for offline dedup
│   └── create.jsx            ← FR-7: remove channel_id field
└── components/               ← (no changes)
```

### Dependency Graph (FR → File)

```
FR-1  → auth/hook.js:35          [1 line change]
FR-3  → sales/session/action.js   [+8 lines: new endpoint]
FR-4  → delivery/action.js        [+30 lines: new API definitions]
        delivery/hook.js           [+25 lines: new hooks]
FR-5  → cart/action.js            [-7 lines: remove endpoint]
        cart/hook.js               [update import]
FR-7  → pages/create.jsx          [-1 field + wire]
FR-8  → offline/syncManager.js    [+15 lines: 401 → logout dispatch]
FR-9  → offline/queue.js          [+15 lines: save-bill dedup on checkout]
FR-10 → offline/syncManager.js    [+3 lines: reset retryCount]
```

---

## 2. Technology Stack

No new dependencies. All changes within existing stack:

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| API layer | RTK Query `createApi` | Existing pattern — consistent |
| State | Redux Toolkit `createSlice` | Existing pattern |
| Persistence | IndexedDB via `idb` | Existing offline queue |
| Auth dispatch | `react-redux` `useDispatch` | Existing pattern |

---

## 3. Component Design

### FR-1: Fix Session Shape

**File:** `src/services/auth/hook.js:36`

**Current:**
```js
dispatch(session(res?.data));
```

**Target:**
```js
dispatch(session(res?.data?.user));
```

**Rationale:** `login()` reducer (auth/slice.js:15) stores `state.session = action.payload.user` — a flat user object. But `getUser()` dispatches `session(res?.data)` where `res.data = { user: {...}, sales_session: {...} }`. The `session` reducer (slice.js:24) stores `state.session = action.payload` directly — so after getUser, `state.session` is `{ user, sales_session }` wrapper, breaking components that read `session?.name` or `session?.role`.

**Risk:** Low. Only `auth/hook.js` changes. All downstream reads of `state.session` now get consistent shape: the flat user object. `sales_session` remains available via `res?.data?.sales_session` if needed (e.g., service charge reads from `session?.sales_session?.outlet?.service_charges` at line 38 — this still works because `session(res?.data?.user)` doesn't wipe `session` entirely, but wait — line 38 accesses `res?.data?.sales_session` directly, not through Redux. Let me verify:

Line 36-40:
```js
dispatch(session(res?.data));
const charge = res?.data?.sales_session?.outlet?.service_charges;
```

After the fix (`dispatch(session(res?.data?.user))`), line 38 still reads from `res?.data?.sales_session` directly — this works fine because `res` is the raw API response, not the Redux state. No change needed for the charge line.

**Risk: Confirmed Low.** Exactly 1 line changed.

---

### FR-3: Add Device Tracking Endpoint

**File:** `src/services/sales/session/action.js`

**Add:**
```js
updateDevice: builder.mutation({
  query: payload => ({
    url: '/sales/session/device',
    method: 'PUT',
    body: payload,
  }),
}),
```

**Export:**
```js
export const {
  useStartMutation,
  useEndMutation,
  useUpdateDeviceMutation,  // NEW
  useLazySummaryQuery,
  useLazySessionQuery,
  useLazyShowSessionQuery,
} = salesSessionApi;
```

**Payload:** `{ latitude: float, longitude: float, battery_health: string }` per contract.
**No automatic GPS/battery capture** — just the API layer for future use.

**Impact:** None on existing flows. New endpoint, never called by UI yet.

---

### FR-4: Delivery Module Endpoints

**Files:** `src/services/delivery/action.js` (NEW), `src/services/delivery/hook.js` (NEW)

**action.js:**
```js
import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from '../../baseQuery';

export const deliveryApi = createApi({
  reducerPath: 'deliveryApi',
  baseQuery: baseQuery,
  endpoints: builder => ({
    getPlan: builder.query({
      query: params => ({
        url: '/delivery/plan',
        method: 'GET',
        params,
      }),
    }),
    receive: builder.mutation({
      query: payload => ({
        url: '/delivery/receive',
        method: 'POST',
        body: payload,
      }),
    }),
  }),
});

export const {
  useLazyGetPlanQuery,
  useReceiveMutation,
} = deliveryApi;
```

**hook.js:**
```js
import { useLazyGetPlanQuery, useReceiveMutation } from './action';

const useDelivery = () => {
  const [triggerPlan, planResult] = useLazyGetPlanQuery();
  const [receiveMutation, receiveResult] = useReceiveMutation();

  const getPlan = async (refCode) => {
    try {
      return await triggerPlan({ ref_code: refCode }).unwrap();
    } catch (err) {
      console.error('Delivery plan error:', err);
      throw err;
    }
  };

  const receive = async (payload) => {
    try {
      return await receiveMutation(payload).unwrap();
    } catch (err) {
      console.error('Delivery receive error:', err);
      throw err;
    }
  };

  return { getPlan, planResult, receive, receiveResult };
};

export default useDelivery;
```

**No UI required** — API layer only for future feature development.

---

### FR-5: Consolidate Duplicate PUT `/sales/order/{id}`

**Analysis:** Two definitions exist:
- `cart/action.js:32-38` — `query: ({ id, payload }) => body: payload` (correct parameter convention)
- `sales/order/action.js:15-23` — `query: ({ id, ...payload }) => body: { ...payload }` (different convention, possibly buggy when called with `{ id, payload }`)

**Decision:** Keep `cartApi`'s convention as canonical and move to `salesOrderApi`:

**Step 1:** Update `sales/order/action.js:15-23` to match canonical shape:
```js
update: builder.mutation({
  query: ({ id, payload }) => ({
    url: `/sales/order/${id}`,
    method: 'PUT',
    body: payload,
  }),
}),
```

**Step 2:** Remove duplicate from `cart/action.js` (lines 32-38 + export).

**Step 3:** Update `cart/hook.js:8` import — replace `useUpdateMutation` (from `'./action'`) with `useUpdateMutation` from `'../sales/order/action'`.

**Impact of the `payload` wrapping bug in current sales/order/action.js:** The existing `sales/order/hook.js:35` calls `updateMutation({ id, payload })` which the current action definition interprets as `body: { payload: {...} }`. This would send wrapped payload to server. However, this may not be triggered in practice — check if `order/hook.js:update` is actually called:

`order/hook.js:update` is a public hook exported for components. Looking at callers... the `update` in `cart/hook.js` uses `cartApi` version, which works correctly. The `order/hook.js:update` is likely unused for actual order updates (or could be broken). This consolidation will fix any latent issue.

**Risk:** Low. Both call sites (`cart/hook.js:242`, `order/hook.js:33`) pass the same `{ id, payload }` shape. After consolidation, both use canonical `body: payload`.

---

### FR-7: Clarify `channel_id` in POST `/catalog`

**Requires backend verification first.** Two possible paths:

**Path A (backend ignores `channel_id`):**
- Remove `channel_id: channel?.id` from `create.jsx:32`
- Remove channel dropdown UI from `CreateSection` (lines 130-178)
- Update payload building at line 28-33

**Path B (backend accepts `channel_id`):**
- Add `channel_id` to API contract under POST `/catalog`
- No code changes needed

**Implementation plan assumes Path A pending verification.** If Path A confirmed:

**File:** `src/pages/authorize/home/create.jsx`
- Remove `channel` state (line 22)
- Remove `channel_id` from payload (line 32)
- Remove channel dropdown JSX (lines 130-178)
- Remove channel dropdown ref (line 13)
- Trigger `getChannel()` can be removed (line 42-43)

---

### FR-8: Harden Offline Sync Against 401

**File:** `src/services/offline/syncManager.js`

**Current behavior** (lines 120-126): On 401, marks item as `failed`, dispatches `setOfflineError`, returns `{ ok: false, stop: true }`. Sync loop halts. User remains on POS screen.

**Target behavior:**
1. On 401, dispatch `logout()` action to clear auth state
2. Redirect to login page via `window.location.href` or import history
3. Failed items remain in IndexedDB queue (status: `failed`)
4. After re-login (page reload → `initSyncManager` → `syncNow()`), pending items resume
5. Error message in Redux: "Session expired. Please login again to sync pending transactions."

**Implementation:**
```js
// In syncManager.js, import auth actions
import { logout } from '../auth/slice';

// Inside processItem(), on 401:
if (status === 401) {
  await markFailed(item, 'Authentication expired. Please login again.');
  if (storeRef) {
    storeRef.dispatch(logout());  // Clear auth
    storeRef.dispatch(setOfflineError(
      'Session expired during sync. Pending items saved. Please login again.'
    ));
  }
  // Redirect — window.location reload triggers page refresh → login page
  setTimeout(() => { window.location.href = '/login'; }, 1500);
  return { ok: false, stop: true };
}
```

**Note:** `window.location.href` is the simplest approach for a SPA that uses browser-native auth redirect. If the app uses an in-app router, replace with `navigate('/login')` from the routing library. Check `main.jsx` for router setup — currently uses React Router with lazy-loaded routes via `import.meta.glob`. The auth guard is likely in `App.jsx` or router config. Since auth redirects on token absence, `window.location.href = '/'` may work (triggers SPA reload → auth guard).

**Alternative:** Import `createBrowserRouter`'s navigate or use the existing `onLogout` from `auth/hook.js`. However, since syncManager doesn't have React context, the simplest approach is dispatching `logout()` + `window.location.href = '/'` which triggers full page reload and reinitializes the app.

**Edge case:** If user is on a slow network and gets repeated 401s after re-login, the sync loop would fail again. This is acceptable — items persist in IndexedDB until manual intervention.

---

### FR-9: Prevent Orphan Bills (Save-Bill + Checkout Collision)

**File:** `src/services/offline/queue.js`

**Current behavior:** `addToQueue()` merges save-bill items when same `ticket` + same URL pattern (line 69-131). But if a checkout (`status: completed`) is queued AFTER a save-bill (`status: pending`) for the same ticket, both coexist — the checkout POST creates a new queue item.

**Target behavior:** When adding a checkout request to queue, if a pending save-bill with same `ticket` exists:
- **Option A** (preferred): Remove the pending save-bill from queue, then add checkout as new item. The pending bill is superseded by the checkout.
- **Option B:** Update pending save-bill's `status` to `completed` and merge checkout fields.

**Chosen:** **Option A** — simpler, avoids status inconsistency in queue.

**Implementation in `addToQueue()`**, after line 131 (after save-bill merge block):

```js
// If it's a checkout request (status: completed), remove any matching pending save-bill
const isCheckout =
  String(request?.url).toLowerCase().includes('/sales/order') &&
  request?.body?.status === 'completed' &&
  ticketName;

if (isCheckout && ticketName) {
  const allItems = await db.getAll(STORES.pendingRequests);
  const pendingBills = allItems.filter(
    item => String(item?.url).endsWith('open-bill') && item?.body?.ticket === ticketName
  );
  for (const bill of pendingBills) {
    await db.delete(STORES.pendingRequests, bill.id);
  }
}
```

**Requirement:** The frontend must include `ticket` in the checkout payload when it knows the bill was saved offline. In `checkout.jsx`, after `handlePay()` builds the payload, if the order originated from a save-bill, include the ticket name in the request body. This is already present in save-bill flow — verify it's also present in checkout flow for offline cases.

**Check:** `checkout.jsx:handlePay()` builds payload. The `ticket` field is present in save-bill (`handleSaveBill` at line 327) but may not be in checkout payload. If missing, FR-9 cannot find the matching save-bill in queue.

**Resolution:** Add `ticket` to checkout payload when the cart has a pending bill reference (i.e., `CartState.bill` is set). Add as optional field — backend can ignore.

---

### FR-10: Reset Retry Counter Per Sync Session

**File:** `src/services/offline/syncManager.js`

**Current behavior:** `processItem()` continues from `item.retryCount` which persists across sync sessions. If an item had `retryCount: 2` from a previous failed session, it only gets 1 more attempt.

**Target behavior:** Reset `retryCount` to 0 before entering retry loop in `processItem()`, ensuring each sync session gives a full budget of MAX_RETRY (3) attempts.

**Implementation:** Add at line 106 (inside `processItem()`, before the retry loop):
```js
// Reset retry budget for this sync session
await updateQueueItem(item.id, { retryCount: 0 });
item.retryCount = 0;
```

**Note:** `retryFailedItem()` already resets `retryCount: 0` (line 230) — this is an independent code path for manual retry. The new reset applies to regular sync processing.

---

## 4. Data Model

No schema changes. IndexedDB queue (`pos-offline-queue` v1) unchanged.

**Queue item shape** unaffected — all changes are behavioral/logic within `addToQueue()` and `processItem()`.

---

## 5. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| FR-8: Expired token replay | 401 immediately halts sync, dispatches logout, redirects to login. No stale token replay. |
| FR-8: Re-login sync resume | After re-login, `initSyncManager` runs at boot, processes queue fresh. Failed items require manual retry via `retryFailedItem()`. |
| FR-9: Orphan prevention | Removing pending save-bill from queue prevents double-order on server. |
| FR-1: Session consistency | Consistent `session` shape prevents components from misreading role/name — no auth bypass risk. |

---

## 6. Performance Strategy

| Concern | Approach |
|---------|----------|
| FR-10: retryCount reset | Reset is a single IndexedDB `put` per item — negligible cost |
| FR-9: Queue scan for matching bills | `db.getAll()` then filter — acceptable for typical queue sizes (< 100 items) |
| FR-8: 401 redirect | One-time dispatch + redirect — no performance impact on happy path |

---

## 7. Implementation Phases

### Phase 1: Low-Risk Bug Fixes (FR-1, FR-5)

**Estimated: 30 min**

- [ ] FR-1: Change `dispatch(session(res?.data))` → `dispatch(session(res?.data?.user))` in `auth/hook.js:36`
- [ ] FR-5: Fix `sales/order/action.js:16` parameter convention to `({ id, payload })` → `body: payload`
- [ ] FR-5: Remove duplicate from `cart/action.js` (lines 32-38 + export)
- [ ] FR-5: Update `cart/hook.js:8` import to use `useUpdateMutation` from `'../sales/order/action'`

### Phase 2: Offline Hardening (FR-8, FR-9, FR-10)

**Estimated: 1.5 hr**

- [ ] FR-8: `syncManager.js` — on 401, dispatch `logout()`, set error, redirect to login
- [ ] FR-9: `queue.js` — add checkout-dedup logic after save-bill merge block
- [ ] FR-9: `checkout.jsx` — ensure `ticket` field in checkout payload for offline flows
- [ ] FR-10: `syncManager.js` — reset `retryCount: 0` at start of `processItem()`

### Phase 3: New Endpoints (FR-3, FR-4)

**Estimated: 1 hr**

- [ ] FR-3: Add `updateDevice` mutation + export to `sales/session/action.js`
- [ ] FR-4: Create `delivery/action.js` with `getPlan` query + `receive` mutation
- [ ] FR-4: Create `delivery/hook.js` with wrapper hooks

### Phase 4: Backend-Verified Changes (FR-7)

**Estimated: 1 hr (blocked on backend verification)**

- [ ] FR-7: Verify backend accepts `channel_id` in POST `/catalog`
- [ ] FR-7: If ignored — remove `channel_id` from `create.jsx:32` + channel dropdown UI
- [ ] FR-7: If accepted — document in API contract

---

## 8. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| FR-5: Wrong import breaks cart update | High — checkout may fail to update orders | Low — diff is trivial, easy to verify | Test update order flow in sandbox after consolidation |
| FR-8: `window.location.href` causes SPA issues | Medium — full reload resets React state | Low — auth guard redirects unauthenticated users; queue persists in IndexedDB | Test offline-with-401 → login → sync flow |
| FR-9: `ticket` field missing in checkout payload | High — dedup won't trigger, orphan bills persist | Medium — `ticket` is sent in save-bill; may not be in checkout | Verify `checkout.jsx` payload builder includes `ticket` when `CartState.bill` exists |
| FR-1: `session?.sales_session` consumers break if any | Medium — service charge read breaks | Low — service charge reads from raw `res.data`, not Redux state | Confirm all `session.sales_session` access is direct (not through Redux) |
| FR-10: Reset retryCount causes infinite retries on persistent error | Low — MAX_RETRY=3 still enforced, just resets per sync session | Low — sync session is triggered by online event (not infinite loop) | Each online event = new session = fresh retries. Acceptable — if error persists, item goes to failed. |

---

## 9. Open Questions

- [ ] FR-7: Does backend accept `channel_id` in POST `/catalog`? Need API test. Answer: remove channel_id.
- [ ] FR-9: Does checkout payload in `checkout.jsx` already include `ticket` when cart has a pending bill? Need to read checkout.jsx line 200-ish. Answer: in payload have ticket ? if no remove.
- [ ] FR-8: Is `window.location.href = '/'` the correct redirect path for the login page? Check `App.jsx` router config. Answer: yes.
- [ ] FR-4: Is delivery module in current v2 sprint? Impacts whether FR-4 is Should Have or Nice to Have. Answer: need to add UI also.

---

## Next Steps

1. Review plan
2. Resolve open questions (especially FR-7 backend verification)
3. Run `/tasks api-contract-audit` to generate implementation task breakdown
4. Run `/implement api-contract-audit` to start building

---

*Plan created with SDD 4.0*
