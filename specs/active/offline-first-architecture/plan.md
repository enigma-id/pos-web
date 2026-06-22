# Technical Plan: Offline-First POS System

**Task ID:** offline-first-architecture
**Status:** Ready for Implementation
**Based on:** spec.md (2026-05-21)
**Version:** 1.0

---

## 1. System Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              React App                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Redux Store + RTK Query                          │    │
│  │  ┌───────────────────────────────────────────────────────────────┐  │    │
│  │  │              Offline Queue Middleware (NEW)                   │  │    │
│  │  │  ┌────────────┐  ┌──────────────┐  ┌────────────────────┐     │  │    │
│  │  │  │  Network   │  │   Request    │  │     IndexedDB      │     │  │    │
│  │  │  │  Detector  │→ │    Queue     │→ │   (persistent)     │     │  │    │
│  │  │  └────────────┘  └──────────────┘  └────────────────────┘     │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      New Components                                 │    │
│  │  ┌──────────────────┐  ┌────────────────┐  ┌────────────────────┐   │    │
│  │  │  OfflineBanner   │  │  SyncIndicator │  │   SyncManager      │   │    │
│  │  │    (UI)          │  │    (UI)        │  │   (background)     │   │    │
│  │  └──────────────────┘  └────────────────┘  └────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ (when online)
                                    ▼
                    ┌─────────────────────────────┐
                    │      API Server             │
                    │  /sales/order/direct-pay    │
                    │  /sales/session/start       │
                    │  /sales/session/end         │
                    │  ...                        │
                    └─────────────────────────────┘
```

### Architecture Decisions

| Decision Area | Choice | Rationale |
|---------------|--------|-----------|
| **Queue Storage** | IndexedDB (via `idb` library) | Durable, async, handles large payloads better than localStorage. Survives refresh. |
| **Network Detection** | `navigator.onLine` + browser events | Zero network cost, instant detection, no polling |
| **Sync Trigger** | `online` event listener | Event-driven, fires once when network returns |
| **Sync Strategy** | FIFO sequential processing | Preserves order, prevents race conditions |
| **Retry Logic** | Custom with exponential backoff (3 attempts) | More control than RTK's default |
| **Idempotency** | UUID v4 per checkout attempt | Client-side dedup + server header |
| **State Sync** | Redux slice for queue metadata | Real-time UI updates for pending count |

---

## 2. Technology Stack

### New Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `idb` | ^8.0.0 | Promise-based IndexedDB wrapper |
| `uuid` | ^10.0.0 | Generate idempotency keys |

### Existing Stack (No Changes)
| Layer | Technology |
|-------|------------|
| State | Redux Toolkit + RTK Query |
| Persistence | redux-persist |
| Storage | localStorage (existing caching) |
| Network | fetchBaseQuery |

### Dependencies to Add (JSON)

```json
{
  "dependencies": {
    "idb": "^8.0.0",
    "uuid": "^10.0.0"
  }
}
```

---

## 3. Component Design

### 3.1 NetworkStatusProvider (Hook/Context)

**Purpose:** Global online/offline state accessible anywhere

**Responsibilities:**
- Initialize `navigator.onLine` listener
- Emit events when status changes
- Provide `isOnline`, `wasOffline` (for detecting reconnect)
- Debounce network flaps (3-second stabilization)

**Interface:**
```javascript
// useNetworkStatus.js
{
  isOnline: boolean,        // Current status
  wasOffline: boolean,      // Was offline before this render
  isSyncing: boolean,       // Sync in progress
  pendingCount: number,     // Items waiting to sync
  lastOnlineTime: number,   // Timestamp of last reconnect
}
```

**Dependencies:**
- SyncManager (for `isSyncing`, `pendingCount`)

---

### 3.2 OfflineQueueService

**Purpose:** IndexedDB CRUD for pending request queue

**Responsibilities:**
- Initialize IndexedDB database `pos-offline-queue`
- Add, get, update, delete pending requests
- Track queue metadata (count, last sync time)
- Enforce FIFO ordering via timestamp

**Interface:**
```javascript
// services/offlineQueue/index.js

// Initialize DB
await initQueueDB(): Promise<IDBDatabase>

// CRUD Operations
await addToQueue(request: PendingRequest): Promise<string> // returns id
await getQueue(): Promise<PendingRequest[]>
await getQueueByStatus(status: 'pending' | 'syncing' | 'failed'): Promise<PendingRequest[]>
await updateQueueItem(id: string, updates: Partial<PendingRequest>): Promise<void>
await removeFromQueue(id: string): Promise<void>
await clearQueue(): Promise<void>

