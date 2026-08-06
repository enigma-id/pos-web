/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useSelector } from 'react-redux';

import { NFCField } from '../../../components/ui';
import { BackIcon, CardSearchIcon, SearchIcon, UserCircleIcon } from '../../../components/ui/icon';
import useModal from '../../../components/ui/modal/hook';
import useSidebar from '../../../components/ui/sidebar/hook';
import useCart from '../../../services/cart/hook';
import useMembership from '../../../services/membership/hook';
import { showMembership } from '../../../utils/cache';

const CustomerSection = () => {
  const CartState = useSelector(state => state?.Cart);
  const isOnline = useSelector(state => state?.Offline?.isOnline);
  const apiReachable = useSelector(state => state?.Offline?.apiReachable);

  const [memberships, setMemberships] = React.useState([]);

  const { openModal, closeModal } = useModal();

  const isOffline = !isOnline || apiReachable === false;

  const { showCart } = useSidebar();

  const { setCustomer } = useCart();
  const { checkSaldo, checkResult, getMember, getMemberResult, membershipData } = useMembership();

  const [search, setSearch] = React.useState('');

  // Search online → panggil endpoint; kosong → baca cache
  React.useEffect(() => {
    const t = setTimeout(
      () => {
        getMember(search ? { search } : {});
      },
      search ? 1000 : 0
    );
    return () => clearTimeout(t);
  }, [search]);

  // Sync sessionData from hook into local state
  React.useEffect(() => {
    if (membershipData || getMemberResult?.isSuccess) {
      setMemberships(membershipData || getMemberResult?.data?.data || []);
    }
  }, [membershipData, getMemberResult]);

  const onSelected = data => {
    const isSameCustomer =
      (CartState?.meta?.customer?.sync_id && CartState?.meta?.customer.sync_id === data?.sync_id) ||
      (CartState?.meta?.customer?.id && CartState?.meta?.customer.id === data?.id);

    if (isSameCustomer) {
      setCustomer(null);
    } else {
      setCustomer(data);
    }

    showCart();
  };

  const handleRead = uid => {
    if (isOffline) {
      const membership = showMembership(uid);
      if (membership) {
        onSelected(membership);
        closeModal();
        showCart();
      } else {
        // Re-open modal → NFCField reconcile (bukan remount), result isError → status 'failed'
        openModal(
          <NFCField onRead={handleRead} isOpen onClose={closeModal} result={{ isError: true }} />,
          'w-md'
        );
      }
    } else {
      const params = { card_id: uid };
      checkSaldo(params);
    }
  };

  const onScan = () => {
    openModal(
      <NFCField onRead={handleRead} isOpen={true} onClose={closeModal} result={checkResult} />,
      'w-md'
    );
  };

  React.useEffect(() => {
    if (checkResult?.isSuccess) {
      let data = checkResult?.data?.data;

      if (data) {
        onSelected(data);
        closeModal();
        showCart();
      }
    }
  }, [checkResult]);

  return (
    <div className="border-base-200 bg-base-100 flex h-screen flex-col border-l">
      <div className="border-base-200 flex h-16 items-center gap-4 border-b px-6">
        <div className="btn btn-md btn-outline btn-circle border-base-200" onClick={showCart}>
          <BackIcon />
        </div>
        <h2 className="text-lg font-bold">Add Customer to bill</h2>
      </div>

      <div>
        <div className="border-base-200 flex h-16 place-items-center border-b">
          <div className="border-base-200 h-full flex-2/3 border-r">
            <div className="relative flex h-full w-full items-center">
              <div className="absolute left-4">
                <SearchIcon />
              </div>
              <input
                name="search"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-full w-full pl-15 focus-visible:!outline-none"
              />
            </div>
          </div>

          <div
            className="bg-primary/10 text-primary flex h-full flex-1/3 cursor-pointer place-content-center place-items-center gap-2"
            onClick={onScan}
          >
            <CardSearchIcon /> Scan card
          </div>
        </div>

        {getMemberResult?.isFetching ? (
          <div className="flex w-full place-content-center place-items-center py-4">
            <span className="loading loading-dots loading-xl"></span>
          </div>
        ) : (
          <div className="px-4">
            {memberships
              .filter(item => {
                if (!search) return true;
                const q = search.toLowerCase();
                return (
                  (item?.name || '').toLowerCase().includes(q) ||
                  (item?.reff_code || '').toLowerCase().includes(q)
                );
              })
              ?.map((d, i) => (
                <div key={i} className="border-base-200 border-b py-4">
                  <label className="flex cursor-pointer place-items-center gap-4 capitalize">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary"
                      onChange={() => onSelected(d)}
                      checked={
                        (CartState?.meta?.customer?.sync_id &&
                          CartState?.meta?.customer?.sync_id === d?.sync_id) ||
                        (CartState?.meta?.customer?.id &&
                          CartState?.meta?.customer?.id === d?.card_id)
                      }
                    />
                    <div className="flex gap-2">
                      <UserCircleIcon />
                      <div>
                        <div className="text-base font-semibold">{d?.name || '-'}</div>
                        <div className="text-base-300 text-xs">{d?.reff_code}</div>
                      </div>
                    </div>
                  </label>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerSection;
