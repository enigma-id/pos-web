# Specification: Offline-First POS System

**Task ID:** offline-first-architecture
**Created:** 2026-05-21
**Status:** Ready for Planning
**Version:** 1.0

---

## 1. Problem Statement

- **The Problem:** When network drops at Suka Bread outlets, ALL write operations (checkout, session management, bill operations) fail immediately. Cashiers cannot process sales, close shifts, or save bills. Business stops until connection returns.
- **Current Situation:** Every business-critical action requires a live API call. No offline fallback, no queue, no retry. Network failure = operational failure.
- **Desired Outcome:** Cashiers continue all business operations seamlessly regardless of network status. Pending operations are queued locally and automatically synced to the server when connection returns. Zero business interruption.

---

## 2. User Personas

### Primary User: Cashier (Kasir)
- **Who:** Front-line staff processing customer transactions at Suka Bread outlets
- **Goals:** Fast transaction processing, no customer waiting, accurate shift accounting
- **Pain points:** Network drops during peak hours → long customer queues → lost sales → frustrated customers

### Secondary User: Store Manager (Supervisor)
- **Who:** Oversees shift reports, refunds, and daily reconciliation
- **Goals:** Accurate financial reporting, all transactions accounted for
- **Pain points:** Offline transactions missing from reports, manual reconciliation needed

---

## 3. Functional Requirements

### FR-1: Network Status Detection
**Description:** Detect online/offline status in real-time without polling

**User Story:**
> As a cashier, I want to see the current network status so that I know whether my transactions will sync immediately or later.

**Acceptance Criteria:**
- [ ] Given the app is open, when network disconnects, then an offline banner appears within 1 second
- [ ] Given the app is open, when network reconnects, then the banner updates to show "Syncing..." then disappears
- [ ] Given the app is offline, when viewing any page, then the banner is visible across all pages
- [ ] Given the app is offline, when checking status, then `navigator.onLine` is used (no API pinging)

**Priority:** Must Have

---

### FR-2: Offline Checkout
**Description:** Allow full checkout flow (including payment) when offline, queue transaction for later sync

**User Story:**
> As a cashier, I want to complete customer checkout even when offline so that the customer can pay and leave without waiting for network.

**Acceptance Criteria:**
- [ ] Given the app is offline, when cashier completes checkout, then the transaction is processed locally with a "Pending Sync" status
- [ ] Given checkout is completed offline, when receipt is printed, then it is marked "PENDING SYNC" on the receipt
- [ ] Given checkout is completed offline, when connection returns, then the transaction is automatically synced to the server
- [ ] Given checkout is completed offline, when sync succeeds, then the transaction status updates from "Pending Sync" to "Completed"
- [ ] Given checkout is completed offline, when sync fails, then the transaction remains in "Pending Sync" with retry on next reconnect

**Priority:** Must Have

---

### FR-3: Offline Save Bill
**Description:** Allow saving orders as bills when offline

**User Story:**
> As a cashier, I want to save an order as a bill when offline so that I can hold it for later without losing the order.

**Acceptance Criteria:**
- [ ] Given the app is offline, when cashier saves a bill, then it is stored locally with "Pending Sync" status
- [ ] Given a bill is saved offline, when connection returns, then it is synced to the server
- [ ] Given a bill is saved offline, when viewing bills list, then it appears with "Pending Sync" badge
- [ ] Given a bill is synced, when viewing bills list, then the badge changes to "Synced"

**Priority:** Must Have

---

### FR-4: Offline Close Bill
**Description:** Allow closing (finalizing) saved bills when offline

**User Story:**
> As a cashier, I want to close a saved bill and checkout when offline so that the customer's held order can be finalized.

**Acceptance Criteria:**
- [ ] Given the app is offline, when cashier closes a bill with payment, then the close-bill action is queued locally
- [ ] Given a close-bill is queued, when connection returns, then it is synced to the server
- [ ] Given a close-bill sync succeeds, then the bill status updates to completed

**Priority:** Must Have

---

