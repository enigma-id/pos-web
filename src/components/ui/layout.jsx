/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import { BurgerIcon, HistoryIcon, ListIcon, MenuIcon, ReceiptIcon, UserIcon } from './icon';
import { OfflineBanner, PendingDrawer, SyncIndicator } from './offline';
import useSidebar from './sidebar/hook';
import { loadOfflineBill } from '../../services/cart/slice';
import { removeFailedItem, retryFailedItem, syncNow } from '../../services/offline';
import useSession from '../../services/sales/session/hook';
import { isActive } from '../../utils/common';

const Layout = ({ children }) => {
  const dispatch = useDispatch();
  const Offline = useSelector(state => state?.Offline);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showBanner, setShowBanner] = useState(true);

  const handleOpenBill = queueItem => {
    dispatch(loadOfflineBill(queueItem));
  };

  const banner =
    showBanner &&
    (!Offline?.isOnline && !Offline?.isSyncing
      ? {
          variant: 'offline',
          message: 'Offline mode. Transactions will be queued.',
        }
      : Offline?.isSyncing
        ? {
            variant: 'syncing',
            message: 'Syncing queued transactions...',
            pendingCount: Offline?.pendingCount || 0,
          }
        : Offline?.error
          ? {
              variant: 'error',
              message: Offline?.error,
            }
          : Offline?.warning
            ? {
                variant: 'warning',
                message: Offline?.warning,
              }
            : null);

  return (
    <div className="flex h-screen w-screen">
      {banner && (
        <OfflineBanner
          variant={banner.variant}
          message={banner.message}
          pendingCount={banner.pendingCount}
          onRetry={() => syncNow()}
          onDismiss={() => setShowBanner(false)}
        />
      )}
      {children}
      <PendingDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onRetry={retryFailedItem}
        onRemove={removeFailedItem}
        onOpenBill={handleOpenBill}
      />
    </div>
  );
};

const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const User = useSelector(state => state?.Auth?.session?.user);
  const SalesSession = useSelector(state => state?.SalesSession);

  const { summary } = useSession();
  const { showSummary } = useSidebar();

  const location = useLocation();
  const { pathname } = location;
  const splitLocation = pathname.split('/');
  const Offline = useSelector(state => state?.Offline);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleOpenBill = queueItem => {
    dispatch(loadOfflineBill(queueItem));
    navigate('/');
  };

  useEffect(() => {
    summary();
  }, []);

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

        <div
          className={`nav-items mb-3 place-items-center ${isActive(splitLocation[1], 'membership')}`}
          onClick={() => navigate('/membership')}
        >
          <UserIcon />
          <small>Member</small>
        </div>

        {User?.role === "manager" && (
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

        <div
          className={`nav-items mb-3 place-items-center ${isActive(splitLocation[1], 'bills')}`}
          onClick={() => navigate('/bills')}
        >
          <ReceiptIcon />
          <small>Saved Bills</small>
        </div>
      </div>

      <div className="mb-5">
        <div className="px-2 pb-2">
          <SyncIndicator
            pendingCount={Offline?.pendingCount || 0}
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
              <small>{User?.name}</small>
            </div>
          </div>
        </div>
      </div>
      <PendingDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onRetry={retryFailedItem}
        onRemove={removeFailedItem}
        onOpenBill={handleOpenBill}
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
