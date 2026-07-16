# Todo List: API Contract Remediation

**Task ID:** api-contract-audit
**Created:** 2026-07-15
**Status:** Complete (Implementation)

---

## Progress Log

| Date | Item | Status |
|------|------|--------|
| 2026-07-15 | Task 1.1: Fix session shape | ✅ |
| 2026-07-15 | Task 1.2: Fix PUT order param convention | ✅ |
| 2026-07-15 | Task 1.3: Remove duplicate PUT from cart/action | ✅ |
| 2026-07-15 | Task 1.4: Update cart/hook.js import | ✅ |
| 2026-07-15 | Task 2.1: 401 handling + logout/redirect | ✅ |
| 2026-07-15 | Task 2.2: Orphan bill dedup in queue.js | ✅ |
| 2026-07-15 | Task 2.3: ticket field in checkout payload | ✅ |
| 2026-07-15 | Task 2.4: retryCount reset per session | ✅ |
| 2026-07-15 | Task 3.1: updateDevice mutation | ✅ |
| 2026-07-15 | Task 3.2: delivery/action.js | ✅ |
| 2026-07-15 | Task 3.3: delivery/hook.js | ✅ |
| 2026-07-15 | Task 4.1: Remove channel_id from create.jsx | ✅ |
| 2026-07-15 | Fix: Session user mismatches across 9 consumers (auth/hook + checkout) | ✅ |

---

## Phase 1: Low-Risk Bug Fixes

- [x] Task 1.1: Fix session shape in auth/hook.js
- [x] Task 1.2: Fix PUT order param convention in sales/order/action.js
- [x] Task 1.3: Remove duplicate PUT order from cart/action.js
- [x] Task 1.4: Update cart/hook.js import to sales/order/action

## Phase 2: Offline Hardening

- [x] Task 2.1: Harden 401 handling in syncManager.js
- [x] Task 2.2: Prevent orphan bills — dedup checkout in queue.js
- [x] Task 2.3: Ensure ticket field in checkout payload
- [x] Task 2.4: Reset retryCount per sync session

## Phase 3: New Endpoints

- [x] Task 3.1: Add updateDevice mutation to sales/session/action.js
- [x] Task 3.2: Create delivery/action.js
- [x] Task 3.3: Create delivery/hook.js

## Phase 4: Backend-Verified Changes

- [x] Task 4.1: Remove channel_id from create.jsx

## Phase 5: Verification & Testing (Manual)

- [ ] Task 5.1: Verify addons catalog data flow
- [ ] Task 5.2: Regression test all core flows
