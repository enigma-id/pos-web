import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';

import { SidebarContext } from './context';

const SidebarProvider = ({ children }) => {
  const SalesSession = useSelector(state => state?.SalesSession);
  const [mode, setMode] = useState('open_session');

  useEffect(() => {
    setMode(prev => {
      if (!SalesSession?.hasSession) return 'open_session';

      if (prev === 'open_session') return 'cart';
      return prev;
    });
  }, [SalesSession?.hasSession]);

  const showCart = () => {
    if (SalesSession?.hasSession) setMode('cart');
  };

  const showSummary = () => {
    if (SalesSession?.hasSession) setMode('summary');
  };

  const showOpenSession = () => setMode('open_session');

  const showCustomer = () => setMode('bill_customer');

  const showBill = () => setMode('bill_show');

  return (
    <SidebarContext.Provider
      value={{
        mode,
        showCart,
        showSummary,
        showOpenSession,
        showCustomer,
        showBill,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export default SidebarProvider;
