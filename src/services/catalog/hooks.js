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
        channel_id: selectedChannel.id,
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
  }, [selectedChannel, triggerPricing, triggerCategories, applyFilter]);

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
    } catch (error) {
      console.log('Error refreshing catalog:', error);
    }

    setIsLoading(false);
  }, [selectedChannel, triggerPricing, triggerCategories]);

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
