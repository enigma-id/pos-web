# Phase 3: Membership + Topup — Final Polish

## Goal

Membership & topup flow berfungsi penuh saat offline. Final sync payload includes memberships[] dan topups[]. Summary offline compute dari data real (bukan 0). PendingDrawer final semua 4 tabs.

---

## Files Changed (Phase 3)

| # | File | Change |
|---|------|--------|
| 1 | `src/services/offline/queue.js` | Tambah `appendTopupToSession()`, `appendMembershipToSession()` |
| 2 | `src/services/offline/syncManager.js` | Memberships[] & topups[] udah di payload (line 165). Pastikan field mapping bener untuk topup item |
| 3 | `src/pages/authorize/membership/card.content.jsx` | Offline path: append topup ke session blob, inject ke history cache, print receipt lokal |
| 4 | `src/pages/authorize/home/checkout.jsx` | Offline path: handle `membershipId` di order shape (sudah). NFC handleRead offline — tetep jalan |
| 5 | `src/services/sales/session/hook.js` | Summary offline: compute dari orders[] + topups[] (bukan 0) |
| 6 | `src/components/ui/offline/PendingDrawer.jsx` | Tab Topup render dari `sessions[].topups[]` (sudah flatten). Verifikasi mapping field |
| 7 | `src/services/offline/slice.js` | Pastikan `offlineSummary` cukup untuk compute topups totals |
| 8 | `src/services/membership/action.js` | Hapus `__offlinePreview` dari `topup` endpoint (baseQuery ga queue lagi) |
| 9 | **NEW** `src/pages/authorize/membership/topup-manual.jsx` | **BARU.** Page manual topup tanpa NFC — input card_id manual + CardContent |
| 10 | `src/pages/authorize/membership/_subrouter.js` | Tambah route `/membership/topup-manual` |

---

## 9. (NEW) `topup-manual.jsx` — Manual Topup Page

Page ini solusi karena user gak bisa test NFC. Input card_id manual → search member → topup form.

### Flow

```
/topup-manual
  ├─ Input field: "Card ID / Member Code"
  ├─ Button: "Search Member"
  │
  ├─ Online:
  │   ├─ checkSaldo({ card_id })
  │   └─ Sukses → render <CardContent data={member} />
  │
  ├─ Offline:
  │   ├─ getMemberCache(cardId)
  │   ├─ Ada cache → render <CardContent data={member} />
  │   └─ Ga ada cache → "Member not cached. Scan while online first."
```

### Code

```jsx
import React from 'react';
import { useSelector } from 'react-redux';
import CardContent from './card.content';
import useMembership from '../../../services/membership/hook';
import { getMemberCache, setMemberCache } from '../../../utils/cache';
import { BackIcon, SearchIcon } from '../../../components/ui/icon';

const TopupManual = () => {
  const { checkSaldo, checkResult } = useMembership();
  const [cardId, setCardId] = React.useState('');
  const [member, setMember] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const scanConsumed = React.useRef(false);

  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  const handleSearch = () => {
    const uid = cardId.trim();
    if (!uid) return;

    setError('');
    setLoading(true);
    scanConsumed.current = false;

    if (isOffline) {
      const cached = getMemberCache(uid);
      if (cached) {
        setMember(cached);
        setLoading(false);
        return;
      }
      setError('Member data not available offline. Please scan while online first to cache.');
      setLoading(false);
      return;
    }

    checkSaldo({ card_id: uid });
  };

  React.useEffect(() => {
    if (checkResult?.isSuccess && !scanConsumed.current) {
      scanConsumed.current = true;
      const data = checkResult?.data?.data;
      if (data?.card_id) setMemberCache(data.card_id, data);
      setMember(data);
      setLoading(false);
    }
  }, [checkResult]);

  React.useEffect(() => {
    if (checkResult?.isError && !scanConsumed.current) {
      scanConsumed.current = true;
      setError('Member not found. Check card ID or try again later.');
      setLoading(false);
    }
  }, [checkResult]);

  if (member) {
    return (
      <div className="flex h-screen flex-col">
        <div className="border-base-200 bg-base-100 flex h-16 border-t border-b">
          <div className="border-base-200 flex-1 place-content-center border-r border-l">
            <div className="flex place-items-center gap-6 px-4">
              <div className="btn btn-circle btn-md btn-outline" onClick={() => setMember(null)}>
                <BackIcon />
              </div>
              <div className="text-lg font-semibold">Topup — {member.name}</div>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <CardContent
            data={member}
            onClose={() => {
              setMember(null);
              setCardId('');
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="border-base-200 bg-base-100 flex h-16 border-t border-b">
        <div className="border-base-200 flex-1 place-content-center border-r border-l">
          <div className="flex place-items-center gap-6 px-4">
            <div className="text-lg font-semibold">Manual Topup</div>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col place-items-center place-content-center p-8">
        <div className="w-full max-w-md space-y-4">
          <label className="text-sm font-semibold">Card ID / Member Code</label>
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder="e.g. 1234567890"
            value={cardId}
            onChange={e => setCardId(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
            autoFocus
          />

          {error && (
            <div className="text-sm text-error bg-error/10 rounded px-3 py-2">{error}</div>
          )}

          <button
            className={`btn btn-primary btn-block btn-xl ${loading ? 'btn-disabled' : ''}`}
            onClick={handleSearch}
          >
            {loading ? <span className="loading loading-spinner"></span> : <><SearchIcon /> Search Member</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopupManual;
```

