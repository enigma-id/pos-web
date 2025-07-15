import HomeScreen from '.';
import CheckoutScreen from './checkout';

const routes = [
  {
    path: '/',
    element: HomeScreen,
  },
  {
    path: '/checkout',
    element: CheckoutScreen,
  },
];

export default routes;
