/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useSelector } from 'react-redux';

import { Input } from '../../../components/ui';
import { ChevronDownIcon, PlusIcon } from '../../../components/ui/icon';
import useCatalog from '../../../services/catalog/hooks';
import { currencyFormat, isActive } from '../../../utils/common';

const CreateSection = ({ onClose }) => {
  const dropdownRef = React.useRef(null);
  const FormState = useSelector(state => state?.Form);

  const [isOpen, setIsOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [price, setPrice] = React.useState(0);
  const [category, setCategory] = React.useState(null);

  const { getCategory, categoriesResult, create, createResult } = useCatalog();

  const onSubmit = () => {
    const payload = {
      name,
      price: Number(price),
      category_id: category?.id,
    };

    create(payload);
  };

  React.useEffect(() => {
    getCategory();
  }, []);

  React.useEffect(() => {
    if (createResult?.isSuccess) {
      setName('');
      setPrice(0);
      setCategory(null);
      onClose();
    }
  }, [createResult]);

  const categories = categoriesResult?.data?.data;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-3">
          <div className="text-sm">Catalog name</div>
          <Input
            value={name}
            onChange={e => setName(e?.target?.value)}
            error={FormState?.errors?.name}
          />
        </div>
        <div>
          <div className="text-sm">Catalog price</div>
          <Input
            value={currencyFormat(price)}
            onChange={e => {
              const raw = e.target.value.replace(/[^0-9]/g, '');
              setPrice(raw);
            }}
            error={FormState?.errors?.price}
          />
        </div>
        <div className="py-4">
          <div className="text-sm">Catalog category</div>
          <div
            ref={dropdownRef}
            tabIndex={0}
            className="dropdown dropdown-end border-base-200 bg-accent mt-2 w-full cursor-pointer place-content-center rounded border px-4 py-3"
          >
            <div
              className="hover:text-primary flex place-content-between"
              onClick={() => setIsOpen(prev => !prev)}
            >
              <div className="text-left !text-base">{category?.name}</div>
              <ChevronDownIcon
                className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
              />
            </div>
            {isOpen && (
              <ul className="menu dropdown-content rounded-box bg-base-100 z-1 mt-4 w-full p-2 shadow-sm">
                {categories?.map(cat => (
                  <li key={cat.id}>
                    <a
                      className={`category ${isActive(category?.id, cat?.id)}`}
                      onClick={() => {
                        setCategory(cat);
                        setIsOpen(false);
                      }}
                    >
                      {cat?.name}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {FormState?.errors?.category_id && (
            <small className="text-error">{FormState?.errors?.category_id}</small>
          )}
        </div>
      </div>

      <div className="border-base-200 min-h-15 border-t">
        <div className="btn btn-primary btn-block h-full rounded-none border-0" onClick={onSubmit}>
          <PlusIcon /> Create new catalog
        </div>
      </div>
    </div>
  );
};

export default CreateSection;
