/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';

import { Input, Modal, QuantityStepper } from '../../../components/ui';
import useCart from '../../../services/cart/hook';
import { currencyFormat } from '../../../utils/common';

const DetailScreen = ({ catalog, onClose, mode = 'add', editKey = null, type = 'cart' }) => {
  const { catalogDetail, change, add } = useCart(type === 'cart' ? catalog?.id : null);

  const [catalogData, setCatalogData] = React.useState({});
  const [quantity, setQuantity] = React.useState(0);
  const [initialQuantity, setInitialQuantity] = React.useState(0);
  const [additionals, setAdditionals] = React.useState([]);

  React.useEffect(() => {
    const isEditMode = mode === 'edit';
    const existingItem = isEditMode && typeof editKey === 'number' ? catalog : null;
    const detail = type === 'bill' ? catalog : catalogDetail;

    if (!detail) return;

    setCatalogData({
      ...detail,
      name: detail.name || catalog?.name || '',
      unit_price: detail.unit_price || catalog?.unit_price || 0,
    });

    if (isEditMode && existingItem) {
      const itemQty = existingItem?.quantity || 0;
      setQuantity(itemQty);
      setInitialQuantity(itemQty);

      const additions = (detail?.addons || []).map(add => {
        const cartAddon = existingItem?.addons?.find(a => a.id === add.id);

        return {
          ...add,
          items: (add?.items || []).map(child => {
            const cartChild = cartAddon?.items?.find(c => c.id === child.id);
            return {
              ...child,
              quantity: add.type === 'quantity' ? cartChild?.quantity || 0 : cartChild ? 1 : 0,
              selected: add.type !== 'quantity' ? !!cartChild?.selected : false,
            };
          }),
        };
      });

      setAdditionals(additions);


    } else {
      setQuantity(0);
      setInitialQuantity(0);
      const clearedAdditionals = (detail?.addons || []).map(add => ({
        ...add,
        items: (add?.items || []).map(child => ({
          ...child,
          quantity: 0,
          selected: false,
        })),
      }));
      setAdditionals(clearedAdditionals);

    }
  }, [catalogDetail, catalog, mode, type]);

  const addToCart = () => {
    if (!catalogData) return;

    const formattedItem = {
      ...catalogData,
      quantity,
      addons: additionals,
      subtotal: calculateSubtotal(),
    };

    if (mode === 'edit') {
      change(editKey, formattedItem, type);
    } else {
      add(formattedItem);
    }

    onClose();
  };

  const updateQuantity = (addonId, childId, qty) => {
    setAdditionals(prev =>
      prev.map(add =>
        add.id !== addonId
          ? add
          : {
              ...add,
              items: add.items.map(c => (c.id !== childId ? c : { ...c, quantity: qty })),
            }
      )
    );
  };

  const selectOption = (addonId, selectedChildId) => {
    setAdditionals(prev =>
      prev.map(add => {
        if (add.id !== addonId) return add;
        const isAlreadySelected = add.items.some(
          child => child.id === selectedChildId && child.selected
        );
        return {
          ...add,
          items: add.items.map(child => ({
            ...child,
            selected: isAlreadySelected ? false : child.id === selectedChildId,
            quantity: isAlreadySelected ? 0 : child.id === selectedChildId ? 1 : 0,
          })),
        };
      })
    );
  };

  const toggleCheckbox = (addonId, childId, checked) => {
    setAdditionals(prev =>
      prev.map(add =>
        add.id !== addonId
          ? add
          : {
              ...add,
              items: add.items.map(c =>
                c.id !== childId ? c : { ...c, selected: checked, quantity: checked ? 1 : 0 }
              ),
            }
      )
    );
  };

  const calculateSubtotal = () => {
    let total = quantity * (catalogData?.unit_price || 0);

    additionals.forEach(add => {
      add.items.forEach(child => {
        if (add.type === 'quantity' && child.quantity > 0) {
          total += quantity * child.quantity * (child.unit_price || 0);
        }
        if (add.type !== 'quantity' && child.selected) {
          total += quantity * (child.unit_price || 0);
        }
      });
    });

    return total;
  };

  return (
    <Modal.Body full>
      <div className="bg-base-100 flex min-h-1/3 min-w-fit flex-1 flex-col overflow-y-auto p-6 shadow-sm">
        <div className="border-base-200 mb-3 flex justify-between border-b border-dashed pb-3">
          <h2 className="card-title text-xl!">{catalogData?.name}</h2>
          <p className="text-primary text-end text-xl font-semibold">
            {currencyFormat(catalogData?.unit_price)}
          </p>
        </div>

        {catalogDetail?.is_custom === true && (
          <>
            <div className="mb-3">
              <Input
                label="Catalog Name"
                value={catalogData?.name || ''}
                onChange={e => setCatalogData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="mb-3">
              <Input
                label="Catalog Price"
                value={currencyFormat(catalogData?.unit_price)}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  setCatalogData(prev => ({ ...prev, unit_price: Number(raw) }));
                }}
              />
            </div>
          </>
        )}

        {additionals.map(
          add =>
            add.items?.length > 0 && (
              <div key={add.id} className="border-base-200 mb-4 border-b border-dashed pb-3">
                <p className="mb-2 text-base font-semibold uppercase">
                  {add.name}{' '}
                  {add?.type === 'quantity' ? (
                    <span className="text-base-content text-sm !font-thin !capitalize">
                      (set quantity for each option)
                    </span>
                  ) : add?.type === 'options' ? (
                    <span className="text-base-content text-sm !font-thin !capitalize">
                      (choose one)
                    </span>
                  ) : add?.type === 'checkbox' ? (
                    <span className="text-base-content text-sm !font-thin !capitalize">
                      (choose one or more)
                    </span>
                  ) : null}
                </p>

                {add.items.map(child => (
                  <div key={child.id} className="mb-2 flex items-center justify-between text-sm">
                    <span>{child.name}</span>
                    <div className="flex items-center">
                      <span className="text-primary me-3 text-sm">
                        {child.unit_price ? `@ ${currencyFormat(child.unit_price)}` : 'Free'}
                      </span>
                      {type === 'bill' ? (
                        add.type === 'quantity' && (
                          <span className="bg-base-content rounded-lg px-3 py-1 text-white">
                            {child?.quantity}
                          </span>
                        )
                      ) : add.type === 'quantity' ? (
                        <QuantityStepper
                          small
                          value={child.quantity || 0}
                          onChange={val => updateQuantity(add.id, child.id, val)}
                        />
                      ) : add.type === 'options' ? (
                        <input
                          type="checkbox"
                          name={`options-${add.id}`}
                          checked={child.selected}
                          onChange={() => selectOption(add.id, child.id)}
                          className="radio radio-primary h-5 w-5"
                        />
                      ) : (
                        <input
                          type="checkbox"
                          checked={child.selected}
                          onChange={e => toggleCheckbox(add.id, child.id, e.target.checked)}
                          className="checkbox checkbox-primary h-5 w-5"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
        )}

        <QuantityStepper
          value={quantity}
          onChange={setQuantity}
          disableIncrement={type === 'bill' && quantity >= initialQuantity}
        />

        <button className="btn btn-primary btn-block btn-lg mt-4" onClick={addToCart}>
          {quantity > 0
            ? `Add (${currencyFormat(calculateSubtotal(), undefined, 'Free')})`
            : mode === 'edit'
              ? 'Remove & Back'
              : 'Back'}
        </button>
      </div>
    </Modal.Body>
  );
};

export default DetailScreen;
