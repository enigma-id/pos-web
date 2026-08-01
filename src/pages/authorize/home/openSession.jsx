import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';

import { v4 as uuidv4 } from 'uuid';
import { Input, Modal } from '../../../components/ui';
import useModal from '../../../components/ui/modal/hook';
import useAuth from '../../../services/auth/hook';
import useSession from '../../../services/sales/session/hook';
import { currencyFormat } from '../../../utils/common';
import { resetCart } from '../../../services/cart/slice';
import useCatalog from '../../../services/catalog/hooks';
import { makeStartSession } from '../../../services/offline/shapes';
import { startSession } from '../../../services/offline';
import { saveShifts } from '../../../utils/cache';

const OpenSection = () => {
  const isOnline = useSelector(state => state?.Offline?.isOnline);
  const apiReachable = useSelector(state => state?.Offline?.apiReachable);
  const AuthSession = useSelector(state => state?.Auth?.session);

  const { start, startResult } = useSession();
  const { refreshCatalog } = useCatalog();
  const { onLogout } = useAuth();
  const { openModal, closeModal } = useModal();

  const [cash, setCash] = React.useState('');

  const isOffline = !isOnline || apiReachable === false;

  const onStartOffline = async () => {
    let now = new Date();
    const payload = {
      cash_started: parseFloat(cash) || 0,
      sync_id: uuidv4(),
      outlet_id: AuthSession?.outlet?.id,
      cashier_id: AuthSession?.user?.id,
      transaction_date: now,
      started_at: now,
      cash_started: cash,
      status: 'opened',
    };

    const dataOfflineToOnline = makeStartSession(payload);

    try {
      await startSession(dataOfflineToOnline, session?.user?.id);
    } catch (err) {
      handleModalError();
      dispatch($failure(err));
      return;
    }

    triggerQueueRefresh();

    // Push ke localStorage session cache
    try {
      saveShifts(dataOfflineToOnline);
    } catch (e) {
      handleModalError();
    }
  };

  const onStartOnline = async () => {
    const payload = {
      cash_started: parseFloat(cash) || 0,
    };

    await start(payload);
  };

  const onStart = async () => {
    if (isOffline) {
      onStartOffline();
    } else {
      onStartOnline();
    }
  };

  useEffect(() => {
    if (startResult?.isSuccess) {
      refreshCatalog();
      dispatch(resetCart());
    }
  }, [startResult?.isSuccess]);

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

  return (
    <div className="border-base-200 bg-base-100 flex h-screen flex-col border-t border-l">
      <div className="border-base-200 flex h-16 place-content-between place-items-center border-b">
        <h2 className="ps-6 text-xl font-bold">Open Sales Session</h2>
        <div
          className="bg-error text-base-100 flex h-full cursor-pointer place-items-center px-4 text-center"
          onClick={openLogout}
        >
          Logout
        </div>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto px-6 py-4">
        <div className="bg-accent mb-3 rounded-md p-4 text-[16px]">
          You are about to start a sales session. All transactions made will be grouped into this
          session, making it easier to manage and track your cash flow.
        </div>
        {isOffline && (
          <div className="bg-warning/10 text-warning mb-3 rounded-md p-3 text-sm">
            You are offline. Session will be saved locally and synced when connection is restored.
          </div>
        )}
        <label>Starting Cash</label>
        <Input
          value={currencyFormat(cash)}
          onChange={e => {
            const raw = e.target.value.replace(/[^0-9]/g, '');
            setCash(raw);
          }}
        />
        <small className="text-gray-500">
          Enter the amount of cash in the drawer at the start of the session.
        </small>
      </div>

      <div className="border-base-200 min-h-15 border-t">
        <button
          className={`btn btn-block btn-xl btn-primary rounded-none ${startResult?.isLoading ? 'btn-disabled' : ''}`}
          onClick={onStart}
          disabled={startResult?.isLoading}
        >
          {startResult?.isLoading ? (
            <>
              Starting Session...
              <span className="loading loading-spinner"></span>
            </>
          ) : (
            'Start Session'
          )}
        </button>
      </div>
    </div>
  );
};

export default OpenSection;
