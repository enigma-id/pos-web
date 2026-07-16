# Specification: API Contract vs Frontend Implementation — Remediation

**Task ID:** api-contract-audit
**Created:** 2026-07-15
**Status:** Ready for Planning
**Version:** 1.0

---

## 1. Problem Statement

- **The Problem:** The frontend implementation at `src/services/` has drifted from the API contract (`specs/api-contract.md`). 35 endpoints exist, but there are missing endpoints, payload mismatches, field name discrepancies, and a confirmed bug in session state management. The offline system (IndexedDB queue + sync engine) is undocumented in the contract and has its own gaps (401 handling, retry accumulator, orphan bills).

- **Current Situation:** Checkout, payment, session management, and membership flows work in nominal online conditions. However, the following are broken or suboptimal:
  1. `GET /profile/me` response stores wrong shape in Redux — components reading `session?.name` get `undefined` after profile refresh
  2. Three contract endpoints never implemented (`PUT /sales/session/device`, `GET /delivery/plan`, `POST /delivery/receive`)
  3. `PUT /sales/order/{id}` defined in two API services (duplicate)
  4. Checkout payload sends 3 fields not in contract (`note`, `card_id`, `additionals_catalog_map`)
  5. Custom catalog POST sends `channel_id` not in contract
  6. Session close summary reads `topups`/`payment_methods` — contract says `topup`/`payment_method`
  7. Offline sync hits 401 → all pending items stuck as `failed`, no auto-redirect to login
  8. Offline save-bill + checkout for same ticket creates orphan orders on sync
  9. Idempotency keys generated client-side but never verified against server
  10. Offline retry accumulator doesn't reset between sync sessions

- **Desired Outcome:** Frontend fully aligned with API contract. All gaps documented, fixed, or explicitly accepted as frontend extensions. Offline system hardened against token expiry and orphan data. No regression on any currently working flow.

---

## 2. User Personas

### Primary User: Cashier
- **Who:** Frontline staff operating POS terminal at bakery outlet
- **Goals:** Process sales, manage bills, open/close shift, handle membership payments — even when internet is down
- **Pain points:** When offline, transactions queue but may fail to sync silently. Token expiry during sync loses all queued data.

### Secondary User: Supervisor/Manager
- **Who:** Outlet manager who closes shifts and reconciles payments
- **Goals:** Accurate end-of-shift summary, confidence that offline-queued transactions eventually sync
- **Pain points:** Offline pending count warning on session close is informative but doesn't guarantee sync success

### Tertiary User: Backend API
- **Who:** Server-side contract enforced by validation
- **Goals:** Receive correct payload shapes matching contract spec
- **Pain points:** Extra fields sent by frontend (`note`, `card_id`, `channel_id`) may be silently ignored or cause validation warnings

---

## 3. Functional Requirements

### FR-1: Fix Session State Shape in Redux

**Description:** `auth/hook.js:35` dispatches `session(res?.data)` but login path stores `session(res?.data?.user)`. This inconsistency means `state.session` is either a flat user object or a `{user, sales_session}` wrapper depending on which auth action runs first.

**User Story:**
> As a cashier, I want my session info (name, role) to remain consistent after refreshing my profile, so that I never see a blank name or broken UI after a profile update.

**Acceptance Criteria:**
- [ ] Given auth is initialized via `getUser()`, when response returns `{user, sales_session}`, then Redux `state.session` stores only the `user` object (not the wrapper)
- [ ] Given auth is initialized via `login()`, when response returns `{access_token, refresh_token, user, sales_session}`, then Redux `state.session` stores the `user` object consistently
- [ ] Components accessing `state.session?.name` and `state.session?.role` return expected values regardless of auth initialization path
- [ ] No regression in login, logout, or profile refresh flows

**Priority:** Must Have

---

### FR-2: Align Session Close Summary Field Names

**Description:** `closeSession.jsx` reads `summary.topups` and `summary.payment_methods` but API contract defines singular `topup` and `payment_method`. One of them is wrong — resolve and fix accordingly.

**User Story:**
> As a supervisor, I want the session close summary to correctly display topup data and payment method breakdowns, so that my end-of-shift reconciliation is accurate.