// Idempotency
await hasIdempotentKey(key: string): Promise<boolean>
await setIdempotentKey(key: string): Promise<void>

// Metadata
await getPendingCount(): Promise<number>
await setLastSyncTime(timestamp: number): Promise<void>
await getLastSyncTime(): Promise<number>
```

**Data Model - PendingRequest:**
```typescript
interface PendingRequest {
  id: string;                    // UUID
  idempotencyKey: string;        // UUID for dedup
  type: 'mutation' | 'query';    // RTK Query operation type
  endpoint: string;              // e.g., 'checkout'
  url: string;                   // Full API URL
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body: any;                     // Request payload
  headers?: Record<string, string>; // Auth token preserved
  timestamp: number;             // Created at (FIFO ordering)
  status: 'pending' | 'syncing' | 'failed' | 'completed';
  retryCount: number;            // 0-3 attempts
  error?: string;                // Last error message
  result?: any;                  // Sync result (for UI)
}
```

---

### 3.3 Enhanced BaseQuery

**Purpose:** Drop-in replacement for existing baseQuery with offline detection

**Responsibilities:**
- Check network status before each request
- If offline + mutation: queue locally, return mock success
- If offline + query: attempt anyway (fallback behavior)
- Capture auth token for queued requests
- Add idempotency key to mutations

**Interface (modifies existing `baseQuery.js`):**
```javascript
// src/services/baseQuery.js (MODIFIED)

export const baseQuery = async (args, api, extraOptions) => {
  // Step 1: Check if we should queue
  const shouldQueue = shouldQueueRequest(args, extraOptions);

  // Step 2: Check network
  if (!navigator.onLine && shouldQueue) {
    // Queue the request
    const queuedRequest = await queueRequest(args, api, extraOptions);
    return {
      data: { offline_queued: true, queueId: queuedRequest.id },
      meta: { offline: true }
    };
  }

  // Step 3: Attempt API call
  try {
    const result = await rawBaseQuery(args, api, extraOptions);

    // Step 4: Handle network failure mid-request
    if (result.error && !navigator.onLine && shouldQueue) {
      await queueRequest(args, api, extraOptions);
      return {
        data: { offline_queued: true },
        meta: { offline: true }
      };
    }

    return result;
  } catch (error) {
    // Network error - queue if mutation
    if (shouldQueue) {
      await queueRequest(args, api, extraOptions);
      return {
        data: { offline_queued: true },
        meta: { offline: true, error: error.message }
      };
    }
    throw error;
  }
};

function shouldQueueRequest(args, extraOptions) {
  // Mutations (POST, PUT, DELETE) always queue offline
  // Queries depend on use case
  const method = args.method?.toUpperCase() || 'GET';
  return ['POST', 'PUT', 'DELETE'].includes(method);
}
```

---

### 3.4 SyncManager (Background Service)

**Purpose:** Process queue when connection returns

**Responsibilities:**
- Listen to `online` event
- Debounce (3-second stable connection before sync)
- Process queue in FIFO order
- Handle errors with retry logic
- Update Redux state for UI
- Notify on completion/failure

**Interface:**
```javascript
// services/syncManager/index.js

// Initialize - called on app mount
initSyncManager(): void

// Manual trigger (if needed)
syncNow(): Promise<SyncResult>

// Status
getSyncStatus(): {
  isSyncing: boolean,
  currentItem: string | null,
  progress: { completed: number, total: number }
}

// Event listeners
onSyncProgress(callback: (progress) => void): void
onSyncComplete(callback: (result) => void): void
onSyncError(callback: (error) => void): void
```

**Sync Algorithm:**
```
1. Wait for navigator.onLine = true (debounced 3s)
2. Get all 'pending' items from IndexedDB ordered by timestamp
3. For each item:
   a. Mark status = 'syncing'
   b. Execute with rawBaseQuery
   c. If success:
      - Mark status = 'completed'
      - Remove from queue after 5 seconds (keep for receipt lookup)
      - Update Redux pending count
   d. If error:
      - increment retryCount
      - If retryCount >= 3: mark status = 'failed'
      - else: status = 'pending' for retry
