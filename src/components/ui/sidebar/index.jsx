import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';

import { SidebarContext } from './context';

const SidebarProvider = ({ children }) => {
  const SalesSession = useSelector(state => state?.SalesSession);
  const [mode, setMode] = useState('open_session');

  useEffect(() => {
    if (!SalesSession?.hasSession) {
      setMode('open_session');
    } else {
      setMode(prev => (prev === 'summary' ? 'summary' : 'cart'));
    }
  }, [SalesSession]);

  const showCart = () => {
    if (SalesSession?.hasSession) setMode('cart');
  };

  const showSummary = () => {
    if (SalesSession?.hasSession) setMode('summary');
  };

  const showOpenSession = () => setMode('open_session');

  return (
    <SidebarContext.Provider
      value={{
        mode,
        showCart,
        showSummary,
        showOpenSession,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export default SidebarProvider;
