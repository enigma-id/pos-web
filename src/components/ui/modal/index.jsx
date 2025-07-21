import React from 'react';

import { ModalContext } from './context';
import { CloseIcon } from '../icon';

const Provider = ({ children }) => {
  const [component, setComponent] = React.useState(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const [modalSize, setModalSize] = React.useState('w-md');

  const openModal = React.useCallback((content, size = 'w-md') => {
    setComponent(content);
    setModalSize(size);
    setIsOpen(true);
  }, []);

  const closeModal = React.useCallback(({ onClose } = {}) => {
    setIsOpen(false);
    setTimeout(() => {
      onClose?.();
      setComponent(null);
    }, 200);
  }, []);

  return (
    <ModalContext.Provider value={{ openModal, closeModal }}>
      {children}

      <Wrapper open={isOpen} onClose={closeModal} className={modalSize}>
        {component}
      </Wrapper>
    </ModalContext.Provider>
  );
};

const Wrapper = ({ open = false, onClose, className = '', children }) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const [isRender, setIsRender] = React.useState(open);

  React.useEffect(() => {
    if (open) {
      setIsRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true); // ✅ delay ke frame ke-2 agar transisi smooth
        });
      });
    } else {
      setIsVisible(false);
      const timeout = setTimeout(() => setIsRender(false), 200); // match anim duration
      return () => clearTimeout(timeout);
    }
  }, [open]);

  // Esc to close
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = e => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!isRender) return null;

  return (
    <div
      className={`fixed inset-0 z-[999] flex items-center justify-center bg-black/40 transition-opacity duration-200 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-base-100 relative w-fit overflow-hidden rounded ${className} shadow-lg transition-all duration-200 ${
          isVisible ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
        }`}
        onClick={e => e.stopPropagation()} // prevent close when clicking inside
      >
        {children}
      </div>
    </div>
  );
};

const Header = ({ children, onClose }) => (
  <div className="border-base-200 relative w-full border-b px-4 py-5">
    {children}
    {/* Close Button */}
    {onClose && (
      <div className="absolute top-3 right-3">
        <button className="btn btn-ghost btn-circle btn-md" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
    )}
  </div>
);

const Body = ({ children, full }) => (
  <div className={`flex max-h-[850px] flex-col overflow-hidden ${full ? '' : 'px-4'}`}>
    {children}
  </div>
);

const Footer = ({ children }) => (
  <div className="border-secondary flex h-16 place-content-end place-items-center gap-4 border-t px-4">
    {children}
  </div>
);

const Modal = () => null;
Modal.Provider = Provider;
Modal.Wrapper = Wrapper;
Modal.Header = Header;
Modal.Body = Body;
Modal.Footer = Footer;

export default Modal;
