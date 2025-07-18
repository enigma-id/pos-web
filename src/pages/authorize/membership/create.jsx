/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';

import { Input, NFCField } from '../../../components/ui';
import { PlusIcon } from '../../../components/ui/icon';
import useModal from '../../../components/ui/modal/hook';
import useMembership from '../../../services/membership/hook';

const CreateSection = ({ onClose }) => {
  const { create, createResult } = useMembership();
  const { openModal, closeModal } = useModal();

  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');

  const handleRead = uid => {
    const payload = {
      reff_code: phone,
      name,
      card_id: uid,
    };

    create(payload);
  };

  const onScan = () => {
    openModal(
      <NFCField onRead={handleRead} isOpen={true} onClose={closeModal} result={createResult} />,
      'w-md'
    );
  };

  React.useEffect(() => {
    if (createResult?.isSuccess) {
      closeModal();
      onClose();
    }
  }, [createResult]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-3">
          <div className="text-sm">Member name</div>
          <Input value={name} onChange={e => setName(e?.target?.value)} />
        </div>
        <div>
          <div className="text-sm">Phone number</div>
          <Input value={phone} onChange={e => setPhone(e?.target?.value)} />
        </div>
      </div>

      <div className="border-base-200 min-h-15 border-t">
        <div className="btn btn-primary btn-block h-full rounded-none border-0" onClick={onScan}>
          <PlusIcon /> Create new membership
        </div>
      </div>
    </div>
  );
};

export default CreateSection;
