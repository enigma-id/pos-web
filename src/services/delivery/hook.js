import { useLazyGetPlanQuery, useReceiveMutation } from './action';

const useDelivery = () => {
  const [triggerPlan, planResult] = useLazyGetPlanQuery();
  const [receiveMutation, receiveResult] = useReceiveMutation();

  const getPlan = async (refCode) => {
    try {
      return await triggerPlan({ ref_code: refCode }).unwrap();
    } catch (err) {
      console.error('Delivery plan error:', err);
      throw err;
    }
  };

  const receive = async (payload) => {
    try {
      return await receiveMutation(payload).unwrap();
    } catch (err) {
      console.error('Delivery receive error:', err);
      throw err;
    }
  };

  return { getPlan, planResult, receive, receiveResult };
};

export default useDelivery;
