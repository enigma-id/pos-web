import React from 'react';

import { currencyFormat, dateFormat } from '../../utils/common';

const OrderDetails = ({ data }) => {
  // Map category_id → category_name dari items
  const catNames = {};
  data?.items?.forEach(item => {
    const id = item?.catalog?.category?.id || item?.catalog?.category_id;
    if (id && item?.category_name) catNames[id] = item?.category_name;
  });

  return (
    <div className="h-fit w-full rounded-xl bg-white p-6 shadow">
      <div className="border-base-200 border-b">
        <h2 className="mb-4 text-center text-4xl font-bold">
          {currencyFormat(data?.total_charges)}
        </h2>
      </div>

      <div className="border-base-200 border-b py-4">
        {(data?.bill_name || data?.ticket || data?.note) && (
          <div className="mb-2 text-sm">
            <span className="font-semibold">Bills name :</span> {data?.bill_name || data?.ticket || data?.note}
          </div>
        )}
        <div className="mb-2 text-sm">
          <span className="font-semibold">Cashier :</span> {data?.session?.cashier?.name || '-'}
        </div>
        <div className="mb-2 text-sm">
          <span className="font-semibold">Session time :</span>{' '}
          {dateFormat(data?.session?.started_at, 'DD MMM YYYY')} -{' '}
          {dateFormat(data?.session?.finished_at, 'DD MMM YYYY', '(ongoing)')}
        </div>
        {data?.membership?.name && (
          <div className="mb-2 text-sm capitalize">
            <span className="font-semibold">Customer :</span> {data?.membership?.name}
          </div>
        )}
      </div>

      <div className="border-base-200 border-b pt-4 pb-2">
        {data?.items?.map((item, i) => (
          <div key={i} className="pb-2">
            <div className="flex place-content-between place-items-center text-base">
              <div>{item?.catalog?.name || item?.catalog_name || item?.description}</div>
              <div>
                {/* {item?.discount_value > 0 && (
                  <span className="text-base-300 me-2 text-xs line-through">
                    {currencyFormat(item?.unit_gross * item?.quantity)}
                  </span>
                )} */}
                {currencyFormat(item?.unit_nett * item?.quantity)}{' '}
              </div>
            </div>
            <div className="pb-2 text-xs">
              {item?.quantity} x {currencyFormat(item?.unit_nett)}{' '}
              {/* {item?.discount_value > 0 && (
                <span className="text-base-300 line-through">
                  {currencyFormat(item?.unit_gross)}
                </span>
              )} */}
            </div>
            <div>
              {item?.addons?.map((addon, i) => (
                <div key={i} className="flex place-content-between place-items-center text-base">
                  <div className="text-xs font-thin">
                    <span>
                      + {addon?.catalog_name}{' '}
                      {addon?.addon?.type === 'options'
                        ? ''
                        : `${addon?.quantity > 0 ? `(${addon?.quantity} x ${currencyFormat(addon?.unit_nett)})` : ""}`}
                    </span>
                  </div>
                  <div className="text-xs font-thin">
                    {currencyFormat(addon?.quantity * addon?.unit_nett)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-base-200 border-b py-4">
        {data?.subtotal_nett > data?.total_charges && (
          <div className="flex place-content-between place-items-center text-base">
            <div>Subtotal Before Discount</div>
            <div>
              {data?.subtotal_gross > data?.subtotal_nett && (
                <span className="text-base-300 me-2 text-xs font-thin line-through">
                  {currencyFormat(data?.subtotal_gross)}
                </span>
              )}
              {currencyFormat(data?.subtotal_nett)}
            </div>
          </div>
        )}

        {data?.category_discounts?.length > 0 && (
          <>
            {data?.category_discounts?.map((d, i) => (
              <div key={i} className="flex place-content-between place-items-center text-base">
                <div>Discount Category {catNames[d?.category_id] || ''}</div>
                <div>-{currencyFormat(d?.total_discount || d?.discount_value)}</div>
              </div>
            ))}
          </>
        )}
        {data?.discount_value > 0 && (
          <div className="flex place-content-between place-items-center text-base">
            <div>Discount Order </div>
            <div>-{currencyFormat(data?.discount_value)}</div>
          </div>
        )}
      </div>
      <div className="border-base-200 border-b py-4">
        {data?.service_charge_value > 0 && (
          <div className="flex place-content-between place-items-center text-base">
            <div>Service </div>
            <div>{currencyFormat(data?.service_charge_value)}</div>
          </div>
        )}

        <div className="flex place-content-between place-items-center text-base font-semibold">
          <div>Total</div>
          <div>
            {/* {data?.subtotal_gross > data?.total_charges && (
              <span className="text-base-300 me-2 text-xs font-thin line-through">
                {currencyFormat(data?.subtotal_gross)}
              </span>
            )} */}

            {currencyFormat(data?.total_charges)}
          </div>
        </div>
        {data?.total_payment > 0 && (
          <div className="flex place-content-between place-items-center text-base">
            <div className="capitalize">{data?.payment_method?.name || 'Cash'} </div>
            <div>{currencyFormat(data?.total_payment)}</div>
          </div>
        )}

        {data?.total_payment - data?.total_charges > 0 && (
          <div className="flex place-content-between place-items-center text-base">
            <div>Change</div>
            <div>{currencyFormat(data?.total_payment - data?.total_charges)}</div>
          </div>
        )}
        {data?.payment_ref !== '' && (
          <div className="flex place-content-between place-items-center text-base">
            <div>Ref</div>
            <div>{data?.payment_ref}</div>
          </div>
        )}
      </div>

      <div className="text-base-300 flex place-content-between place-items-center py-4 text-base">
        <div>{dateFormat(data?.ordered_at)}</div>
        <div>{data?.code}</div>
      </div>
    </div>
  );
};

export default OrderDetails;
