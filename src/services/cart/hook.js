/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { useBillMutation, useCheckoutMutation, useLazyGetMethodQuery } from './action';
import {
  customer,
  removeItem,
  resetCart,
  updateCategoryDiscount,
  updateCartDiscount,
} from './slice';
import { useLazyGetCatalogDetailQuery } from '../catalog/action';
import { $failure } from '../form/action';

const useCart = catalog_id => {
  const dispatch = useDispatch();
  const selectedChannel = useSelector(state => state?.SalesChannel?.selectedChannel);
  const CartState = useSelector(state => state?.Cart);

  const [triggerCatalogDetail, catalogDetailResult] = useLazyGetCatalogDetailQuery();
  const [checkoutMutation, checkoutResult] = useCheckoutMutation();
  const [billMutation, billResult] = useBillMutation();
  const [triggerPaymentMethod] = useLazyGetMethodQuery();

  // All cart items
  const cartItems = useSelector(state => state?.Cart?.items?.list || []);

  // Cek apakah item sudah ada
  const existingIndex = cartItems.findIndex(item => item?.id === catalog_id);
  const isItemInCart = existingIndex >= 0;
  const existingItem = isItemInCart ? cartItems[existingIndex] : null;

  const reset = () => {
    dispatch(resetCart());
  };

  const isCheckoutRunning = useRef(false);
  const checkout = async data => {
    if (isCheckoutRunning.current) return;
    isCheckoutRunning.current = true;

    try {
      const res = await checkoutMutation(data).unwrap();
      if (res?.status === 'success') dispatch(resetCart());
    } catch (error) {
      dispatch($failure(error));
    } finally {
      isCheckoutRunning.current = false;
    }
  };

  const isBillRunning = useRef(false);
  const openBill = async data => {
    if (isBillRunning.current) return;
    isBillRunning.current = true;

    try {
      const res = await billMutation(data).unwrap();
      if (res?.status === 'success') dispatch(resetCart());
    } catch (error) {
      dispatch($failure(error));
    } finally {
      isBillRunning.current = false;
    }
  };

  const getPaymentMethod = async () => {
    const req = await triggerPaymentMethod().unwrap();
    const data = req?.data || [];
    return [{ id: 0, name: 'Cash' }, ...data];
  };

  const remove = async index => {
    dispatch(removeItem(index));
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
      const item = CartState?.items?.list?.list?.find(i => i.category?.id === categoryId);
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

  useEffect(() => {
    if (catalog_id) {
      triggerCatalogDetail({
        id: catalog_id,
        channel_id: selectedChannel?.id,
      });
    }
  }, [catalog_id, selectedChannel]);

  return {
    catalogDetail: catalogDetailResult?.data?.data,
    isLoading: catalogDetailResult.isFetching,
    error: catalogDetailResult.error,
    isItemInCart,
    existingItem,
    existingIndex,
    getPaymentMethod,
    checkout,
    checkoutResult,
    openBill,
    billResult,
    reset,
    cartItems,
    remove,
    setCustomer,
    onChangeDiscount,
    onChangeCartDiscount, // ✅ ditambahkan
  };
};

export default useCart;