4. Emit completion event
```

---

### 3.5 UI Components

#### OfflineBanner
```javascript
// src/components/ui/offline/OfflineBanner.jsx

// Props:
{
  variant: 'offline' | 'syncing' | 'warning' | 'error',
  message: string,
  pendingCount?: number,
  onRetry?: () => void,
  onDismiss?: () => void
}

// Display:
// - Red banner when offline
// - Yellow "Syncing X items..." when syncing
// - Red "X items failed" when errors exist
```

#### SyncIndicator (compact badge)
```javascript
// Location: Navbar/App header
// Shows: Badge with pending count (e.g., "3")
// Click: Opens drawer with pending items list
```

---

## 4. Data Flow

### Flow 1: Checkout When Offline

```
User taps "Bayar" (Checkout)
        │
        ▼
CheckoutScreen calls checkout mutation
        │
        ▼
RTK Query triggers baseQuery
        │
        ▼
baseQuery checks navigator.onLine → FALSE
        │
        ▼
baseQuery calls queueRequest()
        │
        ▼
OfflineQueueService:
  1. Generate idempotencyKey (uuid)
  2. Check idempotency (prevent dupe)
  3. Add to IndexedDB with status='pending'
  4. Return { offline_queued: true, queueId }
        │
        ▼
RTK mutation hook returns success with offline_queued
        │
        ▼
CheckoutScreen:
  - Show success screen
  - Print receipt marked "PENDING SYNC"
  - Reset cart
        │
        ▼
Redux slice 'Offline' updates pendingCount
        │
        ▼
SyncIndicator shows "1 pending"
```

### Flow 2: Network Reconnects

```
Network returns (WiFi ON)
        │
        ▼
Browser fires 'online' event
        │
        ▼
SyncManager receives event
        │
        ▼
Debounce: Wait 3 seconds for stable connection
        │
        ▼
SyncManager.processQueue():
  1. Get pending items from IndexedDB
  2. For each item (FIFO):
     - Set status='syncing'
     - Execute via rawBaseQuery
     - On success: status='completed', remove later
     - On error: retry up to 3 times
        │
        ▼
UI Updates:
  - Banner shows "Syncing X of Y..."
  - Progress updates in real-time
        │
        ▼
Completion:
  - Banner shows "All synced!" (3s then hide)
  - Indicator badge removed
  - Notifications for any failures
