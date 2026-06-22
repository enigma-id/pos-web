# Implementation Tasks: Offline-First POS System

**Task ID:** offline-first-architecture
**Created:** 2026-05-21
**Status:** Ready for Implementation
**Version:** 1.0

---

## Summary

| Metric | Value |
|--------|-------|
| Total Tasks | 24 |
| Estimated Effort | 48-56 hours (~2-3 weeks) |
| Phases | 6 |

---

## Phase 1: Network Status & Detection

**Goal:** Install dependencies, create directory structure, implement network detection hook and banner UI

### Task 1.1: Install Dependencies

**Description:** Install idb and uuid packages for IndexedDB and idempotency

**Acceptance Criteria:**
- [ ] Run `npm install idb@^8.0.0 uuid@^10.0.0`
- [ ] Verify packages appear in package.json
- [ ] Verify no build errors after install

**Effort:** 1 hour
**Priority:** High
**Dependencies:** None

---

### Task 1.2: Create Offline Services Directory

**Description:** Create directory structure for offline services

**Acceptance Criteria:**
- [ ] Create `src/services/offline/` directory
- [ ] Create subdirectories/files:
  - `src/services/offline/index.js` (exports)
  - `src/services/offline/queue.js` (IndexedDB service)
  - `src/services/offline/syncManager.js` (sync logic)
  - `src/services/offline/useNetworkStatus.js` (hook)
- [ ] Directory structure matches plan

**Effort:** 1 hour
**Priority:** High
**Dependencies:** None

---

### Task 1.3: Create Network Status Hook

**Description:** Implement useNetworkStatus hook with navigator.onLine detection and debounce

**Acceptance Criteria:**
- [ ] Hook returns `isOnline` boolean
- [ ] Hook listens to 'online' and 'offline' events
- [ ] Debounce of 3 seconds on network flap detection
- [ ] Exports `wasOffline` to detect reconnect moment
- [ ] Export from `src/services/offline/useNetworkStatus.js`

**Effort:** 3 hours
**Priority:** High
**Dependencies:** Task 1.2

---

### Task 1.4: Create OfflineBanner Component

**Description:** Create UI banner component for offline/syncing state

**Acceptance Criteria:**
- [ ] Create `src/components/ui/offline/OfflineBanner.jsx`
- [ ] Supports variants: 'offline', 'syncing', 'warning', 'error'
- [ ] Shows message text
- [ ] Shows pendingCount badge when syncing
- [ ] Has onRetry and onDismiss callbacks (optional)
- [ ] Responsive styling that works on POS screen sizes

**Effort:** 3 hours
**Priority:** High
**Dependencies:** Task 1.3 (uses hook)

---

### Task 1.5: Add OfflineBanner to Layout

**Description:** Add offline banner to main app layout

**Acceptance Criteria:**
- [ ] Import OfflineBanner in main layout component
- [ ] Show banner when isOnline = false
- [ ] Show "Syncing..." when isSyncing = true
- [ ] Banner visible on all pages
- [ ] Does not block main content (non-intrusive)

**Effort:** 2 hours
**Priority:** High
**Dependencies:** Task 1.4

---

## Phase 2: IndexedDB Queue Infrastructure

**Goal:** Implement persistent queue storage using IndexedDB

### Task 2.1: Initialize IndexedDB Database

**Description:** Create IndexedDB initialization with idb library

**Acceptance Criteria:**
- [ ] Create database 'pos-offline-queue' version 1
- [ ] Object store 'pendingRequests' with keyPath 'id'
- [ ] Object store 'idempotencyKeys' with keyPath 'key'
- [ ] Object store 'metadata' for queue stats
- [ ] Handle upgrade/migrations for future versions

**Effort:** 3 hours
**Priority:** High
**Dependencies:** Task 1.2

---

### Task 2.2: Implement Queue CRUD Operations

**Description:** Create queue service with add/get/update/remove operations

