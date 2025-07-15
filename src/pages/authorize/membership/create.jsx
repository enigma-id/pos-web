/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';

import { Dialog, Input, NFCField } from '../../../components/ui';
import { PlusIcon } from '../../../components/ui/icon';
import useMembership from '../../../services/membership/hook';
import useDialogModal from '../../../utils/modal';

const CreateSection = ({ onClose }) => {
  const { create, createResult } = useMembership();
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');

  const { dialogRef, open: openModal, close: closeModal, isOpen } = useDialogModal();

  const handleRead = uid => {
    const payload = {
      reff_code: phone,
      name,
      card_id: uid,
    };

    create(payload);
  };

  React.useEffect(() => {
    if (createResult?.isSuccess) {
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
        <div className="btn btn-primary btn-block h-full rounded-none border-0" onClick={openModal}>
          <PlusIcon /> Create new membership
        </div>
      </div>

      <Dialog.Wrapper ref={dialogRef}>
        <Dialog.Header onClose={closeModal}>
          <div className="text-[16px] font-semibold tracking-wide">Scan NFC</div>
        </Dialog.Header>
        <Dialog.Body>
          <NFCField
            onRead={handleRead}
            isOpen={isOpen}
            onClose={closeModal}
            result={createResult}
          />
        </Dialog.Body>
      </Dialog.Wrapper>
    </div>
  );
};

export default CreateSection;
