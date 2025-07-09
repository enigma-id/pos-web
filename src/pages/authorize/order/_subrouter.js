import OrderScreen from '.';
import DetailScreen from './detail';

const routes = [
  {
    path: '/order',
    element: OrderScreen,
  },
  {
    path: '/order/:id',
    element: DetailScreen,
  },
];

export default routes;