**Acceptance Criteria:**
- [ ] `addToQueue(request)` - Add pending request to IndexedDB
- [ ] `getQueue()` - Get all pending requests ordered by timestamp (FIFO)
- [ ] `getQueueByStatus(status)` - Filter by status
- [ ] `updateQueueItem(id, updates)` - Update status/retryCount
- [ ] `removeFromQueue(id)` - Remove completed request
- [ ] `clearQueue()` - Clear all (for testing/reset)

**Effort:** 4 hours
**Priority:** High
**Dependencies:** Task 2.1

---

### Task 2.3: Implement Idempotency Helpers

**Description:** Create idempotency key management

**Acceptance Criteria:**
- [ ] Generate UUID v4 for each new request
- [ ] `hasIdempotentKey(key)` - Check if key exists
- [ ] `setIdempotentKey(key)` - Store key after successful queue add
- [ ] `checkAndSetIdempotency(key)` - Atomic check-and-set (prevents race)
- [ ] Key expiry after 24 hours (cleanup old keys)

**Effort:** 3 hours
**Priority:** High
**Dependencies:** Task 2.2

---

### Task 2.4: Implement Metadata Helpers

**Description:** Track queue statistics

**Acceptance Criteria:**
- [ ] `getPendingCount()` - Return count of 'pending' items
- [ ] `setLastSyncTime(timestamp)` - Track last successful sync
- [ ] `getLastSyncTime()` - Retrieve last sync time
- [ ] `incrementSyncAttempt()` - Track sync attempts
- [ ] `resetMetadata()` - Clear all metadata

**Effort:** 2 hours
**Priority:** Medium
**Dependencies:** Task 2.1

---

## Phase 3: Enhanced BaseQuery Integration

**Goal:** Modify baseQuery to queue requests when offline

### Task 3.1: Modify BaseQuery with Offline Detection

**Description:** Add offline queue logic to existing baseQuery

**Acceptance Criteria:**
- [ ] Modify `src/services/baseQuery.js`
- [ ] Check navigator.onLine before API call
- [ ] If offline + mutation: route to queue service
- [ ] Return { offline_queued: true } response
- [ ] Preserve original return structure for RTK Query

**Effort:** 4 hours
**Priority:** High
**Dependencies:** Task 2.2, Task 2.3

---

### Task 3.2: Capture Auth Token for Queued Requests

**Description:** Store auth token with queued requests

**Acceptance Criteria:**
- [ ] Extract token from Redux state (getState().Auth.session.token)
- [ ] Store token in queued request headers
- [ ] Ensure token refresh works after re-connection
- [ ] Handle missing/expired token gracefully

**Effort:** 2 hours
**Priority:** High
**Dependencies:** Task 3.1

---

### Task 3.3: Handle Offline Response in Checkout

**Description:** Update checkout flow to handle offline_queued response

**Acceptance Criteria:**
- [ ] Modify checkout success screen to detect offline_queued
- [ ] Show "Transaction saved. Will sync when online." message
- [ ] Print receipt marked "PENDING SYNC"
- [ ] Reset cart after offline checkout (same as online)
- [ ] Track offline checkout in activity metrics

**Effort:** 3 hours
**Priority:** High
**Dependencies:** Task 3.1

---

## Phase 4: Sync Manager

**Goal:** Implement automatic queue processing when network returns

### Task 4.1: Create SyncManager Service

**Description:** Create background sync service

**Acceptance Criteria:**
- [ ] Create `src/services/offline/syncManager.js`
- [ ] Listen to 'online' event
- [ ] Debounce 3 seconds before starting sync
- [ ] Process queue in FIFO order
- [ ] Track isSyncing state for UI

**Effort:** 4 hours
**Priority:** High
**Dependencies:** Task 2.2

---

### Task 4.2: Implement Retry Logic

**Description:** Add exponential backoff retry for failed syncs