### FR-5: Offline Session Management
**Description:** Allow opening and closing shifts when offline

**User Story:**
> As a cashier, I want to open and close my shift even when offline so that my work is not blocked by network issues.

**Acceptance Criteria:**
- [ ] Given the app is offline, when cashier opens a session with starting cash, then the session opens locally and syncs when online
- [ ] Given the app is offline, when cashier ends a session, then the session end data is queued for sync
- [ ] Given a session is opened offline, when connection returns, then the session start is synced
- [ ] Given a session end is queued, when sync succeeds, then the session summary is updated with server data

**Priority:** Must Have

---

### FR-6: Offline Order Cancel (Refund)
**Description:** Allow canceling/refunding orders when offline

**User Story:**
> As a cashier, I want to process a refund when offline so that customer complaints are resolved immediately.

**Acceptance Criteria:**
- [ ] Given the app is offline, when cashier cancels an order, then the cancel action is queued locally
- [ ] Given a cancel is queued, when connection returns, then it is synced to the server
- [ ] Given a cancel is queued, when viewing the order, then it shows "Cancel Pending Sync" status

**Priority:** Should Have

---

### FR-7: Pending Sync Indicator & Counter
**Description:** Show count of pending operations waiting to sync

**User Story:**
> As a cashier, I want to see how many transactions are pending sync so that I know the system state before closing my shift.

**Acceptance Criteria:**
- [ ] Given there are pending operations, when viewing the app, then a counter badge shows the number of pending items
- [ ] Given the counter shows N pending, when sync completes an item, then the counter decrements
- [ ] Given all items are synced, when viewing the app, then the counter disappears

**Priority:** Must Have

---

### FR-8: Automatic Sync on Reconnect
**Description:** Automatically process the offline queue when connection returns

**User Story:**
> As a cashier, I want my pending transactions to sync automatically when the network returns so that I don't have to manually trigger sync.

**Acceptance Criteria:**
- [ ] Given there are pending operations, when network comes back online, then sync starts automatically within 2 seconds
- [ ] Given sync is in progress, when a request succeeds, then it is removed from the queue
- [ ] Given sync is in progress, when a request fails, then it remains in the queue for next reconnect
- [ ] Given sync is in progress, when the user navigates, then sync continues in the background
- [ ] Given all items are synced, when sync completes, then a success notification appears briefly

**Priority:** Must Have

---

### FR-9: Idempotency — Prevent Duplicate Submissions
**Description:** Ensure offline-queued operations are not submitted twice

**User Story:**
> As a store manager, I want assurance that offline transactions are not double-charged so that financial records are accurate.

**Acceptance Criteria:**
- [ ] Given a checkout is queued offline, when sync runs, then it is submitted exactly once
- [ ] Given a checkout is queued offline with idempotency key, when the user tries to checkout the same cart again, then the duplicate is prevented
- [ ] Given a sync request succeeds, when the same request is retried, then the server recognizes the idempotency key and returns the original result

**Priority:** Must Have

---

### FR-10: Sync Failure Notification
**Description:** Alert the user when a queued operation fails to sync after reconnect

**User Story:**
> As a cashier, I want to know if a transaction failed to sync so that I can take action (retry or contact support).

**Acceptance Criteria:**
- [ ] Given sync fails for a request, when viewing the app, then a notification shows which transaction failed and why
- [ ] Given a sync failure, when the user taps the notification, then they see options: "Retry" or "Dismiss"
- [ ] Given a sync failure is retried, when it succeeds, then the notification is cleared

**Priority:** Should Have

---

## 4. Non-Functional Requirements

### Performance
- Offline queue operations must complete in < 50ms (IndexedDB write)
- Network detection must respond in < 1 second
- Sync must start within 2 seconds of reconnect
- App must remain responsive during sync (no UI blocking)

### Reliability
- Queued operations must survive browser refresh (persistent in IndexedDB)
- Queued operations must survive browser crash (IndexedDB is durable)
- Queue must not lose data under any condition short of localStorage/IndexedDB wipe

