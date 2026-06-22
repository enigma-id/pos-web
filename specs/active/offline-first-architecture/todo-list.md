# Todo List: Offline-First Architecture

**Task ID:** offline-first-architecture
**Created:** 2026-05-21
**Status:** In Progress

---

## Phase 1: Network Status & Detection
- [ ] Task 1.1: Install dependencies (idb, uuid)
- [ ] Task 1.2: Create offline services directory
- [ ] Task 1.3: Create network status hook
- [ ] Task 1.4: Create OfflineBanner component
- [ ] Task 1.5: Add banner to layout

## Phase 2: IndexedDB Queue Infrastructure
- [ ] Task 2.1: Initialize IndexedDB database
- [ ] Task 2.2: Queue CRUD operations
- [ ] Task 2.3: Idempotency helpers
- [ ] Task 2.4: Metadata helpers

## Phase 3: Enhanced BaseQuery Integration
- [ ] Task 3.1: Modify baseQuery with offline detection
- [ ] Task 3.2: Capture auth token for queued requests
- [ ] Task 3.3: Handle offline response in checkout

## Phase 4: Sync Manager
- [ ] Task 4.1: Create SyncManager service
- [ ] Task 4.2: Implement retry logic
- [ ] Task 4.3: Sync completion handling
- [ ] Task 4.4: App init sync check

## Phase 5: UI Polish & Edge Cases
- [ ] Task 5.1: Create SyncIndicator badge
- [ ] Task 5.2: Create pending items drawer
- [ ] Task 5.3: Handle token expiry
- [ ] Task 5.4: Queue warning at 100 items
- [ ] Task 5.5: Session close warning

## Phase 6: Testing & Cleanup
- [ ] Task 6.1: Test offline checkout
- [ ] Task 6.2: Test reconnect sync
- [ ] Task 6.3: Test multiple checkouts
- [ ] Task 6.4: Test refresh persistence
- [ ] Task 6.5: Code cleanup

---

## Progress Log

| Time | Task | Status | Notes |
|------|------|--------|-------|
| 2026-05-25 | Implementation started | In Progress | - |
