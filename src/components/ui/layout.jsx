/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import logo from '../../assets/logo.png';

import { isActive } from '../../utils/common';

import useSalesChannel from '../../services/sales/channel/hook';
import useSession from '../../services/sales/session/hook';
import useSidebar from './sidebar/hook';

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
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M0.953534 5.61072L7.4175 0.546889C8.3483 -0.182297 9.6517 -0.182297 10.5825 0.546889L17.0465 5.61072C17.8043 6.20439 18 7.09585 18 8.12448C18 8.12448 17.7639 11.7691 16.5949 15.9084C16.2173 16.9615 15.3289 18 14.1067 18H12.918C12.1777 18 11.4713 17.3956 11.4713 16.65L11.5776 13.846C11.5776 12.4122 10.4236 11.2498 9 11.2498C7.57642 11.2498 6.42239 12.4122 6.42239 13.846L6.54168 16.65C6.54168 17.3956 5.82229 18 5.08203 18H3.89335C2.6711 18 1.78269 16.9615 1.40511 15.9084C0.236125 11.7691 0 8.12448 0 8.12448C-1.11656e-05 7.09585 0.195708 6.20439 0.953534 5.61072Z"
                  fill="currentColor"
                />
              </svg>
              Home
            </a>
          </li>
          <li>
            <a
              className={`nav-sb ${isActive(splitLocation[1], 'membership')}`}
              onClick={() => navigate('/membership')}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M14 20.9617C11.4757 21.0582 9.16166 20.9724 6.23865 20.7048C5.19543 20.6092 4.36239 19.736 4.26588 18.6277C3.87042 14.0861 3.94716 10.903 4.292 6.41419C4.37877 5.28469 5.21856 4.38258 6.28078 4.28634C10.4928 3.90469 13.4667 3.9038 17.7331 4.28821C18.7928 4.38368 19.6326 5.28098 19.7203 6.4076C19.9822 9.77112 20.0688 12.3867 19.9433 15.3485M14 20.9617L19.9433 15.3485M14 20.9617V17.8485C14 16.4678 15.1193 15.3485 16.5 15.3485H19.9433M8 3V5.5M16 3V5.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path d="M8 9.5H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M8 13H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Membership
            </a>
          </li>
          <li>
            <a
              className={`nav-sb ${isActive(splitLocation[1], 'order')}`}
              onClick={() => navigate('/order')}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M14 20.9617C11.4757 21.0582 9.16166 20.9724 6.23865 20.7048C5.19543 20.6092 4.36239 19.736 4.26588 18.6277C3.87042 14.0861 3.94716 10.903 4.292 6.41419C4.37877 5.28469 5.21856 4.38258 6.28078 4.28634C10.4928 3.90469 13.4667 3.9038 17.7331 4.28821C18.7928 4.38368 19.6326 5.28098 19.7203 6.4076C19.9822 9.77112 20.0688 12.3867 19.9433 15.3485M14 20.9617L19.9433 15.3485M14 20.9617V17.8485C14 16.4678 15.1193 15.3485 16.5 15.3485H19.9433M8 3V5.5M16 3V5.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path d="M8 9.5H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M8 13H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Order
            </a>
          </li>

          <li>
            <a
              className={`nav-sb ${isActive(splitLocation[1], 'history')}`}
              onClick={() => navigate('/history')}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M12 6.5V11.9586C12 11.9851 11.9895 12.0105 11.9707 12.0293L9 15"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              History
            </a>
          </li>
          <li>
            <a
              className={`nav-sb ${isActive(splitLocation[1], 'bills')}`}
              onClick={() => navigate('/bills')}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M18.5 3C19.4665 3 20.5 3.5 20.5 4.78736V9.10674C20.5 9.38877 20.2761 9.61741 20 9.61741H17M18.5 3C17.5335 3 17 3.80023 17 4.78736V9.61741M18.5 3H6C4.61929 3 3.5 4.14318 3.5 5.55337V19.6891C3.5 20.1142 3.98497 20.3505 4.31235 20.085L5.63161 19.0149C5.83843 18.8471 6.13841 18.872 6.3156 19.0716L7.87835 20.8322C8.07697 21.0559 8.42303 21.0559 8.62165 20.8322L10.1284 19.1347C10.327 18.911 10.673 18.911 10.8716 19.1347L12.3293 20.777C12.5445 21.0194 12.9262 20.9957 13.1106 20.7285L14.1943 19.1588C14.3599 18.919 14.6908 18.8708 14.9163 19.0537L16.1877 20.085C16.515 20.3505 17 20.1142 17 19.6891V9.61741"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M6.75 8.5H13.75"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M6.75 11.5H13.75"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M6.75 14.5H11.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
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
