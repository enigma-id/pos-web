// Base cache (default)

export const getCache = key => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const { data } = JSON.parse(raw);
    return data;
  } catch (err) {
    console.error('Error reading cache', err);
    return null;
  }
};

export const setCache = (key, data) => {
  setItemQuotaSafe(key, JSON.stringify({ data }));
};

export const getOrFetch = async (key, fetcher) => {
  const cached = getCache(key);
  if (cached || (Array.isArray(cached) && cached.length > 0)) return cached;

  try {
    const data = await fetcher();
    setCache(key, data);
    return data;
  } catch (e) {
    console.error('getOrFetch error for', key, e);
    return null;
  }
};

//
// Quota-safe writes
//

// localStorage shares one quota (~5 MB) across all keys. When full, setItem
// throws QuotaExceededError and a cache silently stops updating. These grouped
// caches regenerate on demand, so drop them to free space and retry the write.
const CACHE_MAX_ITEMS = 500;
const DETAIL_CACHE_MAX = 40;
const EVICTABLE_CACHE_KEYS = ['cache_sales', 'cache_catalog', 'cache_membership', 'cache_membership_search'];

const trimDetailCache = obj => {
  const keys = Object.keys(obj);
  while (keys.length > DETAIL_CACHE_MAX) {
    delete obj[keys.shift()];
  }
  return obj;
};

const setItemQuotaSafe = (key, value) => {
  try {
    localStorage.setItem(key, value);
    return;
  } catch (err) {
    if (err?.name === 'QuotaExceededError') {
      const evictable = EVICTABLE_CACHE_KEYS.filter(k => k !== key);
      for (const evictKey of [...evictable, key]) {
        try {
          localStorage.removeItem(evictKey);
        } catch {
          /* eviction best-effort */
        }
        try {
          localStorage.setItem(key, value);
          return;
        } catch {
          /* masih penuh — coba key berikutnya */
        }
      }
    }
    console.error('Error setting cache', err);
  }
};

//
// Grouped cache: cache_sales
//

const SALES_CACHE_KEY = 'cache_sales';

