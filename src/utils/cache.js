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
  return getSalesCacheValue(key) || [];
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