---

## 1. `src/services/offline/queue.js` — Tambah Fungsi

### `appendTopupToSession()`

```js
export const appendTopupToSession = async (syncId, topup, userId) => {
  const db = await ensureDB(userId);
  const existing = await db.get(STORES.offlineSessions, syncId);
  if (!existing) throw new Error(`Session not found: ${syncId}`);

  if (!Array.isArray(existing.topups)) {
    existing.topups = [];
  }

  existing.topups.push(topup);
  await db.put(STORES.offlineSessions, existing);
  return existing;
};
```

### `appendMembershipToSession()`

```js
export const appendMembershipToSession = async (syncId, membership, userId) => {
  const db = await ensureDB(userId);
  const existing = await db.get(STORES.offlineSessions, syncId);
  if (!existing) throw new Error(`Session not found: ${syncId}`);

  if (!Array.isArray(existing.memberships)) {
    existing.memberships = [];
  }

  existing.memberships.push(membership);
  await db.put(STORES.offlineSessions, existing);
  return existing;
};
```

---

## 2. `src/pages/authorize/membership/card.content.jsx` — Offline Topup

### Handle offline di `handleTopup`

```
handleTopup():
  ├─ isOffline?
  │    └─ YA:
  │       ├─ Baca activeSyncId dari Redux (state.Offline.activeSyncId)
  │       ├─ Kalo ga ada → dispatch(setWarning('No active session')) → return
  │       ├─ Build topup shape:
  │       │   {
  │       │     sync_id: uuidv4(),
  │       │     session_sync_id: activeSyncId,
  │       │     membership_id: data.id,
  │       │     nominal: Number(value),
  │       │     payment_type: method,
  │       │     member_name: data.name,
  │       │     member_code: data.reff_code,
  │       │     created_at: new Date().toISOString()
  │       │   }
  │       ├─ appendTopupToSession(activeSyncId, topup, userId)
  │       ├─ Update cache: updateMemberCacheSaldo(data.card_id, newSaldo)
  │       ├─ Print receipt lokal (pakai data yang ada)
  │       │   openPrint(<TopupReceipt member={data} nominal={nominal} ... />)
  │       ├─ Refresh Redux offline sessions
  │       └─ Close modal
  │
  └─ TIDAK (online):
       └─ topupMutation({ id: data.id, payload }) → existing flow
```

### Import tambahan

```js
import { appendTopupToSession } from '../../../services/offline/queue';
import {
  getAllSessions,
} from '../../../services/offline/queue';
import { useSelector } from 'react-redux';
import { setSessions, setPendingCount } from '../../../services/offline/slice';
```

### Catatan: `topupResult?.isSuccess` effect — skip untuk offline

```js
React.useEffect(() => {
  if (topupResult?.isSuccess && topupSubmitted.current) {
    // Skip kalo ini offline — offline path handle sendiri
    if (topupResult?.data?.data?.offline_queued) return;
    
    topupSubmitted.current = false;
    // ... existing online flow
  }
}, [topupResult]);
```

---

## 3. `src/pages/authorize/membership/_subrouter.js` — Tambah Route

```js
import MembershipScreen from '.';
import TopupManual from './topup-manual';

const routes = [
  {
    path: '/membership',
    element: MembershipScreen,
  },
  {
    path: '/membership/topup-manual',
    element: TopupManual,
  },
];

export default routes;
```

---

## 4. Checkout Membership (NFC) Offline

### `checkout.jsx` — `handleRead()`

**Sudah handle offline:**
```js
const handleRead = uid => {
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  if (isOffline || apiReachable === false) {
    const cached = getMemberCache(uid);
    handlePay(cached || { card_id: uid });
    return;
  }
  // ... online checkSaldo
};
```

