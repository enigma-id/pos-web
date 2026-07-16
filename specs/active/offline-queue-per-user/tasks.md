# Implementation Tasks: Per-User Offline Queue Database

**Task ID:** offline-queue-per-user
**Created:** 2026-07-15
**Status:** Ready for Implementation

## Summary

| Metric | Value |
|--------|-------|
| Total Tasks | 10 |
| Estimated Effort | ~6-8 hours |
| Phases | 5 |

---

## Phase 1: Queue Layer Refactor

**Goal:** Restructure `queue.js` to support per-user databases, remove idempotency, add migration helpers.

**⚠️ Important — userId source:** From Redux state: `Auth.session.user.id` (integer). Convert to `String(userId)` for consistent Map keys.

### Task 1.1: Remove idempotency stores and functions

**Description:** Remove `idempotencyKeys` store from DB schema, remove all idempotency-related exports (`generateIdempotencyKey`, `hasIdempotentKey`, `setIdempotentKey`, `checkAndSetIdempotency`, `cleanupExpiredIdempotencyKeys`, `QUEUE_STORES`).

**Acceptance Criteria:**
- [ ] DB version bumped (VERSION 1 → 2)
- [ ] `idempotencyKeys` store removed from `upgrade` callback
- [ ] All idempotency functions deleted
- [ ] No imports of deleted functions elsewhere in codebase
- [ ] `QUEUE_STORES` removed

**Effort:** 1 hour
**Priority:** High
**Dependencies:** None

---

### Task 1.2: Replace singleton DB with per-user DB instances

**Description:** Replace `dbPromise` singleton with `Map<userId, dbPromise>`. Add `getDBName(userId)` helper. All `ensureDB()` calls now require `userId`. Add `closeUserDB(userId)` and `deleteUserDB(userId)`.

**Acceptance Criteria:**
- [ ] `dbPromise` replaced with `dbInstances` Map
- [ ] `getDBName(userId)` returns `pos-offline-queue-{userId}`
- [ ] `ensureDB(userId)` creates/returns correct per-user DB
- [ ] `ensureDB(null)` throws or returns null
- [ ] `closeUserDB(userId)` closes and removes from Map
- [ ] `deleteUserDB(userId)` closes and deletes entire IndexedDB
- [ ] `DB_VERSION` bumped to 2

**Effort:** 1.5 hours
**Priority:** High
**Dependencies:** Task 1.1

---

### Task 1.3: Add `userId` param to all queue functions

**Description:** Add `userId` as the last param to all exported functions: `initQueueDB`, `addToQueue`, `getQueue`, `getQueueByStatus`, `getQueueItem`, `updateQueueItem`, `removeFromQueue`, `clearQueue`, `getPendingCount`, `setLastSyncTime`, `getLastSyncTime`, `incrementSyncAttempt`, `resetMetadata`, `getAllMetadata`.

**Acceptance Criteria:**
- [ ] Every function signature updated to accept `userId`
- [ ] Every function passes `userId` to `ensureDB(userId)`
- [ ] `getPendingCount` uses `getQueueByStatus` with `userId`
- [ ] Default value for `userId` is not allowed (must be explicit)
- [ ] All internal calls within queue.js also pass userId

**Effort:** 1 hour
**Priority:** High
**Dependencies:** Task 1.2

---

### Task 1.4: Add legacy migration functions