**Acceptance Criteria:**
- [ ] Determine if backend returns singular (`topup`, `payment_method`) or plural (`topups`, `payment_methods`)
- [ ] If backend uses singular → update `closeSession.jsx` to read `summary.topup` and `summary.payment_method`
- [ ] If backend uses plural → update API contract to match `$summary.topups` and `$summary.payment_methods`
- [ ] Session close page renders topup list and payment method breakdown correctly

**Priority:** Must Have

---

### FR-3: Add Missing `PUT /sales/session/device` Endpoint

**Description:** Contract defines endpoint for periodic device tracking (lat, long, battery). Frontend has no implementation.

**User Story:**
> As an operations manager, I want the POS to periodically report device location and battery health, so that I can monitor device status across outlets.

**Acceptance Criteria:**
- [ ] New endpoint defined in `sales/session/action.js`: `PUT /sales/session/device`
- [ ] Mutation accepts `{latitude, longitude, battery_health}` payload per contract
- [ ] Implementation does NOT automatically capture GPS/battery — just provides the endpoint for future use
- [ ] Existing session open/close flows unaffected

**Priority:** Nice to Have

---

### FR-4: Add Delivery Module Endpoints

**Description:** Contract §8 defines `GET /delivery/plan?ref_code=` and `POST /delivery/receive`. Neither is implemented.

**User Story:**
> As a stock manager, I want to look up delivery plans by reference code and confirm receipt of delivery items, so that inventory is updated automatically when goods arrive.

**Acceptance Criteria:**
- [ ] `GET /delivery/plan` defined in new `delivery/action.js` with `ref_code` query param
- [ ] `POST /delivery/receive` defined in `delivery/action.js` with payload per contract
- [ ] Hooks created for both endpoints following existing pattern
- [ ] No UI required — API layer only for future feature development

**Priority:** Nice to Have (deferred if delivery module not in current roadmap)

---

### FR-5: Consolidate Duplicate `PUT /sales/order/{id}`

**Description:** Endpoint defined in both `cart/action.js:33` (cartApi) and `sales/order/action.js:16` (salesOrderApi). Confusing for maintenance.

**User Story:**
> As a developer, I want a single canonical definition for `PUT /sales/order/{id}`, so that I don't have to maintain two copies.

