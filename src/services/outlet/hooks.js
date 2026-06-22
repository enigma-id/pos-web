import { useDispatch } from 'react-redux';

import { useLazyGetServiceChargeQuery } from './action';
import { getSalesCacheValue, setSalesCacheValue } from '../../utils/cache';
import { changeServiceCharge } from '../cart/slice';

const useOutlet = () => {
  const dispatch = useDispatch();

  const [triggerServiceCharge] = useLazyGetServiceChargeQuery();

  const getServiceCharge = async () => {
    try {
      const res = await triggerServiceCharge().unwrap();
      const charge = res?.data || 0;
      setSalesCacheValue('service_charge', charge);
      dispatch(changeServiceCharge(charge));
    } catch (error) {
      const cachedCharge = getSalesCacheValue('service_charge');
      if (cachedCharge !== null && cachedCharge !== undefined) {
        dispatch(changeServiceCharge(cachedCharge));
      } else {
        console.log('Error fetching:', error);
      }
    }
  };

  return {
    getServiceCharge,
  };
};

export default useOutlet;
