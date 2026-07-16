# Technical Plan: Per-User Offline Queue Database

**Task ID:** offline-queue-per-user
**Date:** 2026-07-15
**Status:** Ready for Implementation
**Based on:** spec.md, research.md

---

## 1. System Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────┐
│                    App Layer                             │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ baseQuery │  │ syncManager  │  │ auth/hook        │  │
│  │ (enqueue) │  │ (process)    │  │ (login/logout)   │  │
│  └─────┬─────┘  └──────┬───────┘  └────────┬─────────┘  │
└────────┼───────────────┼───────────────────┼────────────┘
         │               │                   │
┌────────┼───────────────┼───────────────────┼────────────┐
│        ▼               ▼                   ▼            │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Queue Layer (queue.js)               │   │
│  │  ensureDB(userId) → pos-offline-queue-{userId}   │   │
│  │                                                   │   │
│  │  Stores per DB:                                   │   │
│  │  ┌─────────────────────────────────────────┐      │   │
│  │  │ pendingRequests (store)                 │      │   │
│  │  │   ├─ id (keyPath)                       │      │   │
│  │  │   ├─ status (index)                     │      │   │
│  │  │   └─ createdAt (index)                  │      │   │
│  │  ├─────────────────────────────────────────┤      │   │
│  │  │ metadata (store)                        │      │   │
│  │  │   └─ key (keyPath)                      │      │   │
│  │  └─────────────────────────────────────────┘      │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  IndexedDB (Browser)                                    │
│  ├─ pos-offline-queue-user_1                            │
│  │   ├─ pendingRequests                                 │
│  │   └─ metadata                                        │
│  ├─ pos-offline-queue-user_2                            │
│  │   ├─ pendingRequests                                 │
│  │   └─ metadata                                        │
│  └─ pos-offline-queue (legacy, deleted after migrate)   │
└─────────────────────────────────────────────────────────┘
```

### Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| DB naming | `pos-offline-queue-{userId}` | Clear, debuggable, no collision |
| Idempotency store | Skipped | API doesn't support idempotency keys |
| Connection caching | `Map<userId, dbPromise>` | Avoids multiple open handles per user |
| Migration strategy | Read legacy → write per-user → delete legacy | One-time, backward compatible |
| Queue item identification | `user_id` extracted from stored token | Legacy items don't have explicit userId |

---

## 2. Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Storage | IndexedDB (via `idb` library) | Already used, battle-tested |
| Queue lib | `idb` (openDB) | Already used, no change |
| User ID source | Redux `Auth.session.user.id` | Single source of truth |

**No new dependencies.** All changes are within existing `src/services/offline/queue.js`.

---

## 3. Component Design

### Component: Queue Database (`src/services/offline/queue.js`)

**Purpose:** Manage per-user IndexedDB databases for offline queue storage.

**Changes:**

```js
// Replace singleton dbPromise with Map
const dbInstances = new Map(); // userId -> dbPromise

const getDBName = (userId) => `pos-offline-queue-${userId}`;

