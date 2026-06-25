/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useSelector } from 'react-redux';

import { Input, Modal, Summary } from '../../../components/ui';
import { BackIcon } from '../../../components/ui/icon';
import useModal from '../../../components/ui/modal/hook';
import useSidebar from '../../../components/ui/sidebar/hook';
import useAuth from '../../../services/auth/hook';
import useSession from '../../../services/sales/session/hook';
import { currencyFormat, dateFormat } from '../../../utils/common';
import { usePrintWindow } from '../../../utils/print';

const CloseSection = () => {
  const { summary, summaryResult, end, endResult } = useSession();
  const pendingCount = useSelector(state => state?.Offline?.pendingCount || 0);
  const { onLogout } = useAuth();

  const { showCart } = useSidebar();
  const { openModal, closeModal } = useModal();

  const { open } = usePrintWindow({
    title: 'Print Preview',
    autoClose: true,
    onClose: () => onLogout(),
  });

  const [cash, setCash] = React.useState('');
  const [diff, setDiff] = React.useState(0);

  const handleOpenPrintSummary = v => {
    open(<Summary data={v} />);
  };

  const onSubmit = async () => {
    if (pendingCount > 0) {
      openModal(
        <>
          <Modal.Header onClose={closeModal}>
            <div className="text-[16px] font-semibold tracking-wide">Pending Sync Warning</div>
          </Modal.Header>
          <Modal.Body>
            <div className="p-6">
              <div className="mb-4 text-sm">
                There are <b>{pendingCount}</b> transaction(s) still pending sync.
                Ending session now may leave sales unsynced.
              </div>
              <div className="flex place-content-end gap-3">
                <button className="btn btn-outline" onClick={closeModal}>
                  Cancel
                </button>
                <button
                  className="btn btn-warning"
                  onClick={() => {
                    closeModal();
                    const payload = { cash_finished: Number(cash) };
                    end(payload);
                  }}
                >
                  End Session Anyway
                </button>
              </div>
            </div>
          </Modal.Body>
        </>
      );
      return;
    }

    const payload = {
      cash_finished: Number(cash),
    };

    end(payload);
  };

  const openLogout = () => {
    openModal(
      <>
        <Modal.Header onClose={closeModal}>
          <div className="text-[16px] font-semibold tracking-wide">Logout</div>
        </Modal.Header>
        <Modal.Body>
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
        </Modal.Body>
      </>
    );
  };

  React.useEffect(() => {
    summary();
  }, []);

  React.useEffect(() => {
    if (endResult?.isSuccess) {
      handleOpenPrintSummary(endResult?.data?.data);
    }
  }, [endResult]);


  const List = ({ title, value }) => {
    return (
      <div className="border-base-200 mb-3 flex items-center justify-between border-b py-1">
        <div className="text-sm font-thin">{title} :</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    );
  };

  const data = summaryResult?.data?.data;

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
          className="bg-error text-base-100 flex h-full cursor-pointer place-items-center px-4 text-center"
          onClick={openLogout}
        >
          Logout
        </div>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto px-6 py-4">
        <List title="Session Started" value={dateFormat(data?.started_at)} />
        <List title="Cashier" value={data?.cashier?.name} />
        <List
          title="Starting Cash"
          value={currencyFormat(data?.cash_started || 0)}
        />
        <List
          title="Outstanding Bill Payments"
          value={currencyFormat(data?.summary?.sales?.outstanding_bill_payment || 0)}
        />
        <List
          title="Outstanding Bills"
          value={currencyFormat(data?.summary?.sales?.outstanding_bill || 0)}
        />
        <List
          title="Total Sales"
          value={currencyFormat(data?.summary?.sales?.total_sales || 0)}
        />
        <List
          title="Total Discount"
          value={currencyFormat(data?.summary?.sales?.total_discount || 0)}
        />
        <List
          title="Total After Discount"
          value={currencyFormat(
            data?.summary?.sales?.total_after_discount || 0
          )}
        />
        <List
          title="Total Service"
          value={currencyFormat(
            data?.summary?.sales?.total_service || 0
          )}
        />
        <List
          title="Grand Total"
          value={currencyFormat(data?.summary?.sales?.grand_total || 0)}
        />

        {data?.summary?.topups?.length > 0 && (
          <div className="bg-accent mb-3 rounded-md p-3">
            {data?.summary?.topups?.map((t, i) => (
              <List key={i} title={`Topup ${t?.type}`} value={currencyFormat(t?.total_nominal || 0)} />
            ))}
          </div>
        )}

        {data?.summary?.payment_methods
?.length > 0 && (
          <div className="bg-accent mb-3 rounded-md p-3">
            {data?.summary?.payment_methods
?.map((pm, i) => (
              <List
                key={i}
                title={pm?.name}
                value={currencyFormat(pm?.total_paid || 0)}
              />
            ))}
          </div>
        )}
        <div className="mb-3">
          <div className="text-sm font-thin">Ending Cash</div>
          <Input
            value={currencyFormat(cash)}
            onChange={e => {
              const raw = e.target.value.replace(/[^0-9]/g, '');
              setCash(raw);

              const different = Number(raw) - Number(data?.summary?.cash?.expected_cash || 0);

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
    </div>
  );
};

export default CloseSection;