**Acceptance Criteria:**
- [ ] Retry failed requests up to 3 times
- [ ] Exponential backoff: 1s, 2s, 4s between retries
- [ ] After 3 failures, mark as 'failed' status
- [ ] Do not retry 4xx errors (client errors) - mark as failed
- [ ] Retry 5xx errors (server errors) with backoff

**Effort:** 3 hours
**Priority:** High
**Dependencies:** Task 4.1

---

### Task 4.3: Sync Completion Handling

**Description:** Handle successful sync results

**Acceptance Criteria:**
- [ ] On success: mark status 'completed', remove from queue after 5s
- [ ] On success: update Redux pending count
- [ ] On success: trigger UI notification
- [ ] On partial success: continue processing remaining items
- [ ] After all complete: show success message briefly

**Effort:** 3 hours
**Priority:** High
**Dependencies:** Task 4.1

---

### Task 4.4: App Init Sync Check

**Description:** Check queue on app startup

**Acceptance Criteria:**
- [ ] On app mount: check if pending items exist
- [ ] If items pending AND online: auto-start sync
- [ ] If offline: wait for 'online' event
- [ ] Show pending count in UI immediately on mount

**Effort:** 2 hours
**Priority:** Medium
**Dependencies:** Task 4.1

---

## Phase 5: UI Polish & Edge Cases

**Goal:** Complete UI components and handle edge cases

### Task 5.1: Create SyncIndicator Badge

**Description:** Add pending count badge to navbar

**Acceptance Criteria:**
- [ ] Create `src/components/ui/offline/SyncIndicator.jsx`
- [ ] Show badge with pending count (e.g., "3")
- [ ] Badge hidden when count is 0
- [ ] Click opens drawer with pending items list
- [ ] Show different colors: yellow (pending), red (failed)

**Effort:** 3 hours
**Priority:** Medium
**Dependencies:** Task 4.3

---

### Task 5.2: Create Pending Items Drawer

**Description:** Show list of pending items with status

**Acceptance Criteria:**
- [ ] Drawer shows all pending/syncing/failed items
- [ ] Each item shows: type, endpoint, timestamp, status
- [ ] Failed items show error message
- [ ] Manual retry button for failed items
- [ ] Dismiss/remove failed items option

**Effort:** 4 hours
**Priority:** Medium
**Dependencies:** Task 5.1

---

### Task 5.3: Handle Token Expiry

**Description:** Graceful handling when token expires during sync

**Acceptance Criteria:**
- [ ] Detect 401 response during sync
- [ ] Pause sync queue
- [ ] Show re-login prompt to user
- [ ] After re-login: retry sync with new token
- [ ] Preserve queue during re-login

**Effort:** 3 hours
**Priority:** Medium
**Dependencies:** Task 4.2

---

### Task 5.4: Queue Warning at 100 Items

**Description:** Warn when queue grows too large

