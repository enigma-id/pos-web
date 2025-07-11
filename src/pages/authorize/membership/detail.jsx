import React from 'react';

import CardMockup from '../../../assets/card-mockup.jpg';
import { CloseIcon, PaypassIcon } from '../../../components/ui/icon';
import Input from '../../../components/ui/input';
import useMembership from '../../../services/membership/hook';
import { currencyFormat } from '../../../utils/common';
import useDialogModal from '../../../utils/modal';

const DetailSession = ({ id, onClose, isOpen }) => {
  const { dialogRef, open: openModal, close: closeModal } = useDialogModal();
  const { showResult, remove, removeResult } = useMembership(id);

  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [edit, setEdit] = React.useState(false);

  const onDelete = async () => {
    remove(id);
  };

  React.useEffect(() => {
    if (removeResult?.isSuccess) {
      closeModal();
      onClose();
    }
  }, [removeResult]);

  React.useEffect(() => {
    if (isOpen === false) {
      setName(showResult?.data?.data?.name);
      setPhone(showResult?.data?.data?.reff_code);
      setEdit(false);
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (showResult?.isSuccess) {
      setName(showResult?.data?.data?.name);
      setPhone(showResult?.data?.data?.reff_code);
    }
  }, [showResult]);

  if (showResult?.isLoading) return <div>loading...</div>;

  const data = showResult?.data?.data;

  return (
    <div className="flex h-full w-md flex-1 flex-col">
      <div className="flex-1">
        <div className="h-80 w-full overflow-hidden rounded-lg">
          <div
            className="flex h-full w-full place-content-center place-items-center bg-center"
            style={{ background: `url(${CardMockup})` }}
          >
            <div
              className="flex h-64 w-7/8 flex-col rounded-lg p-6 text-white shadow shadow-white/45"
              style={{
                background:
                  'linear-gradient(112.91deg, rgba(255,255,255,0.3) 3.51%, rgba(255,255,255,0) 111.71%), rgba(0,0,0,0.1)',
                backdropFilter: 'blur(8.36975px)',
              }}
            >
              <div className="flex flex-1 place-content-between">
                <div className="text-2xl font-semibold tracking-wide">Suka Bread.</div>
                <div>
                  <PaypassIcon />
                </div>
              </div>

              <div className="text-5xl font-semibold tracking-wide">
                {currencyFormat(data?.saldo || 0)}
              </div>
              <div className="mt-2 text-[16px] font-medium tracking-wide uppercase">
                {data?.name || '-'}
              </div>
              <div className="text-xl font-medium tracking-wide uppercase">
                {data?.reff_code || '-'}
              </div>
            </div>
          </div>
        </div>

        <div className="py-4">
          <fieldset className="fieldset">
            <label className="flex place-content-between place-items-center text-[14px] font-semibold tracking-wide uppercase">
              Update Member
              <input
                type="checkbox"
                checked={edit}
                className="toggle toggle-primary"
                onChange={() => setEdit(!edit)}
              />
            </label>
          </fieldset>
          <div className="pt-4">
            <Input
              value={name}
              onChange={v => setName(v?.target?.value)}
              disabled={!edit}
              label="Name"
            />
          </div>
          <div className="pt-4">
            <Input
              label="Phone Number"
              value={phone}
              onChange={v => setPhone(v?.target?.value)}
              disabled={!edit}
            />
          </div>
        </div>
      </div>
      <div className="border-secondary flex min-h-15 place-content-center place-items-center gap-2 border-t pt-3">
        <button
          className={`btn btn-md btn-primary w-2/3 rounded-l-full ${edit ? '' : 'btn-disabled'}`}
        >
          Save
        </button>

        <div className="btn btn-error w-1/3 rounded-r-full text-white" onClick={openModal}>
          Remove
        </div>
      </div>

      <dialog ref={dialogRef} className="modal">
        <div className="w-md rounded-lg bg-white">
          <div className="border-secondary flex place-content-between place-items-center border-b px-6 py-4">
            <div className="text-[16px] font-semibold tracking-wide">Remove</div>
            <div className="btn btn-ghost btn-sm btn-circle" onClick={closeModal}>
              <CloseIcon />
            </div>
          </div>

          <div className="p-6 text-center">
            <div className="mb-4 text-[16px] font-semibold tracking-wide">Are you sure ?</div>
            <div className="flex place-content-center place-items-center gap-4">
              <div className="btn btn-error btn-sm rounded-full px-6 text-white" onClick={onDelete}>
                Yes
              </div>
              <div className="btn btn-outline btn-sm rounded-full px-6" onClick={closeModal}>
                Cancel
              </div>
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
};

export default DetailSession;
