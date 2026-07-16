# Research: Per-User Offline Queue Database

**Task ID:** offline-queue-per-user
**Date:** 2026-07-15
**Status:** Complete

---

## Executive Summary

The current offline queue uses a single IndexedDB database (`pos-offline-queue`) shared across all users on the same device. This creates critical issues: switching accounts loads stale items from the previous user, and logout cannot safely clear the queue without risking data loss for pending transactions. The proposed solution restructures the queue into per-user databases (`pos-offline-queue-{user_id}`), providing complete isolation between users, safe logout semantics, and clean DevTools debugging.

---

## Codebase Analysis

### Current Architecture

#### 1. Queue Database Layer — `src/services/offline/queue.js`

Single shared database with hardcoded name:

```js
const DB_NAME = 'pos-offline-queue';
let dbPromise = null; // module-level singleton

const ensureDB = () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, { ... });
  }
  return dbPromise;
};
```

**Key issue:** `dbPromise` is a singleton. Once initialized for user A, it stays open for user A's DB. Switching users doesn't change the database.

**Object stores (all shared):**
| Store | Purpose |
|-------|---------|
| `pendingRequests` | Queue items with status, token, body |
| `idempotencyKeys` | Dedup keys to prevent duplicate sync |
| `metadata` | Sync timestamps and counters |

Queue items store the auth token directly:
```js
const item = {
  token: request?.token || null,  // <-- user-specific JWT
  url: request?.url || '',
  method: request?.method || 'POST',
  body: request?.body ?? null,
  // ...
};
```

#### 2. Queue Population — `src/services/baseQuery.js`

When offline, mutations are queued via `addToQueue()`:
```js
const token = api?.getState?.()?.Auth?.token || null;

const queuedRaw = await addToQueue({
  url: args?.url,
  method,
  body: args?.body,
  headers: toObjectHeaders(args?.headers),
  token,                          // <-- token attached here
  type: 'mutation',
  status: 'pending',
  transaction_preview: previewData,
});
```

**No user_id tag** — items are not associated with any user.

#### 3. Sync Manager — `src/services/offline/syncManager.js`

Processes all pending items without user filtering:
```js
export const syncNow = async () => {
  let pending = await getQueueByStatus('pending');
  while (pending.length > 0) {
    const sorted = sortPendingQueue(pending);
    const current = sorted[0];
    const result = await processItem(current);
    // ...
  }
};
```

**401 handling is destructive:**
```js
if (status === 401) {
  await markFailed(item, 'Authentication expired.');
  storeRef.dispatch(logout());  // <-- force logout entire app
  storeRef.dispatch(setOfflineError('Session expired during sync.'));
  setTimeout(() => { window.location.href = '/'; }, 1500);
  return { ok: false, stop: true };
}
```
If user B has user A's stale items with expired tokens, syncing them triggers a global logout.

#### 4. Initialization — `src/main.jsx`

```js
import { initSyncManager } from './services/offline';
initSyncManager(store);  // called once at app startup
```

`initSyncManager` stores a ref to the store and immediately syncs:
```js
export const initSyncManager = async store => {
  storeRef = store;
  await broadcastQueueState();
  // ... online listener setup
  setTimeout(() => syncNow(), 3000);
};
```

**No user-awareness** — sync manager doesn't know which user is logged in.

#### 5. Auth — `src/services/auth/hook.js`

```js
const onLogout = () => {
  stopDeviceTrackingGlobal();
  clearCatalogCache();
  clearSalesCache();
  dispatch(resetCart());
  dispatch($reset());
  dispatch(clearSelectedChannel());
  dispatch(invalidateSession());
  dispatch(logout());
};
```

**Queue is untouched** — no `clearQueue()`, no queue state reset.

#### 6. Close Session — `src/pages/authorize/home/closeSession.jsx`

Recent upgrade added Option 1 → Option 2 flow:
- Try sync first
- If fail, warn user with "Close Anyway" option
- "Close Anyway" calls `clearQueue()`

This only covers close-session, not logout.

### Affected Files

