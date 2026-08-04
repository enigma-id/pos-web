import { useState } from 'react';
import { useSelector } from 'react-redux';

import { useLazyGetSchemaBonusQuery, useLazyGetPaymentMethodQuery } from './action';
import { getCache, setCache } from '../../utils/cache';

const SCHEMA_BONUS_CACHE_KEY = 'cache_schema_bonus';
const PAYMENT_METHOD_CACHE_KEY = 'cache_payment_methods';

const useMaster = () => {
  const apiReachable = useSelector(state => state?.Offline?.apiReachable);
  const [triggerSchemaBonus] = useLazyGetSchemaBonusQuery();
  const [triggerPaymentMethod] = useLazyGetPaymentMethodQuery();
  const [mergedSchemaBonusData, setMergedSchemaBonusData] = useState(null);
  const [mergedPaymentMethodData, setMergedPaymentMethodData] = useState(null);

  const getSchemaBonus = async () => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const apiDead = apiReachable === false;

    if (!isOffline && !apiDead) {
      try {
        const res = await triggerSchemaBonus().unwrap();
        const serverData = res?.data || [];

        setCache(SCHEMA_BONUS_CACHE_KEY, serverData);
        setMergedSchemaBonusData(serverData);
        return;
      } catch (error) {
        // fetch error
      }
    }

    // Offline — selalu baca cache utama, filter client
    const cached = getCache(SCHEMA_BONUS_CACHE_KEY) || [];
    setMergedSchemaBonusData(cached);
  };

  const getPaymentMethods = async () => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const apiDead = apiReachable === false;

    if (!isOffline && !apiDead) {
      try {
        const res = await triggerPaymentMethod().unwrap();
        const serverData = res?.data || [];

        setCache(PAYMENT_METHOD_CACHE_KEY, serverData);
        setMergedPaymentMethodData(serverData);

        return serverData;
      } catch (err) {
        console.log('==================', err);
        // fetch error
      }
    }

    // When offline — use cache, excluding realtime-only providers
    let cached = getCache(PAYMENT_METHOD_CACHE_KEY) || [];

    if (cached.length > 0) {
      cached = cached.filter(m => m?.provider !== 'qris' && m?.provider !== 'midtrans');
    }

    setMergedPaymentMethodData(cached);

    return cached;
  };

  return {
    getSchemaBonus,
    getPaymentMethods,
    schemaBonus: mergedSchemaBonusData,
    paymentMethods: mergedPaymentMethodData,
  };
};

export default useMaster;
