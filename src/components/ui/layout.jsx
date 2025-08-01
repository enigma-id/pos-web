/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import { BurgerIcon, HistoryIcon, ListIcon, MenuIcon, ReceiptIcon, UserIcon } from './icon';
import useSidebar from './sidebar/hook';
import useSession from '../../services/sales/session/hook';
import { isActive } from '../../utils/common';

const Layout = ({ children }) => {
  return <div className="flex h-screen w-screen">{children}</div>;
};

const Navbar = () => {
  const navigate = useNavigate();
  const User = useSelector(state => state?.Auth?.session?.user);
  const SalesSession = useSelector(state => state?.SalesSession);

  const { summary } = useSession();
  const { showSummary } = useSidebar();

  const location = useLocation();
  const { pathname } = location;
  const splitLocation = pathname.split('/');

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

        {User?.is_supervisor === 1 && (
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
    </div>
  );
};

const Body = ({ children }) => {
  return <div className="w-full">{children}</div>;
};

Layout.Navbar = Navbar;
Layout.Body = Body;

export default Layout;