| File | Changes Required | Impact |
|------|-----------------|--------|
| `src/services/offline/queue.js` | Major | DB naming by user, all functions need userId |
| `src/services/offline/syncManager.js` | Medium | Pass userId to queue functions, fix 401 handling |
| `src/services/offline/slice.js` | None | Redux state stays user-scoped |
| `src/services/baseQuery.js` | Minor | Pass userId when queueing |
| `src/services/auth/hook.js` | Minor | Cleanup queue DB on logout if empty |
| `src/pages/authorize/home/closeSession.jsx` | Minor | Pass userId to clearQueue |
| `src/main.jsx` | None | initSyncManager doesn't change |

---

## External Solutions / Options

### Option 1: Single DB + user_id Index (Minimal Change)

**What it is:** Keep one database, add `user_id` field to every item, filter by index.

**Pros:**
- Minimal code change
- No migration needed (add index on upgrade)
- Single connection to manage

**Cons:**
- All users' data mixed in DevTools
- Schema migration affects all data
- Table bloat over time with many users
- Accidentally loading all items = memory waste

**DevTools inspection:** ❌ Hard — 50 items mixed together, need to mentally filter

### Option 2: DB Per User (Recommended)

**What it is:** Database name includes `user_id`: `pos-offline-queue-{user_id}`

**Pros:**
- Complete isolation — zero cross-contamination risk
- DevTools shows per-user DBs, easy to inspect/debug
- Delete user = delete entire DB (clean slate)
- No filtering overhead — getAll = this user's items only
- Schema migration per DB, not per table within shared DB

**Cons:**
- Multiple DB connections on device switch (rare on POS)
- Need to close old DB when switching users
- Slightly more code to manage DB name

**DevTools inspection:** ✅ Excellent — each user has own expandable tree

### Option 3: Single DB + Object Store Per User

**What it is:** One DB, dynamically created stores like `pending_requests_{user_id}`

**Pros:**
- Single DB connection
- Visual separation in DevTools

**Cons:**
- IndexedDB doesn't support dynamic store creation easily
- Schema upgrade per new user is awkward
- Can't delete all user data with one call
- Unconventional pattern — confusing to maintain

**DevTools inspection:** ⚠️ Okay — separate stores but in one DB tree

---

## Comparison Matrix

| Criteria | Single DB + Index | DB Per User | DB + Store Per User |
|----------|-------------------|-------------|---------------------|
| Isolation | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| DevTools Debug | ⭐ | ⭐⭐⭐ | ⭐⭐ |
| Code Simplicity | ⭐⭐⭐ | ⭐⭐ | ⭐ |
| Cleanup Ease | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Migration Complexity | ⭐⭐⭐ | ⭐⭐ | ⭐ |
| POS Device Fit | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ |

---

## Recommendations

### Primary Recommendation: DB Per User

```js
const getDBName = (userId) => `pos-offline-queue-${userId}`;
```

**Rationale:**
1. **POS context** — limited users per device (2-5), not a web-scale app
2. **Debugging** — DevTools clarity is critical for support
3. **Safety** — zero chance of user A's items affecting user B
4. **Cleanup** — delete DB = complete removal, no orphaned data

### Implementation Strategy

**Phase 1: Queue Layer Refactor**
- `ensureDB(userId)` → dynamic DB name
- Remove singleton `dbPromise`, cache connections per userId
- All public functions accept `userId` param

**Phase 2: Update Consumers**
- `baseQuery.js` — pass userId from Redux state
- `syncManager.js` — pass userId in all queue calls
- `closeSession.jsx` — pass userId for clearQueue

**Phase 3: Auth Integration**
- `onLogout` — check if queue empty → delete DB
- `initSyncManager` — track current userId for sync

---

## Open Questions

- How to handle `idempotencyKeys` and `metadata` stores — per DB or shared? → **Per DB**, they're user-scoped.
- Migration path for existing single-DB data? → Read legacy DB once, migrate items tagged by token's user, then delete legacy DB.
- What happens to queue items when user is deleted from server? → Items will fail sync with 401/403, marked as failed, user can manually clear.

---

## Next Steps

1. Review findings
2. Proceed with implementation (plan + todo)
3. Migrate existing legacy DB on first load

---

*Research completed with SDD 2.0*
