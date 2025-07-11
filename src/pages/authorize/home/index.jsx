import React from 'react';

import Cart from './cart';
import CloseSection from './closeSession';
import DetailScreen from './detail';
import OpenSection from './openSession';
import { CardSearchIcon, SearchIcon } from '../../../components/ui/icon';
import useSidebar from '../../../components/ui/sidebar/hook';
import useCatalog from '../../../services/catalog/hooks';
import { currencyFormat, isActive } from '../../../utils/common';
import useDialogModal from '../../../utils/modal';

const CatalogScreen = () => {
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

  const [catalogSelected, setCatalogSelected] = React.useState(null);
  const [editKey, setEditKey] = React.useState(null);

  const { dialogRef, open, close } = useDialogModal({
    onClose: () => {
      setCatalogSelected(null);
      setEditKey(null);
    },
  });

  const onShow = (data, index = null) => {
    setCatalogSelected(data);
    setEditKey(index);
    open();
  };

  return (
    <div className="flex">
      <div className="relative flex-1">
        {/* Header Search & Categories */}
        <div className="border-secondary flex h-[62px] border-t border-b bg-white">
          <div className="border-secondary flex-1/2 border-r">
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
          <div className="flex-1/2 overflow-x-auto overflow-y-hidden">
            <div className="flex items-center gap-5 px-6 py-4">
              <div
                className={`categories ${isActive(selectedCategory, null)}`}
                onClick={() => onSelectCategory(null)}
              >
                All
              </div>
              {categories?.map(category => (
                <div
                  key={category?.id}
                  className={`categories ${isActive(selectedCategory, category?.id)}`}
                  onClick={() => onSelectCategory(category?.id)}
                >
                  {category?.name}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Catalog List */}
        <div className="flex h-[calc(100vh-178px)] flex-col">
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
                      src={cat?.image}
                      alt={cat?.name}
                      className="bg-secondary h-full w-full rounded-xl object-cover"
                    />
                  </div>
                  <div className="py-2">
                    <div className="overflow-hidden text-center font-semibold text-ellipsis">
                      {cat?.name}
                    </div>
                    <div className="text-primary text-center text-[16px] font-semibold">
                      {currencyFormat(cat?.unit_price || 0)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detail Modal */}
          <dialog ref={dialogRef} className="modal">
            <DetailScreen
              catalog={catalogSelected}
              mode={editKey !== null ? 'edit' : 'add'}
              editKey={editKey}
              onClose={close}
            />
          </dialog>
        </div>

        <div className="absolute bottom-5 left-5">
          <div
            className="btn btn-circle btn-xl btn-info btn-outline hover:!text-info bg-white shadow-lg"
            onClick={() => refreshCatalog()}
          >
            <CardSearchIcon />
          </div>
        </div>
      </div>

      <div className="w-100">
        {mode === 'cart' && <Cart onUpdate={(item, index) => onShow(item, index)} />}
        {mode === 'summary' && <CloseSection />}
        {mode === 'open_session' && <OpenSection />}
      </div>
    </div>
  );
};

export default CatalogScreen;
