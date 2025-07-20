/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
  useBillMutation,
  useCheckoutMutation,
  useCloseBillMutation,
  useLazyGetBillQuery,
  useLazyGetMethodQuery,
} from './action';
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
} from './slice';
import { useLazyGetCatalogDetailQuery } from '../catalog/action';
import { $failure } from '../form/action';
import useOrder from '../sales/order/hook';

const useCart = catalog_id => {
  const dispatch = useDispatch();
  const selectedChannel = useSelector(state => state?.SalesChannel?.selectedChannel);
  const CartState = useSelector(state => state?.Cart);

  const [triggerCatalogDetail, catalogDetailResult] = useLazyGetCatalogDetailQuery();
  const [checkoutMutation, checkoutResult] = useCheckoutMutation();
  const [billMutation, billResult] = useBillMutation();
  const [closeBillMutation, closeBillResult] = useCloseBillMutation();
  const [triggerPaymentMethod] = useLazyGetMethodQuery();
  const [triggerCountBill, countResult] = useLazyGetBillQuery();

  const { show, showResult } = useOrder();

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

  const closeBill = async (id, payload) => {
    try {
      const res = await closeBillMutation({ id, payload }).unwrap();
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

  const onCount = async () => {
    try {
      await triggerCountBill().unwrap();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('error:', error);
      }
    }
  };

  const onBillSelected = async data => {
    if (!data) return;
    show(data?.id);
  };

  const billItems = data => {
    dispatch(setBillItems(data));
  };

  useEffect(() => {
    if (showResult?.isSuccess) {
      billItems(showResult?.data?.data?.items);
      dispatch(selectedBill(showResult?.data?.data));
    }
  }, [showResult]);

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
    onCount,
    countResult,
    onBillSelected,
    billItems,
  };
};

export default useCart;
