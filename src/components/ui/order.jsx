import { currencyFormat, dateFormat } from '../../utils/common';

const OrderDetails = ({ data }) => {
  return (
    <div className="h-fit w-full rounded-xl bg-white p-6 shadow">
      <div className="border-base-200 border-b">
        <h2 className="mb-4 text-center text-4xl font-bold">
          {currencyFormat(data?.total_charges)}
        </h2>
      </div>

      <div className="border-base-200 border-b py-4">
        <div className="mb-2 text-sm">
          <span className="font-semibold">Bills name :</span> {data?.ticket || '-'}
        </div>
        <div className="mb-2 text-sm">
          <span className="font-semibold">Cashier :</span> {data?.session?.cashier?.name || '-'}
        </div>
        <div className="mb-2 text-sm">
          <span className="font-semibold">Session time :</span>{' '}
          {dateFormat(data?.session?.started_at, 'DD MMM YYYY')} -{' '}
          {dateFormat(data?.session?.finished_at, 'DD MMM YYYY', '(ongoing)')}
        </div>
        <div className="mb-2 text-sm capitalize">
          <span className="font-semibold">Customer :</span> {data?.membership?.name || '-'}
        </div>
      </div>

      <div className="border-base-200 border-b pt-4 pb-2">
        {data?.items?.map((item, i) => (
          <div key={i} className="pb-2">
            <div className="flex place-content-between place-items-center text-base">
              <div>{item?.catalog?.name}</div>
              <div>
                {item?.discount_value > 0 && (
                  <span className="text-base-300 me-2 text-xs line-through">
                    {currencyFormat(item?.unit_gross * item?.quantity)}
                  </span>
                )}
                {currencyFormat(item?.unit_bill * item?.quantity)}{' '}
              </div>
            </div>
            <div className="pb-2 text-xs">
              {item?.quantity} x {currencyFormat(item?.unit_bill)}{' '}
              {item?.discount_value > 0 && (
                <span className="text-base-300 line-through">
                  {currencyFormat(item?.unit_gross)}
                </span>
              )}
            </div>
            <div>
              {item?.additionals?.map((addon, i) => (
                <div className="text-xs font-thin" key={i}>
                  <span>
                    + {addon?.catalog?.name} ({addon?.quantity > 0 && `${addon?.quantity} x `}
                    {`${addon?.unit_nett > 0 ? currencyFormat(addon?.unit_nett) : 'Free'}`})
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-base-200 border-b py-4">
        {/* {data?.subtotal_nett > data?.total_charges && (
          <div className="flex place-content-between place-items-center text-base">
            <div>Subtotal</div>
            <div>
              {data?.subtotal_gross > data?.subtotal_nett && (
                <span className="text-base-300 me-2 text-xs font-thin line-through">
                  {currencyFormat(data?.subtotal_gross)}
                </span>
              )}
              {currencyFormat(data?.subtotal_nett)}
            </div>
          </div>
        )} */}

        {data?.items.reduce((sum, item) => {
          const qty = item.quantity ?? 1; // default 1 kalau tidak ada quantity
          const discount = item.discount_value ?? 0;
          return sum + discount * qty;
        }, 0) > 0 && (
          <div className="flex place-content-between place-items-center text-base">
            <div>Discount Category </div>
            <div>
              -
              {currencyFormat(
                data?.items.reduce((sum, item) => {
                  const qty = item.quantity ?? 1; // default 1 kalau tidak ada quantity
                  const discount = item.discount_value ?? 0;
                  return sum + discount * qty;
                }, 0)
              )}
            </div>
          </div>
        )}
        {data?.discount_value > 0 && (
          <div className="flex place-content-between place-items-center text-base">
            <div>Discount Order </div>
            <div>-{currencyFormat(data?.discount_value)}</div>
          </div>
        )}
      </div>
      <div className="border-base-200 border-b py-4">
        <div className="flex place-content-between place-items-center text-base font-semibold">
          <div>Total</div>
          <div>
            {data?.subtotal_gross > data?.total_charges && (
              <span className="text-base-300 me-2 text-xs font-thin line-through">
                {currencyFormat(data?.subtotal_gross)}
              </span>
            )}

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
