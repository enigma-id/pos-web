/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';

import { Dialog, Input, Summary } from '../../../components/ui';
import { BackIcon } from '../../../components/ui/icon';
import useSidebar from '../../../components/ui/sidebar/hook';
import useAuth from '../../../services/auth/hook';
import useSession from '../../../services/sales/session/hook';
import { currencyFormat, dateFormat } from '../../../utils/common';
import useDialogModal from '../../../utils/modal';
import { usePrintWindow } from '../../../utils/print';

const CloseSection = () => {
  const { dialogRef, open: openModal, close: closeModal } = useDialogModal();
  const { summary, summaryResult, end, endResult } = useSession();
  const { onLogout } = useAuth();

  const { showCart } = useSidebar();
  const { open } = usePrintWindow({ title: 'Print Preview', autoClose: true });

  const [cash, setCash] = React.useState('');
  const [diff, setDiff] = React.useState(0);

  const handleOpenPrintSummary = () => {
    open(<Summary data={summaryResult?.data?.data} />);
  };

  const onSubmit = async () => {
    handleOpenPrintSummary();
    const payload = {
      cash: Number(cash),
    };

    end(payload);
  };

  React.useEffect(() => {
    summary();
  }, []);

  const List = ({ title, value }) => {
    return (
      <div className="border-base-200 mb-3 flex items-center justify-between border-b py-1">
        <div className="text-sm font-thin">{title} :</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    );
  };

  return (
    <div className="border-base-200 bg-base-100 flex h-screen flex-col border-l">
      <div className="border-base-200 flex h-16 place-content-between place-items-center border-b">
        <div className="flex items-center gap-4 ps-6">
          <div className="btn btn-md btn-outline btn-circle border-base-200" onClick={showCart}>
            <BackIcon />
          </div>
          <h2 className="text-xl font-bold">Sales Session</h2>
        </div>

        <div
          className="bg-error text-base-100 flex h-full cursor-pointer place-items-center px-4"
          onClick={openModal}
        >
          Logout
        </div>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto px-6 py-4">
        <List title="Session Started" value={dateFormat(summaryResult?.data?.data?.started_at)} />
        <List title="Cashier" value={summaryResult?.data?.data?.cashier?.name} />
        <List
          title="Starting Cash"
          value={currencyFormat(summaryResult?.data?.data?.cash_started || 0)}
        />
        <List
          title="Total Transactions"
          value={currencyFormat(summaryResult?.data?.data?.subtotal_order || 0)}
        />

        <div className="bg-base-300/30 mb-3 rounded-md p-3">
          {summaryResult?.data?.data?.cash_payments?.map((pm, i) => (
            <List
              key={i}
              title={pm?.payment_name === '' ? 'Cash' : pm?.payment_name}
              value={currencyFormat(pm?.subtotal || 0)}
            />
          ))}
        </div>

        <div className="mb-3">
          <div className="text-sm font-thin">Ending Cash</div>
          <Input
            value={cash}
            type="number"
            onChange={e => {
              setCash(e?.target?.value);

              const different =
                Number(e?.target?.value) - Number(summaryResult?.data?.data?.cash_due || 0);

              setDiff(isNaN(different) ? 0 : different);
            }}
          />
        </div>

        {cash > 0 && diff !== 0 && (
          <div className="border-base-200 mb-3 flex items-center justify-between border-b py-1">
            <div className="text-sm font-thin">Difference:</div>
            <div className="text-error text-sm font-semibold">{currencyFormat(diff)}</div>
          </div>
        )}
      </div>

      <div className="border-base-200 min-h-15 border-t">
        <button
          className={`btn btn-block btn-xl btn-primary rounded-none ${endResult?.isLoading ? 'btn-disabled' : ''}`}
          onClick={onSubmit}
        >
          End Session
          {endResult?.isLoading && <span className="loading loading-spinner"></span>}
        </button>
      </div>

      <Dialog.Wrapper ref={dialogRef}>
        <Dialog.Header onClose={closeModal}>
          <div className="text-[16px] font-semibold tracking-wide">Logout</div>
        </Dialog.Header>
        <Dialog.Body>
          <div className="p-6 text-center">
            <div className="mb-4 text-[16px] font-semibold tracking-wide">Are you sure ?</div>
            <div className="flex place-content-center place-items-center gap-4">
              <div className="btn btn-error btn-lg px-6 text-white" onClick={onLogout}>
                Yes
              </div>
              <div className="btn btn-outline btn-lg px-6" onClick={closeModal}>
                Cancel
              </div>
            </div>
          </div>
        </Dialog.Body>
      </Dialog.Wrapper>
    </div>
  );
};

export default CloseSection;
