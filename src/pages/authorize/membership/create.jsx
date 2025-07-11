import React from 'react';

import { Input, NFCField } from '../../../components/ui';
import { CloseIcon, PlusIcon } from '../../../components/ui/icon';
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
      <div className="flex-1 overflow-y-auto">
        <div className="mb-3">
          <div className="text-sm">Member name</div>
          <Input value={name} onChange={e => setName(e?.target?.value)} />
        </div>
        <div>
          <div className="text-sm">Phone number</div>
          <Input value={phone} onChange={e => setPhone(e?.target?.value)} />
        </div>
      </div>

      <div className="border-secondary min-h-15 border-t pt-3">
        <div className="btn btn-primary btn-block rounded-full" onClick={openModal}>
          <PlusIcon /> Create new membership
        </div>
      </div>

      <dialog ref={dialogRef} className="modal">
        <div className="w-lg rounded-lg bg-white">
          <div className="border-secondary flex place-content-between place-items-center border-b px-6 py-4">
            <div className="text-[16px] font-semibold tracking-wide">Scan NFC</div>
            <div className="btn btn-ghost btn-sm btn-circle" onClick={closeModal}>
              <CloseIcon />
            </div>
          </div>

          <NFCField
            onRead={handleRead}
            isOpen={isOpen}
            onClose={closeModal}
            result={createResult}
          />
        </div>
      </dialog>
    </div>
  );
};

export default CreateSection;
