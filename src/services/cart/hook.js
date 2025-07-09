/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { resetCart } from './slice';
import {
  useBillMutation,
  useCheckoutMutation,
  useLazyGetMethodQuery,
  useLazyGetTableQuery,
} from './action';

import { $failure } from '../form/action';
import { useLazyGetCatalogDetailQuery } from '../catalog/action';

const useCart = catalog_id => {
  const dispatch = useDispatch();
  const selectedChannel = useSelector(state => state.SalesChannel?.selectedChannel);

  const [triggerCatalogDetail, catalogDetailResult] = useLazyGetCatalogDetailQuery();
  const [checkoutMutation, checkoutResult] = useCheckoutMutation();
  const [billMutation, billResult] = useBillMutation();
  const [triggerPaymentMethod] = useLazyGetMethodQuery();
  const [triggerTable, tableResult] = useLazyGetTableQuery();

  // Get all items in cart
  const cartItems = useSelector(state => state?.Cart.items);

  // Check if item is already in cart
  const existingIndex = cartItems.findIndex(item => item?.id === catalog_id);
  const isItemInCart = existingIndex >= 0;
  const existingItem = isItemInCart ? cartItems[existingIndex] : null;

  const reset = () => {
    dispatch(resetCart());
  };

  const isCheckoutRunning = useRef(false);

  const checkout = async data => {
    if (isCheckoutRunning.current) {
      return;
    }

    isCheckoutRunning.current = true;

    try {
      const res = await checkoutMutation(data).unwrap();

      if (res?.status === 'success') {
        dispatch(resetCart());
      }
    } catch (error) {
      dispatch($failure(error));
    } finally {
      isCheckoutRunning.current = false;
    }
  };

  const isBillRunning = useRef(false);

  const openBill = async data => {
    if (isBillRunning.current) {
      return;
    }

    isBillRunning.current = true;

    try {
      const res = await billMutation(data).unwrap();

      if (res?.status === 'success') {
        dispatch(resetCart());
      }
    } catch (error) {
      dispatch($failure(error));
    } finally {
      isBillRunning.current = false;
    }
  };

  const getPaymentMethod = async () => {
    const req = await triggerPaymentMethod().unwrap();
    const data = req?.data || [];

    // Tambahkan metode 'Tunai' secara manual di atas
    return [{ id: 0, name: 'Cash' }, ...data];
  };

  const getTable = async () => {
    try {
      await triggerTable().unwrap();
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('error:', err);
      }
    }
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
    getTable,
    tableResult,
  };
};

export default useCart;
