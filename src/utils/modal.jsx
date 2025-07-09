import { useEffect, useRef, useCallback } from 'react';

const useDialogModal = ({ onClose } = {}) => {
  const dialogRef = useRef(null);

  const open = useCallback(() => {
    dialogRef.current?.showModal();
  }, []);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  const handleClose = useCallback(() => {
    // 🟢 Jalankan callback eksternal jika disediakan
    if (onClose) onClose();
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
  };
};

export default useDialogModal;
