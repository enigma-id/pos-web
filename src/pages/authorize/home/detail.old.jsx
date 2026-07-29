/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';

import { Input, Modal, QuantityStepper } from '../../../components/ui';
import useCart from '../../../services/cart/hook';
import { currencyFormat } from '../../../utils/common';

const DetailScreen = ({ catalog, onClose, mode = 'add', editKey = null, type = 'cart' }) => {
  const { catalogDetail, change, add } = useCart(catalog?.id);

  const [catalogData, setCatalogData] = React.useState({});
  const [quantity, setQuantity] = React.useState(0);
  const [additionals, setAdditionals] = React.useState([]);

  React.useEffect(() => {
    if (!catalogDetail) return;

    const isEditMode = mode === 'edit';
    const existingItem = isEditMode && typeof editKey === 'number' ? catalog : null;

    setCatalogData({
      ...catalogDetail,
      name: catalogDetail.name || catalog?.name || '',
      unit_nett: catalogDetail.unit_nett || catalog?.unit_nett || 0,
    });

    if (isEditMode && existingItem) {
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
    } else {
      setQuantity(0);
      const clearedAdditionals = (catalogDetail?.additionals || []).map(add => ({
        ...add,
        childs: (add?.childs || []).map(child => ({
          ...child,
          quantity: 0,
          selected: false,
        })),
      }));
      setAdditionals(clearedAdditionals);
    }
  }, [catalogDetail, catalog, mode]);

  const addToCart = () => {
    if (!catalogDetail) return;

    const formattedItem = {
      ...catalogData,
      quantity: quantity,
      additionals: additionals,
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
    let total = quantity * (catalogData?.unit_nett || 0);

    additionals.forEach(add => {
      add.childs?.forEach(child => {
        if (add.type === 'quantity' && child?.quantity > 0) {
          total += quantity * child?.quantity * (child?.unit_nett || 0);
        }

        if (add.type !== 'quantity' && child.selected) {
          total += quantity * (child.unit_nett || 0);
        }
      });
    });

    return total;
  };

  return (
    <Modal.Body full>
      <div className="bg-base-100 flex min-h-1/3 min-w-fit flex-1 flex-col overflow-y-auto p-6 shadow-sm">
        <div>
          <div className="border-base-200 mb-3 flex place-content-between border-b border-dashed pb-3">
            {catalogDetail?.is_custom !== 1 && (
              <>
                <h2 className="card-title !text-xl">{catalogData?.name}</h2>
                <p className="text-primary text-end text-xl font-semibold">
                  {currencyFormat(catalogData?.unit_nett)}
                </p>
              </>
            )}
          </div>

          <div>
            {catalogDetail?.is_custom === 1 && (
              <div>
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
                    value={currencyFormat(catalogData?.unit_nett)}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      setCatalogData(prev => ({
                        ...prev,
                        unit_nett: raw,
                      }));
                    }}
                  />
                </div>
              </div>
            )}
            {type === 'cart'
              ? additionals.map(
                  add =>
                    add?.childs?.length > 0 && (
                      <div
                        key={add?.id}
                        className="border-base-200 mb-4 border-b border-dashed pb-3"
                      >
                        <p className="mb-2 text-base font-semibold uppercase">
                          {add?.name}{' '}
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

                        {add?.type === 'quantity' &&
                          add?.childs?.map(child => (
                            <div
                              key={child?.id}
                              className="mb-2 flex items-center justify-between text-sm"
                            >
                              <span>{child?.name}</span>

                              <div className="flex items-center">
                                <span className="text-primary me-3 text-sm">
                                  {child?.unit_nett
                                    ? `@ ${currencyFormat(child?.unit_nett)}`
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
                                className="mb-2 flex cursor-pointer items-center justify-between text-sm"
                              >
                                <span>{child?.name}</span>

                                <div>
                                  <span className="text-primary me-3 text-sm">
                                    {child?.unit_nett
                                      ? `@ ${currencyFormat(child?.unit_nett)}`
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
                                className="mb-2 flex cursor-pointer items-center justify-between text-sm"
                              >
                                <span>{child?.name}</span>
                                <div>
                                  <span className="text-primary me-3 text-sm">
                                    {child?.unit_nett
                                      ? `@ ${currencyFormat(child?.unit_nett)}`
                                      : 'Free'}
                                  </span>
                                  <input
                                    id={inputId}
                                    type="checkbox"
                                    checked={child?.selected}
                                    onChange={e =>
                                      toggleCheckbox(add?.id, child?.id, e.target.checked)
                                    }
                                    className="checkbox checkbox-primary h-5 w-5"
                                  />
                                </div>
                              </label>
                            );
                          })}
                      </div>
                    )
                )
              : additionals.map(
                  add =>
                    add?.childs?.length > 0 && (
                      <div
                        key={add?.id}
                        className="border-base-200 mb-4 border-b border-dashed pb-3"
                      >
                        {add?.type === 'quantity' &&
                          add?.childs?.map(
                            child =>
                              child?.quantity > 0 && (
                                <div
                                  key={child?.id}
                                  className="mb-2 flex items-center justify-between text-sm"
                                >
                                  <span>{child?.name}</span>

                                  <div className="flex items-center">
                                    <span className="text-primary me-3 text-sm">
                                      {child?.unit_nett
                                        ? `@ ${currencyFormat(child?.unit_nett)}`
                                        : 'Free'}
                                    </span>

                                    <div>{child?.quantity}</div>
                                  </div>
                                </div>
                              )
                          )}

                        {add?.type === 'options' &&
                          add?.childs?.map(child => {
                            const inputId = `option-${add?.id}-${child?.id}`;

                            if (!child?.selected) return;

                            return (
                              <label
                                key={child?.id}
                                htmlFor={inputId}
                                className="mb-2 flex cursor-pointer items-center justify-between text-sm"
                              >
                                <span>{child?.name}</span>

                                <div>
                                  <span className="text-primary me-3 text-sm">
                                    {child?.unit_nett
                                      ? `@ ${currencyFormat(child?.unit_nett)}`
                                      : 'Free'}
                                  </span>
                                </div>
                              </label>
                            );
                          })}

                        {add?.type === 'checkbox' &&
                          add?.childs?.map(child => {
                            const inputId = `checkbox-${add?.id}-${child?.id}`;

                            if (!child?.selected) return;

                            return (
                              <label
                                key={child?.id}
                                htmlFor={inputId}
                                className="mb-2 flex cursor-pointer items-center justify-between text-sm"
                              >
                                <span>{child?.name}</span>
                                <div>
                                  <span className="text-primary me-3 text-sm">
                                    {child?.unit_nett
                                      ? `@ ${currencyFormat(child?.unit_nett)}`
                                      : 'Free'}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                      </div>
                    )
                )}
          </div>
        </div>

        <div>
          <QuantityStepper value={quantity} onChange={setQuantity} />
          <button className="btn btn-primary btn-block btn-lg mt-4" onClick={addToCart}>
            {quantity > 0
              ? `Add (${currencyFormat(calculateSubtotal(), undefined, 'Free')})`
              : mode === 'edit'
                ? 'Remove & Back'
                : 'Back'}
          </button>
        </div>
      </div>
    </Modal.Body>
  );
};

export default DetailScreen;
