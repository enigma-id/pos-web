/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';

import { Input, Modal } from '../../../components/ui';
import useModal from '../../../components/ui/modal/hook';

const UpdateTicket = ({ data, onSubmit, isLoading }) => {
  const FormState = useSelector(state => state?.Form);
  const { closeModal } = useModal();
  const [ticket, setTicket] = React.useState('');

  useEffect(() => {
    setTicket(data?.ticket);
  }, [data]);

  return (
    <>
      <Modal.Header onClose={closeModal}>
        <div className="text-lg font-semibold">Update Ticket</div>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-3 py-4">
          <Input
            label="bill name"
            value={ticket}
            onChange={e => setTicket(e?.target?.value)}
            error={FormState?.errors?.ticket}
          />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="btn btn-md px-10" onClick={closeModal}>
          Cancel
        </div>
        <div
          className={`btn btn-md btn-primary px-10 text-white ${isLoading ? 'btn-disabled' : ''}`}
          onClick={() => onSubmit(ticket)}
        >
          Update Ticket{' '}
          {isLoading ? <span className="loading loading-spinner loading-sm"></span> : null}
        </div>
      </Modal.Footer>
    </>
  );
};

export default UpdateTicket;
