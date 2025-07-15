import React from 'react';
import { useSelector } from 'react-redux';

import { Dialog, NFCField } from '../../../components/ui';
import { BackIcon, CardSearchIcon, SearchIcon, UserCircleIcon } from '../../../components/ui/icon';
import useSidebar from '../../../components/ui/sidebar/hook';
import useCart from '../../../services/cart/hook';
import useMembership from '../../../services/membership/hook';
import useDialogModal from '../../../utils/modal';

const CustomerSection = () => {
  const CartState = useSelector(state => state?.Cart);
  const { showCart } = useSidebar();
  const { setCustomer } = useCart();
  const { getMember, getMemberResult, checkSaldo, checkResult } = useMembership();
  const { dialogRef, open: openModal, close: closeModal, isOpen } = useDialogModal();

  const [search, setSearch] = React.useState('');

  const onLoad = () => {
    getMember({ search });
  };

  const onSelected = data => {
    if (CartState?.meta?.customer?.id === data?.id) {
      setCustomer(null);
    } else {
      setCustomer(data);
    }
    showCart();
  };

  const handleRead = uid => {
    const params = {
      card_id: uid,
    };

    checkSaldo(params);
  };

  React.useEffect(() => {
    const handler = setTimeout(() => {
      onLoad();
    }, 300);

    return () => clearTimeout(handler);
  }, [search]);

  React.useEffect(() => {
    if (checkResult?.isSuccess) {
      let data = checkResult?.data?.data;

      if (data) {
        onSelected(data);
      }
    }
  }, [checkResult]);

  let data = getMemberResult?.data?.data;

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
            onClick={openModal}
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
            {data?.map((d, i) => (
              <div key={i} className="border-base-200 border-b py-4">
                <label className="flex cursor-pointer place-items-center gap-4 capitalize">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary"
                    onChange={() => onSelected(d)}
                    checked={CartState?.meta?.customer?.id === d?.id}
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

      <Dialog.Wrapper ref={dialogRef} className="w-md !rounded-lg">
        <Dialog.Header onClose={closeModal}>
          <div className="text-lg font-semibold">Scan card</div>
        </Dialog.Header>
        <NFCField onRead={handleRead} isOpen={isOpen} onClose={closeModal} result={checkResult} />
      </Dialog.Wrapper>
    </div>
  );
};

export default CustomerSection;
