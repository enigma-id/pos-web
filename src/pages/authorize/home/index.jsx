import React from 'react';

import useCatalog from '../../../services/catalog/hooks';
import { currencyFormat, isActive } from '../../../utils/common';
import useDialogModal from '../../../utils/modal';
import useSidebar from '../../../components/ui/sidebar/hook';

import DetailScreen from './detail';
import Cart from './cart';
import OpenSection from './openSession';
import CloseSection from './closeSession';

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

  const { dialogRef, open, close } = useDialogModal({
    onClose: () => setCatalogSelected(null),
  });

  const onShow = data => {
    setCatalogSelected(data);
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
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M17.3556 17.3658C18.8279 15.8961 19.7388 13.8641 19.7388 11.6194C19.7388 7.13518 16.1036 3.5 11.6194 3.5C7.13518 3.5 3.5 7.13518 3.5 11.6194C3.5 16.1036 7.13518 19.7388 11.6194 19.7388C13.8589 19.7388 15.8866 18.8321 17.3556 17.3658ZM17.3556 17.3658L20.5 20.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
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
                  onClick={mode === 'open_session' ? false : () => onShow(cat)}
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
              onClose={() => {
                close(); // close dari hook
              }}
            />
          </dialog>
        </div>

        {/* <div className="max-h-[calc(100vh-178px)] overflow-x-auto">
          <div className="flex flex-wrap place-content-center place-items-center gap-2 py-4">
            {catalog?.map(cat => (
              <div
                key={cat?.id}
                className="catalog-card"
                onClick={mode === 'open_session' ? false : () => onShow(cat)}
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
        </div> */}

        <div className="absolute bottom-5 left-5">
          <div
            className="btn btn-circle btn-xl btn-info btn-outline hover:!text-info bg-white shadow-lg"
            onClick={() => refreshCatalog()}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                opacity="0.5"
                d="M10 20H13.627C13.2014 19.4512 12.8889 18.8235 12.7076 18.1531C12.5262 17.4828 12.4797 16.7831 12.5707 16.0946C12.6617 15.4061 12.8884 14.7425 13.2376 14.1423C13.5869 13.542 14.0517 13.017 14.6053 12.5977C15.1588 12.1783 15.7901 11.873 16.4625 11.6993C17.1349 11.5256 17.835 11.487 18.5224 11.5858C19.2098 11.6847 19.8708 11.9189 20.467 12.2749C21.0633 12.6309 21.583 13.1017 21.996 13.66C21.9987 13.1533 22 12.6 22 12C22 11.558 22 10.392 21.998 10H2.002C2 10.392 2 11.558 2 12C2 15.771 2 17.657 3.172 18.828C4.344 19.999 6.229 20 10 20Z"
                fill="currentColor"
              />
              <path
                d="M5.25 16C5.25 15.8011 5.32902 15.6103 5.46967 15.4697C5.61032 15.329 5.80109 15.25 6 15.25H10C10.1989 15.25 10.3897 15.329 10.5303 15.4697C10.671 15.6103 10.75 15.8011 10.75 16C10.75 16.1989 10.671 16.3897 10.5303 16.5303C10.3897 16.671 10.1989 16.75 10 16.75H6C5.80109 16.75 5.61032 16.671 5.46967 16.5303C5.32902 16.3897 5.25 16.1989 5.25 16Z"
                fill="currentColor"
              />
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M17.75 14.4998C17.1533 14.4998 16.581 14.7369 16.159 15.1588C15.7371 15.5808 15.5 16.1531 15.5 16.7498C15.5 17.3466 15.7371 17.9189 16.159 18.3408C16.581 18.7628 17.1533 18.9998 17.75 18.9998C18.3467 18.9998 18.919 18.7628 19.341 18.3408C19.7629 17.9189 20 17.3466 20 16.7498C20 16.1531 19.7629 15.5808 19.341 15.1588C18.919 14.7369 18.3467 14.4998 17.75 14.4998ZM14 16.7498C14.0002 16.1651 14.1371 15.5886 14.3997 15.0663C14.6624 14.5439 15.0436 14.0902 15.5128 13.7414C15.9821 13.3926 16.5264 13.1583 17.1023 13.0573C17.6782 12.9564 18.2697 12.9914 18.8296 13.1597C19.3895 13.3281 19.9023 13.625 20.3271 14.0268C20.7518 14.4286 21.0767 14.9242 21.2758 15.4739C21.475 16.0236 21.5428 16.6123 21.4739 17.1929C21.405 17.7735 21.2013 18.33 20.879 18.8178L21.78 19.7198C21.8537 19.7885 21.9128 19.8713 21.9538 19.9633C21.9948 20.0553 22.0168 20.1546 22.0186 20.2553C22.0204 20.356 22.0018 20.456 21.9641 20.5494C21.9264 20.6428 21.8703 20.7276 21.799 20.7989C21.7278 20.8701 21.643 20.9262 21.5496 20.9639C21.4562 21.0017 21.3562 21.0202 21.2555 21.0184C21.1548 21.0166 21.0555 20.9946 20.9635 20.9536C20.8715 20.9126 20.7887 20.8535 20.72 20.7798L19.818 19.8788C19.2528 20.2525 18.5969 20.466 17.92 20.4967C17.2431 20.5274 16.5705 20.3742 15.9738 20.0532C15.377 19.7323 14.8784 19.2557 14.5309 18.674C14.1833 18.0924 13.9999 17.4274 14 16.7498Z"
                fill="currentColor"
              />
              <path
                d="M9.995 4H14.005C17.786 4 19.677 4 20.851 5.116C21.697 5.919 21.934 7.076 22 9V10H2V9C2.066 7.075 2.303 5.92 3.149 5.116C4.323 4 6.214 4 9.995 4Z"
                fill="currentColor"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="w-100">
        {mode === 'cart' && <Cart onUpdate={onShow} />}
        {mode === 'summary' && <CloseSection />}
        {mode === 'open_session' && <OpenSection />}
      </div>
    </div>
  );
};

export default CatalogScreen;
