/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';

import { Input, Modal } from '../../../components/ui';
import useTopup from '../../../services/topup/hook';
import { currencyFormat } from '../../../utils/common';

const CancelTopupModal = ({ log, onClose, onRefetch }) => {
  const [reason, setReason] = React.useState('');
  const [pin, setPin] = React.useState('');
  const { cancel, cancelResult } = useTopup();

  const onConfirm = () => {
    const targetId = log?.id ?? log?.sync_id;
    if (!targetId) return;

    const payload = { cancelled_reason: reason, password: pin };
    cancel({ id: targetId, payload });
  };

  React.useEffect(() => {
    if (cancelResult?.isSuccess) {
      onRefetch?.();
      onClose?.();
      setReason('');
      setPin('');
    }
  }, [cancelResult]);

  return (
    <>
      <Modal.Header onClose={onClose}>
        <div className="text-lg font-semibold">Cancel Topup</div>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-3 py-4">
          <div className="mb-3">
            Are you sure you want to cancel this topup?
            <div className="text-gray-500 text-sm">
              {log?.reference_code} · {currencyFormat(log?.nominal)}
            </div>
          </div>
          <div className="space-y-4">
            <Input
              label="Reason"
              value={reason}
              onChange={e => setReason(e?.target?.value)}
              placeholder="Required"
            />

            <Input
              label="Enter PIN"
              value={pin}
              onChange={e => setPin(e?.target?.value)}
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
          className={`btn btn-md btn-error px-10 text-white ${
            cancelResult?.isLoading || !reason || !pin ? 'btn-disabled' : ''
          }`}
          onClick={onConfirm}
        >
          Confirm{' '}
          {cancelResult?.isLoading ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : null}
        </div>
      </Modal.Footer>
    </>
  );
};

export default CancelTopupModal;
