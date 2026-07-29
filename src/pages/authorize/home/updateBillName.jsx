/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';

import { Input, Modal } from '../../../components/ui';
import useModal from '../../../components/ui/modal/hook';

const UpdateTicket = ({ data, onSubmit, isLoading, onClose }) => {
  const FormState = useSelector(state => state?.Form);
  const { closeModal } = useModal();
  const [billName, setBillName] = React.useState('');

  useEffect(() => {
    setBillName(data?.bill_name || '');
  }, [data]);

  return (
    <>
      <Modal.Header onClose={() => { onClose?.(); closeModal(); }}>
        <div className="text-lg font-semibold">Update Bill</div>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-3 py-4">
          <Input
            label="Bill Name"
            value={billName}
            onChange={e => setBillName(e?.target?.value)}
            error={FormState?.errors?.billName}
          />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="btn btn-md px-10" onClick={() => { onClose?.(); closeModal(); }}>
          Cancel
        </div>
        <div
          className={`btn btn-md btn-primary px-10 text-white ${isLoading ? 'btn-disabled' : ''}`}
          onClick={() => onSubmit(billName)}
        >
          Update Bill{' '}
          {isLoading ? <span className="loading loading-spinner loading-sm"></span> : null}
        </div>
      </Modal.Footer>
    </>
  );
};

export default UpdateTicket;
