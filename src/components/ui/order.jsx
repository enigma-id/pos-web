import { useSelector } from 'react-redux';

import { currencyFormat } from '../../utils/common';

const OrderSummary = ({ title, subtitle, data, onClose, onConfirm, isLoading }) => {
  const FormState = useSelector(state => state?.Form);

  const renderAdditionals = item => {
    return (item?.additionals || [])
      .map(add => {
        const selectedChilds = (add?.childs || []).filter(child =>
          add.type === 'quantity' ? (child?.quantity || 0) > 0 : !!child?.selected
        );

        if (selectedChilds.length === 0) return null;

        const childNames = selectedChilds
          .map(child => {
            const suffix =
              add?.type === 'quantity'
                ? ` (${child?.quantity}) (${child?.unit_price > 0 ? currencyFormat(child?.unit_price, false) : 'Free'})`
                : ` (${child?.unit_price > 0 ? currencyFormat(child?.unit_price, false) : 'Free'})`;
            return `${child.name}${suffix}`;
          })
          .join(', ');

        return (
          <div key={add.id} className="text-sm">
            {add.name}: <span className="font-semibold">{childNames}</span>
          </div>
        );
      })
      .filter(Boolean);
  };

  return (
    <div className="bg-base-100 w-1/2 rounded px-4 py-6">
      <div className="mb-4 pb-3 text-center">
        <div className="text-lg font-semibold tracking-wide uppercase">{title}</div>
        <div className="text-accent text-sm">{subtitle}</div>
      </div>

      <div className="mb-4">
        <table className="w-full">
          <thead>
            <tr className="border-base-200 border-b uppercase">
              <th className="text-accent px-2 py-3 text-start text-xs font-thin">item name</th>
              <th className="text-accent w-15 px-2 py-3 text-center text-xs font-thin">qty</th>
              <th className="text-accent w-40 px-2 py-3 text-end text-xs font-thin">price</th>
              <th className="text-accent w-40 px-2 py-3 text-end text-xs font-thin">subtotal</th>
            </tr>
          </thead>
          <tbody>
            {data?.items?.map((item, i) => (
              <tr className="border-base-200 border-b" key={i}>
                <td className="px-2 py-3 text-start text-sm capitalize">
                  <div className="font-semibold">{item?.name}</div>
                  {renderAdditionals(item).map((line, idx) => (
                    <div key={idx} className="text-sm text-gray-700">
                      {line}
                    </div>
                  ))}

                  {FormState?.errors?.[`items.${i}.catalog_id`] && (
                    <small className="text-error">
                      {FormState?.errors?.[`items.${i}.catalog_id`]}
                    </small>
                  )}
                </td>
                <td className="px-2 py-3 text-center text-sm capitalize">{item?.quantity}</td>
                <td className="px-2 py-3 text-end text-sm capitalize">
                  {currencyFormat(item?.unit_price)}
                </td>
                <td className="px-2 py-3 text-end text-sm capitalize">
                  {currencyFormat(item?.subtotal)}
                </td>
              </tr>
            ))}

            <tr>
              <td colSpan={2} rowSpan={4} className="px-2 pt-5 text-start">
                {data?.note && (
                  <div className="bg-base-100 w-full p-3">
                    <div className="text-sm font-semibold tracking-wide uppercase">notes</div>
                    <div className="pt-3 text-xs tracking-wide">{data?.note}</div>
                  </div>
                )}
              </td>
              <td className="w-40 px-2 pt-5 pb-3 text-end text-sm font-thin uppercase">
                BILL AMOUNT
              </td>
              <td className="text-primary px-2 pt-5 pb-3 text-end text-sm font-semibold capitalize">
                {currencyFormat(data?.subtotal)}
              </td>
            </tr>
            {data && 'payment' in data && (
              <tr>
                <td className="w-40 px-2 pb-3 text-end text-sm font-thin uppercase">
                  Total payment
                </td>
                <td className="text-primary px-2 pb-3 text-end text-sm font-semibold capitalize">
                  {currencyFormat(data?.payment)}
                </td>
              </tr>
            )}

            {data?.payment > 0 && data?.payment - data?.subtotal > 0 && (
              <tr>
                <td className="w-40 px-2 pb-3 text-end text-sm font-thin uppercase">change</td>
                <td className="text-primary px-2 pb-3 text-end text-sm font-semibold capitalize">
                  {currencyFormat(data?.payment - data?.subtotal)}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {FormState?.errors?.total_payment && (
          <div className="bg-error/15 border-error w-full rounded border py-4 text-center">
            <small className="text-error">{FormState?.errors?.total_payment}</small>
          </div>
        )}
      </div>

      <div className="border-base-200 flex place-content-between place-items-center border-t px-4 pt-4">
        {data?.payment_method ? (
          <div>
            <div className="text-accent text-xs font-thin tracking-wide">Payment Method</div>
            <div className="text-primary text-sm font-bold tracking-wide">
              {data?.payment_method?.name} {data?.payment_ref && `#${data?.payment_ref}`}
            </div>
          </div>
        ) : (
          <div>
            <div className="text-accent text-xs font-thin tracking-wide">Ticket Name.</div>
            <div className="text-primary text-sm font-bold tracking-wide">
              {data?.ticket || '-'}
            </div>
          </div>
        )}
        <div className="flex gap-4">
          <div className="btn btn-outline btn-primary rounded-full px-6" onClick={onClose}>
            Cancel
          </div>
          <div
            className={`btn btn-primary ${isLoading ? 'btn-disabled' : ''} rounded-full px-6`}
            onClick={onConfirm}
          >
            Confirm
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderSummary;