const ensureDB = (userId) => {
  if (!userId) throw new Error('userId required for queue DB');
  const key = String(userId);
  if (!dbInstances.has(key)) {
    dbInstances.set(key, openDB(getDBName(userId), DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('pendingRequests')) {
          const store = db.createObjectStore('pendingRequests', { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      },
    }));
  }
  return dbInstances.get(key);
};
```

**Removed stores:** `idempotencyKeys` — API doesn't support idempotency keys, so this store and all related functions (`generateIdempotencyKey`, `hasIdempotentKey`, `setIdempotentKey`, `checkAndSetIdempotency`, `cleanupExpiredIdempotencyKeys`) are removed.

**All public functions updated to accept `userId` as first or last parameter:**

| Function | Signature Change |
|----------|-----------------|
| `initQueueDB` | `(userId)` |
| `addToQueue` | `(request, userId)` |
| `getQueue` | `(userId)` |
| `getQueueByStatus` | `(status, userId)` |
| `getQueueItem` | `(id, userId)` |
| `updateQueueItem` | `(id, updates, userId)` |
| `removeFromQueue` | `(id, userId)` |
| `clearQueue` | `(userId)` |
| `getPendingCount` | `(userId)` |
| `setLastSyncTime` | `(timestamp, userId)` |
| `getLastSyncTime` | `(userId)` |
| `incrementSyncAttempt` | `(userId)` |
| `resetMetadata` | `(userId)` |
| `getAllMetadata` | `(userId)` |

**New functions:**

| Function | Signature | Purpose |
|----------|-----------|---------|
| `deleteUserDB` | `(userId)` | Delete entire DB for a user (logout cleanup) |
| `getLegacyQueue` | `()` | Read items from old single-DB (migration only) |
| `migrateLegacyQueue` | `(userId)` | One-time migration from legacy to per-user DB |
| `closeUserDB` | `(userId)` | Close connection (before switching users) |

### Component: Auth Hook (`src/services/auth/hook.js`)

**Purpose:** Integrate queue cleanup on logout.

**Changes to `onLogout`:**
```js
const onLogout = async () => {
  stopDeviceTrackingGlobal();
  clearCatalogCache();
  clearSalesCache();
  dispatch(resetCart());
  dispatch($reset());
  dispatch(clearSelectedChannel());
  dispatch(invalidateSession());
  dispatch(logout());

  // Queue cleanup
  const userId = /* current user id from state */;
  const pending = await getPendingCount(userId);
  if (pending === 0) {
    await deleteUserDB(userId);
    await resetMetadata(userId);
  }
  // If pending > 0, leave DB intact for next login
};
```

**Changes to `signin`:**
After successful login, trigger queue recovery:
```js
const signin = async data => {
  const res = await loginMutation(data).unwrap();
  dispatch(login(res?.data));
  getUser();

  // Recover queue for this user
  const userId = res?.data?.user?.id;
  await migrateLegacyQueue(userId);
  syncNow();  // will use current user's queue
};
```

### Component: Sync Manager (`src/services/offline/syncManager.js`)

**Purpose:** Process only current user's queue items.

**Changes:**
- Remove 401 → force logout logic (mark as failed instead)
- All queue calls filtered by current user ID from Redux `Auth.session.user.id`
- `syncNow()` reads current user ID from `storeRef.getState()`
- `broadcastQueueState()` reads current user's queue only
- Remove `storeRef.dispatch(logout())` on 401 — just mark failed

### Component: Close Session (`src/pages/authorize/home/closeSession.jsx`)

**Purpose:** Pass userId to `clearQueue()`.

**Changes:**
- Get userId from Redux state
- Pass to `clearQueue(userId)` in "Close Anyway" handler

### Component: Sync Manager Init (`src/main.jsx`)

**Changes:** `initSyncManager` no longer auto-syncs immediately. Sync is triggered by login instead (to avoid sync before user is known).

---

## 4. Data Model

### Queue Item (unchanged)

```js
{
  id: string,            // uuid
  url: string,           // API endpoint
  method: string,        // POST, PUT, PATCH, DELETE
  body: object|null,     // request payload
  params: object|null,   // URL params
  headers: object,       // request headers
  token: string|null,    // JWT (user-specific)
  type: string,          // 'mutation'
  status: string,        // 'pending' | 'syncing' | 'completed' | 'failed'
  retryCount: number,
  lastError: string|null,
  transaction_preview: object|null,
  createdAt: number,     // timestamp
  updatedAt: number,
}
```

### Legacy Migration Mapping

```js
// Legacy DB: `pos-offline-queue`
// New DB:    `pos-offline-queue-{userId}`
//
// Migration reads ALL items from legacy DB,
// groups them by extracting user from token,
// writes each batch to the respective user DB,
// then deletes the legacy DB.
```

---

## 5. API Contracts

No API changes. All changes are client-side.

---

## 6. Security Considerations

- **Token isolation:** Queue items store tokens per-user. DB isolation ensures user B can never read user A's token.
- **Cleanup:** Deleting the DB on logout removes all stored tokens completely.
- **401 handling:** Sync failure due to expired token no longer force-logouts. Item is marked as failed; user can manually retry or discard.
- **No sensitive data expansion:** Same data, same storage model. No new attack surface.

---

## 7. Performance Strategy

- **Connection caching:** `Map<userId, dbPromise>` prevents redundant DB opens during rapid operations within the same user session.
- **DB close on switch:** `closeUserDB()` called before switching users to release resources.
- **Migrate once:** Legacy migration runs once and deletes old DB. Subsequent logins are instant.
- **Sync timing:** Async and non-blocking — no UI freeze during sync.

---

## 8. Implementation Phases

### Phase 1: Queue Layer Refactor
- [ ] Remove idempotency stores and functions
- [ ] Rename DB to dynamic per-user (`getDBName`)
- [ ] Replace `dbPromise` with `dbInstances` Map
- [ ] Add `userId` param to all exported functions
- [ ] Add `deleteUserDB`, `closeUserDB`, `migrateLegacyQueue`

### Phase 2: Fix 401 Death Spiral in Sync Manager
- [ ] Remove `dispatch(logout())` on 401 in `processItem`
- [ ] Mark item as failed instead (with message "Session expired")
- [ ] All queue calls scoped to current user ID from Redux

### Phase 3: Auth Integration
- [ ] Logout: check empty queue → delete DB
- [ ] Login: migrate legacy DB if exists
- [ ] Login: trigger syncNow for current user

### Phase 4: Close Session + Consumers
- [ ] Pass userId to `clearQueue()` in closeSession
- [ ] Pass userId to `addToQueue()` in baseQuery
- [ ] Update sync-init to not auto-sync before login

### Phase 5: Remove Init Auto-Sync
- [ ] Update `main.jsx` / `initSyncManager` to not auto-sync until login

---

## 9. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Legacy migration fails | Medium (data loss) | Low | Read items first, validate, then write; if write fails, don't delete legacy |
| DB deletion during active sync | High (data loss) | Low | Only delete on logout when queue is confirmed empty |
| Multiple tabs with same user | Low (race condition) | Medium | IndexedDB handles this — last write wins |
| User ID changes (account deleted) | Low (orphan DB) | Low | DB stays on disk but never accessed again — manual cleanup via DevTools |
| `userId` is null/undefined during queue | High (crash) | Medium | Guard clause: `if (!userId) throw` / skip queue |

---

## 10. Open Questions

- [ ] **User ID format:** Is it integer or string? (affects DB name format) — Check Redux state shape.
- [ ] **Flag to skip legacy migration:** Should we add a localStorage flag so migration runs only once?

---

## Next Steps

1. Review technical plan
2. Run `/tasks offline-queue-per-user` to generate implementation tasks
3. Resolve open questions before implementation

---

*Plan created with SDD 2.0*
