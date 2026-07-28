import React from 'react';
import { useSelector } from 'react-redux';

import Input from './input';
import Modal from './modal';
import useOrder from '../../services/sales/order/hook';

const Refund = ({ id, onClose, status }) => {
  const FormState = useSelector(state => state?.Form);
  const [pin, setPin] = React.useState('');
  const [reason, setReason] = React.useState('');
  const isPending = status === 'pending';

  const { cancel, cancelResult } = useOrder();

  const onCancel = () => {
    const payload = {
      cancelled_reason: reason,
      password: pin,
    };

    cancel({ id, payload });
  };

  React.useEffect(() => {
    if (cancelResult?.isSuccess) {
      onClose?.();
      setPin('');
      setReason('');
    }
  }, [cancelResult]);

  return (
    <>
      <Modal.Header onClose={onClose}>
        <div className="text-lg font-semibold">{isPending ? 'Cancel' : 'Refund'}</div>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-3 py-4">
          <div>Are you sure you want to {isPending ? 'cancel' : 'refund'} this transaction?</div>
          <div className="mb-3">Cash amount on hand will be recalculated.</div>
          <div className="space-y-4">
            <Input
              label="Reason"
              value={reason}
              onChange={e => setReason(e?.target?.value)}
              error={FormState?.errors?.cancelled_reason}
            />

            <Input
              label="Enter PIN"
              value={pin}
              onChange={e => setPin(e?.target?.value)}
              error={FormState?.errors?.id || FormState?.errors?.password}
              type="password"
            />
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="btn btn-md px-10" onClick={onClose}>
          Cancel
        </div>
        <div
          className={`btn btn-md btn-error px-10 text-white ${cancelResult?.isLoading ? 'btn-disabled' : ''}`}
          onClick={onCancel}
        >
          Confirm{' '}
          {cancelResult.isLoading ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : null}
        </div>
      </Modal.Footer>
    </>
  );
};

export default Refund;
