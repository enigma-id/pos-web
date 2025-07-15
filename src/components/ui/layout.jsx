/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import { BurgerIcon, HistoryIcon, ListIcon, MenuIcon, ReceiptIcon, UserIcon } from './icon';
import useSidebar from './sidebar/hook';
import useSession from '../../services/sales/session/hook';
import { isActive } from '../../utils/common';

const Layout = ({ children }) => {
  return <div className="flex h-screen w-screen">{children}</div>;
};

// const Navbar = () => {
//   const navigate = useNavigate();
//   const { showSummary } = useSidebar();

//   const location = useLocation();
//   const { pathname } = location;
//   const splitLocation = pathname.split('/');

// const selectedChannel = useSelector(state => state?.SalesChannel?.selectedChannel);
//   const SalesSession = useSelector(state => state?.SalesSession);
//   const User = useSelector(state => state?.Auth?.session?.user);

//   const { channels, selectChannel } = useSalesChannel();
// const { summary } = useSession();

// useEffect(() => {
//   summary();
// }, []);

//   return (
//     <div className="navbar bg-base-100 border-base-200 font-poppins h-[78px] border-b px-6 py-4">
//       <div className="flex-1">
//         <img src={logo} alt="logo" className="h-13 w-auto" />
//       </div>
//       <div className="flex items-center gap-10">
//         <ul className="menu menu-horizontal rounded-box items-center gap-2">
//           <li>
//             <a className={`nav-sb ${isActive(splitLocation[1], '')}`} onClick={() => navigate('/')}>
//               <HomeIcon />
//               Home
//             </a>
//           </li>
//           <li>
//             <a
//               className={`nav-sb ${isActive(splitLocation[1], 'membership')}`}
//               onClick={() => navigate('/membership')}
//             >
//               <ListIcon />
//               Membership
//             </a>
//           </li>
//           <li>
//             <a
//               className={`nav-sb ${isActive(splitLocation[1], 'order')}`}
//               onClick={() => navigate('/order')}
//             >
//               <ListIcon />
//               Order
//             </a>
//           </li>

//           <li>
//             <a
//               className={`nav-sb ${isActive(splitLocation[1], 'history')}`}
//               onClick={() => navigate('/history')}
//             >
//               <HistoryIcon />
//               History
//             </a>
//           </li>
//           <li>
//             <a
//               className={`nav-sb ${isActive(splitLocation[1], 'bills')}`}
//               onClick={() => navigate('/bills')}
//             >
//               <ReceiptIcon />
//               Bills
//             </a>
//           </li>

//           <li>
//             <div className="dropdown dropdown-end hover:!border-primary active:!border-primary !h-9 !w-36 items-center rounded-full border border-white !bg-[var(--color-primary-shadow)] px-6 hover:!border hover:!bg-[var(--color-primary-shadow)] active:!border active:!bg-[var(--color-primary-shadow)] active:!bg-none">
//               <div tabIndex={0} className="!text-primary mt-0.5 text-center">
//                 {selectedChannel?.name}
//               </div>
//               <ul
//                 tabIndex={0}
//                 className="menu dropdown-content rounded-box bg-base-100 z-1 mt-4 w-52 p-2 shadow-sm"
//               >
//                 {channels?.map(channel => (
//                   <li key={channel.id}>
//                     <a
//                       className={`dd-sb ${isActive(selectedChannel?.id, channel?.id)}`}
//                       onClick={() => selectChannel(channel)}
//                     >
//                       {channel?.name}
//                     </a>
//                   </li>
//                 ))}
//               </ul>
//             </div>
//           </li>
//         </ul>
//         <div className="flex items-center gap-3">
//           <div
//             className="hover:!border-base-200 hover:!bg-secondary flex !h-9 cursor-pointer items-center rounded-full border border-white bg-[var(--color-base-300)] px-6 text-black"
//             onClick={SalesSession?.hasSession ? () => showSummary() : undefined}
//           >
//             {User?.name}

//             <div className="ms-2 inline-grid *:[grid-area:1/1]">
//               <div
//                 className={`status ${SalesSession?.hasSession ? 'status-success' : 'status-error'} animate-ping`}
//               ></div>
//               <div
//                 className={`status ${SalesSession?.hasSession ? 'status-success' : 'status-error'}`}
//               ></div>
//             </div>
//           </div>

//           <div className="avatar avatar-placeholder">
//             <div className="bg-neutral text-neutral-content h-8 w-8 rounded-full">
//               <span className="text-xs">UI</span>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

const Navbar = () => {
  const navigate = useNavigate();
  const User = useSelector(state => state?.Auth?.session?.user);
  const SalesSession = useSelector(state => state?.SalesSession);

  const { summary } = useSession();
  const { showSummary } = useSidebar();

  const [expand, setExpand] = useState(false);

  const location = useLocation();
  const { pathname } = location;
  const splitLocation = pathname.split('/');

  useEffect(() => {
    summary();
  }, []);

  return (
    <div
      className={`nav-container flex flex-1 flex-col shadow transition-all duration-200 ease-in-out ${expand ? 'expand' : ''}`}
    >
      <div className={`flex-1`}>
        <div className={`nav-items ${expand ? 'expand' : ''}`} onClick={() => setExpand(!expand)}>
          <BurgerIcon />
        </div>
        <div
          className={`nav-items mb-3 ${expand ? 'expand' : 'place-items-center'} ${isActive(splitLocation[1], '')}`}
          onClick={() => navigate('/')}
        >
          <MenuIcon />
          <small>Menu</small>
        </div>

        <div
          className={`nav-items mb-3 ${expand ? 'expand' : 'place-items-center'} ${isActive(splitLocation[1], 'membership')}`}
          onClick={() => navigate('/membership')}
        >
          <UserIcon />
          <small>Member</small>
        </div>

        {User?.is_supervisor === 1 && (
          <div
            className={`nav-items mb-3 ${expand ? 'expand' : 'place-items-center'} ${isActive(splitLocation[1], 'shifts')}`}
            onClick={() => navigate('/shifts')}
          >
            <ListIcon />
            <small>Shifts</small>
          </div>
        )}

        <div
          className={`nav-items mb-3 ${expand ? 'expand' : 'place-items-center'} ${isActive(splitLocation[1], 'history')}`}
          onClick={() => navigate('/history')}
        >
          <HistoryIcon />
          <small>History</small>
        </div>

        <div
          className={`nav-items mb-3 ${expand ? 'expand' : 'place-items-center'} ${isActive(splitLocation[1], 'bills')}`}
          onClick={() => navigate('/bills')}
        >
          <ReceiptIcon />
          <small>Saved Bills</small>
        </div>
      </div>

      <div className="mb-5">
        <div
          className={`nav-items mb-3 ${expand ? 'expand' : 'place-items-center'}`}
          onClick={SalesSession?.hasSession ? () => showSummary() : undefined}
        >
          <div className="indicator">
            <span
              className={`indicator-item status ${SalesSession?.hasSession ? 'status-success' : 'status-error'} animate-ping`}
            ></span>
            <div className={`flex place-items-center ${expand ? 'flex-row gap-2' : 'flex-col'}`}>
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
