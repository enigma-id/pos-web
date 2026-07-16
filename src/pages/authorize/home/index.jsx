import React from 'react';
import { useSelector } from 'react-redux';

import Cart from './cart';
import CloseSection from './closeSession';
import CreateSection from './create';
import CustomerSection from './customer';
import DetailScreen from './detail';
import OpenSection from './openSession';
import { Drawer } from '../../../components/ui';
import { ChevronDownIcon, PlusIcon, RefreshIcon, SearchIcon } from '../../../components/ui/icon';
import useModal from '../../../components/ui/modal/hook';
import useSidebar from '../../../components/ui/sidebar/hook';
import useCatalog from '../../../services/catalog/hooks';
import useSalesChannel from '../../../services/sales/channel/hook';
import { currencyFormat, isActive } from '../../../utils/common';
import useDrawer from '../../../utils/drawer';

const CatalogScreen = () => {
  const dropdownRef = React.useRef(null);
  const dropdownRefs = React.useRef(null);
  const selectedChannel = useSelector(state => state?.SalesChannel?.selectedChannel);
  const User = useSelector(state => state?.Auth?.session?.user);

  const {
    refreshCatalog,
    catalog,
    categories,
    selectedCategory,
    onSelectCategory,
    onSearch,
    searchTerm,
  } = useCatalog();

  const { mode } = useSidebar();
  const { channels, selectChannel } = useSalesChannel();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isOpens, setIsOpens] = React.useState(false);

  const { drawerRef, open: openDrawer, close: closeDrawer } = useDrawer();
  const { openModal, closeModal } = useModal();

  const onShow = (data, index = null) => {
    handleModal({ catalog: data, key: index });
  };

  const handleModal = ({ catalog, key }) => {
    openModal(
      <DetailScreen
        catalog={catalog}
        mode={key !== null ? 'edit' : 'add'}
        editKey={key}
        onClose={closeModal}
      />
    );
  };

  React.useEffect(() => {
    const handleClickOutside = event => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  React.useEffect(() => {
    const handleClickOutside2 = event => {
      if (dropdownRefs.current && !dropdownRefs.current.contains(event.target)) {
        setIsOpens(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside2);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside2);
    };
  }, []);

  return (
    <Drawer.Wrapper>
      <div className="flex">
        <div className="relative flex-1">
          {/* Header Search & Categories */}
          <div className="border-base-200 bg-base-100 flex h-16 border-t border-b">
            <div
              ref={dropdownRefs}
              tabIndex={0}
              className="dropdown dropdown-end w-3xs cursor-pointer place-content-center"
            >
              <div className="hover:text-primary flex" onClick={() => setIsOpens(prev => !prev)}>
                <img src="/rabbit.png" className="h-12 w-auto object-contain" />
                <div className="flex flex-col place-content-center">
                  <div className="text-left !text-lg font-semibold">{selectedChannel?.name}</div>
                  <small className="text-xs font-thin">Suka Bread</small>
                </div>
              </div>
              {isOpens && (
                <ul className="menu dropdown-content rounded-box bg-base-100 z-1 w-full p-2 shadow-sm">
                  {channels?.map(channel => (
                    <li key={channel.id}>
                      <a
                        className={`category ${isActive(selectedChannel?.id, channels?.id)}`}
                        onClick={() => {
                          selectChannel(channel);
                          setIsOpens(false);
                        }}
                      >
                        {channel?.name}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-base-200 flex-3/4 border-r border-l">
              <div className="relative flex h-full w-full items-center">
                <div className="absolute left-4">
                  <SearchIcon />
                </div>

                <input
                  name="search"
                  placeholder="Search menu ..."
                  value={searchTerm}
                  onChange={e => onSearch(e.target.value)}
                  className="h-full w-full pl-15 focus-visible:!outline-none"
                />
              </div>
            </div>
            <div
              ref={dropdownRef}
              tabIndex={0}
              className="dropdown dropdown-end flex-1/4 cursor-pointer place-content-center px-4"
            >
              <div
                className="hover:text-primary flex place-content-between"
                onClick={() => setIsOpen(prev => !prev)}
              >
                <div className="text-left !text-lg font-semibold">{selectedCategory?.name}</div>
                <ChevronDownIcon
                  className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
                />
              </div>
              {isOpen && (
                <ul className="menu dropdown-content rounded-box bg-base-100 z-1 mt-4 w-full p-2 shadow-sm">
                  {categories?.map(category => (
                    <li key={category.id}>
                      <a
                        className={`category ${isActive(selectedCategory?.id, category?.id)}`}
                        onClick={() => {
                          onSelectCategory(category);
                          setIsOpen(false);
                        }}
                      >
                        {category?.name}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Catalog List */}
          <div className="flex h-[calc(100vh-64px)] w-full flex-col">
            <div className="flex-1 overflow-auto">
              <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {catalog?.map(cat => (
                  <div
                    key={cat?.id}
                    className="catalog-card"
                    onClick={mode === 'open_session' ? false : () => onShow(cat, null)}
                  >
                    <div className="catalog-img">
                      <img
                        src={cat?.image || '/placeholder.svg'}
                        alt={cat?.name}
                        className="bg-secondary h-full w-full rounded-xl object-cover"
                        onError={e => {
                          if (e.target.src !== '/placeholder.svg') {
                            e.target.src = '/placeholder.svg';
                          }
                        }}
                      />
                    </div>
                    <div className="py-2">
                      <div className="overflow-hidden text-center font-semibold text-ellipsis">
                        {cat?.name || '{custom catalog}'}
                      </div>
                      <div className="text-primary text-center text-[16px] font-semibold">
                        {currencyFormat(
                          cat?.unit_price,
                          undefined,
                          cat?.is_custom ? '{custom price}' : 'Free'
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="absolute bottom-5 left-5 flex flex-col gap-2">
            <div
              className="btn btn-circle btn-xl btn-info btn-outline hover:!text-info bg-base-100 shadow-lg"
              onClick={() => refreshCatalog()}
            >
              <RefreshIcon />
            </div>

            {User?.role === "manager" && (
              <div className="btn btn-circle btn-xl btn-primary" onClick={openDrawer}>
                <PlusIcon />
              </div>
            )}
          </div>
        </div>

        <div className="w-100 transition-all duration-300 ease-in-out">
          <div key={mode} className="animate-fade-slide">
            {mode === 'cart' && <Cart onUpdate={(item, index) => onShow(item, index)} />}
            {mode === 'summary' && <CloseSection />}
            {mode === 'open_session' && <OpenSection />}
            {mode === 'bill_customer' && <CustomerSection />}
          </div>
        </div>
      </div>

      <Drawer.Content drawerRef={drawerRef} title={'Create new catalog'} close={closeDrawer}>
        <CreateSection
          onClose={() => {
            closeDrawer();
            refreshCatalog();
          }}
        />
      </Drawer.Content>
    </Drawer.Wrapper>
  );
};

export default CatalogScreen;
