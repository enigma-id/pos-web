import React from 'react';

import { currencyFormat, dateFormat } from '../../utils/common';

const Receipt = ({ data }) => {
  const [discountMap, setDiscountMap] = React.useState([]);

  const groupedCategories = items => {
    const group = {};

    items.forEach(item => {
      const category = item?.catalog?.category;
      const discount = item?.discount_value * item?.quantity || 0;

      if (!category) return;

      const id = category.id;
      const name = category.name;

      if (!group[id]) {
        group[id] = {
          id,
          name,
          subtotal: 0,
        };
      }

      group[id].subtotal += discount;
    });

    const result = Object.values(group).filter(item => item.subtotal > 0);
    setDiscountMap(result);
  };

  React.useEffect(() => {
    if (!data) return;
    groupedCategories(data?.items);
  }, [data]);

  if (!data) return;

  return (
    <div className="sheet page-break" style={{ padding: '10px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        }}
      >
        <img src="./logo.png" style={{ height: 50, width: 'auto' }} />
      </div>

      <div style={{ paddingBottom: 5, marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ marginBlock: 2, fontSize: 11 }}>
            {dateFormat(data?.ordered_at, 'DD-MM-YYYY')}
          </p>
          <p style={{ marginBlock: 2, fontSize: 11 }}>{dateFormat(data?.ordered_at, 'HH:mm')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ marginBlock: 2, fontSize: 11 }}>Transaction</p>
          <p style={{ marginBlock: 2, fontSize: 11 }}>No. {data?.code}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ marginBlock: 2, fontSize: 11 }}>Sales Channel</p>
          <p style={{ marginBlock: 2, fontSize: 11 }}>{data?.channel?.name}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ marginBlock: 2, fontSize: 11 }}>Cashier</p>
          <p style={{ marginBlock: 2, fontSize: 11 }}>{data?.session?.cashier?.name}</p>
        </div>

        {data?.note && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ marginBlock: 2, fontSize: 11 }}>Bill Name</p>
            <p style={{ marginBlock: 2, fontSize: 11 }}>{data?.note}</p>
          </div>
        )}

        {data?.membership && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ marginBlock: 2, fontSize: 11 }}>Member</p>
            <p style={{ marginBlock: 2, fontSize: 11 }}>{data?.membership?.name}</p>
          </div>
        )}

        {data?.ticket && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ marginBlock: 2, fontSize: 11 }}>Bill Name</p>
            <p style={{ marginBlock: 2, fontSize: 11 }}>{data?.ticket}</p>
          </div>
        )}
      </div>

      <div
        style={{
          borderBottom: 1,
          borderBottomStyle: 'dashed',
          borderTop: 1,
          borderTopStyle: 'dashed',
          paddingBlock: 5,
          marginBottom: 5,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ marginBlock: 2, fontSize: 11 }}>Description</p>
          <p style={{ marginBlock: 2, fontSize: 11 }}>Total</p>
        </div>
      </div>

      {data?.items?.map((item, i) => (
        <div key={i} style={{ marginBottom: 5 }}>
          <div style={{ display: 'flex', alignItems: '', justifyContent: 'space-between' }}>
            <div>
              <p style={{ marginBlock: 2, fontSize: 11, textTransform: 'capitalize' }}>
                {item?.catalog?.name || item?.description}
              </p>
              <p style={{ marginBlock: 2, fontSize: 9 }}>
                {item?.quantity} x {currencyFormat(item?.unit_nett, false)}
              </p>
            </div>
            <p style={{ marginBlock: 2, fontSize: 11 }}>
              {currencyFormat(item?.quantity * item?.unit_nett, false)}
            </p>
          </div>
          {item?.additionals?.map((addon, idx) => (
            <div
              key={idx}
              style={{ display: 'flex', alignItems: '', justifyContent: 'space-between' }}
            >
              <p style={{ marginBlock: 2, fontSize: 9, textTransform: 'capitalize' }}>
                + {addon?.catalog?.name}
                {addon?.addon?.type !== 'options' &&
                  ` (${addon?.quantity} x ${currencyFormat(addon?.unit_nett, false)})`}
              </p>
              <p style={{ marginBlock: 2, fontSize: 9 }}>
                {currencyFormat(
                  addon?.quantity > 0
                    ? addon?.quantity * addon?.unit_nett
                    : item?.quantity * addon?.unit_nett,
                  false
                )}
              </p>
            </div>
          ))}
        </div>
      ))}

      <div
        style={{
          borderTop: 1,
          borderTopStyle: 'dashed',
          paddingBlock: 5,
          marginBottom: 5,
        }}
      >
        {data?.subtotal_nett > data?.total_charges && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ marginBlock: 2, fontSize: 11 }}>Before Discount</p>
            <p style={{ marginBlock: 2, fontSize: 11 }}>{currencyFormat(data?.subtotal_nett)}</p>
          </div>
        )}

        {discountMap?.length > 0 &&
          discountMap?.map((d, i) => (
            <div
              key={i}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <p style={{ marginBlock: 2, fontSize: 11 }}>Discount Category {d?.name}</p>
              <p style={{ marginBlock: 2, fontSize: 11 }}>-{currencyFormat(d?.subtotal)}</p>
            </div>
          ))}
        {/* {data?.items.reduce((sum, item) => {
          const qty = item.quantity ?? 1;
          const discount = item.discount_value ?? 0;
          return sum + discount * qty;
        }, 0) > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ marginBlock: 2, fontSize: 11 }}>Discount Category</p>
            <p style={{ marginBlock: 2, fontSize: 11 }}>
              -
              {currencyFormat(
                data?.items.reduce((sum, item) => {
                  const qty = item.quantity ?? 1;
                  const discount = item.discount_value ?? 0;
                  return sum + discount * qty;
                }, 0)
              )}
            </p>
          </div>
        )} */}
        {data?.discount_value > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ marginBlock: 2, fontSize: 11 }}>Discount Order</p>
            <p style={{ marginBlock: 2, fontSize: 11 }}>-{currencyFormat(data?.discount_value)}</p>
          </div>
        )}
      </div>
      <div
        style={{
          borderTop: 1,
          borderTopStyle: 'dashed',
          paddingBlock: 5,
          marginBottom: 5,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ marginBlock: 2, fontSize: 11 }}>Total</p>
          <p style={{ marginBlock: 2, fontSize: 11 }}>{currencyFormat(data?.total_charges)}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ marginBlock: 2, fontSize: 11 }}>{data?.payment_method?.name || 'Cash'}</p>
          <p style={{ marginBlock: 2, fontSize: 11 }}>{currencyFormat(data?.total_payment)}</p>
        </div>
        {data?.payment_ref && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ marginBlock: 2, fontSize: 11 }}>Ref</p>
            <p style={{ marginBlock: 2, fontSize: 11 }}>{data?.payment_ref}</p>
          </div>
        )}
        {data?.total_payment - data?.total_charges > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ marginBlock: 2, fontSize: 11 }}>Change</p>
            <p style={{ marginBlock: 2, fontSize: 11 }}>
              {currencyFormat(data?.total_payment - data?.total_charges, false)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Receipt;