### Security
- Auth token must be included in queued requests
- If token expires while offline, sync must fail gracefully and prompt re-login
- No sensitive data (card numbers, tokens) stored in queue

### Scalability
- Queue must handle up to 100 pending operations without performance degradation
- Individual queue item size must not exceed 500KB

### Data Integrity
- Operations must sync in the order they were created (FIFO)
- Each operation must have a unique idempotency key
- Sync status must be accurately reflected in UI at all times

---

## 5. Out of Scope

- ❌ **Member saldo topup offline** — Financial operation requires real-time server validation. Queue is too risky for balance modifications.
- ❌ **Member saldo check offline** — Requires real-time balance from server. Show cached balance with "may be outdated" warning instead.
- ❌ **Service Worker / PWA** — Overkill for this use case. Custom baseQuery approach is sufficient.
- ❌ **Multi-device sync** — If same cashier logs in on different device, pending operations on old device are not merged. Out of scope for v1.
- ❌ **Conflict resolution (server overrides local)** — Server is source of truth. If sync returns different data, server wins. Advanced conflict resolution deferred to v2.
- ❌ **Background Sync API** — Browser support is inconsistent. Custom solution is more reliable.

---

## 6. Edge Cases & Error Handling

| Scenario | Expected Behavior |
|----------|-------------------|
| Network flaps (connect/disconnect rapidly) | Debounce online event — wait 3s of stable connection before starting sync |
| Browser refresh while offline | Queue persists in IndexedDB — operations survive refresh |
| Browser refresh during sync | Sync resumes on next page load (check queue on app init) |
| Token expires while offline | Sync fails → prompt re-login → retry queue after re-auth |
| Queue reaches 100 items | Show warning banner: "Many pending transactions. Contact support." |
| Server returns 409 Conflict on sync | Mark operation as failed → notify user → do not retry automatically |
| Server returns 500 on sync | Retry up to 3 times with exponential backoff, then mark failed |
| Same cart checked out twice rapidly | Idempotency key prevents duplicate |
| Sync partially completes (3 of 5 succeed) | Successful 3 removed from queue, failed 2 remain |
| User closes shift while pending sync exists | Warn: "You have N pending transactions. Close shift anyway?" |

| Error | User Message | System Action |
|-------|--------------|---------------|
| Network offline during checkout | "Transaction saved. Will sync when online." | Queue in IndexedDB, show "Pending Sync" |
| Sync fails (server error) | "Sync failed for [transaction]. Tap to retry." | Keep in queue, show notification |
| Token expired during sync | "Session expired. Please log in again." | Pause sync, redirect to login |
| Queue full (>100) | "Too many pending transactions. Please check your connection." | Still queue but show warning |
| Duplicate checkout detected | "This transaction is already pending." | Prevent duplicate submission |

---

## 7. Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Zero business interruption | 100% of checkouts complete regardless of network | Count failed checkouts due to offline = 0 |
| Sync success rate | > 99% of queued operations sync successfully | Sync success / total queued |
| Sync latency | < 5 seconds from reconnect to all items synced | Time from online event to empty queue |
| Queue persistence | 0 data loss on browser refresh/crash | Pending count before refresh = after refresh |
| Idempotency | 0 duplicate transactions | Count duplicate checkouts = 0 |
| User awareness | Cashier always knows sync status | UI banner + counter visible at all times |

---

## 8. Open Questions

- [ ] Does the backend API support idempotency keys? (e.g., `Idempotency-Key` header)
- [ ] What is the maximum acceptable offline duration? (hours? days?)
- [ ] Should closing a shift be blocked if pending sync items exist?
- [ ] How to handle NFC member payment offline? (Allow with warning or block?)
- [ ] Should the receipt printer work differently when offline? (Mark as pending?)

---

## 9. Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-05-21 | Initial specification |

---

## Next Steps

1. Resolve open questions
2. Run `/plan offline-architecture` to create technical implementation plan
3. Run `/tasks offline-architecture` to break down into implementation tasks

*Specification created with SDD 4.0*
