# Research: Offline-First Architecture for POS System

**Task ID:** offline-first-architecture
**Date:** 2026-05-21
**Status:** Complete

---

## Executive Summary

The Suka Bread POS system currently relies entirely on real-time API calls for all write operations (checkout, session management, bill operations). When network is unavailable, these operations fail and disrupt business flow. This research explores ways to make the POS **work offline seamlessly** — allowing all business processes to continue locally and automatically sync to the API when connection returns.

**Key Finding:** The codebase already has strong foundations — Redux Toolkit, redux-persist, and localStorage caching. The gap is in **queueing failed writes** and **automatic retry/sync on reconnect**.

---

## Codebase Analysis

### Current Network Handling
| File | Purpose | Offline Support |
|------|---------|-----------------|
| `src/services/baseQuery.js` | RTK baseQuery with auth | ❌ No offline handling |
| `src/services/cart/slice.js` | Cart state management | ✅ Fully local |
| `src/utils/cache.js` | localStorage caching | ✅ Read caching exists |
| `src/services/store.js` | Redux persist config | ✅ State persisted |

### Current baseQuery Implementation
```javascript
// src/services/baseQuery.js - No offline handling
export const baseQuery = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  // No retry, no queue, no offline detection
  return result;
};
```

### What Already Works Offline
- ✅ Adding items to cart (local Redux state)
- ✅ Browsing catalog (cached via `cache.js`)
- ✅ Viewing category discounts (local state)
- ✅ Service charge calculation (local)

### What Breaks When Offline
| Operation | Endpoint | Impact |
|-----------|----------|--------|
| Checkout | `/sales/order/direct-pay` | Transaction fails, customer cannot pay |
| Save Bill | `/sales/order/open-bill` | Cannot save pending order |
| Close Bill | `/sales/order/{id}/close-bill` | Cannot finalize saved bill |
| Start Session | `/sales/session/start` | Cannot open shift |
| End Session | `/sales/session/end` | Cannot close shift |
| Member Topup | `/saldo/top-up` | Cannot add saldo offline |
| Cancel Order | `/sales/order/{id}/cancel` | Cannot refund offline |

---

## Business Process Criticality

### Tier 1: Must Work Offline (Critical)
1. **Add to Cart + Checkout** — Core sales flow
2. **Save Bill** — Hold orders for later
3. **Open/Close Session** — Shift management

### Tier 2: Should Work Offline
4. **Cancel/Refund Order** — Customer service
5. **Member Lookup** — Check cached data

### Tier 3: Can Show Error
6. **Order History Fetch** — Read-only
7. **Member Topup** — Financial, needs verification

---

## External Solutions

### Option 1: Custom BaseQuery with Queue (Recommended)

**Overview:** Wrap existing `baseQuery` with offline detection + request queue. Uses `navigator.onLine` to detect connectivity. Failed requests are stored in IndexedDB (better than localStorage for large queues) and retried on reconnect.

**Pros:**
- Full control over retry logic
- Works with existing RTK Query setup
- Can use IndexedDB for persistent queue
- Supports idempotent and non-idempotent operations differently

**Cons:**
- Need to handle duplicate submissions (idempotency)
- Complex error recovery for partial failures

**Implementation complexity:** Medium
**Team familiarity:** High (pure JavaScript)

---

### Option 2: Redux Persist + Manual Sync Pattern

**Overview:** Store pending actions in Redux (persisted to localStorage). On reconnect, dispatch a sync action that replays all pending mutations.

**Pros:**
- Leverages existing redux-persist
- Simple to understand
- Native Redux flow

**Cons:**
- Not suitable for large queues
- No built-in retry with backoff
- Hard to track sync status per-request

**Implementation complexity:** Low
**Team familiarity:** High

---

### Option 3: Service Worker with Background Sync

**Overview:** Use Workbox or custom service worker to handle offline requests. Browser handles retry automatically.

**Pros:**
- Native browser capability
- Works even if tab is closed
- Built-in retry logic

**Cons:**
- Limited browser support for Background Sync API
- Harder to integrate with Redux state
- Overkill for single-page POS app

**Implementation complexity:** High
**Team familiarity:** Low

---

### Option 4: Use Existing RTK Query Optimistic Updates

**Overview:** Leverage RTK Query's `onQueryStarted` with `optimisticUpdate` to immediately update cache, rollback on failure.

**Pros:**
- Built into RTK Query
- Good for UI responsiveness

**Cons:**
- Only handles cache updates, not true offline
- Doesn't persist across page refresh
- Doesn't solve queue problem

**Implementation complexity:** Low
**Team familiarity:** Medium

---

## Recommended Approach: Option 1 - Custom BaseQuery with IndexedDB Queue

This is the most robust solution for POS systems:

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      React App                              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐   │
│  │   Cart UI   │    │  Checkout UI │    │   Session UI  │   │
│  └──────┬──────┘    └──────┬───────┘    └───────┬───────┘   │
│         │                  │                    │           │
│  ┌──────▼──────────────────▼────────────────────▼────────┐  │
│  │              Redux Store + RTK Query                  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │         Custom baseQuery with Queue             │  │  │
│  │  │  ┌─────────┐  ┌──────────┐  ┌──────────────┐    │  │  │
│  │  │  │Network  │  │ Request  │  │   IndexedDB  │    │  │  │
│  │  │  │Detector │→ │ Queue    │→ │   (pending)  │    │  │  │
│  │  │  └─────────┘  └──────────┘  └──────────────┘    │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ (when online)
                    ┌─────────────────────┐
                    │      API Server     │
                    │  (sync pending ops) │
                    └─────────────────────┘
