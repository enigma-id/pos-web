import React from 'react';
import { useSelector } from 'react-redux';

import AuthorizeRouter from './pages/authorize/router.jsx';
import UnauthorizeRouter from './pages/unauthorize/router.jsx';
import useAuth from './services/auth/hook.js';
import { useLazyHistoryQuery } from './services/sales/order/action';
import { useLazyGetMethodQuery } from './services/cart/action';
import { setPaymentMethodsCache } from './utils/cache';
import { getCache, setCache } from './utils/cache';
import { checkAppVersion } from './utils/checkVersion.jsx';

const HISTORY_CACHE_KEY = 'cache_order_history';

checkAppVersion();

const App = () => {
  const isAuthenticated = useSelector(state => state.Auth?.isAuthenticated);
  const channelId = useSelector(state => state?.SalesChannel?.selectedChannel?.id);
  const [triggerHistory] = useLazyHistoryQuery();
  const [triggerPaymentMethod] = useLazyGetMethodQuery();

  const { getUser } = useAuth();

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
      // Pre-fetch history
      try {
        const res = await triggerHistory({}).unwrap();
        const data = res?.data || [];
        if (data.length > 0) {
          setCache(HISTORY_CACHE_KEY, data);
        }
      } catch {
        // Silently fail
      }

      // Pre-fetch payment methods
      try {
        const res = await triggerPaymentMethod().unwrap();
        const methods = res?.data || [];
        if (methods.length > 0) {
          setPaymentMethodsCache(channelId ?? 'default', methods);
        }
      } catch {
        // Silently fail
      }
    };

    fetchAndCache();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  return (
    <React.Fragment>{isAuthenticated ? <AuthorizeRouter /> : <UnauthorizeRouter />}</React.Fragment>
  );
};

export default App;
