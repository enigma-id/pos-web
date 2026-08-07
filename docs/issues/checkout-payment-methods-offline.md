# Checkout: Payment Methods Offline Fallback

## Problem

Saat checkout, payment methods di-fetch dari `GET /payment-method`. Pas offline:
1. Fetch gagal (network error)
2. Fallback ke `getPaymentMethodsCache(channelId)` — localStorage
3. **Tapi cache kosong** kalo belum pernah fetch method online sebelumnya / cache expired

Akibatnya: dropdown payment method kosong, user ga bisa checkout.

## Tujuan

Tetap munculin default payment method ("Cash") saat offline, meski cache kosong.

## Batasan (Ga Disentuh)

- Queue engine ❌
- Sync manager ❌
- BaseQuery ❌
- Queue Manager ❌

## Desain

### Di `services/cart/hook.js` — `getPaymentMethod()`

Deteksi offline/API dead → kalo cache ada, pake cache. Kalo ga ada, return **default: Cash**.

Default shape:
```js
{ id: 0, name: 'Cash', provider: 'cash', is_nfc: 0 }
```

### Flow
```
getPaymentMethod()
  ├─ offline/API dead + cache ada → return cache ✅
  ├─ offline/API dead + NO cache → return [Cash] ✅
  └─ online → fetch server → cache → return data ✅
```

### Di `pages/authorize/home/checkout.jsx`

Setelah `getPaymentMethod()` return data, `setSelectedMethod(res[0])` — otomatis pake Cash kalo cuma itu.

## Files Berubah

| File | Perubahan |
|---|---|
| `services/cart/hook.js` | `getPaymentMethod()`: deteksi offline + default Cash fallback |

## Verification

1. **Online** → checkout → payment methods dari server ✅
2. **Offline (cache ada)** → checkout → payment methods dari cache ✅
3. **Offline (cache kosong)** → checkout → default Cash muncul ✅
4. **Cash selected** → bisa lanjut bayar (input total payment) ✅
