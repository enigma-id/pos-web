/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useEffect, useState } from 'react';
import {
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
} from '../../utils/cache';
import { useSelector } from 'react-redux';

const useCatalog = () => {
  const selectedChannel = useSelector(state => state.SalesChannel?.selectedChannel);

  const [allCatalog, setAllCatalog] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filteredCatalog, setFilteredCatalog] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [triggerPricing] = useLazyGetCatalogPricingQuery();
  const [triggerCategories] = useLazyGetCategoriesQuery();
  const [triggerCatalogDetail] = useLazyGetCatalogDetailQuery();

  const applyFilter = useCallback((rawCatalog, categoryId, search) => {
    let result = rawCatalog;

    if (categoryId !== null) {
      result = result.filter(item => item.category?.id === categoryId);
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
        channel_id: selectedChannel.id,
      }).unwrap();
      return res?.data || [];
    });

    const categoryData = await getOrFetchCatalog(categoryKey, async () => {
      const res = await triggerCategories().unwrap();
      return res?.data || [];
    });

    setAllCatalog(catalogData);
    setCategories(categoryData);

    // ✅ Restore selected category
    const cachedCategory = getCatalogCacheValue('selected_category');
    const cachedSearch = getCatalogCacheValue('search_term') || '';

    const filtered = applyFilter(catalogData, cachedCategory ?? null, cachedSearch);

    setAllCatalog(catalogData);
    setCategories(categoryData);
    setSelectedCategory(cachedCategory ?? null);
    setSearchTerm(cachedSearch);
    setFilteredCatalog(filtered);
    setIsLoading(false);
  }, [selectedChannel, triggerPricing, triggerCategories, applyFilter]);

  const onSelectCategory = useCallback(
    categoryId => {
      setSelectedCategory(categoryId);
      setCatalogCacheValue('selected_category', categoryId);

      const filtered = applyFilter(allCatalog, categoryId, searchTerm);
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

  const getDetail = useCallback(
    async ({ id, channel_id = selectedChannel.id }) => {
      const cached = getCatalogDetailCache(id, channel_id);
      if (cached) return cached;

      try {
        const res = await triggerCatalogDetail({ id, channel_id }).unwrap();
        const data = res?.data || null;
        if (data) {
          setCatalogDetailCache(id, channel_id, data);
        }
        return data;
      } catch (e) {
        console.log('Error fetching catalog detail:', e);
        return null;
      }
    },
    [triggerCatalogDetail, selectedChannel]
  );

  const refreshCatalog = useCallback(async () => {
    if (!selectedChannel?.id) return;

    setIsLoading(true);

    try {
      const resCatalog = await triggerPricing({ channel_id: selectedChannel.id }).unwrap();
      const resCategory = await triggerCategories().unwrap();

      const catalogData = resCatalog?.data || [];
      const categoryData = resCategory?.data || [];

      // Simpan ke cache
      setCatalogCacheValue(`catalog_pricing_${selectedChannel.id}`, catalogData);
      setCatalogCacheValue(`categories`, categoryData);

      // ✅ Reset filter ke default (hapus selectedCategory dan searchTerm)
      setCatalogCacheValue('selected_category', null);
      setCatalogCacheValue('search_term', '');

      setSelectedCategory(null);
      setSearchTerm('');
      setAllCatalog(catalogData);
      setCategories(categoryData);
      setFilteredCatalog(catalogData); // tampilkan semua tanpa filter
    } catch (error) {
      console.log('Error refreshing catalog:', error);
    }

    setIsLoading(false);
  }, [selectedChannel, triggerPricing, triggerCategories]);

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
    refreshCatalog,
  };
};

export default useCatalog;
