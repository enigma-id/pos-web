/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
  useCreateMutation,
  useLazyGetCatalogDetailQuery,
  useLazyGetCatalogPricingQuery,
  useLazyGetCategoriesQuery,
} from './action';
import {
  getOrFetchCatalog,
  getCatalogCacheValue,
  setCatalogCacheValue,
  getCatalogDetailCache,
  setCatalogDetailCache,
  getCatalogDetailCacheByCategory,
  setCatalogDetailCacheByCategory,
  getCatalogItemFromPricingCache,
} from '../../utils/cache';
import { $failure } from '../form/action';

const useCatalog = () => {
  const dispatch = useDispatch();
  const selectedChannel = useSelector(state => state.SalesChannel?.selectedChannel);

  const [createCatalog, createResult] = useCreateMutation();
  const [allCatalog, setAllCatalog] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filteredCatalog, setFilteredCatalog] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [triggerPricing] = useLazyGetCatalogPricingQuery();
  const [triggerCategories, categoriesResult] = useLazyGetCategoriesQuery();
  const [triggerCatalogDetail] = useLazyGetCatalogDetailQuery();

  const prewarmCatalogDetails = useCallback(
    async ({ catalogList, channelId, categoryId }) => {
      if (!channelId || !Array.isArray(catalogList) || catalogList.length === 0) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;

      const targetCategoryId = categoryId ?? 0;
      const toPrefetch = catalogList.slice(0, 30);

      await Promise.allSettled(
        toPrefetch.map(async item => {
          const catalogId = item?.id ?? item?.catalog_id;
          if (!catalogId) return;

          const cachedByCategory = getCatalogDetailCacheByCategory(
            catalogId,
            channelId,
            targetCategoryId
          );
          if (cachedByCategory) return;

          const cachedLegacy = getCatalogDetailCache(catalogId, channelId);
          if (cachedLegacy) {
            setCatalogDetailCacheByCategory(catalogId, channelId, targetCategoryId, cachedLegacy);
            return;
          }

          const res = await triggerCatalogDetail({ id: catalogId, channel_id: channelId }).unwrap();
          const data = res?.data;
          if (data) {
            setCatalogDetailCache(catalogId, channelId, data);
            setCatalogDetailCacheByCategory(catalogId, channelId, targetCategoryId, data);
          }
        })
      );
    },
    [triggerCatalogDetail]
  );

  const create = async payload => {
    try {
      await createCatalog(payload).unwrap();
    } catch (err) {
      dispatch($failure(err));
    }
  };

  const applyFilter = useCallback((rawCatalog, category, search) => {
    let result = rawCatalog;

    if (category !== null && category.id !== 0) {
      result = result.filter(item => item.category_id === category.id);
    }

    if (search) {
      result = result.filter(item => item.name?.toLowerCase().includes(search.toLowerCase()));
    }

    return result;
  }, []);

  const loadCatalogAndCategory = useCallback(async () => {
    if (!selectedChannel?.id) return;

    setIsLoading(true);

    const catalogKey = `catalog_pricing_${selectedChannel.id}`;
    const categoryKey = `categories`;

    const catalogData = await getOrFetchCatalog(catalogKey, async () => {
      const res = await triggerPricing({
        sales_channel_id: selectedChannel.id,
      }).unwrap();
      return res?.data || [];
    });

    const categoryData = await getOrFetchCatalog(categoryKey, async () => {
      const res = await triggerCategories().unwrap();
      const data = res?.data || [];
      return [{ id: 0, name: 'All Category' }, ...data];
    });

    setAllCatalog(catalogData);
    setCategories(categoryData);

    // ✅ Restore selected category
    const cachedCategory = getCatalogCacheValue('selected_category');
    const cachedSearch = getCatalogCacheValue('search_term') || '';

    const fallbackCategory = categoryData.find(cat => cat.id === 0) || null;
    const activeCategory = cachedCategory ?? fallbackCategory;

    const filtered = applyFilter(catalogData, activeCategory, cachedSearch);

    setAllCatalog(catalogData);
    setCategories(categoryData);
    setSelectedCategory(activeCategory);
    setSearchTerm(cachedSearch);
    setFilteredCatalog(filtered);
    setIsLoading(false);

    prewarmCatalogDetails({
      catalogList: filtered,
      channelId: selectedChannel.id,
      categoryId: activeCategory?.id ?? 0,
    });
  }, [selectedChannel, triggerPricing, triggerCategories, applyFilter, prewarmCatalogDetails]);

  const onSelectCategory = useCallback(
    category => {
      setSelectedCategory(category);
      setCatalogCacheValue('selected_category', category);

      const filtered = applyFilter(allCatalog, category, searchTerm);
      setFilteredCatalog(filtered);
    },
    [allCatalog, searchTerm, applyFilter]
  );

  const onSearch = useCallback(
    term => {
      setSearchTerm(term);
      setCatalogCacheValue('search_term', term);

      const filtered = applyFilter(allCatalog, selectedCategory, term);
      setFilteredCatalog(filtered);
    },
    [allCatalog, selectedCategory, applyFilter]
  );

  const clearCategory = useCallback(() => {
    setSelectedCategory(null);
    setCatalogCacheValue('selected_category', null);
    applyFilter(null, searchTerm);
  }, [applyFilter, searchTerm]);

  const apiReachable = useSelector(state => state?.Offline?.apiReachable);

  const getDetail = useCallback(
    async ({ id, channel_id = selectedChannel.id, category_id }) => {
      const resolvedCategoryId = category_id ?? selectedCategory?.id ?? 0;
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      const apiDead = apiReachable === false;

      const cachedByCategory = getCatalogDetailCacheByCategory(id, channel_id, resolvedCategoryId);
      const cachedLegacy = getCatalogDetailCache(id, channel_id);

      if (isOffline || apiDead) {
        return cachedByCategory || cachedLegacy || getCatalogItemFromPricingCache(id, channel_id) || null;
      }

      try {
        const res = await triggerCatalogDetail({ id, channel_id }).unwrap();
        const data = res?.data || null;
        if (data) {
          setCatalogDetailCache(id, channel_id, data);
          setCatalogDetailCacheByCategory(id, channel_id, resolvedCategoryId, data);
          return data;
        }

        return cachedByCategory || cachedLegacy || null;
      } catch (e) {
        console.log('Error fetching catalog detail:', e);
        return cachedByCategory || cachedLegacy || null;
      }
    },
    [triggerCatalogDetail, selectedChannel, selectedCategory]
  );

  const refreshCatalog = useCallback(async () => {
    if (!selectedChannel?.id) return;

    setIsLoading(true);

    try {
      const resCatalog = await triggerPricing({ sales_channel_id: selectedChannel.id }).unwrap();
      const resCategory = await triggerCategories().unwrap();
      const d = resCategory?.data || [];
      const catalogData = resCatalog?.data || [];
      const categoryData = [{ id: 0, name: 'All Category' }, ...d];

      // Simpan ke cache
      setCatalogCacheValue(`catalog_pricing_${selectedChannel.id}`, catalogData);
      setCatalogCacheValue(`categories`, categoryData);

      // ✅ Reset filter ke default (hapus selectedCategory dan searchTerm)
      const fallbackCategory = categoryData.find(cat => cat.id === 0) || null;

      setCatalogCacheValue('selected_category', fallbackCategory);
      setCatalogCacheValue('search_term', '');

      setSelectedCategory(fallbackCategory);
      setSearchTerm('');
      setAllCatalog(catalogData);
      setCategories(categoryData);
      setFilteredCatalog(catalogData); // tampilkan semua tanpa filter

      prewarmCatalogDetails({
        catalogList: catalogData,
        channelId: selectedChannel.id,
        categoryId: fallbackCategory?.id ?? 0,
      });
    } catch (error) {
      console.log('Error refreshing catalog:', error);
    }

    setIsLoading(false);
  }, [selectedChannel, triggerPricing, triggerCategories, prewarmCatalogDetails]);

  const getCategory = async () => {
    try {
      await triggerCategories().unwrap();
    } catch (error) {
      console.log('Error fetching:', error);
    }
  };

  useEffect(() => {
    if (selectedChannel?.id) {
      loadCatalogAndCategory();
    }
  }, [selectedChannel]);

  return {
    catalog: filteredCatalog,
    categories,
    selectedCategory,
    searchTerm,
    onSelectCategory,
    clearCategory,
    onSearch,
    isLoading,
    getDetail,
    getCategory,
    categoriesResult,
    refreshCatalog,
    create,
    createResult,
  };
};

export default useCatalog;
