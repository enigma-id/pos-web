import React from 'react';
import { useSelector } from 'react-redux';

import AuthorizeRouter from './pages/authorize/router.jsx';
import UnauthorizeRouter from './pages/unauthorize/router.jsx';
import useAuth from './services/auth/hook.js';
import { checkAppVersion } from './utils/checkVersion.jsx';
import useOrder from './services/sales/order/hook.js';
import useSession from './services/sales/session/hook.js';
import useCart from './services/cart/hook.js';
import useMembership from './services/membership/hook.js';
import useMaster from './services/master/hook.js';

checkAppVersion();

const App = () => {
  const isAuthenticated = useSelector(state => state.Auth?.isAuthenticated);

  const { getUser } = useAuth();
  const { history } = useOrder();
  const { session } = useSession();
  const { getPaymentMethods, getSchemaBonus } = useMaster();
  const { bill } = useCart();
  const { getMember } = useMembership();

  React.useEffect(() => {
    if (isAuthenticated) {
      getUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-fetch data when authenticated — populates offline cache
  React.useEffect(() => {
    if (!isAuthenticated) return;

    const fetchAndCache = async () => {
      // Param sama persis kayak page mount → RTK Query dedupe, gak dobel fetch.
      // Bill & membership pakai limit 200 buat ambil semua; history/session polos.
      history();
      session();
      bill({ limit: 200, page: 1 });
      getPaymentMethods();
      getSchemaBonus();
      getMember({ limit: 200, page: 1 });
    };

    fetchAndCache();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  return (
    <React.Fragment>{isAuthenticated ? <AuthorizeRouter /> : <UnauthorizeRouter />}</React.Fragment>
  );
};

export default App;
