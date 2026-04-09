/* eslint-disable react-hooks/exhaustive-deps */
import { useDispatch } from 'react-redux';

import { useLazyGetServiceChargeQuery } from './action';
import { changeServiceCharge } from '../cart/slice';

const useOutlet = () => {
  const dispatch = useDispatch();

  const [triggerServiceCharge] = useLazyGetServiceChargeQuery();

  const getServiceCharge = async () => {
    try {
      const res = await triggerServiceCharge().unwrap();
      dispatch(changeServiceCharge(res?.data || 0));
    } catch (error) {
      console.log('Error fetching:', error);
    }
  };

  return {
    getServiceCharge,
  };
};

export default useOutlet;
