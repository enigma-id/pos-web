import { useEffect, useRef, useCallback, useState } from 'react';

const useDialogModal = ({ onClose } = {}) => {
  const [isOpen, setIsOpen] = useState(false);

  const dialogRef = useRef(null);

  const open = useCallback(() => {
    setIsOpen(true);
    dialogRef.current?.showModal();
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    dialogRef.current?.close();
  }, []);

  const handleClose = useCallback(() => {
    // 🟢 Jalankan callback eksternal jika disediakan
    if (onClose) onClose();
    setIsOpen(false);
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [handleClose]);

  return {
    dialogRef,
    open,
    close,
    isOpen,
  };
};

export default useDialogModal;