const getSalesCacheRaw = () => {
  try {
    const raw = localStorage.getItem(SALES_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const setSalesCacheRaw = data => {
  const existing = getSalesCacheRaw();
  const updated = { ...existing, ...data };
  setItemQuotaSafe(SALES_CACHE_KEY, JSON.stringify(updated));
};

export const getSalesCacheValue = key => {
  const cache = getSalesCacheRaw();
  return cache?.[key] ?? null;
};

export const setSalesCacheValue = (key, value) => {
  setSalesCacheRaw({ [key]: value });
};

export const getOrFetchSales = async (key, fetcher) => {
  const cached = getSalesCacheValue(key);
  if (cached || (Array.isArray(cached) && cached.length > 0)) return cached;

  try {
    const result = await fetcher();
    setSalesCacheValue(key, result);
    return result;
  } catch (e) {
    console.error(`getOrFetchSales error for ${key}`, e);
    return null;
  }
};

export const clearSalesCache = () => {
  localStorage.removeItem(SALES_CACHE_KEY);
};

export const setPaymentMethodsCache = (channelId, methods) => {
  const key = `payment_methods_${channelId ?? 'default'}`;
  setSalesCacheValue(key, methods || []);
};

export const getPaymentMethodsCache = channelId => {
  const key = `payment_methods_${channelId ?? 'default'}`;
  const data = getSalesCacheValue(key);
  if (data && data.length > 0) return data;

  // Fallback to default key if channel-specific not found
  if (channelId) {
    return getSalesCacheValue('payment_methods_default') || [];
  }
  return [];
};

//
// Grouped cache: cache_catalog
//

const CATALOG_CACHE_KEY = 'cache_catalog';

const getCatalogCacheRaw = () => {
  try {
    const raw = localStorage.getItem(CATALOG_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const setCatalogCacheRaw = data => {
  const existing = getCatalogCacheRaw();
  const updated = { ...existing, ...data };
  // Prune oversized/legacy detail sub-caches so cache_catalog stays bounded.
  if (updated.detail_catalog) updated.detail_catalog = trimDetailCache(updated.detail_catalog);
  if (updated.detail_catalog_by_category)
    updated.detail_catalog_by_category = trimDetailCache(updated.detail_catalog_by_category);
  setItemQuotaSafe(CATALOG_CACHE_KEY, JSON.stringify(updated));
};

export const getCatalogCacheValue = key => {
  const cache = getCatalogCacheRaw();
  return cache?.[key] ?? null;
};

export const setCatalogCacheValue = (key, value) => {
  setCatalogCacheRaw({ [key]: value });
};

export const getOrFetchCatalog = async (key, fetcher) => {
  const cached = getCatalogCacheValue(key);
  if (cached || (Array.isArray(cached) && cached.length > 0)) return cached;

  try {
    const result = await fetcher();
    setCatalogCacheValue(key, result);
    return result;
  } catch (e) {
    console.error(`getOrFetchCatalog error for ${key}`, e);
    return null;
  }
};

export const getCatalogDetailCacheKey = (id, channelId) => `${channelId}_${id}`;

export const getCatalogDetailByCategoryCacheKey = (id, channelId, categoryId) =>
  `${channelId}_${categoryId ?? 'all'}_${id}`;

export const setCatalogDetailCache = (id, channelId, data) => {
  const raw = getCatalogCacheRaw();
  const current = raw?.detail_catalog || {};

  const key = getCatalogDetailCacheKey(id, channelId);
  const updatedDetail = trimDetailCache({ ...current, [key]: data });

  setCatalogCacheRaw({ ...raw, detail_catalog: updatedDetail });
};

export const getCatalogDetailCache = (id, channelId) => {
  const cache = getCatalogCacheRaw();
  const key = getCatalogDetailCacheKey(id, channelId);
  return cache?.detail_catalog?.[key] || null;
};

export const setCatalogDetailCacheByCategory = (id, channelId, categoryId, data) => {
  const raw = getCatalogCacheRaw();
  const current = raw?.detail_catalog_by_category || {};
  const key = getCatalogDetailByCategoryCacheKey(id, channelId, categoryId);
  const updated = trimDetailCache({ ...current, [key]: data });

  setCatalogCacheRaw({ ...raw, detail_catalog_by_category: updated });
};

export const getCatalogDetailCacheByCategory = (id, channelId, categoryId) => {
  const cache = getCatalogCacheRaw();
  const key = getCatalogDetailByCategoryCacheKey(id, channelId, categoryId);

  const exact = cache?.detail_catalog_by_category?.[key] || null;
  if (exact) return exact;

  const allByCategory = cache?.detail_catalog_by_category || {};
  const fallbackPrefix = `${channelId}_`;
  const fallbackSuffix = `_${id}`;

  const fallbackKey = Object.keys(allByCategory).find(
    k => k.startsWith(fallbackPrefix) && k.endsWith(fallbackSuffix)
  );

  return fallbackKey ? allByCategory[fallbackKey] : null;
};

export const clearCatalogCache = () => {
  localStorage.removeItem(CATALOG_CACHE_KEY);
};

export const getCatalogItemFromPricingCache = (id, channelId) => {
  const key = `catalog_pricing_${channelId}`;
  const list = getCatalogCacheValue(key);
  if (!Array.isArray(list)) return null;
  return (
    list.find(item => String(item.id) === String(id) || String(item.catalog_id) === String(id)) ||
    null
  );
};

const BILLS_CACHE_KEY = 'cache_openbills';

const getOpenBillsCacheRaw = () => {
  try {
    const raw = localStorage.getItem(BILLS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveOpenBills = data => {
  const existing = getOpenBillsCacheRaw();

  if (!existing.data) {
    existing.data = [];
  }

  existing.data.unshift(data);
  existing.data = existing.data.slice(0, CACHE_MAX_ITEMS);

  setItemQuotaSafe(BILLS_CACHE_KEY, JSON.stringify(existing));

  return data;
};


export const updateOpenBills = data => {
  const existing = getOpenBillsCacheRaw();

  const index = existing.data.findIndex(
    item => item.id === data.id || item.sync_id === data.sync_id
  );

  if (index === -1) return null;

  existing.data[index] = {
    ...existing.data[index],
    ...data,
  };

  setItemQuotaSafe(BILLS_CACHE_KEY, JSON.stringify(existing));

  return existing.data[index];
};

export const deleteOpenBills = data => {
  const existing = getOpenBillsCacheRaw();

  existing.data = existing.data.filter(
    item => item.id !== data?.id || item.sync_id !== data?.sync_id
  );

  setItemQuotaSafe(BILLS_CACHE_KEY, JSON.stringify(existing));
};

const HISTORY_CACHE_KEY = 'cache_order_history';

const getOrderHistoryCacheRaw = () => {
  try {
    const raw = localStorage.getItem(HISTORY_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveOrderHistory = data => {
  const existing = getOrderHistoryCacheRaw();

  if (!existing.data) {
    existing.data = [];
  }

  existing.data.unshift(data);
  existing.data = existing.data.slice(0, CACHE_MAX_ITEMS);

  setItemQuotaSafe(HISTORY_CACHE_KEY, JSON.stringify(existing));

  return data;
};

export const deleteOrderHistory = data => {
  const existing = getOrderHistoryCacheRaw();

  existing.data = existing.data.filter(
    item => item.id !== data?.id || item.sync_id !== data?.sync_id
  );

  setItemQuotaSafe(HISTORY_CACHE_KEY, JSON.stringify(existing));
};

const SHIFTS_CACHE_KEY = 'cache_shifts';

const getShiftsCacheRaw = () => {
  try {
    const raw = localStorage.getItem(SHIFTS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveShifts = data => {
  const existing = getShiftsCacheRaw();

  if (!existing.data) {
    existing.data = [];
  }

  existing.data.unshift(data);
  existing.data = existing.data.slice(0, CACHE_MAX_ITEMS);

  setItemQuotaSafe(SHIFTS_CACHE_KEY, JSON.stringify(existing));

  return data;
};

export const updateShifts = data => {
  const existing = getShiftsCacheRaw();

  const index = existing.data.findIndex(
    item => item.id === data.id || item.sync_id === data.sync_id
  );

  if (index === -1) return null;

  existing.data[index] = {
    ...existing.data[index],
    ...data,
  };

  setItemQuotaSafe(SHIFTS_CACHE_KEY, JSON.stringify(existing));

  return existing.data[index];
};

export const showShifts = data => {
  const existing = getShiftsCacheRaw();

  const index = existing.data.findIndex(
    item => item.id === data.id || item.sync_id === data.sync_id
  );

  if (index === -1) return null;

  return existing.data[index];
};

const MEMBERSHIP_CACHE_KEY = 'cache_membership';
const MEMBERSHIP_SEARCH_CACHE_KEY = 'cache_membership_search';
// Membership payloads are large (card + saldo + nested saldo_logs per member).
// Cap by count AND strip saldo_logs (only the detail/history view needs it), so
// a single list write can't blow the shared localStorage quota (~5 MB).
const MEMBERSHIP_CACHE_MAX = 200;
const MEMBERSHIP_VALUE_BUDGET_BYTES = 1.5 * 1024 * 1024;
// point_logs tetap disimpan (dipakai tab Point saat offline), tapi dibatasi jumlah
// entrinya biar mirror lokal tidak menumbuhkan cache tanpa batas (F6).
const MEMBERSHIP_POINT_LOG_MAX = 50;

const stripSaldoLogs = m => {
  if (m && typeof m === 'object' && 'saldo_logs' in m) {
    const rest = { ...m };
    delete rest.saldo_logs;
    return rest;
  }
  return m;
};

const boundPointLogs = m => {
  if (m && typeof m === 'object' && Array.isArray(m.point_logs)) {
    if (m.point_logs.length <= MEMBERSHIP_POINT_LOG_MAX) return m;
    return { ...m, point_logs: m.point_logs.slice(0, MEMBERSHIP_POINT_LOG_MAX) };
  }
  return m;
};

const boundMembership = m => boundPointLogs(stripSaldoLogs(m));

const boundMembershipList = data => {
  if (!Array.isArray(data)) return data;
  let out = [];
  let bytes = 0;
  for (const m of data) {
    const slim = boundMembership(m);
    bytes += JSON.stringify(slim).length;
    if (out.length >= MEMBERSHIP_CACHE_MAX || bytes > MEMBERSHIP_VALUE_BUDGET_BYTES) break;
    out.push(slim);
  }
  return out;
};

export const saveMembershipList = (key, data) => {
  const bounded = boundMembershipList(data);
  setItemQuotaSafe(key, JSON.stringify({ data: bounded }));
  return bounded;
};

// key opsional: 'cache_membership_search' dipakai jalur search online (F5).
// Selalu balikin objek dengan `data` array biar caller tidak throw saat cache kosong (F4).
export const getMembersipCacheRaw = (key = MEMBERSHIP_CACHE_KEY) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { data: [] };

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : { data: [] };
  } catch {
    return { data: [] };
  }
};

export const showMembership = id => {
  const existing = getMembersipCacheRaw();

  const index = existing.data.findIndex(item => item.card_id === id);

  if (index === -1) return null;

  return existing.data[index];
};

export const saveMembership = data => {
  const existing = getMembersipCacheRaw();

  if (!existing.data) {
    existing.data = [];
  }

  existing.data.unshift(data);
  existing.data = existing.data.slice(0, CACHE_MAX_ITEMS);

  setItemQuotaSafe(MEMBERSHIP_CACHE_KEY, JSON.stringify(existing));

  return data;
};

// Match by id (server) atau card_id (member offline) — tanpa self-match ke `undefined`.
const isSameMember = (item, data) => {
  if (data?.id != null && item?.id === data.id) return true;
  if (data?.card_id != null && item?.card_id === data.card_id) return true;
  return false;
};

export const perbaharuiMembership = data => {
  const existing = getMembersipCacheRaw();

  const index = existing.data.findIndex(item => isSameMember(item, data));

  if (index >= 0) {
    existing.data[index] = {
      ...existing.data[index],
      ...data,
    };

    setItemQuotaSafe(MEMBERSHIP_CACHE_KEY, JSON.stringify(existing));

    return existing.data[index];
  }

  // F5: member yang cuma ada di cache hasil search online sebelumnya jadi no-op senyap.
  const search = getMembersipCacheRaw(MEMBERSHIP_SEARCH_CACHE_KEY);
  const searchData = Array.isArray(search?.data) ? search.data : [];
  const searchIndex = searchData.findIndex(item => isSameMember(item, data));

  if (searchIndex === -1) return null;

  searchData[searchIndex] = {
    ...searchData[searchIndex],
    ...data,
  };

  setItemQuotaSafe(MEMBERSHIP_SEARCH_CACHE_KEY, JSON.stringify({ data: searchData }));

  return searchData[searchIndex];
};
