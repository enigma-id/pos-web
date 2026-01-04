import React from 'react';
import { useSelector } from 'react-redux';

import AuthorizeRouter from './pages/authorize/router.jsx';
import UnauthorizeRouter from './pages/unauthorize/router.jsx';
import useAuth from './services/auth/hook.js';
import { checkAppVersion } from './utils/checkVersion.jsx';


checkAppVersion();

const App = () => {
  const isAuthenticated = useSelector(state => state.Auth?.isAuthenticated);

  const { getUser } = useAuth();

  React.useEffect(() => {
    getUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <React.Fragment>{isAuthenticated ? <AuthorizeRouter /> : <UnauthorizeRouter />}</React.Fragment>
  );
};

export default App;
