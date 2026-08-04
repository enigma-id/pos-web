import MembershipScreen from '.';
import TopupManual from './topup-manual';
import CreateManual from './create-manual';

const routes = [
  {
    path: '/membership',
    element: MembershipScreen,
  },
  {
    path: '/membership/topup-manual',
    element: TopupManual,
  },
  {
    path: '/membership/create-manual',
    element: CreateManual,
  },
];

export default routes;
