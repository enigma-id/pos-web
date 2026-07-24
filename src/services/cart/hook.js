import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
  useCheckoutMutation,
  useLazyGetBillQuery,
  useCloseBillMutation,
  useLazyGetMethodQuery,
} from './action';
import { useUpdateMutation } from '../sales/order/action';
import {
  customer,
  removeItem,
  resetCart,
  updateCategoryDiscount,
  updateCartDiscount,
  selectedBill,
  setBillItems,
  removeBillItem,
  changeItem,
  changeBillItem,
  addItem,
  changeServiceCharge,
} from './slice';
import {
  getPaymentMethodsCache,
  setPaymentMethodsCache,
  getCatalogDetailCache,
  getCatalogDetailCacheByCategory,
  getCatalogCacheValue,
  getCatalogItemFromPricingCache,
  setSalesCacheValue,
} from '../../utils/cache';
import { useLazyGetCatalogDetailQuery } from '../catalog/action';
import { $failure } from '../form/action';
import { useLazyShowQuery } from '../sales/order/action';
import { getQueue } from '../offline/queue';
import { loadOfflineBill } from './slice';
import { getCache, setCache } from '../../utils/cache';

const BILLS_CACHE_KEY = 'cache_openbills';

const useCart = catalog_id => {
  const dispatch = useDispatch();
  const selectedChannel = useSelector(state => state?.SalesChannel?.selectedChannel);
  const CartState = useSelector(state => state?.Cart);
  const userId = useSelector(state => state?.Auth?.session?.user?.id);

  const [triggerCatalogDetail, catalogDetailResult] = useLazyGetCatalogDetailQuery();
  const [checkoutMutation, checkoutResult] = useCheckoutMutation();
  const [closeBillMutation, closeBillResult] = useCloseBillMutation();
  const [triggerPaymentMethod] = useLazyGetMethodQuery();
  const [triggerBill, billResult] = useLazyGetBillQuery();
  const [updateMutation, updateResult] = useUpdateMutation();

  const [showOrder] = useLazyShowQuery();
  const [offlineCatalogDetail, setOfflineCatalogDetail] = useState(null);
  const [mergedBillData, setMergedBillData] = useState(null);
  const queueItemsMapRef = useRef({});

  // All cart items
  const cartItems = useSelector(state => state?.Cart?.items?.list || []);
  const apiReachable = useSelector(state => state?.Offline?.apiReachable);

  const charge = useSelector(state => state?.Auth?.session?.sales_session?.outlet?.service_charges);

  // Cek apakah item sudah ada
  const existingIndex = cartItems.findIndex(item => item?.id === catalog_id);
  const isItemInCart = existingIndex >= 0;
  const existingItem = isItemInCart ? cartItems[existingIndex] : null;

  const reset = () => {
    dispatch(resetCart());
    setSalesCacheValue('service_charge', charge);
    dispatch(changeServiceCharge(charge));
  };

  const isCheckoutRunning = useRef(false);
  const checkout = async data => {
    if (isCheckoutRunning.current) return;
    isCheckoutRunning.current = true;

    try {
      console.log('[cart.checkout] sending payload', { ...data, items: `[${data?.items?.length} items]` });
      const res = await checkoutMutation(data).unwrap();
      console.log('[cart.checkout] response:', res);
      if (res?.message === 'success') reset();
    } catch (error) {
      console.error('[cart.checkout] error:', error);
      dispatch($failure(error));
    } finally {
      isCheckoutRunning.current = false;
    }
  };

  const isBillRunning = useRef(false);
  const closeBill = async (id, payload) => {
    try {
      const res = await closeBillMutation({ id, payload }).unwrap();
      if (res?.message === 'success') reset();
    } catch (error) {
      dispatch($failure(error));
    } finally {
      isBillRunning.current = false;
    }
  };

  const getPaymentMethod = async () => {
    const channelId = selectedChannel?.id ?? 'default';
    const fallback = getPaymentMethodsCache(channelId);

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const apiDead = apiReachable === false;

    // When offline — use cache, excluding realtime-only providers
    if (isOffline || apiDead) {
      if ((fallback || []).length > 0) {
        const filtered = fallback.filter(m => m?.provider !== 'qris' && m?.provider !== 'midtrans');
        return filtered.length > 0 ? filtered : fallback;
      }
      return [];
    }

    try {
      const req = await triggerPaymentMethod().unwrap();
      const data = req?.data || [];
      setPaymentMethodsCache(channelId, data);
      return data;
    } catch (error) {
      if ((fallback || []).length > 0) {
        const filtered = fallback.filter(m => m?.provider !== 'qris' && m?.provider !== 'midtrans');
        return filtered.length > 0 ? filtered : fallback;
      }

      dispatch($failure(error));
      return [];
    }
  };

  const add = catalog => {
    const cloned = { ...catalog, from_bill: false };
    dispatch(addItem(cloned));
  };

  const remove = async (index, type = 'cart') => {
    if (type === 'cart') {
      dispatch(removeItem(index));
    } else {
      dispatch(removeBillItem(index));
    }
  };

  const change = async (key, catalog, type = 'cart') => {
    if (type === 'cart') {
      dispatch(changeItem({ key, catalog }));
    } else {
      dispatch(changeBillItem({ key, catalog }));
    }
  };

  const setCustomer = data => {
    dispatch(customer(data));
  };

  const onChangeDiscount = (categoryId, field, value) => {
    const cat = CartState?.discount?.category?.find(c => c.id === categoryId);
    if (!cat) return;

    const discount_type = field === 'discount_type' ? value : cat.discount_type;

    if (field === 'discount_type') {
      dispatch(
        updateCategoryDiscount({
          id: categoryId,
          discount_type: value,
          discount_value: 0,
        })
      );
      return;
    }

    if (field === 'discount_value' && value === '') {
      dispatch(
        updateCategoryDiscount({
          id: categoryId,
          discount_type,
          discount_value: 0,
        })
      );
      return;
    }

    let parsed = parseFloat(value.toString().replace(',', '.'));
    if (isNaN(parsed)) parsed = 0;

    if (discount_type === 'percentage') {
      parsed = Math.min(parsed, 100);
    }

    if (discount_type === 'nominal') {
      const allItems = [...(CartState?.items?.list ?? []), ...(CartState?.items?.bill ?? [])];
      const item = allItems.find(i => i.category?.id === categoryId);

      if (item) parsed = Math.min(parsed, item.subtotal);
    }

    dispatch(
      updateCategoryDiscount({
        id: categoryId,
        discount_type,
        discount_value: parsed,
      })
    );
  };

  const onChangeCartDiscount = (field, value) => {
    const discount_type = field === 'discount_type' ? value : CartState?.discount?.cart?.type;

    if (field === 'discount_type') {
      dispatch(
        updateCartDiscount({
          discount_type: value,
          discount_value: 0,
        })
      );
      return;
    }

    if (field === 'discount_value' && value === '') {
      dispatch(
        updateCartDiscount({
          discount_type,
          discount_value: 0,
        })
      );
      return;
    }

    let parsed = parseFloat(value.toString().replace(',', '.'));
    if (isNaN(parsed)) parsed = 0;

    if (discount_type === 'percentage') {
      parsed = Math.min(parsed, 100);
    }

    if (discount_type === 'nominal') {
      parsed = Math.min(parsed, CartState?.meta?.subtotal || 0);
    }

    dispatch(
      updateCartDiscount({
        discount_type,
        discount_value: parsed,
      })
    );
  };

  const bill = async () => {
    let serverData = [];
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const apiDead = apiReachable === false;

    if (!isOffline && !apiDead) {
      try {
        const res = await triggerBill().unwrap();
        serverData = res?.data || [];

        // Cache server bills for offline access
        if (serverData.length > 0) {
          setCache(BILLS_CACHE_KEY, serverData);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('[useCart.bill] server fetch error', error);
        }
      }
    } else {
      // Read cached bills when offline
      serverData = getCache(BILLS_CACHE_KEY) || [];
    }

    // Merge offline pending save-bills from queue
    const merged = await mergeOfflineBills(serverData);

    if (merged.length > 0 || serverData.length > 0) {
      setMergedBillData(merged);
    }

    // Build lookup map for queue detail items
    const queueMap = {};
    merged.forEach(b => { if (b.from_queue) queueMap[b.queue_id] = b; });
    queueItemsMapRef.current = queueMap;
  };

  const mergeOfflineBills = async (serverData) => {
    if (!userId) return serverData;

    let queueItems = [];
    try {
      queueItems = await getQueue(userId);
    } catch {
      return serverData;
    }

    // Filter: pending save-bills (body.status === 'pending', has bill_name)
    const offlineBills = queueItems.filter(item =>
      String(item?.url || '').toLowerCase().includes('/sales/order') &&
      item?.body?.status === 'pending' &&
      item?.body?.bill_name
    );

    if (offlineBills.length === 0) return serverData;

    // Collect server tickets for dedup
    const serverTickets = new Set(
      serverData.map(b => b?.ticket || b?.bill_name).filter(Boolean)
    );

    // Transform queue items → API response shape, skip dupe tickets
    const transformed = offlineBills
      .filter(item => {
        const ticket = item?.body?.bill_name;
        return ticket && !serverTickets.has(ticket);
      })
      .map(item => {
        const preview = item?.transaction_preview || {};
        return {
          id: preview?.id || item?.id,
          bill_name: preview?.bill_name || item?.body?.bill_name || '',
          ticket: item?.body?.bill_name || '',
          total_charges: preview?.total_charges || preview?.total_bill || 0,
          code: preview?.code || `OFF-${item?.id}`,
          ordered_at: preview?.created_at || item?.createdAt,
          created_at: preview?.created_at || item?.createdAt,
          items: preview?.items || [],
          membership: preview?.membership || null,
          session: preview?.session || null,
          discount_value: preview?.discount_value || 0,
          service_charge_value: preview?.service_charge_value || 0,
          total_payment: preview?.total_payment || 0,
          payment_method: preview?.payment_method || null,
          payment_ref: preview?.payment_ref || '',
          subtotal_nett: preview?.subtotal_nett || preview?.total_bill || 0,
          subtotal_gross: preview?.subtotal_gross || preview?.total_bill || 0,
          note: item?.body?.note || '',
          from_queue: true,
          queue_id: item?.id,
          offline_queued: true,
        };
      });

    return [...serverData, ...transformed];
  };

  const update = async ({ id, payload }) => {
    try {
      const res = await updateMutation({ id, payload }).unwrap();
      if (res?.message === 'success') reset();
      return res;
    } catch (error) {
      dispatch($failure(error));
      throw error;
    }
  };

  const isBillSelected = useRef(false);
  const onBillSelected = async data => {
    if (isBillSelected.current) return;
    isBillSelected.current = true;

    try {
      // Queue item → use local data, no server fetch
      if (data?.from_queue) {
        // Get full queue item from IndexedDB to ensure we have body/content
        const queueId = data?.queue_id;
        let queueItem = null;
        if (queueId) {
          try {
            const all = await getQueue(userId);
            queueItem = all.find(x => x.id === queueId);
          } catch {}
        }

        if (queueItem) {
          dispatch(loadOfflineBill(queueItem));
        }
        return;
      }

      const res = await showOrder({ id: data?.id }).unwrap();
      if (res?.message === 'success') {
        billItems({ items: res?.data?.items, category_discounts: res?.data?.category_discounts });

        dispatch(selectedBill(res?.data));

        showSetDiscount(res?.data);
      }
    } catch (error) {
      dispatch($failure(error));
    } finally {
      isBillSelected.current = false;
    }
  };

  const billItems = data => {
    dispatch(setBillItems(data));
  };

  const showSetDiscount = data => {
    if (data?.discount_value > 0) {
      const discountType = data?.is_discount_percentage ? 'percentage' : 'nominal';
      const discountValue = discountType === 'percentage' ? data?.discount : data?.discount_value;

      dispatch(updateCartDiscount({ discount_type: discountType, discount_value: discountValue }));
    }
  };

  useEffect(() => {
    if (!catalog_id || !selectedChannel?.id) return;

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const apiDead = apiReachable === false;
    const selectedCategory = getCatalogCacheValue('selected_category');
    const resolvedCategoryId = selectedCategory?.id ?? 0;

    if (isOffline || apiDead) {
      const byCategory = getCatalogDetailCacheByCategory(
        catalog_id,
        selectedChannel.id,
        resolvedCategoryId
      );
      const legacy = getCatalogDetailCache(catalog_id, selectedChannel.id);
      const pricing = getCatalogItemFromPricingCache(catalog_id, selectedChannel.id);

      setOfflineCatalogDetail(byCategory || legacy || pricing || null);
      return;
    }

    setOfflineCatalogDetail(null);
    triggerCatalogDetail({
      id: catalog_id,
      channel_id: selectedChannel?.id,
    });
  }, [catalog_id, selectedChannel, apiReachable, triggerCatalogDetail]);

  return {
    catalogDetail: offlineCatalogDetail || catalogDetailResult?.data?.data,
    isLoading: catalogDetailResult.isFetching,
    error: catalogDetailResult.error,
    isItemInCart,
    existingItem,
    existingIndex,
    getPaymentMethod,
    checkout,
    checkoutResult,
    closeBill,
    closeBillResult,
    reset,
    cartItems,
    add,
    remove,
    change,
    setCustomer,
    onChangeDiscount,
    onChangeCartDiscount,
    bill,
    billResult,
    billData: mergedBillData, // merged server + offline queue
    onBillSelected,
    billItems,
    update,
    updateResult,
  };
};

export default useCart;