**Acceptance Criteria:**
- [ ] Choose one API service to own the endpoint (recommended: `sales/order/action.js` as it's the domain-appropriate service)
- [ ] Remove duplicate definition from `cart/action.js`
- [ ] Update `cart/hook.js` imports to reference the surviving definition
- [ ] All call sites (`cart/hook.js:update`, `sales/order/hook.js:update`) use same endpoint definition
- [ ] No regression in order update flow

**Priority:** Should Have

---

### FR-6: Clarify Extra Fields in Checkout Payload

**Description:** Frontend sends `note`, `card_id`, and `additionals_catalog_map` in checkout payload — none in contract. Either add to contract or remove from frontend.

**User Story:**
> As a cashier, I want to add notes to an order and pay via NFC card, so that the order has necessary context and member payment works correctly.

**Acceptance Criteria:**
- [ ] Verify backend accepts `note`, `card_id`, `additionals_catalog_map` — do they process or ignore?
- [ ] If backend processes them → add fields to API contract under POST `/sales/order`
- [ ] If backend ignores them → remove from `checkout.jsx` frontend code
- [ ] No regression in checkout or NFC payment flow

**Priority:** Should Have

---

### FR-7: Clarify Extra `channel_id` in Custom Catalog POST

**Description:** `create.jsx:32` sends `channel_id` in POST `/catalog` payload — not in contract.

**User Story:**
> As a cashier, I want to create a custom catalog item for the current sales channel, so that the item appears with correct pricing at my outlet.

**Acceptance Criteria:**
- [ ] Verify backend accepts `channel_id` in POST `/catalog`
- [ ] If backend uses `channel_id` → add to API contract
- [ ] If backend ignores it → remove from `create.jsx`
- [ ] No regression in create-custom-item flow

**Priority:** Should Have

---

### FR-8: Harden Offline Sync Against Token Expiry (401)

**Description:** When token expires during offline sync replay, all pending items become `failed` with no auto-redirect. User stays on POS screen unaware that sync has irrecoverably halted.

**User Story:**
> As a cashier, if my session expires while I'm offline, I want the system to redirect me to the login page when online sync fails with 401, so that I can re-authenticate and resume sync.

**Acceptance Criteria:**
- [ ] `syncManager.js` — when `processItem()` receives 401, dispatch logout action (or redirect to login)
- [ ] After re-login, trigger `syncNow()` automatically to resume processing
- [ ] Failed items remain in queue (status: `failed`) until re-login completes
- [ ] Show appropriate error message: "Session expired. Please login again to sync pending transactions."
- [ ] No regression in normal (non-401) sync flow

**Priority:** Must Have

---

### FR-9: Prevent Orphan Bills from Offline Save-Bill + Checkout

**Description:** If user saves bill offline (status: pending) then also queues checkout (status: completed) for same ticket, both POST `/sales/order` requests coexist in queue. On sync, the pending bill runs first, creating a server-side orphan — the checkout also succeeds independently.

**User Story:**
> As a cashier, when I save a bill offline and later check it out (also offline), I want only one transaction to sync, so that I don't create duplicate/orphan orders on the server.

**Acceptance Criteria:**
- [ ] `addToQueue()` — when a checkout request is queued for same `ticket` as an existing pending save-bill, either:
  - Option A: Remove the pending save-bill from queue, OR
  - Option B: Update the pending save-bill's `status` to `completed` and merge checkout fields
- [ ] If user closes the save-bill's ticket after checkout, no stale pending bill remains in queue
- [ ] No regression in offline save-bill merge logic (existing merge by `catalog_id` + `addons`)

**Priority:** Should Have

---

### FR-10: Reset Retry Counter Per Sync Session

**Description:** `processItem()` continues from `item.retryCount` instead of resetting per-sync-session. An item retried 2× previously only gets 1 more attempt.

**User Story:**
> As a cashier, I want each new sync session to give pending items a full retry budget (3 attempts), so that items that failed previously get a fair chance to sync.

**Acceptance Criteria:**
- [ ] Before entering the retry loop in `processItem()`, reset `retryCount` to 0 (or accept caller-provided value)
- [ ] `syncNow()` sync session provides fresh retry budget for all pending items
- [ ] `retryFailedItem()` still manually resets `retryCount: 0` (already implemented)
- [ ] No infinite retry — max 3 attempts still enforced

**Priority:** Should Have

---

### FR-11: Wire Idempotency Keys to Server-Side Dedup

**Description:** Idempotency keys are generated and stored (`idempotencyKeys` IndexedDB store) but never included in request headers/body for server-side dedup verification.

**User Story:**
> As a developer, I want idempotency keys sent with each queued request so that the server can deduplicate if the same request is replayed.

**Acceptance Criteria:**
- [ ] Include `Idempotency-Key` header (or body field) in replayed requests from sync engine
- [ ] `executeQueuedRequest()` attaches stored `idempotencyKey` to replayed request
- [ ] Server-side contract updated to document idempotency header expectation (if not already)
- [ ] No regression in offline queue or sync flow

**Priority:** Nice to Have

---

### FR-12: Add `/outlet/service/charge` to Contract or Remove Endpoint

**Description:** `outlet/action.js:11` defines `GET /outlet/service/charge` but this endpoint is NOT in API contract. All call sites have `getServiceCharge()` commented out. Service charge is instead sourced from auth session's `outlet.service_charges`.

**User Story:**
> As a developer, I want the codebase to be consistent — either the endpoint is documented in the contract or removed from the codebase.

**Acceptance Criteria:**
- [ ] If endpoint is valid and used → add `GET /outlet/service/charge` to API contract
- [ ] If endpoint is dead code → remove `outlet/action.js` and `outlet/hooks.js`
- [ ] No regression in service charge flow (already sourced from auth session, not this endpoint)

**Priority:** Nice to Have

---

## 4. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Performance** | Offline sync should not block UI thread — sync runs async via `syncManager.js` |
| **Performance** | IndexedDB operations must not degrade cart/checkout interaction latency |
| **Reliability** | Offline-queued items must survive browser close/refresh (IndexedDB persistence) |
| **Reliability** | Sync retry must exhaust all 3 attempts before marking item as `failed` |
| **Security** | Token expiry must halt sync immediately — never replay with expired token |
| **Security** | Password field in cancel flow must be sent as plain text (contract requirement) |
| **Maintainability** | One canonical definition per endpoint — no duplicates |
| **Maintainability** | Extra fields must be either removed or added to contract — no undocumented drift |
| **Backward Compatibility** | Fixing session shape must not break existing login/getUser flows |
| **Backward Compatibility** | All fixes must preserve existing checkout/payment/session/membership behavior |

---

## 5. Out of Scope

- ❌ **UI redesign for offline flows** — Current OfflineBanner/PendingDrawer/SyncIndicator are adequate. Only functional hardening in scope.
- ❌ **Auto GPS/location capture** — `PUT /sales/session/device` endpoint added but no automatic GPS polling. Cashier manual entry or future feature.
- ❌ **Delivery module UI** — Only API layer. No delivery screens.
- ❌ **Full refresh token flow** — Storing `refresh_token` and implementing silent refresh. On 401 during sync, user re-logs in manually.
- ❌ **Queueing offline queries (GET)** — Only mutations are intercepted. GET failures are not part of this remediation.
- ❌ **End-to-end tests** — Not creating integration/E2E tests for existing flows. Manual verification only.
- ❌ **API contract rewrite** — Contract is correct reference; individual field updates only as needed.

---

## 6. Edge Cases & Error Handling

| Scenario | Expected Behavior |
|----------|-------------------|
| User logs out before offline items sync | Queue persists in IndexedDB. On next login, `initSyncManager` processes pending items (if page reloads). |
| Two offline save-bills with different tickets, then checkout one | Existing merge logic handles: pending save-bills kept separate. Checkout for ticket A should remove/convert ticket A's pending bill. |
| Network comes back, sync starts, drops again mid-sync | `processItem()` hits network error → retry (up to 3×). Subsequent items in same batch skipped until next online event. |
| Token expires while offline, user queues 20 transactions | First replayed request returns 401 → all 20 items marked `failed`. User redirected to login. On re-login, must manually trigger sync or retry failed items. |
| Session close attempted with >0 pending items | Warning modal shown. User can proceed (closes session locally, queued items sync later) or cancel. |
| Custom catalog item created with `channel_id` that backend ignores | Item created without channel association. PR-7 resolves this alignment. |
| Cancel order with invalid password | Backend returns 422 validation error. Frontend shows error in failure dispatch. |

| Error | User Message | System Action |
|-------|--------------|---------------|
| 401 during sync | "Session expired. Please login again to sync pending transactions." | Sync halted, mark all pending as `failed`, redirect to login |
| Save-bill merge conflict | (silent) | Items merged by `catalog_id` + `addons` — user sees consolidated item count |
| 422 on cancel (bad password) | "Invalid password. Refund cancelled." | No action taken on order |
| Checkout offline, then comes online before sync | (silent) | `baseQuery.js` sends to API directly. Queue item remains until sync cycle removes completed duplicates (idempotency key handles dedup) |
| Queue reaches >100 pending items | "Many pending transactions. Contact support." | `setWarning` dispatched. Existing behavior — no change needed. |

---

## 7. Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Session state consistency | 100% — `session?.name` always returns username | Manual test: login → refresh profile → read `state.Auth.session.name` |
| Endpoint coverage | 35/35 endpoints mapped in contract | Re-run endpoint coverage matrix |
| Offline sync survival after 401 | All pending items visible in queue after re-login | Simulate 401 during sync → login again → confirm items in PendingDrawer |
| No orphan bills from save-bill + checkout | Single order on server per checkout | Queue save-bill offline → queue checkout → sync → verify 1 order on server |
| Extra payload fields | Either documented in contract or removed | Re-run payload shape comparison |
| Retry budget per sync session | 3 attempts per item per sync session | Log `retryCount` reset on `syncNow()` start |

---

## 8. Open Questions

- [ ] OF-1: Does backend return `topup` (singular) or `topups` (plural)? Same for `payment_method` vs `payment_methods`. Need to check actual API response or backend team input.
- [ ] FR-6: Does backend accept `note`, `card_id`, `additionals_catalog_map`? Need API test or backend confirmation.
- [ ] FR-7: Does backend accept `channel_id` in POST `/catalog`? Need API test or backend confirmation.
- [ ] FR-4: Is delivery module in current v2 roadmap? If yes, priority increases from Nice-to-Have to Should Have.
- [ ] FR-11: Does server already support `Idempotency-Key` header? Check backend docs or team.

---

## 9. Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-07-15 | Initial specification — covers all 10 audit findings + offline system hardening |

---

## Next Steps

1. Review spec with stakeholders
2. Resolve open questions (field name pluralization, backend acceptance of extra fields)
3. Run `/plan api-contract-audit` to create technical implementation plan

---

*Specification created with SDD 4.0*
