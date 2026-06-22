import { useEffect, useRef, useState } from 'react';

const RECONNECT_DEBOUNCE_MS = 3000;

const safeOnline = () => {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
};

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(safeOnline());
  const [wasOffline, setWasOffline] = useState(false);

  const reconnectTimerRef = useRef(null);
  const hadOfflineRef = useRef(!safeOnline());

  useEffect(() => {
    const onOffline = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      hadOfflineRef.current = true;
      setIsOnline(false);
      setWasOffline(false);
    };

    const onOnline = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }

      reconnectTimerRef.current = setTimeout(() => {
        setIsOnline(true);
        setWasOffline(hadOfflineRef.current);
        hadOfflineRef.current = false;
        reconnectTimerRef.current = null;
      }, RECONNECT_DEBOUNCE_MS);
    };

    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);

    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);

  return {
    isOnline,
    wasOffline,
  };
};

export default useNetworkStatus;