**Description:** Add `migrateLegacyQueue(userId)` that reads from old `pos-offline-queue` DB, groups items by user (extracting user from `item.token` — parse JWT payload's `sub` or `user_id` claim), writes each group to the respective per-user DB, then deletes legacy DB. Also add `getLegacyQueue()` helper.

**Acceptance Criteria:**
- [ ] `getLegacyQueue()` reads all items from old single DB
- [ ] `migrateLegacyQueue(userId)` processes one user's items
- [ ] JWT payload decoded (simple `atob` split) to extract user identity
- [ ] Items without valid token skipped (logged)
- [ ] Legacy DB deleted after successful migration
- [ ] If any write fails, legacy DB is NOT deleted
- [ ] `deleteUserDB` handles deleting the legacy DB by name

**Effort:** 2 hours
**Priority:** Medium
**Dependencies:** Task 1.2

---

## Phase 2: Fix 401 Death Spiral

**Goal:** Sync manager no longer force-logouts on 401. Items are marked as failed instead.

### Task 2.1: Replace 401 force-logout with graceful failure

**Description:** In `syncManager.js`'s `processItem`, replace the 401 handler: remove `storeRef.dispatch(logout())`, remove `setOfflineError`, remove redirect. Instead, call `markFailed(item, 'Session expired. Please login again.')` and return `{ ok: false }` (without `stop: true`).

**Acceptance Criteria:**
- [ ] 401 handler no longer calls `logout()`
- [ ] 401 handler no longer redirects to `/`
- [ ] Item is marked as 'failed' with descriptive message
- [ ] Sync continues (doesn't halt the queue) — `{ ok: false }` without `stop: true`
- [ ] Other error handlers unchanged

**Effort:** 0.5 hours
**Priority:** High
**Dependencies:** None

---

### Task 2.2: Scope sync manager to current user

**Description:** All queue calls in `syncManager.js` pass `userId` from `storeRef.getState()?.Auth?.session?.user?.id`. `broadcastQueueState()` reads only current user's queue. `syncNow()` processes only current user's items.

**Acceptance Criteria:**
- [ ] `getCurrentUserId()` helper reads from Redux state
- [ ] `getQueue(userId)` used instead of `getQueue()`
- [ ] `getQueueByStatus('pending', userId)` used everywhere
- [ ] `broadcastQueueState()` reflects only current user's items
- [ ] If no user logged in, all sync operations skip gracefully

**Effort:** 1 hour
**Priority:** High
**Dependencies:** Task 1.3, Task 2.1

---

## Phase 3: Auth Integration

**Goal:** Login triggers queue recovery. Logout cleans up empty databases.

### Task 3.1: Queue cleanup on logout

**Description:** In `auth/hook.js`'s `onLogout`, add: get `userId` from state before dispatch(logout), call `getPendingCount(userId)`, if 0 → `deleteUserDB(userId)`, if > 0 → leave DB intact. Make `onLogout` async or use fire-and-forget.

**Acceptance Criteria:**
- [ ] User ID captured BEFORE `dispatch(logout())` clears state
- [ ] `getPendingCount(userId)` called to check queue
- [ ] `deleteUserDB(userId)` called when queue empty
- [ ] DB kept when queue has items
- [ ] Cleanup failure doesn't block logout
- [ ] No errors if DB doesn't exist

**Effort:** 1 hour
**Priority:** High
**Dependencies:** Task 1.2, Task 1.3

---

### Task 3.2: Login queue recovery

**Description:** In `auth/hook.js`'s `signin`, after successful login: call `migrateLegacyQueue(userId)` (fire-and-forget), then trigger `syncNow()`. Import `syncNow` from offline services.

**Acceptance Criteria:**
- [ ] `migrateLegacyQueue(userId)` called after login success
- [ ] `syncNow()` called after login success
- [ ] Both are fire-and-forget (not awaited to avoid blocking UI)
- [ ] Failure doesn't block the login flow
- [ ] No duplicate syncs on page load

**Effort:** 0.5 hours
**Priority:** Medium
**Dependencies:** Task 1.4, Task 2.2

---

## Phase 4: Consumers Update

**Goal:** Update callers to pass userId to queue functions.

### Task 4.1: Update baseQuery to pass userId

**Description:** In `baseQuery.js`, read `userId` from `api.getState()?.Auth?.session?.user?.id`, pass to `addToQueue(request, userId)` and `getPendingCount(userId)`.

**Acceptance Criteria:**
- [ ] `userId` extracted from API state
- [ ] `addToQueue(request, userId)` with userId param
- [ ] `getPendingCount(userId)` with userId param
- [ ] If no userId (not logged in), queue operation skipped

**Effort:** 0.5 hours
**Priority:** High
**Dependencies:** Task 1.3

---

### Task 4.2: Update closeSession to pass userId

**Description:** In `closeSession.jsx`, read `userId` from Redux state (`Auth.session.user.id`), pass to `clearQueue(userId)` in the "Close Anyway" handler.

**Acceptance Criteria:**
- [ ] `userId` read from Redux `useSelector`
- [ ] `clearQueue(userId)` with userId param
- [ ] No regression in close session flow

**Effort:** 0.5 hours
**Priority:** Medium
**Dependencies:** Task 1.3

---

## Phase 5: Init Cleanup

**Goal:** Sync manager doesn't auto-sync before user is known.

### Task 5.1: Remove auto-sync from initSyncManager

**Description:** In `syncManager.js`'s `initSyncManager`, remove the `setTimeout(() => syncNow(), 3000)` call. Also remove the online listener if it doesn't check for logged-in user (or guard it with userId check).

**Acceptance Criteria:**
- [ ] No auto-sync on app startup without a logged-in user
- [ ] Online listener only triggers sync if user is logged in
- [ ] `broadcastQueueState()` still runs (shows empty state)
- [ ] Login triggers sync instead (handled in Task 3.2)

**Effort:** 0.5 hours
**Priority:** Medium
**Dependencies:** Task 3.2

---

## Quick Reference Checklist

- [ ] **1.1** Remove idempotency stores and functions
- [ ] **1.2** Replace singleton DB with per-user DB instances
- [ ] **1.3** Add `userId` param to all queue functions
- [ ] **1.4** Add legacy migration functions
- [ ] **2.1** Replace 401 force-logout with graceful failure
- [ ] **2.2** Scope sync manager to current user
- [ ] **3.1** Queue cleanup on logout
- [ ] **3.2** Login queue recovery
- [ ] **4.1** Update baseQuery to pass userId
- [ ] **4.2** Update closeSession to pass userId
- [ ] **5.1** Remove auto-sync from initSyncManager

---

## Next Steps

1. Review task breakdown
2. Run `/implement offline-queue-per-user` to start execution
3. Execute in order — Phase 1 first, then sequential

---

*Tasks created with SDD 2.0*
