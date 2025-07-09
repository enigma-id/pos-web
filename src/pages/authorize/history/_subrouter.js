import HistoryScreen from '.';
import DetailScreen from './detail';

const routes = [
  {
    path: '/history',
    element: HistoryScreen,
  },
  {
    path: `/history/:id`,
    element: DetailScreen,
  },
];

export default routes;
