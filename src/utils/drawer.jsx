import { useCallback, useRef, useState } from 'react';

const useDrawer = () => {
  const drawerRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  const open = () => {
    if (drawerRef.current) {
      setIsOpen(true);
      drawerRef.current.checked = true;
    }
  };

  const close = () => {
    if (drawerRef.current) {
      setIsOpen(false);
      drawerRef.current.checked = false;
    }
  };

  const toggle = useCallback(() => {
    if (drawerRef.current) {
      setIsOpen(!isOpen);
      drawerRef.current.checked = !drawerRef.current.checked;
    }
  }, []);

  return {
    drawerRef,
    open,
    close,
    toggle,
    isOpen,
  };
};

export default useDrawer;
