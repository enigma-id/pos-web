/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { useLazyGetSalesChannelsQuery } from './action';
import { clearSelectedChannel, setSelectedChannel } from './slice';
import { getOrFetchSales, getSalesCacheValue } from '../../../utils/cache'; // ✅ pakai cache grouped
import { resetCart } from '../../cart/slice';

const useSalesChannel = () => {
  const dispatch = useDispatch();
  const selectedChannel = useSelector(state => state?.SalesChannel?.selectedChannel);

  const [trigger] = useLazyGetSalesChannelsQuery();

  const selectChannel = channel => {
    dispatch(setSelectedChannel(channel));
    dispatch(resetCart());
  };

  const resetChannel = () => dispatch(clearSelectedChannel());

  const loadChannels = async () => {
    const res = await getOrFetchSales('sales_channels', async () => {
      const req = await trigger().unwrap();
      return req?.data || [];
    });

    if (res?.length > 0 && !selectedChannel) {
      selectChannel(res[0]); // ✅ auto-select first channel
    }
  };

  // 🧠 Auto-trigger saat hook dipakai
  useEffect(() => {
    loadChannels();
  }, []);

  return {
    selectChannel,
    resetChannel,
    loadChannels,
    channels: getSalesCacheValue('sales_channels') || [],
  };
};

export default useSalesChannel;
