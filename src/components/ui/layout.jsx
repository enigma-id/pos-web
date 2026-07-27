/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import { BurgerIcon, HistoryIcon, ListIcon, MenuIcon, ReceiptIcon, UserIcon } from './icon';
import { OfflineBanner, PendingDrawer, SyncIndicator } from './offline';
import useSidebar from './sidebar/hook';
import { loadOfflineBill } from '../../services/cart/slice';
import { getAllSessions, getOfflinePendingCount } from '../../services/offline/queue';
import { removeFailedItem, retryFailedItem, syncNow } from '../../services/offline';
import { setSessions, setNetworkState, setPendingCount } from '../../services/offline/slice';
import useNetworkStatus from '../../services/offline/useNetworkStatus';
import useSession from '../../services/sales/session/hook';
import { isActive } from '../../utils/common';

const Layout = ({ children }) => {
  const dispatch = useDispatch();
  const Offline = useSelector(state => state?.Offline);
  const authUser = useSelector(state => state?.Auth?.user);
  const { isOnline, wasOffline } = useNetworkStatus();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [backOnline, setBackOnline] = useState(false);
  const prevOnlineRef = useRef(isOnline);
  const prevApiReachableRef = useRef(Offline?.apiReachable);

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
    dispatch(loadOfflineBill(queueItem));
  };

  const refreshQueue = async () => {
    const userId = authUser?.id;
    if (userId) {
      const fresh = await getAllSessions(userId);
      dispatch(setSessions(fresh));
      const c = await getOfflinePendingCount(userId);
      dispatch(setPendingCount(c));
    }
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
        pendingCount: Offline?.pendingCount || 0,
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
          pendingCount={banner.pendingCount}
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

  const refreshQueue = async () => {
    const userId = User?.id;
    if (userId) {
      const fresh = await getAllSessions(userId);
      dispatch(setSessions(fresh));
      const c = await getOfflinePendingCount(userId);
      dispatch(setPendingCount(c));
    }
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

        {User?.role === 'manager' && (
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
        onRefresh={refreshQueue}
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