```

---

## 5. API Contracts

### Modified RTK Query Endpoints (No Changes Required)

All existing endpoints continue to work. The offline layer intercepts transparently:

| Endpoint | Offline Behavior |
|----------|------------------|
| `checkout` mutation | Queue → sync later |
| `bill` mutation | Queue → sync later |
| `closeBill` mutation | Queue → sync later |
| `session.start` mutation | Queue → sync later |
| `session.end` mutation | Queue → sync later |
| `order.cancel` mutation | Queue → sync later |
| `catalog` query | Use cache if available |
| `order` query | Use cache if available |

### Internal API (Queue Service)

```javascript
// Queue operations exposed via custom hook
const {
  pendingCount,      // number
  isOnline,          // boolean
  isSyncing,         // boolean
  failedItems,       // PendingRequest[]
  syncNow,           // () => Promise<void>
  clearFailedItem,   // (id) => Promise<void>
} = useOfflineQueue();
```

---

## 6. Security Considerations

### Authentication
- [x] Auth token captured from Redux state at queue time
- [x] Token included in queued request headers
- [x] If token expires during offline period → sync fails → prompt re-login

### Data Protection
- [x] No sensitive data (card numbers) stored in queue
- [x] Queue stored in IndexedDB (not localStorage) — slightly better isolation
- [x] Idempotency keys prevent duplicate charges

### Security Checklist
- [ ] Token refresh works after re-login (test)
- [ ] Queued requests with expired token are handled gracefully
- [ ] No PII in console logs when DEV=true

---

## 7. Performance Strategy

### Targets
- Queue add: < 50ms (IndexedDB async)
- Queue read (100 items): < 100ms
- Sync start delay: 2 seconds max after reconnect
- UI responsiveness: No blocking during sync (async)

### Optimization
- **IndexedDB:** Async, non-blocking
- **Sync:** Sequential (not parallel) to prevent server overload
- **Debounce:** 3-second wait prevents sync-spam on network flap
- **Lazy sync:** Only sync when there are pending items

---

## 8. Implementation Phases

### Phase 1: Network Status & Detection (Week 1, Day 1-2)
- [ ] Install dependencies: `idb`, `uuid`
- [ ] Create `src/services/offline/` directory
- [ ] Create `useNetworkStatus` hook with navigator.onLine
- [ ] Create OfflineBanner component
- [ ] Add banner to main Layout
- [ ] Test: Banner shows/hides on network toggle

### Phase 2: IndexedDB Queue Infrastructure (Week 1, Day 3-4)
- [ ] Initialize IndexedDB with `idb`
- [ ] Create OfflineQueueService (add, get, update, remove)
- [ ] Create idempotency key helpers
- [ ] Test: Queue persists through refresh
- [ ] Test: Idempotency prevents duplicate adds

### Phase 3: Enhanced BaseQuery Integration (Week 2, Day 1-3)
- [ ] Modify `src/services/baseQuery.js`
- [ ] Add queue logic when offline
- [ ] Capture auth token for queued requests
- [ ] Test: Checkout works when offline (manual test)
- [ ] Test: Receipt shows "Pending Sync"

### Phase 4: Sync Manager (Week 2, Day 4-5)
- [ ] Create SyncManager service
- [ ] Add `online` event listener with debounce
- [ ] Implement FIFO queue processing
- [ ] Add retry logic (3 attempts, exponential backoff)
- [ ] Test: Queue syncs when network returns
- [ ] Test: Partial sync handles failures correctly

### Phase 5: UI Polish & Edge Cases (Week 3, Day 1-2)
- [ ] SyncIndicator badge in navbar
- [ ] Pending items list drawer/modal
- [ ] Sync failure notifications
- [ ] Token expiry handling (re-login prompt)
- [ ] Queue warning at 100 items
- [ ] End session warning if pending items

### Phase 6: Testing & Cleanup (Week 3, Day 3-5)
- [ ] Manual testing: Full offline checkout flow
- [ ] Manual testing: Network reconnect sync
- [ ] Manual testing: Multiple checkouts offline
- [ ] Code cleanup and comments
- [ ] Update redux-persist config (exclude API cache if needed)

---

## 9. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| IndexedDB not available (private browsing) | High | Low | Fallback to localStorage, warn user |
| Token expires during offline | High | Medium | Detect 401, pause sync, prompt re-login |
| Queue grows too large (>100) | Medium | Low | Show warning, suggest checking connection |
| Sync race conditions | Medium | Low | FIFO processing, status flags per item |
| Browser doesn't fire 'online' event | Medium | Low | Fallback: poll setInterval as backup |
| Server returns different data than queued | Medium | Low | Accept server response as truth for v1 |

---

## 10. Open Questions (from spec, with recommendations)

| Question | Recommendation |
|----------|----------------|
| Backend idempotency support? | Add idempotency header regardless; server can ignore if unsupported. Client-side dedup protects against dupe regardless. |
| Max offline duration? | Recommend 8 hours. After 8 hours, show strong warning before checkout. |
| Block shift close with pending sync? | Yes, show warning but allow override with supervisor confirmation. |
| NFC member payment offline? | Block with message "Network required for member payment" — too risky for offline. |
| Receipt printer offline? | Print anyway, mark "PENDING SYNC" — reconciliation happens later. |

---

## 11. File Structure

```
src/
├── services/
│   ├── baseQuery.js                    # MODIFIED - add offline queue logic
│   ├── offline/
│   │   ├── index.js                    # Main exports
│   │   ├── queue.js                    # IndexedDB queue service
│   │   ├── syncManager.js              # Background sync
│   │   └── useNetworkStatus.js         # Hook for components
│   └── store.js                        # Possibly add offline slice
├── components/
│   └── ui/
│       └── offline/
│           ├── OfflineBanner.jsx       # Full banner
│           └── SyncIndicator.jsx       # Compact badge
├── hooks/
│   └── useOfflineQueue.js              # Public API for queue status
└── pages/
    └── authorize/
        └── home/
            ├── checkout.jsx            # Handle offline_queued response
            ├── success.jsx             # Show "PENDING SYNC" receipt
            └── closeSession.jsx        # Warn if pending items
```

---

## Next Steps

1. Review this technical plan
2. Run `/tasks offline-architecture` to generate task breakdown
3. Run `/implement offline-architecture` to start coding

---

*Plan created with SDD 4.0* | **Based on:** `spec.md` (10 functional requirements, 6 non-functional)
