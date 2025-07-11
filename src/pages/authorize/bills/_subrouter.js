import HistoryScreen from '.';
import DetailScreen from './detail';

const routes = [
  {
    path: '/bills',
    element: HistoryScreen,
  },
  {
    path: `/bills/:id`,
    element: DetailScreen,
  },
];

export default routes;
