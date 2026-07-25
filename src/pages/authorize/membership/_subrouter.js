import MembershipScreen from '.';
import TopupManual from './topup-manual';
import CreateManual from './create-manual';
import ChangeCardManual from './change-card';

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
  {
    path: '/membership/change-card',
    element: ChangeCardManual,
  },
];

export default routes;