```

### Core Components

#### 1. Network Detector Hook
```javascript
// Detects online/offline status
const isOnline = navigator.onLine; // Simple check
window.addEventListener('online', () => syncPendingRequests());
window.addEventListener('offline', () => showOfflineBanner());
```

#### 2. Request Queue with IndexedDB
```javascript
// Store pending requests in IndexedDB
const db = await openDB('pos-offline-queue', 1, {
  upgrade(db) {
    db.createObjectStore('pendingRequests', { keyPath: 'id', autoIncrement: true });
  }
});

const addToQueue = async (request) => {
  await db.add('pendingRequests', { ...request, timestamp: Date.now() });
};

const processQueue = async () => {
  const pending = await db.getAll('pendingRequests');
  for (const req of pending) {
    try {
      await executeRequest(req);
      await db.delete('pendingRequests', req.id);
    } catch (e) {
      // Retry later
    }
  }
};
```

#### 3. Enhanced baseQuery
```javascript
export const baseQuery = async (args, api, extraOptions) => {
  if (!navigator.onLine) {
    // Store request for later
    await addToQueue({ args, extraOptions, type: 'mutation' });
    return { error: { status: 'OFFLINE', data: 'Request queued' } };
  }

  try {
    return await rawBaseQuery(args, api, extraOptions);
  } catch (error) {
    if (!navigator.onLine) {
      await addToQueue({ args, extraOptions, type: 'mutation' });
      return { error: { status: 'OFFLINE_QUEUED', data: 'Will sync when online' } };
    }
    throw error; // Re-throw for other errors
  }
};
```

#### 4. Sync Manager Service
```javascript
// Background sync when connection returns
window.addEventListener('online', () => {
  syncPendingRequests();
});

const syncPendingRequests = async () => {
  const pending = await getPendingRequests();

  for (const request of pending) {
    try {
      // Mark as syncing
      await updateRequestStatus(request.id, 'syncing');

      // Execute with original baseQuery
      const result = await rawBaseQuery(request.args, null, request.extraOptions);

      if (result.error) {
        // Handle API error - keep in queue or mark failed
        await handleSyncError(request, result.error);
      } else {
        // Success - remove from queue and notify UI
        await removeRequest(request.id);
        notifySuccess(request.id, result.data);
      }
    } catch (e) {
      console.error('Sync failed for request:', request.id, e);
    }
  }
};
```

---

## Handling Idempotency

### The Problem
If checkout is queued offline, and the user submits again when online (before sync completes), we could charge twice.

### Solutions

| Approach | Description | Complexity |
|----------|-------------|------------|
| **Client-side dedup** | Generate UUID per checkout, store in localStorage, check before queue | Low |
| **Server-side idempotency** | Pass idempotency key in request header, server handles dedup | Medium (requires backend) |
| **Optimistic lock** | Server returns version/timestamp, client includes in sync | High |

### Recommended: Client-Side Deduplication
```javascript
const submitCheckout = async (cartData) => {
  const idempotencyKey = generateUUID(); // Generate once per checkout attempt

  // Check if already pending
  const existing = await getPendingByIdempotency(idempotencyKey);
  if (existing) return existing.result;

  return queueRequest({ type: 'checkout', payload: cartData, idempotencyKey });
};
```

---

## UI Considerations

### 1. Offline Banner
- Show persistent banner when offline
- Show pending sync count: "3 transactions pending sync"

### 2. Checkout Flow
- Allow checkout offline with "Pending Sync" status
- Show clear feedback: "Transaction saved locally. Will sync when online."

### 3. Session Management
- Allow opening session offline (store opening cash locally)
- Warn when closing session offline: "Final settlement will process when online"

### 4. Receipt Printing
- Print locally even if API call queued
- Mark receipt as "Pending sync" — later reconcile with server

---

## Comparison Matrix

| Criteria | Custom BaseQuery | Redux Persist | Service Worker | RTK Optimistic |
|----------|------------------|---------------|----------------|----------------|
| Offline writes | ✅ Full | ✅ Full | ✅ Full | ❌ Cache only |
| Persistent queue | ✅ IndexedDB | ⚠️ localStorage | ⚠️ Limited | ❌ No |
| Auto-sync | ✅ Custom | ⚠️ Manual | ✅ Native | ❌ No |
| Complexity | Medium | Low | High | Low |
| Team familiarity | High | High | Low | Medium |
| Works after refresh | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |

---

## Recommendations

### Primary: Custom BaseQuery + IndexedDB Queue

This approach gives:
1. **Zero business interruption** — checkout and sessions work offline
2. **Persistent queue** — survives browser refresh
3. **Auto-sync** — transparent to user
4. **Full control** — can handle POS-specific needs

### Implementation Phases

| Phase | Scope | Description |
|-------|-------|-------------|
| 1 | Network Detection | Add online/offline detection + UI banner |
| 2 | Basic Queue | Queue failed mutations in IndexedDB |
| 3 | Auto-Sync | Process queue when connection returns |
| 4 | Idempotency | Prevent duplicate submissions |
| 5 | Reconciliation | Handle conflicts (server vs local) |

---

## Open Questions

1. **Backend idempotency:** Does the API server support idempotency keys? If not, can it be added?
2. **Data reconciliation:** What happens if local state differs from server after sync? (e.g., price changes)
3. **Session timeout:** Should offline session auto-close after X hours?
4. **Multi-device:** If same cashier logs in on different device, how to merge pending operations?

---

## Next Steps

1. Review this research document
2. Run `/specify offline-architecture` to define detailed requirements
3. Run `/plan offline-architecture` to create technical implementation plan

---

*Research completed with SDD 2.0*
