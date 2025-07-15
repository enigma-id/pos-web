/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { Dialog, Input, NFCField } from '../../../components/ui';
import {
  BackIcon,
  CardIcon,
  ChevronDownIcon,
  MoneyIcon,
  PrintIcon,
  UserCircleIcon,
} from '../../../components/ui/icon';
import Keypad from '../../../components/ui/keypad';
import useCart from '../../../services/cart/hook';
import useMembership from '../../../services/membership/hook';
import { currencyFormat, isActive } from '../../../utils/common';
import useDialogModal from '../../../utils/modal';

const CheckoutScreen = () => {
  const navigate = useNavigate();
  const CartState = useSelector(state => state?.Cart);
  const Channel = useSelector(state => state?.SalesChannel);

  const dropdownRef = React.useRef(null);

  const { getPaymentMethod, onChangeDiscount, onChangeCartDiscount, checkout, checkoutResult } =
    useCart();
  const { checkSaldo, checkResult } = useMembership();
  const { dialogRef, open: openModal, close: closeModal } = useDialogModal();

  const [isOpen, setIsOpen] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState([]);
  const [paymentRef, setPaymentRef] = React.useState('');
  const [pay, setPay] = React.useState(0);
  const [discountInputs, setDiscountInputs] = React.useState({});

  const [selectedMethod, setSelectedMethod] = React.useState(null);

  const renderAdditionals = item => {
    return (item?.additionals || [])
      .map(add => {
        const selectedChilds = (add?.childs || []).filter(child =>
          add.type === 'quantity' ? (child?.quantity || 0) > 0 : !!child?.selected
        );

        if (selectedChilds.length === 0) return null;

        const childNames = selectedChilds.map(child => {
          const suffix =
            add?.type === 'quantity'
              ? `(${child?.quantity} x ${currencyFormat(child?.unit_price, undefined, 'Free')})`
              : '';
          return (
            <div className="text-base-300 flex place-content-between text-xs font-thin">
              <span>
                + {child?.name} {suffix}
              </span>
              <span>{currencyFormat(child?.quantity * child?.unit_price, undefined, 'Free')}</span>
            </div>
          );
        });

        return (
          <div key={add.id} className="text-sm">
            <div className="text-base-300 text-xs font-semibold uppercase">{add.name}</div>
            <div>{childNames}</div>
          </div>
        );
      })
      .filter(Boolean);
  };

  const handleSubmit = async () => {
    const items = CartState?.items?.list?.map(item => {
      const base = {
        catalog_id: item.id,
        quantity: item.quantity,
      };

      if (item?.additionals_flat?.length > 0) {
        base.additionals = item?.additionals_flat;
      }

      if (item?.is_custom === 1) {
        base.description = item?.name;
        base.unit_price = item?.unit_price;
      }

      return base;
    });

    const discount_categories = CartState?.discount?.category
      ?.filter(
        cat => cat?.discount_value > 0 && ['percentage', 'nominal'].includes(cat?.discount_type)
      )
      ?.map(cat => ({
        category_id: cat.id,
        ...(cat.discount_type === 'percentage'
          ? { discount_percentage: cat.discount_value }
          : { discount_value: cat.discount_value }),
      }));

    const payload = {
      channel_id: Channel?.selectedChannel?.id,
      payment_method_id: selectedMethod?.id,
      payment_ref: selectedMethod?.id === 0 ? '' : paymentRef,
      total_payment: selectedMethod?.id === 0 ? Number(pay) || 0 : CartState?.meta?.subtotal || 0,
      items,
      discount_categories,
    };

    if (CartState?.discount?.cart?.type) {
      if (CartState?.discount?.cart?.type === 'percentage') {
        payload.discount_percentage = CartState?.discount?.cart?.value;
      }

      if (CartState?.discount?.cart?.type === 'nominal') {
        payload.discount_value = CartState?.discount?.cart?.value;
      }
    }

    await checkout(payload);
  };

  const handleRead = uid => {
    const params = {
      is_checkout: true,
      nominal: CartState?.meta?.grand_total,
      card_id: uid,
    };

    checkSaldo(params);
  };

  React.useEffect(() => {
    const getMethod = async () => {
      const res = await getPaymentMethod();
      setPaymentMethod(res);
      setSelectedMethod(res[0]);
    };

    getMethod();
  }, []);

  React.useEffect(() => {
    if (checkoutResult?.isSuccess) {
      openModal();
    }
  }, [checkoutResult]);

  React.useEffect(() => {
    const inputs = {};

    // Ambil dari diskon cart
    const cartType = CartState?.discount?.cart?.type;
    const cartValue = CartState?.discount?.cart?.value;
    if (cartType && cartValue != null) {
      inputs.cart = cartValue.toString().replace('.', ',');
    }

    // Ambil dari diskon per kategori
    CartState?.discount?.category?.forEach(cat => {
      if (cat.discount_type && cat.discount_value != null) {
        inputs[cat.id] = cat.discount_value.toString().replace('.', ',');
      }
    });

    setDiscountInputs(inputs);
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <div className="border-base-200 bg-base-100 flex h-16 border-t border-b">
        <div className="border-base-200 flex-1 place-content-center border-r border-l">
          <div className="flex place-items-center gap-6 px-4">
            <div
              className="btn btn-circle btn-md btn-outline btn-neutral"
              onClick={() => navigate(-1)}
            >
              <BackIcon />
            </div>

            <div className="text-lg font-semibold">Order payment</div>
          </div>
        </div>
      </div>
      <div className="flex h-[calc(100vh-64px)] p-4">
        <div className="bg-base-100 flex h-full min-h-0 w-1/3 flex-1 flex-col p-4">
          <div className="py-4 text-base font-semibold">Order details</div>

          <div className="flex-1 overflow-y-auto">
            <div className="bg-accent p-4">
              {CartState?.items?.list?.map((item, i) => (
                <div key={i} className="border-base-200 border-b py-2">
                  <div className="flex place-content-between place-items-center text-base font-semibold">
                    <div>{item?.name}</div>
                    <div>
                      {item?.discount_amount > 0 ? (
                        <div className="text-base">
                          <span className="me-2 text-xs !font-thin line-through">
                            {currencyFormat(item?.subtotal)}
                          </span>
                          {currencyFormat(item?.final_total)}
                        </div>
                      ) : (
                        currencyFormat(item?.subtotal)
                      )}
                    </div>
                  </div>
                  <div className="pb-2 text-xs">
                    {item?.quantity} x {currencyFormat(item?.unit_price)}
                  </div>
                  <div>
                    {renderAdditionals(item).map((line, idx) => (
                      <div key={idx} className="pb-2">
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="bg-base-100 border-base-200 flex h-full min-h-0 w-1/3 flex-1 flex-col border-r border-l p-4">
          {CartState?.meta?.customer && (
            <div>
              <div className="py-4 text-base font-semibold">Customer Info</div>
              <div className="border-base-200 flex gap-5 border-b py-4">
                <div>
                  <UserCircleIcon />
                </div>
                <div>
                  <div className="text-base font-semibold capitalize">
                    {CartState?.meta?.customer?.name || '-'}
                  </div>
                  <div className="text-base-300 text-xs">
                    {CartState?.meta?.customer?.reff_code || '-'}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="py-4 text-base font-semibold">Add discount(s)</div>
          <div className="flex-1 overflow-y-auto">
            <div className="collapse-arrow bg-accent collapse mb-2">
              <input type="checkbox" name="my-accordion-1" defaultChecked />
              <div className="collapse-title text-xl font-semibold">Discount category</div>
              <div className="collapse-content">
                {CartState?.discount?.category?.map((cat, i) => (
                  <div className="mb-3 flex place-content-between place-items-center" key={i}>
                    <div>{cat?.name}</div>
                    <div className="flex place-items-center gap-2">
                      <input
                        type="text"
                        inputMode={cat?.discount_type === 'nominal' ? 'numeric' : 'decimal'}
                        pattern={cat?.discount_type === 'nominal' ? '[0-9]*' : '[0-9]*[.,]?[0-9]*'}
                        className="input input-neutral input-md !bg-base-100 !min-h-10 !w-24 !py-0"
                        disabled={cat?.discount_type === null}
                        value={discountInputs[cat.id] ?? ''}
                        onChange={e => {
                          let raw = e.target.value;
                          const isNominal = cat?.discount_type === 'nominal';
                          if (isNominal) {
                            raw = raw.replace(/[.,]/g, '');
                          }
                          setDiscountInputs(prev => ({ ...prev, [cat.id]: raw }));
                          onChangeDiscount(cat.id, 'discount_value', raw);
                        }}
                      />

                      <div
                        className={`cursor-pointer rounded px-2 py-1 ${
                          cat.discount_type === 'percentage'
                            ? 'bg-primary text-white'
                            : 'bg-base-200'
                        }`}
                        onClick={() => {
                          setDiscountInputs(prev => ({ ...prev, [cat.id]: '' }));
                          onChangeDiscount(cat.id, 'discount_type', 'percentage');
                        }}
                      >
                        %
                      </div>
                      <div
                        className={`cursor-pointer rounded px-2 py-1 ${
                          cat.discount_type === 'nominal' ? 'bg-primary text-white' : 'bg-base-200'
                        }`}
                        onClick={() => {
                          setDiscountInputs(prev => ({ ...prev, [cat.id]: '' }));
                          onChangeDiscount(cat.id, 'discount_type', 'nominal');
                        }}
                      >
                        Rp
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="collapse-arrow bg-accent collapse">
              <input type="checkbox" name="my-accordion-2" />
              <div className="collapse-title text-xl font-semibold">Discount All</div>
              <div className="collapse-content">
                <div className="mb-3 flex place-content-between place-items-center">
                  <div>All Items</div>
                  <div className="flex place-items-center gap-2">
                    <input
                      type="text"
                      inputMode={
                        CartState?.discount?.cart?.type === 'nominal' ? 'numeric' : 'decimal'
                      }
                      pattern={
                        CartState?.discount?.cart?.type === 'nominal'
                          ? '[0-9]*'
                          : '[0-9]*[.,]?[0-9]*'
                      }
                      className="input input-neutral input-md !bg-base-100 !min-h-10 !w-24 !py-0"
                      value={discountInputs['cart'] ?? ''}
                      disabled={CartState?.discount?.cart?.type === null}
                      onChange={e => {
                        let raw = e.target.value;
                        const isNominal = CartState?.discount?.cart?.type === 'nominal';
                        if (isNominal) {
                          raw = raw.replace(/[.,]/g, '');
                        }
                        setDiscountInputs(prev => ({ ...prev, cart: raw }));
                        onChangeCartDiscount('discount_value', raw);
                      }}
                    />

                    <div
                      className={`cursor-pointer rounded px-2 py-1 ${
                        CartState?.discount?.cart?.type === 'percentage'
                          ? 'bg-primary text-white'
                          : 'bg-base-200'
                      }`}
                      onClick={() => {
                        setDiscountInputs(prev => ({ ...prev, cart: '' }));
                        onChangeCartDiscount('discount_type', 'percentage');
                      }}
                    >
                      %
                    </div>
                    <div
                      className={`cursor-pointer rounded px-2 py-1 ${
                        CartState?.discount?.cart?.type === 'nominal'
                          ? 'bg-primary text-white'
                          : 'bg-base-200'
                      }`}
                      onClick={() => {
                        setDiscountInputs(prev => ({ ...prev, cart: '' }));
                        onChangeCartDiscount('discount_type', 'nominal');
                      }}
                    >
                      Rp
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="py-4 text-base font-semibold">Payment summary</div>
          <div className="bg-accent flex place-content-between place-items-center rounded-lg px-4 py-4 text-base font-semibold">
            <div>Total Amount</div>
            <div>
              {CartState?.discount?.cart?.value || CartState?.discount?.cart?.amount > 0 ? (
                <div className="text-base">
                  <span className="me-2 text-xs !font-thin line-through">
                    {currencyFormat(CartState?.meta?.subtotal)}
                  </span>
                  {currencyFormat(CartState?.meta?.grand_total)}
                </div>
              ) : (
                currencyFormat(CartState?.meta?.grand_total)
              )}
            </div>
          </div>
        </div>

        <div className="bg-base-100 flex h-full min-h-0 w-1/3 flex-1 flex-col p-4">
          <div className="py-4 text-base font-semibold">Select payment method</div>

          <div
            ref={dropdownRef}
            tabIndex={0}
            className="dropdown border-base-200 dropdown-end cursor-pointer place-content-center rounded border px-4 py-4"
          >
            <div
              className="hover:text-primary flex place-content-between place-items-center"
              onClick={() => setIsOpen(prev => !prev)}
            >
              <div className="flex place-items-center">
                {selectedMethod?.id == 0 ? (
                  <MoneyIcon className="h-8" />
                ) : (
                  <CardIcon className="h-8" />
                )}
                <div className="text-left !text-lg font-semibold">{selectedMethod?.name}</div>
              </div>
              <ChevronDownIcon
                className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
              />
            </div>
            {isOpen && (
              <ul className="menu dropdown-content rounded-box bg-base-100 z-1 mt-4 w-full p-2 shadow-sm">
                {paymentMethod?.map(method => (
                  <li key={method.id}>
                    <a
                      className={`category ${isActive(selectedMethod?.id, method?.id)}`}
                      onClick={() => {
                        setSelectedMethod(method);
                        setIsOpen(false);
                      }}
                    >
                      {method?.id == 0 ? (
                        <MoneyIcon className="h-8" />
                      ) : (
                        <CardIcon className="h-8" />
                      )}
                      {method?.name}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex-1">
            {selectedMethod?.id === 0 ? (
              <Keypad
                payment={selectedMethod?.id}
                onChange={v => setPay(v)}
                subtotal={CartState?.meta?.subtotal}
              />
            ) : (
              <div className="my-3">
                <div className="text-[16px] font-semibold">Ref Code</div>
                <Input
                  className="input-xl"
                  value={paymentRef}
                  onChange={e => setPaymentRef(e?.target?.value)}
                />
              </div>
            )}
          </div>

          <div
            className={`btn btn-primary btn-xl btn-block ${CartState?.items?.list?.count === 0 || checkoutResult?.isLoading ? 'btn-disabled' : ''}`}
            onClick={selectedMethod?.is_nfc === 1 ? openModal : handleSubmit}
          >
            Pay now
            {checkoutResult?.isLoading && <span className="loading loading-spinner"></span>}
          </div>
        </div>
      </div>

      <Dialog.Wrapper ref={dialogRef} className="w-lg">
        <Dialog.Header
          onClose={
            selectedMethod?.is_nfc === 1
              ? closeModal
              : () => {
                  closeModal();
                  navigate('/');
                }
          }
        >
          <div className="text-lg font-semibold tracking-wide uppercase">
            {selectedMethod?.is_nfc === 1 ? 'Scan card' : 'Payment success'}
          </div>
        </Dialog.Header>
        {selectedMethod?.is_nfc === 1 ? (
          <NFCField onRead={handleRead} isOpen={isOpen} onClose={closeModal} result={checkResult} />
        ) : (
          <Dialog.Body>
            <div className="flex place-content-center place-items-center">
              <img src="./success.png" className="h-64" />
            </div>

            <div className="flex h-16 place-items-center">
              <div className="flex flex-1 flex-col place-content-center place-items-center">
                <div className="text-xl font-semibold">
                  {currencyFormat(checkoutResult?.data?.data?.total_payment)}
                </div>
                <div className="text-base-300 text-base font-thin capitalize">total paid</div>
              </div>
              {selectedMethod?.id === 0 && (
                <div className="border-base-200 flex flex-1 flex-col place-content-center place-items-center border-l">
                  <div className="text-xl font-semibold">
                    {currencyFormat(
                      checkoutResult?.data?.data?.total_payment -
                        checkoutResult?.data?.data?.total_charges
                    )}
                  </div>
                  <div className="text-base-300 text-base font-thin capitalize">change</div>
                </div>
              )}
            </div>
            <div className="mt-4">
              <div className="btn btn-block btn-lg btn-soft btn-primary mb-3">
                <PrintIcon /> Print Receipt
              </div>

              <div className="btn btn-block btn-lg btn-primary mb-3" onClick={() => navigate('/')}>
                Back to menu
              </div>
            </div>
          </Dialog.Body>
        )}
      </Dialog.Wrapper>
    </div>
  );
};

export default CheckoutScreen;
