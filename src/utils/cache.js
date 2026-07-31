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
  try {
    localStorage.setItem(key, JSON.stringify({ data }));
  } catch (err) {
    console.error('Error setting cache', err);
  }
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
  localStorage.setItem(SALES_CACHE_KEY, JSON.stringify(updated));
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
  localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(updated));
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
  const updatedDetail = { ...current, [key]: data };

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
  const updated = { ...current, [key]: data };

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

// Look up a catalog item from the cached pricing list (not detail cache)
// Used as fallback when server is unreachable and no detail cache exists
//
// Grouped cache: cache_members
//

const MEMBER_CACHE_KEY = 'cache_members';

const getMemberCacheRaw = () => {
  try {
    const raw = localStorage.getItem(MEMBER_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const setMemberCacheRaw = data => {
  const existing = getMemberCacheRaw();
  const updated = { ...existing, ...data };
  localStorage.setItem(MEMBER_CACHE_KEY, JSON.stringify(updated));
};

export const getMemberCache = cardId => {
  const cache = getMemberCacheRaw();
  return cache?.[cardId] ?? null;
};

export const setMemberCache = (cardId, memberData) => {
  setMemberCacheRaw({ [cardId]: memberData });
};

export const updateMemberCacheSaldo = (cardId, newSaldo) => {
  const existing = getMemberCache(cardId);
  if (!existing) return;
  setMemberCacheRaw({ [cardId]: { ...existing, saldo: newSaldo } });
};

export const clearMemberCache = () => {
  localStorage.removeItem(MEMBER_CACHE_KEY);
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

  localStorage.setItem(BILLS_CACHE_KEY, JSON.stringify(existing));

  return bill;
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

  localStorage.setItem(BILLS_CACHE_KEY, JSON.stringify(existing));

  return existing.data[index];
};

export const deleteOpenBills = id => {
  const existing = getOpenBillsCacheRaw();

  existing.data = existing.data.filter(item => item.id !== id && item.sync_id !== id);

  localStorage.setItem(BILLS_CACHE_KEY, JSON.stringify(existing));
};
