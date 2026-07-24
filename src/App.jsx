import React from 'react';
import { useSelector } from 'react-redux';

import AuthorizeRouter from './pages/authorize/router.jsx';
import UnauthorizeRouter from './pages/unauthorize/router.jsx';
import useAuth from './services/auth/hook.js';
import { useLazyHistoryQuery } from './services/sales/order/action';
import { getCache, setCache } from './utils/cache';
import { checkAppVersion } from './utils/checkVersion.jsx';

const HISTORY_CACHE_KEY = 'cache_order_history';

checkAppVersion();

const App = () => {
  const isAuthenticated = useSelector(state => state.Auth?.isAuthenticated);
  const [triggerHistory] = useLazyHistoryQuery();

  const { getUser } = useAuth();

  React.useEffect(() => {
    getUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-fetch history when authenticated to populate offline cache
  React.useEffect(() => {
    if (!isAuthenticated) return;

    const fetchAndCache = async () => {
      try {
        const res = await triggerHistory({}).unwrap();
        const data = res?.data || [];
        if (data.length > 0) {
          setCache(HISTORY_CACHE_KEY, data);
        }
      } catch {
        // Silently fail — it's just pre-caching
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
