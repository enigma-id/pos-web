import React from 'react';
import { useSelector } from 'react-redux';

import Input from './input';
import Modal from './modal';
import useMembership from '../../services/membership/hook';

const Remove = ({ id, onClose }) => {
  const FormState = useSelector(state => state?.Form);
  const [pin, setPin] = React.useState('');

  const { remove, removeResult } = useMembership();

  const onDelete = () => {
    const payload = {
      pin,
    };

    remove({ id, payload });
  };

  React.useEffect(() => {
    if (removeResult?.isSuccess) {
      onClose?.();
      setPin('');
    }
  }, [removeResult]);

  return (
    <>
      <Modal.Header onClose={onClose}>
        <div className="text-lg font-semibold">Remove Member</div>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-3 py-4">
          <div>Are you sure you want to remove this member?</div>

          <Input
            label="Enter PIN"
            value={pin}
            onChange={e => setPin(e?.target?.value)}
            error={FormState?.errors?.pin}
            type="password"
          />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="btn btn-md px-10" onClick={onClose}>
          Cancel
        </div>
        <div
          className={`btn btn-md btn-error px-10 text-white ${removeResult?.isLoading ? 'btn-disabled' : ''}`}
          onClick={onDelete}
        >
          Confirm{' '}
          {removeResult.isLoading ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : null}
        </div>
      </Modal.Footer>
    </>
  );
};

export default Remove;
