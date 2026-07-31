/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { store } from '../../../services/store';

import { Input, Modal, Summary } from '../../../components/ui';
import { BackIcon } from '../../../components/ui/icon';
import useModal from '../../../components/ui/modal/hook';
import useSidebar from '../../../components/ui/sidebar/hook';
import useAuth from '../../../services/auth/hook';
import useSession from '../../../services/sales/session/hook';
import { syncPendingSessions } from '../../../services/offline/syncManager';
import usePendingQueueCount, {
  triggerQueueRefresh,
} from '../../../services/offline/usePendingQueueCount';
import { currencyFormat, dateFormat } from '../../../utils/common';
import { usePrintWindow } from '../../../utils/print';
import { resetSummary } from '../../../services/sales/session/slice';

const CloseSection = () => {
  const dispatch = useDispatch();

  const sessionSummary = useSelector(state => state?.SalesSession?.sessionSummary);
  const isOnline = useSelector(state => state?.Offline?.isOnline);
  const apiReachable = useSelector(state => state?.Offline?.apiReachable);

  const isOffline = !isOnline || apiReachable === false;

  const { summary, summaryResult, end, endResult } = useSession();
  const { count: pendingCount, refresh: refreshQueueCount } = usePendingQueueCount();
  const { onLogout } = useAuth();

  const userId = useSelector(state => state?.Auth?.session?.user?.id);

  const { showCart } = useSidebar();
  const { openModal, closeModal } = useModal();
  const [syncing, setSyncing] = React.useState(false);

  const { open } = usePrintWindow({
    title: 'Print Preview',
    autoClose: true,
    onClose: !isOffline ? onLogout : undefined,
  });

  const [cash, setCash] = React.useState('');
  const [diff, setDiff] = React.useState(0);

  const handleOpenPrintSummary = v => {
    open(<Summary data={v} />);
  };

  const doEndSession = () => {};

  const showFailoverModal = (count = pendingCount) => {
    openModal(
      <>
        <Modal.Header onClose={closeModal}>
          <div className="text-[16px] font-semibold tracking-wide">Pending Sync Warning</div>
        </Modal.Header>
        <Modal.Body>
          <div className="p-6">
            <div className="mb-4 text-sm">
              There are <b>{count}</b> session(s) that couldn't be synced.
            </div>
            <div className="flex place-content-end gap-3">
              <button className="btn btn-outline" onClick={closeModal}>
                Cancel
              </button>
              <button
                className="btn btn-outline"
                onClick={async () => {
                  setSyncing(true);
                  try {
                    await syncPendingSessions();
                  } catch {
                    // sync failed silently
                  }
                  setSyncing(false);

                  // Re-check pending count after sync attempt
                  const remaining = await refreshQueueCount();
                  if (remaining > 0) {
                    showFailoverModal(remaining);
                  } else {
                    closeModal();
                    doEndSession();
                  }
                }}
              >
                Try Again
              </button>
              {isOffline && (
                <button
                  className="btn btn-warning"
                  onClick={async () => {
                    closeModal();
                    doEndSession();
                  }}
                >
                  Close Anyway
                </button>
              )}
            </div>
          </div>
        </Modal.Body>
      </>
    );
  };

  const onCloseOffline = async () => {
    handleOpenPrintSummary(sessionSummary);
    dispatch(resetSummary());
  };

  const onCloseOnline = async () => {
    const payload = { cash_finished: Number(cash) };
    end(payload);
  };

  const onClose = async () => {
    if (isOffline) {
      onCloseOffline();
    } else {
      onCloseOnline();
    }
  };

  const openEndSessionConfirm = () => {
    openModal(
      <>
        <Modal.Header onClose={closeModal}>
          <div className="text-[16px] font-semibold tracking-wide">End Session</div>
        </Modal.Header>
        <Modal.Body>
          <div className="p-6 text-center">
            <div className="mb-4 text-[16px] font-semibold tracking-wide">
              Are you sure to end this session?
            </div>
            <div className="flex place-content-center place-items-center gap-4">
              <div
                className="btn btn-primary btn-lg px-6 text-white"
                onClick={() => {
                  closeModal();
                  onClose();
                }}
              >
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

  // Summary fetch
  React.useEffect(() => {
    summary();
  }, []);

  // Trigger print untuk online end
  React.useEffect(() => {
    if (endResult?.isSuccess && endResult?.data?.data) {
      handleOpenPrintSummary(endResult.data.data);
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

  const data = sessionSummary;

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
        {isOffline && (
          <div className="bg-warning/10 text-warning mb-3 rounded-md p-3 text-sm">
            Offline mode — summary data will be complete after sync.
          </div>
        )}
        <List title="Session Started" value={dateFormat(data?.started_at)} />
        <List title="Cashier" value={data?.cashier?.name} />
        <List title="Starting Cash" value={currencyFormat(data?.cash_started || 0)} />
        <List
          title="Outstanding Bill Payments"
          value={currencyFormat(data?.summary?.sales?.outstanding_bill_payment || 0)}
        />
        <List
          title="Outstanding Bills"
          value={currencyFormat(data?.summary?.sales?.outstanding_bill || 0)}
        />
        <List title="Total Sales" value={currencyFormat(data?.summary?.sales?.total_sales || 0)} />
        <List
          title="Total Discount"
          value={currencyFormat(data?.summary?.sales?.total_discount || 0)}
        />
        <List
          title="Total After Discount"
          value={currencyFormat(data?.summary?.sales?.total_after_discount || 0)}
        />
        <List
          title="Total Service"
          value={currencyFormat(data?.summary?.sales?.total_service || 0)}
        />
        <List title="Grand Total" value={currencyFormat(data?.summary?.sales?.grand_total || 0)} />

        {data?.summary?.topups?.length > 0 && (
          <div className="bg-accent mb-3 rounded-md p-3">
            {data?.summary?.topups?.map((t, i) => (
              <List
                key={i}
                title={`Topup ${t?.type}`}
                value={currencyFormat(t?.total_nominal || 0)}
              />
            ))}
          </div>
        )}

        {data?.summary?.payment_methods?.length > 0 && (
          <div className="bg-accent mb-3 rounded-md p-3">
            {data?.summary?.payment_methods?.map((pm, i) => (
              <List key={i} title={pm?.name} value={currencyFormat(pm?.total_paid || 0)} />
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
          className={`btn btn-block btn-xl btn-primary rounded-none ${endResult?.isLoading || syncing ? 'btn-disabled' : ''}`}
          onClick={openEndSessionConfirm}
          disabled={endResult?.isLoading || syncing}
        >
          {syncing ? 'Syncing pending sessions...' : 'End Session'}
          {(endResult?.isLoading || syncing) && <span className="loading loading-spinner"></span>}
        </button>
      </div>
    </div>
  );
};

export default CloseSection;
