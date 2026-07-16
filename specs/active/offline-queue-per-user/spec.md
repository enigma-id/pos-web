# Specification: Per-User Offline Queue Database

**Task ID:** offline-queue-per-user
**Created:** 2026-07-15
**Status:** Ready for Planning
**Version:** 1.0

---

## 1. Problem Statement

**The Problem:** The offline queue uses a single IndexedDB database (`pos-offline-queue`) shared across all users on the same POS device. When a different user logs in, the sync manager loads stale queue items from the previous user — items carrying expired tokens and stale session IDs. Processing these items triggers 401 errors, which force a global app logout, making the new user unable to stay logged in. Additionally, logging out cannot safely clear the queue because there's no way to distinguish which items belong to which user.

**Current Situation:**
- Single DB, all users' queue items mixed together
- No user_id tag on queue items
- Logout doesn't touch the queue (fear of data loss)
- Login loads ALL queue items regardless of user
- Stale items with wrong tokens cause 401 → force logout death spiral

**Desired Outcome:**
- Each user's queue items are stored in their own database
- Switching users has zero risk of cross-contamination
- Logout safely cleans up empty databases
- Login with existing pending items recovers them properly

---

## 2. User Personas

### Primary User: POS Cashier
- **Who:** Staff at Suka Bread outlet using the POS terminal
- **Goals:** Complete transactions even when internet is down; switch shifts without data loss
- **Pain points:** Getting randomly logged out because another user's stale items triggered errors

### Secondary User: Store Manager
- **Who:** Supervisor who logs in to check shifts and session summaries
- **Goals:** View session data without interference from cashier's pending transactions
- **Pain points:** Seeing "pending transactions" warnings that belong to cashier, not them

---

## 3. Functional Requirements

### FR-1: Per-User Database Naming

**Description:** Each user gets their own IndexedDB database identified by user ID.

**User Story:**
> As a POS cashier, I want my offline queue stored separately from other cashiers so that my pending transactions never interfere with theirs.

**Acceptance Criteria:**
- [ ] Database name format: `pos-offline-queue-{user_id}`
- [ ] `getDBName(userId)` returns the correct DB name for any user
- [ ] Different users on the same device have separate databases
- [ ] No shared state between databases

**Priority:** Must Have

### FR-2: User-Scoped Queue Operations

**Description:** All queue functions (add, get, update, delete, clear) operate within the scope of a single user's database.

**User Story:**
> As a developer, I want all queue functions to accept a userId parameter so that operations are always scoped to the correct user.

**Acceptance Criteria:**
- [ ] `ensureDB(userId)` opens/creates the correct user database
- [ ] `addToQueue(request, userId)` stores item in user's database
- [ ] `getQueue(userId)` returns only the current user's items
- [ ] `getQueueByStatus(status, userId)` returns filtered items for the user
- [ ] `getPendingCount(userId)` returns count for the user only
- [ ] `clearQueue(userId)` clears only the specified user's database
- [ ] `removeFromQueue(id, userId)` removes item from user's database

**Priority:** Must Have

### FR-3: Idempotency & Metadata Per User

**Description:** Idempotency keys and sync metadata are scoped per-user database.

**User Story:**
> As a developer, I want idempotency keys to be user-scoped so that user A's retry logic doesn't conflict with user B's.

**Acceptance Criteria:**
- [ ] `setIdempotentKey(key, userId)` stores key in user's database
- [ ] `hasIdempotentKey(key, userId)` checks only user's database
- [ ] `checkAndSetIdempotency(key, userId)` operates on user's database
- [ ] `setLastSyncTime(timestamp, userId)` stores in user's database
- [ ] `getLastSyncTime(userId)` reads from user's database

**Priority:** Must Have

### FR-4: Database Cleanup on Logout

**Description:** When a user logs out with an empty queue, their database is deleted entirely.

**User Story:**
> As a store manager, I want old empty databases cleaned up so that storage doesn't bloat over time.

**Acceptance Criteria:**
- [ ] Logout checks if the user's queue is empty
- [ ] If queue is empty AND no failed items exist → delete the entire database
- [ ] If queue has pending/failed items → leave the database intact
- [ ] Database deletion is complete (all stores removed)
- [ ] If legacy single database exists, migrate data once then delete it

