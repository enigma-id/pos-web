import { useRef, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import Modal from './modal';

const NFCField = ({ onRead, isOpen, onClose, result }) => {
  const FormState = useSelector(state => state?.Form);

  const ref = useRef();
  const [status, setStatus] = useState('idle');

  console.log('[DEBUG] NFC Field', result);

  const handleInput = e => {
    const value = e.target.value.trim();

    if (value.length >= 10) {
      onRead?.(value);
      e.target.value = '';
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const el = ref.current;
    if (!el) return;

    const timeout = setTimeout(() => {
      el.focus();
      setStatus('scanning');
    }, 200);

    return () => clearTimeout(timeout);
  }, [isOpen]);

  useEffect(() => {
    if (result?.isSuccess) {
      setStatus('success');
      const timeout = setTimeout(() => {
        const isFocused = document.activeElement === ref.current;
        setStatus(isFocused ? 'scanning' : 'idle');
      }, 3000);

      return () => clearTimeout(timeout);
    }

    if (result?.isError) {
      setStatus('failed');
    }
  }, [result]);

  const handleBlur = () => setStatus('idle');

  const getTitle = () => {
    if (status === 'success') return 'Scan Successful';
    if (status === 'failed') return 'Scan Failed';
    if (status === 'scanning') return 'Scanning...';
    return 'Ready to Scan';
  };

  const getSubtitle = () => {
    if (status === 'success') return 'The card was successfully scanned and linked.';
    if (status === 'failed') {
      if (FormState?.errors?.saldo) {
        return 'Click the icon above to try again';
      }
      return 'The card could not be registered. It may be unreadable or already linked to another account.';
    }
    if (status === 'scanning') return 'Hold your card near the reader. Scanning in progress...';
    return 'Click the icon above, then tap your membership card to begin.';
  };

  return (
    <>
      <Modal.Header
        onClose={() => {
          onClose?.();
          setStatus('idle');
        }}
      >
        <div className="text-[16px] font-semibold tracking-wide">Scan Membership Card</div>
      </Modal.Header>
      <Modal.Body>
        <div className="relative flex flex-col place-items-center space-y-1 px-6 py-4 text-center">
          {status === 'success' ? (
            <img src={'/success.png'} className="h-50 w-50 object-contain" />
          ) : (
            <img
              src={'/scan.png'}
              className="h-50 w-50 cursor-pointer object-contain"
              onClick={() => {
                ref?.current.focus();
                setStatus('scanning');
              }}
            />
          )}
          <h2 className="text-lg font-semibold text-gray-800">{getTitle()}</h2>
          <p className="text-sm text-gray-600">{getSubtitle()}</p>
          <small className="text-error">{FormState?.errors?.card_id}</small>
          <small className="text-error">{FormState?.errors?.saldo}</small>
          <input
            id="nfc"
            ref={ref}
            autoFocus
            type="text"
            onInput={handleInput}
            onBlur={handleBlur}
            className="pointer-events-none absolute top-0 left-0 h-0 w-0 cursor-default caret-transparent opacity-0 focus:outline-none"
          />
        </div>
      </Modal.Body>
    </>
  );
};

export default NFCField;
