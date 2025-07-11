/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import { HistoryIcon, HomeIcon, ListIcon, ReceiptIcon } from './icon';
import useSidebar from './sidebar/hook';
import logo from '../../assets/logo.png';
import useSalesChannel from '../../services/sales/channel/hook';
import useSession from '../../services/sales/session/hook';
import { isActive } from '../../utils/common';

const Layout = ({ children }) => {
  return <div>{children}</div>;
};

const Navbar = () => {
  const navigate = useNavigate();
  const { showSummary } = useSidebar();

  const location = useLocation();
  const { pathname } = location;
  const splitLocation = pathname.split('/');

  const selectedChannel = useSelector(state => state?.SalesChannel?.selectedChannel);
  const SalesSession = useSelector(state => state?.SalesSession);
  const User = useSelector(state => state?.Auth?.session?.user);

  const { channels, selectChannel } = useSalesChannel();
  const { summary } = useSession();

  useEffect(() => {
    summary();
  }, []);

  return (
    <div className="navbar bg-base-100 border-secondary font-poppins h-[78px] border-b px-6 py-4">
      <div className="flex-1">
        <img src={logo} alt="logo" className="h-13 w-auto" />
      </div>
      <div className="flex items-center gap-10">
        <ul className="menu menu-horizontal rounded-box items-center gap-2">
          <li>
            <a className={`nav-sb ${isActive(splitLocation[1], '')}`} onClick={() => navigate('/')}>
              <HomeIcon />
              Home
            </a>
          </li>
          <li>
            <a
              className={`nav-sb ${isActive(splitLocation[1], 'membership')}`}
              onClick={() => navigate('/membership')}
            >
              <ListIcon />
              Membership
            </a>
          </li>
          <li>
            <a
              className={`nav-sb ${isActive(splitLocation[1], 'order')}`}
              onClick={() => navigate('/order')}
            >
              <ListIcon />
              Order
            </a>
          </li>

          <li>
            <a
              className={`nav-sb ${isActive(splitLocation[1], 'history')}`}
              onClick={() => navigate('/history')}
            >
              <HistoryIcon />
              History
            </a>
          </li>
          <li>
            <a
              className={`nav-sb ${isActive(splitLocation[1], 'bills')}`}
              onClick={() => navigate('/bills')}
            >
              <ReceiptIcon />
              Bills
            </a>
          </li>

          <li>
            <div className="dropdown dropdown-end hover:!border-primary active:!border-primary !h-9 !w-36 items-center rounded-full border border-white !bg-[var(--color-primary-shadow)] px-6 hover:!border hover:!bg-[var(--color-primary-shadow)] active:!border active:!bg-[var(--color-primary-shadow)] active:!bg-none">
              <div tabIndex={0} className="!text-primary mt-0.5 text-center">
                {selectedChannel?.name}
              </div>
              <ul
                tabIndex={0}
                className="menu dropdown-content rounded-box z-1 mt-4 w-52 bg-white p-2 shadow-sm"
              >
                {channels?.map(channel => (
                  <li key={channel.id}>
                    <a
                      className={`dd-sb ${isActive(selectedChannel?.id, channel?.id)}`}
                      onClick={() => selectChannel(channel)}
                    >
                      {channel?.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        </ul>
        <div className="flex items-center gap-3">
          <div
            className="hover:!border-base-300 hover:!bg-secondary flex !h-9 cursor-pointer items-center rounded-full border border-white bg-[var(--color-base-300)] px-6 text-black"
            onClick={SalesSession?.hasSession ? () => showSummary() : undefined}
          >
            {User?.name}

            <div className="ms-2 inline-grid *:[grid-area:1/1]">
              <div
                className={`status ${SalesSession?.hasSession ? 'status-success' : 'status-error'} animate-ping`}
              ></div>
              <div
                className={`status ${SalesSession?.hasSession ? 'status-success' : 'status-error'}`}
              ></div>
            </div>
          </div>

          <div className="avatar avatar-placeholder">
            <div className="bg-neutral text-neutral-content h-8 w-8 rounded-full">
              <span className="text-xs">UI</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Body = ({ children }) => {
  const location = useLocation();
  const { pathname } = location;
  const splitLocation = pathname.split('/');

  const isMatch = () => {
    if (splitLocation[1] === '') {
      return 'Catalog';
    } else return splitLocation[1];
  };

  return (
    <div className="">
      <div className="bg-white px-4">
        <div className="breadcrumbs text-sm">
          <ul>
            <li className="text-accent">Dashboard</li>
            <li className="text-primary capitalize">{isMatch()}</li>
          </ul>
        </div>
      </div>
      {children}
    </div>
  );
};

Layout.Navbar = Navbar;
Layout.Body = Body;

export default Layout;