**Priority:** Must Have

### FR-5: Sync Manager User Awareness

**Description:** Sync manager operates only on the current logged-in user's queue.

**User Story:**
> As a developer, I want the sync manager to only process the current user's queue items so that cross-user contamination is impossible.

**Acceptance Criteria:**
- [ ] `syncNow()` processes items only for the current user (from Redux state)
- [ ] `broadcastQueueState()` reads only current user's queue
- [ ] `initSyncManager` doesn't auto-sync until a user is logged in
- [ ] On login, trigger sync for that user's queue
- [ ] 401 during sync marks item as failed (no force logout)

**Priority:** Must Have

### FR-6: Login Triggers Queue Recovery

**Description:** After successful login, the app checks for existing queue items for that user and attempts to sync them.

**User Story:**
> As a cashier logging back in, I want my previously queued transactions to be synced so that no sales are lost.

**Acceptance Criteria:**
- [ ] After `signin` success, check if user has existing DB
- [ ] If DB exists → sync pending items
- [ ] If DB doesn't exist → nothing to recover (fresh start)
- [ ] Recovery sync is non-blocking (doesn't block UI)

**Priority:** Should Have

---

## 4. Non-Functional Requirements

- **Performance:** DB open/close should be < 10ms. No noticeable delay on login/logout.
- **Storage:** Database is deleted when empty — max ~5 databases on a POS device.
- **Debuggability:** DevTools > Application > IndexedDB must show clearly separated databases per user.
- **Backward Compatibility:** Existing single-DB data must be migrated on first load (read legacy, tag by user_id extracted from stored token, write to new per-user DB, delete legacy).
- **Resilience:** Failed sync should mark item as failed, never force logout.

---

## 5. Out of Scope

- ❌ **Multi-device sync** — This is for a single POS device. Cross-device queue sync is not needed.
- ❌ **Admin dashboard for queue management** — No UI for managers to view other users' queues.
- ❌ **Queue time-to-live** — No automatic purging of old queue items (manual cleanup only via "Close Anyway").
- ❌ **Encryption at rest** — IndexedDB storage is not encrypted (out of scope for this task).

---

## 6. Edge Cases & Error Handling

| Scenario | Expected Behavior |
|----------|-------------------|
| User DB doesn't exist yet | Create on first `ensureDB(userId)` call |
| User logs out with empty queue | Delete the entire DB for that user |
| User logs out with pending items | Keep DB intact, recover on next login |
| Login with same user, DB exists | Sync pending items, recover silently |
| Legacy single DB exists | Migrate items → tag by user from token → write to per-user DBs → delete legacy DB |
| DB deletion fails (IndexedDB error) | Log error, continue logout (non-blocking) |
| Multiple rapid login/logout | Ensure DB connections are properly closed before switching |
| Same user on two tabs (rare) | IndexedDB handles concurrent access — last write wins |

| Error | User Message | System Action |
|-------|--------------|---------------|
| DB creation fails | "Storage error. Please clear site data." | Log error, app continues without offline support |
| Legacy migration fails | "Could not migrate offline data." | Log error, skip migration, delete legacy DB |
| syncNow with no user logged in | — (silent) | Skip sync gracefully |
| clearQueue on nonexistent DB | — (silent) | No-op, no error |

---

## 7. Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Zero cross-user contamination | 100% | User B's queue never shows user A's items |
| Death spiral eliminated | 0 occurrences | No force-logout due to stale queue items |
| DB cleanup on empty logout | 100% | DB deleted when queue is empty |
| Legacy migration success | 100% | All existing queue items migrated on first update |
| DevTools clarity | Pass | Each user's DB clearly separated in IndexedDB tree |

---

## 8. Open Questions

- [ ] **Backend validation:** Does the server validate `sales_session_id` against the current user? If yes, queue items from old sessions will still fail 4xx regardless of DB isolation — acceptable, they'll just be marked failed.

---

## 9. Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-07-15 | Initial specification |

---

## Next Steps

1. Review spec with stakeholders
2. Run `/plan offline-queue-per-user` to create technical plan
3. Resolve open questions before implementation

---

*Specification created with SDD 2.0*