**Acceptance Criteria:**
- [ ] Check queue size before adding new item
- [ ] If >= 100: show warning banner "Many pending transactions. Contact support."
- [ ] Still allow new items (don't block business)
- [ ] Show warning on pending items list

**Effort:** 2 hours
**Priority:** Low
**Dependencies:** Task 5.2

---

### Task 5.5: Session Close Warning

**Description:** Warn cashier when closing shift with pending items

**Acceptance Criteria:**
- [ ] Check pending count before session close
- [ ] If pending > 0: show warning "You have N pending transactions. Close anyway?"
- [ ] Require supervisor confirmation to proceed
- [ ] Allow cancel (don't close session)

**Effort:** 2 hours
**Priority:** Low
**Dependencies:** Task 5.2

---

## Phase 6: Testing & Cleanup

**Goal:** Comprehensive testing and final cleanup

### Task 6.1: Manual Testing - Offline Checkout Flow

**Description:** Test complete checkout when offline

**Acceptance Criteria:**
- [ ] Disconnect network in Chrome DevTools
- [ ] Add items to cart
- [ ] Complete checkout
- [ ] Verify receipt prints with "PENDING SYNC"
- [ ] Verify cart resets
- [ ] Verify pending count shows in UI

**Effort:** 2 hours
**Priority:** High
**Dependencies:** All previous

---

### Task 6.2: Manual Testing - Reconnect Sync

**Description:** Test sync when network returns

**Acceptance Criteria:**
- [ ] With pending items queued, reconnect network
- [ ] Verify sync starts within 2 seconds
- [ ] Verify items process one by one (FIFO)
- [ ] Verify sync success notification appears
- [ ] Verify pending count goes to 0

**Effort:** 2 hours
**Priority:** High
**Dependencies:** Task 6.1

---

### Task 6.3: Manual Testing - Multiple Checkouts

**Description:** Test multiple offline checkouts

**Acceptance Criteria:**
- [ ] Queue 3+ checkouts while offline
- [ ] Verify each has unique idempotency key
- [ ] Reconnect and verify all sync in order
- [ ] Verify no duplicates in server

**Effort:** 2 hours
**Priority:** High
**Dependencies:** Task 6.2

---

### Task 6.4: Manual Testing - Refresh Persistence

**Description:** Test queue survives browser refresh

**Acceptance Criteria:**
- [ ] Queue items while offline
- [ ] Refresh browser tab
- [ ] Verify pending items still exist
- [ ] Verify pending count correct
- [ ] Reconnect and verify sync works

**Effort:** 1 hour
**Priority:** High
**Dependencies:** Task 6.1

---

### Task 6.5: Code Review & Cleanup

**Description:** Final code review and cleanup

**Acceptance Criteria:**
- [ ] Remove any console.log statements (except in DEV mode)
- [ ] Add comments for complex logic
- [ ] Verify no TODO comments left
- [ ] Run linting (if configured)
- [ ] Verify all exports are correct

**Effort:** 2 hours
**Priority:** Medium
**Dependencies:** All previous

---

## Quick Reference Checklist

- [ ] Task 1.1: Install Dependencies (1h)
- [ ] Task 1.2: Create Offline Directory (1h)
- [ ] Task 1.3: Network Status Hook (3h)
- [ ] Task 1.4: OfflineBanner Component (3h)
- [ ] Task 1.5: Add Banner to Layout (2h)
- [ ] Task 2.1: Initialize IndexedDB (3h)
- [ ] Task 2.2: Queue CRUD Operations (4h)
- [ ] Task 2.3: Idempotency Helpers (3h)
- [ ] Task 2.4: Metadata Helpers (2h)
- [ ] Task 3.1: Modify BaseQuery (4h)
- [ ] Task 3.2: Capture Auth Token (2h)
- [ ] Task 3.3: Offline Checkout Response (3h)
- [ ] Task 4.1: Create SyncManager (4h)
- [ ] Task 4.2: Retry Logic (3h)
- [ ] Task 4.3: Sync Completion (3h)
- [ ] Task 4.4: App Init Sync (2h)
- [ ] Task 5.1: SyncIndicator Badge (3h)
- [ ] Task 5.2: Pending Items Drawer (4h)
- [ ] Task 5.3: Token Expiry Handling (3h)
- [ ] Task 5.4: Queue Warning (2h)
- [ ] Task 5.5: Session Close Warning (2h)
- [ ] Task 6.1: Test Offline Checkout (2h)
- [ ] Task 6.2: Test Reconnect Sync (2h)
- [ ] Task 6.3: Test Multiple Checkouts (2h)
- [ ] Task 6.4: Test Refresh Persistence (1h)
- [ ] Task 6.5: Code Cleanup (2h)

---

## Next Steps

1. Review task breakdown
2. Run `/implement offline-architecture` to start execution

---

*Tasks created with SDD 4.0* | **Based on:** `plan.md` (6 phases, 24 tasks)
