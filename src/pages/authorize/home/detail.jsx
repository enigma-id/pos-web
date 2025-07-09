import React from 'react';
import { useDispatch } from 'react-redux';

import useCart from '../../../services/cart/hook';
import { currencyFormat } from '../../../utils/common';
import { QuantityStepper } from '../../../components/ui';
import { addItem, changeItem } from '../../../services/cart/slice';

const DetailScreen = ({ catalog, onClose }) => {
  const dispatch = useDispatch();

  const { catalogDetail, isItemInCart, existingItem, existingIndex } = useCart(catalog?.id);

  const [catalogData, setCatalogData] = React.useState({});
  const [quantity, setQuantity] = React.useState(0);
  const [additionals, setAdditionals] = React.useState([]);

  React.useEffect(() => {
    if (!catalogDetail) return;

    // ambil struktur lengkap dari katalog
    setCatalogData({
      ...catalogDetail,
      unit_price: catalogDetail.unit_price || catalog?.unit_price || 0,
    });

    setQuantity(existingItem?.quantity || 0);

    const additions = (catalogDetail?.additionals || []).map(add => {
      const cartAddon = existingItem?.additionals?.find(a => a.id === add.id);

      return {
        ...add,
        childs: (add?.childs || []).map(child => {
          const cartChild = cartAddon?.childs?.find(c => c.id === child.id);

          return {
            ...child,
            quantity: add.type === 'quantity' ? cartChild?.quantity || 0 : cartChild ? 1 : 0,
            selected: add.type !== 'quantity' ? !!cartChild?.selected : false,
          };
        }),
      };
    });

    setAdditionals(additions);
  }, [catalogDetail, existingItem, catalog]);

  const addToCart = () => {
    if (!catalogDetail) return;

    const formattedItem = {
      ...catalogData,
      quantity: quantity,
      additionals: additionals,
      subtotal: calculateSubtotal(),
    };

    if (isItemInCart) {
      dispatch(changeItem({ key: existingIndex, catalog: formattedItem }));
    } else {
      dispatch(addItem(formattedItem));
    }

    onClose();
  };

  const updateQuantity = (addonId, childId, qty) => {
    setAdditionals(prev =>
      prev.map(add =>
        add?.id !== addonId
          ? add
          : {
              ...add,
              childs: add?.childs?.map(c => (c.id !== childId ? c : { ...c, quantity: qty })),
            }
      )
    );
  };

  const selectOption = (addonId, selectedChildId) => {
    setAdditionals(prev =>
      prev.map(add => {
        if (add?.id !== addonId) return add;

        const isAlreadySelected = add?.childs?.some(
          child => child?.id === selectedChildId && child?.selected
        );

        return {
          ...add,
          childs: (add?.childs || []).map(child => ({
            ...child,
            selected: isAlreadySelected
              ? false // toggle off jika sudah dipilih
              : child.id === selectedChildId,
            quantity: isAlreadySelected ? 0 : child.id === selectedChildId ? 1 : 0,
          })),
        };
      })
    );
  };

  const toggleCheckbox = (addonId, childId, checked) => {
    setAdditionals(prev =>
      prev.map(add =>
        add?.id !== addonId
          ? add
          : {
              ...add,
              childs: add?.childs?.map(c =>
                c.id !== childId
                  ? c
                  : {
                      ...c,
                      selected: checked,
                      quantity: checked ? 1 : 0,
                    }
              ),
            }
      )
    );
  };

  const calculateSubtotal = () => {
    let total = quantity * (catalogDetail?.unit_price || 0);

    additionals.forEach(add => {
      add.childs?.forEach(child => {
        if (add.type === 'quantity' && child?.quantity > 0) {
          total += quantity * child?.quantity * (child?.unit_price || 0);
        }

        if (add.type !== 'quantity' && child.selected) {
          total += quantity * (child.unit_price || 0);
        }
      });
    });

    return total;
  };

  return (
    <div className="card card-side bg-base-100 min-h-1/3 shadow-sm">
      <figure className="bg-secondary w-90">
        <img src={catalogData?.image} alt={catalogData?.name} />
      </figure>
      <div className="card-body min-w-120 justify-between">
        <div>
          <div className="border-secondary mb-3 border-b border-dashed pb-3">
            <h2 className="card-title">{catalogData?.name}</h2>
            <p className="text-primary text-end text-xl font-semibold">
              {currencyFormat(catalogData?.unit_price)}
            </p>
          </div>

          <div>
            {additionals.map(
              add =>
                add?.childs?.length > 0 && (
                  <div key={add?.id} className="border-secondary mb-4 border-b border-dashed pb-3">
                    <p className="mb-2 font-semibold">{add?.name}</p>

                    {add?.type === 'quantity' &&
                      add?.childs?.map(child => (
                        <div key={child?.id} className="mb-2 flex items-center justify-between">
                          <span>{child?.name}</span>

                          <div className="flex items-center">
                            <span className="text-primary me-3 text-sm">
                              {child?.unit_price
                                ? `@ ${currencyFormat(child?.unit_price)}`
                                : 'Free'}
                            </span>
                            <QuantityStepper
                              small
                              value={child?.quantity || 0}
                              onChange={val => updateQuantity(add?.id, child?.id, val)}
                            />
                          </div>
                        </div>
                      ))}

                    {add?.type === 'options' &&
                      add?.childs?.map(child => {
                        const inputId = `option-${add?.id}-${child?.id}`;

                        return (
                          <label
                            key={child?.id}
                            htmlFor={inputId}
                            className="mb-2 flex cursor-pointer items-center justify-between"
                          >
                            <span>{child?.name}</span>

                            <div>
                              <span className="text-primary me-3 text-sm">
                                {child?.unit_price
                                  ? `@ ${currencyFormat(child?.unit_price)}`
                                  : 'Free'}
                              </span>
                              <input
                                id={inputId}
                                type="checkbox"
                                name={`options-${add?.id}`}
                                checked={child?.selected}
                                onChange={() => selectOption(add?.id, child?.id)}
                                className="radio radio-primary h-5 w-5"
                              />
                            </div>
                          </label>
                        );
                      })}

                    {add?.type === 'checkbox' &&
                      add?.childs?.map(child => {
                        const inputId = `checkbox-${add?.id}-${child?.id}`;

                        return (
                          <label
                            key={child?.id}
                            htmlFor={inputId}
                            className="mb-2 flex cursor-pointer items-center justify-between"
                          >
                            <span>{child?.name}</span>
                            <div>
                              <span className="text-primary me-3 text-sm">
                                {child?.unit_price
                                  ? `@ ${currencyFormat(child?.unit_price)}`
                                  : 'Free'}
                              </span>
                              <input
                                id={inputId}
                                type="checkbox"
                                checked={child?.selected}
                                onChange={e => toggleCheckbox(add?.id, child?.id, e.target.checked)}
                                className="checkbox checkbox-primary h-5 w-5"
                              />
                            </div>
                          </label>
                        );
                      })}
                  </div>
                )
            )}
          </div>
        </div>

        <div className="card-actions">
          <QuantityStepper value={quantity} onChange={setQuantity} />
          <button className="btn btn-primary btn-block" onClick={addToCart}>
            {quantity > 0
              ? `Tambahkan (${currencyFormat(calculateSubtotal())})`
              : isItemInCart
                ? 'Hapus & Kembali'
                : 'Kembali'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DetailScreen;
