import OrderScreen from '.';
import DetailScreen from './detail';

const routes = [
  {
    path: '/shifts',
    element: OrderScreen,
  },
  {
    path: '/shifts/:id',
    element: DetailScreen,
  },
];

export default routes;