Di `handlePay`, kalo ada `card`:
```js
if (card) {
  payload.membership_id = card?.id;
  payload.card_id = card?.card_id;
  payload.payment_ref = card?.reff_code;
}
```

Ini berlanjut ke order shape di `session.orders[]`:
```js
membershipId: CartState?.meta?.customer?.id || payload.membership_id || null,
```

**Tidak perlu diubah.**

---

## 5. `src/services/offline/syncManager.js` — Verifikasi Payload

### Memberships — line 165

```js
memberships: (session.memberships || []).map(m => ({
  card_id: m.card_id || m.sync_id,
  name: m.name || '',
})),
```

Udah ada, cuma pastikan mapping field sesuai API contract `{ card_id, name }`.

### Topups

```js
topups: (session.topups || []).map(t => ({
  membership_id: t.membership_id,
  session_sync_id: t.session_sync_id || session.sync_id,
  nominal: t.nominal || 0,
  payment_type: t.payment_type || 'cash',
})),
```

---

## 6. `src/services/sales/session/hook.js` — Summary Offline Compute Real

### `computeOfflineSummary()` — helper function

```js
const computeOfflineSummary = (session, authUser) => {
  const orders = session.orders || [];
  const topups = session.topups || [];

  const completedOrders = orders.filter(o => o.status === 'completed');
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const totalSales = completedOrders.reduce((sum, o) => sum + (o.totalPayment || 0), 0);
  const totalDiscount = completedOrders.reduce((sum, o) => sum + (o.discountValue || 0), 0);
  const totalAfterDiscount = totalSales - totalDiscount;
  const outstandingBill = pendingOrders.reduce((sum, o) => sum + (o.totalPayment || 0), 0);

  // Payment methods breakdown
  const pmMap = {};
  completedOrders.forEach(o => {
    const id = o.paymentMethodId || 0;
    if (!pmMap[id]) pmMap[id] = { payment_method_id: id, total_paid: 0, count: 0, name: o.paymentMethodId === 0 ? 'Cash' : '-' };
    pmMap[id].total_paid += o.totalPayment || 0;
    pmMap[id].count += 1;
  });

  // Topup summary
  const totalTopup = topups.reduce((sum, t) => sum + (t.nominal || 0), 0);
  const topupCash = topups.filter(t => t.payment_type === 'cash').reduce((sum, t) => sum + (t.nominal || 0), 0);

  return {
    started_at: session.session.open_at,
    finished_at: session.session.close_at || new Date().toISOString(),
    cash_started: session.session.cash_started,
    cash_finished: session.session.cash_finished,
    cashier: { name: authUser?.name || '-' },
    summary: {
      sales: {
        total_sales: totalSales,
        total_discount: totalDiscount,
        total_after_discount: totalAfterDiscount,
        total_service: 0,
        grand_total: totalAfterDiscount,
        outstanding_bill: outstandingBill,
        outstanding_bill_payment: outstandingBill,
      },
      cash: {
        expected_cash: (session.session.cash_started || 0) + totalSales + topupCash,
        topup_cash: topupCash,
      },
      payment_methods: Object.values(pmMap),
      category_solds: [],
      topups: topups.map(t => ({
        type: t.payment_type || 'cash',
        total_nominal: t.nominal || 0,
      })),
    },
    orders: orders,
  };
};
```

Panggil ini di `summary()` offline dan `end()` offline.

---

## 7. `src/services/membership/action.js` — Hapus `__offlinePreview`

```js
topup: builder.mutation({
  query: ({ id, payload }) => ({
    url: `/balance/${id}/topup`,
    method: 'POST',
    body: payload,
    // ❌ HAPUS: __offlinePreview: { ... }
  }),
}),
```

---

## Verification Phase 3

1. **Topup manual page** — input card_id, search, render CardContent ✅
2. **Topup offline** — append ke session.topups[], update cache saldo, print receipt ✅
3. **Topup offline + sync** — POST /sales/sync includes topups[] ✅
4. **Membership create offline** — append ke session.memberships[] ✅
5. **Checkout offline + membership** — order.membershipId terisi ✅
6. **NFC offline** — handleRead pake cache → handlePay dengan membership_id ✅
7. **Summary offline** — compute real dari orders[] + topups[] ✅
8. **PendingDrawer tab Topup** — render dari sessions[].topups[] ✅
9. **PendingDrawer tab Orders/Bills** — render dari sessions[].orders[] ✅
10. **PendingDrawer tab Shifts** — render dari session info ✅
11. **`__offlinePreview`** dihapus dari topup mutation ✅
12. **Online topup tetap jalan** → mutation API ✅
