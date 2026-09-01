/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import CashDrawerTrigger from './cashdrawer';
import {
  BurgerIcon,
  HistoryIcon,
  ListIcon,
  MenuIcon,
  ReceiptIcon,
  UserIcon,
  MoneysIcon,
} from './icon';
import { OfflineBanner, PendingDrawer, SyncIndicator } from './offline';
import useSidebar from './sidebar/hook';
import useCart from '../../services/cart/hook';
import { deleteOrderBill, deleteOrderPayment, deleteTopup, syncNow } from '../../services/offline';
import { setNetworkState } from '../../services/offline/slice';
import useNetworkStatus from '../../services/offline/useNetworkStatus';
import usePendingQueueCount, {
  triggerQueueRefresh,
} from '../../services/offline/usePendingQueueCount';
import useSession from '../../services/sales/session/hook';
import {
  deleteOpenBills,
  deleteOrderHistory,
  perbaharuiMembership,
  showMembership,
} from '../../utils/cache';
import { isActive } from '../../utils/common';
import { usePrintWindow } from '../../utils/print';

const Layout = ({ children }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const sessionAuth = useSelector(state => state?.Auth?.session);
  const Offline = useSelector(state => state?.Offline);
  const { isOnline, wasOffline } = useNetworkStatus();
  const { count: queueCount } = usePendingQueueCount();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [backOnline, setBackOnline] = useState(false);
  const prevOnlineRef = useRef(isOnline);
  const prevApiReachableRef = useRef(Offline?.apiReachable);

  const { onBillSelected } = useCart();
  const { updateSessionSummary } = useSession();

  // Wire network status to Redux
  useEffect(() => {
    dispatch(setNetworkState({ isOnline, wasOffline }));
  }, [isOnline, wasOffline]);

  // Re-show banner on offline transition; brief "back online" on reconnect
  useEffect(() => {
    const prev = prevOnlineRef.current;
    prevOnlineRef.current = isOnline;

    if (prev && !isOnline) {
      // Went offline — re-show banner
      setShowBanner(true);
      setBackOnline(false);
    }

    if (wasOffline && isOnline) {
      // Just came back — brief "back online" banner, auto-dismiss 5s
      setBackOnline(true);
      setShowBanner(true);
      const t = setTimeout(() => {
        setBackOnline(false);
        setShowBanner(false);
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [isOnline, wasOffline]);

  // Track apiReachable changes → show/hide "server dead" / "back online" banner
  useEffect(() => {
    const prev = prevApiReachableRef.current;
    prevApiReachableRef.current = Offline?.apiReachable;

    if (prev !== false && Offline?.apiReachable === false) {
      // API just died
      setBackOnline(false);
      setShowBanner(true);
    }

    if (prev === false && Offline?.apiReachable !== false && isOnline) {
      // API just recovered — brief "back online" banner
      setBackOnline(true);
      setShowBanner(true);
      const t = setTimeout(() => {
        setBackOnline(false);
        setShowBanner(false);
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [Offline?.apiReachable, isOnline]);

  const handleOpenBill = queueItem => {
    onBillSelected(queueItem);
    navigate('/');
  };

  const handleRemoveOffline = async (type, queueItem) => {
    if (type === 'bill') {
      try {
        await deleteOrderBill(queueItem, sessionAuth?.user?.id);
      } catch (err) {}

      try {
        await deleteOpenBills(queueItem);
      } catch (err) {}

      updateSessionSummary({
        type: 'update',
        outstanding_bill: -1 * queueItem.total_charges,
      });
    }

    if (type === 'payment') {
      try {
        await deleteOrderPayment(queueItem?.sync_id, sessionAuth?.user?.id);
      } catch (err) {
        /* empty */
      }

      try {
        await deleteOrderHistory(queueItem);
      } catch (err) {}

      let outstandingBillPayment = 0;

      if (
        !(
          queueItem?.session?.id === queueItem?.paid_session?.id ||
          queueItem?.session?.sync_id === queueItem?.paid_session?.sync_id
        )
      ) {
        outstandingBillPayment = -1 * queueItem?.total_charges;
      }

      updateSessionSummary({
        type: 'deleted_payment',
        payment_method: queueItem?.payment_method,
        total_sales: -1 * queueItem?.subtotal_nett,
        total_discount:
          -1 * (queueItem?.subtotal_nett - queueItem?.total_bill + queueItem?.discount_value),
        total_after_discount: -1 * (queueItem?.total_bill - queueItem?.discount_value),
        total_service: -1 * queueItem?.service_charge_value,
        total_charges: -1 * queueItem?.total_charges,
        outstanding_bill_payment: outstandingBillPayment,
        order: queueItem,
      });
    }

    if (type === 'topup') {
      try {
        await deleteTopup(queueItem?.sync_id, sessionAuth?.user?.id);
      } catch (err) {}

      try {
        const membership = showMembership(queueItem?.membership?.card_id);
        membership.saldo -= queueItem.nominal;

        const logsIdx = membership.saldo_logs.findIndex(p => p.sync_id === queueItem?.sync_id);

        membership.saldo_logs.splice(logsIdx, 1);

        await perbaharuiMembership(membership);
      } catch (err) {}

      updateSessionSummary({
        type: 'deleted_topup',
        topup_method: queueItem?.payment_type,
        topup_nominal: -1 * queueItem?.nominal,
      });
    }

    triggerQueueRefresh();
  };

  const banner = (() => {
    if (!showBanner) return null;

    if (backOnline) {
      return {
        variant: 'success',
        message: 'Back online. Connection restored.',
      };
    }

    if (!Offline?.isOnline && !Offline?.isSyncing) {
      return {
        variant: 'offline',
        message: 'Offline mode. Transactions will be queued.',
      };
    }

    if (Offline?.apiReachable === false && Offline?.isOnline && !Offline?.isSyncing) {
      return {
        variant: 'offline',
        message: 'Server unreachable. Transactions will be queued.',
      };
    }

    if (Offline?.isSyncing) {
      return {
        variant: 'syncing',
        message: 'Syncing queued transactions...',
        pendingCount: queueCount,
      };
    }

    if (Offline?.error) {
      return { variant: 'error', message: Offline?.error };
    }

    if (Offline?.warning) {
      return { variant: 'warning', message: Offline?.warning };
    }

    return null;
  })();

  return (
    <div className="flex h-screen w-screen">
      {banner && (
        <OfflineBanner
          variant={banner.variant}
          message={banner.message}
          pendingCount={queueCount}
          onRetry={() => syncNow()}
          onDismiss={() => {
            setShowBanner(false);
            setBackOnline(false);
          }}
        />
      )}
      {children}
      <PendingDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onOpenBill={handleOpenBill}
        onRemove={handleRemoveOffline}
      />
    </div>
  );
};

const Navbar = () => {
  const navigate = useNavigate();
  const sessionAuth = useSelector(state => state?.Auth?.session);
  const SalesSession = useSelector(state => state?.SalesSession);
  const lastSyncTime = useSelector(state => state?.Offline?.lastSyncTime);

  const { summary } = useSession();
  const { showSummary } = useSidebar();
  const { count: queueCount } = usePendingQueueCount();

  const location = useLocation();
  const { pathname } = location;
  const splitLocation = pathname.split('/');
  const Offline = useSelector(state => state?.Offline);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { open: openPrint } = usePrintWindow({ title: 'Open Drawer', autoClose: true });

  const handleOpenCashDrawer = () => {
    openPrint(<CashDrawerTrigger />);
  };

  const { onBillSelected } = useCart();
  const { updateSessionSummary } = useSession();

  const handleOpenBill = queueItem => {
    onBillSelected(queueItem);
    navigate('/');
  };

  const handleRemoveOffline = async (type, queueItem) => {
    if (type === 'bill') {
      try {
        await deleteOrderBill(queueItem, sessionAuth?.user?.id);
      } catch (err) {}

      try {
        await deleteOpenBills(queueItem);
      } catch (err) {}

      updateSessionSummary({
        type: 'update',
        outstanding_bill: -1 * queueItem.total_charges,
      });
    }

    if (type === 'payment') {
      try {
        await deleteOrderPayment(queueItem?.sync_id, sessionAuth?.user?.id);
      } catch (err) {}

      try {
        await deleteOrderHistory(queueItem);
      } catch (err) {}

      let outstandingBillPayment = 0;

      if (
        !(
          queueItem?.session?.id === queueItem?.paid_session?.id ||
          queueItem?.session?.sync_id === queueItem?.paid_session?.sync_id
        )
      ) {
        outstandingBillPayment = -1 * queueItem?.total_charges;
      }

      updateSessionSummary({
        type: 'deleted_payment',
        payment_method: queueItem?.payment_method,
        total_sales: -1 * queueItem?.subtotal_nett,
        total_discount:
          -1 * (queueItem?.subtotal_nett - queueItem?.total_bill + queueItem?.discount_value),
        total_after_discount: -1 * (queueItem?.total_bill - queueItem?.discount_value),
        total_service: -1 * queueItem?.service_charge_value,
        total_charges: -1 * queueItem?.total_charges,
        outstanding_bill_payment: outstandingBillPayment,
        order: queueItem,
      });
    }

    if (type === 'topup') {
      try {
        await deleteTopup(queueItem?.sync_id, sessionAuth?.user?.id);
      } catch (err) {}

      try {
        const membership = showMembership(queueItem?.membership?.card_id);
        membership.saldo -= queueItem.nominal;

        const logsIdx = membership.saldo_logs.findIndex(p => p.sync_id === queueItem?.sync_id);

        membership.saldo_logs.splice(logsIdx, 1);

        await perbaharuiMembership(membership);
      } catch (err) {}

      updateSessionSummary({
        type: 'deleted_topup',
        topup_method: queueItem?.payment_type,
        topup_nominal: -1 * queueItem?.nominal,
      });
    }

    triggerQueueRefresh();
  };

  useEffect(() => {
    summary();
  }, [lastSyncTime]);

  return (
    <div
      className={`nav-container flex flex-1 flex-col shadow transition-all duration-200 ease-in-out`}
    >
      <div className={`flex-1`}>
        <div className={`nav-items`}>
          <BurgerIcon />
        </div>
        <div
          className={`nav-items mb-3 place-items-center ${isActive(splitLocation[1], '')}`}
          onClick={() => navigate('/')}
        >
          <MenuIcon />
          <small>Menu</small>
        </div>

        {sessionAuth?.outlet?.outlet_type_id !== '50a0d3c1-f4ae-4f55-9c73-3155de2ad47b' && (
          <div
            className={`nav-items mb-3 place-items-center ${isActive(splitLocation[1], 'membership')}`}
            onClick={() => navigate('/membership')}
          >
            <UserIcon />
            <small>Member</small>
          </div>
        )}

        {sessionAuth?.user?.role === 'manager' && (
          <div
            className={`nav-items mb-3 place-items-center ${isActive(splitLocation[1], 'shifts')}`}
            onClick={() => navigate('/shifts')}
          >
            <ListIcon />
            <small>Shifts</small>
          </div>
        )}

        <div
          className={`nav-items mb-3 place-items-center ${isActive(splitLocation[1], 'history')}`}
          onClick={() => navigate('/history')}
        >
          <HistoryIcon />
          <small>History</small>
        </div>

        {sessionAuth?.outlet?.outlet_type_id !== '50a0d3c1-f4ae-4f55-9c73-3155de2ad47b' && (
          <>
            {Offline?.isOnline && Offline?.apiReachable !== false && (
              <div
                className={`nav-items mb-3 place-items-center ${isActive(splitLocation[1], 'topup')}`}
                onClick={() => navigate('/topup')}
              >
                <MoneysIcon />
                <small>Top Up</small>
              </div>
            )}
          </>
        )}

        <div
          className={`nav-items mb-3 place-items-center ${isActive(splitLocation[1], 'bills')}`}
          onClick={() => navigate('/bills')}
        >
          <ReceiptIcon />
          <small>Saved Bills</small>
        </div>
      </div>

      <div className="mb-5">
        <div className="nav-items mb-3 place-items-center" onClick={handleOpenCashDrawer}>
          <MoneysIcon />
          <small>Open Drawer</small>
        </div>
        <div className="px-2 pb-2">
          <SyncIndicator
            pendingCount={queueCount}
            failedCount={Offline?.failedCount || 0}
            onClick={() => setDrawerOpen(true)}
          />
        </div>
        <div
          className={`nav-items mb-3`}
          onClick={
            SalesSession?.hasSession
              ? () => {
                  showSummary();
                  navigate('/');
                }
              : () => navigate('/')
          }
        >
          <div className="indicator">
            <span
              className={`indicator-item status ${SalesSession?.hasSession ? 'status-success' : 'status-error'} animate-ping`}
            ></span>
            <div className={`-ms-2 flex flex-col place-items-center`}>
              <UserIcon />
              <small>{sessionAuth?.user?.name}</small>
            </div>
          </div>
        </div>
      </div>
      <PendingDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onOpenBill={handleOpenBill}
        onRemove={handleRemoveOffline}
      />
    </div>
  );
};

const Body = ({ children }) => {
  return <div className="w-full">{children}</div>;
};

Layout.Navbar = Navbar;
Layout.Body = Body;

export default Layout;
