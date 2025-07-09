import { useCallback, useRef } from 'react';

const useDrawer = () => {
  const drawerRef = useRef(null);

  const open = () => {
    if (drawerRef.current) {
      drawerRef.current.checked = true;
    }
  };

  const close = () => {
    if (drawerRef.current) {
      drawerRef.current.checked = false;
    }
  };

  const toggle = useCallback(() => {
    if (drawerRef.current) drawerRef.current.checked = !drawerRef.current.checked;
  }, []);

  return {
    drawerRef,
    open,
    close,
    toggle,
  };
};

export default useDrawer;
