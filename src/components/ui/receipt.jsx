import React from 'react';

import { currencyFormat, dateFormat } from '../../utils/common';

const Receipt = ({ data }) => {
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
        <img src="/logo.png" style={{ height: 50, width: 'auto' }} />
      </div>

      <div style={{ paddingBottom: 5, marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ marginBlock: 2, fontSize: 11 }}>
            {dateFormat(data?.paid_at || data?.created_at, 'DD-MM-YYYY')}
          </p>
          <p style={{ marginBlock: 2, fontSize: 11 }}>
            {dateFormat(data?.paid_at || data?.created_at, 'HH:mm')}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ marginBlock: 2, fontSize: 11 }}>Transaction</p>
          <p style={{ marginBlock: 2, fontSize: 11 }}>No. {data?.code}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ marginBlock: 2, fontSize: 11 }}>Sales Channel</p>
          <p style={{ marginBlock: 2, fontSize: 11 }}>{data?.sales_channel?.name}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ marginBlock: 2, fontSize: 11 }}>Cashier</p>
          <p style={{ marginBlock: 2, fontSize: 11 }}>{data?.session?.cashier?.name || '-'}</p>
        </div>

        {data?.bill_name && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ marginBlock: 2, fontSize: 11 }}>Bill Name</p>
            <p style={{ marginBlock: 2, fontSize: 11 }}>{data?.bill_name}</p>
          </div>
        )}

        {data?.membership && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ marginBlock: 2, fontSize: 11 }}>Member</p>
            <p style={{ marginBlock: 2, fontSize: 11 }}>{data?.membership?.name}</p>
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
                {item?.catalog_name || item?.catalog?.name || '-'}{' '}
                {/* catalog_name langsung, catalog?.name fallback struktural */}
              </p>
              <p style={{ marginBlock: 2, fontSize: 9 }}>
                {item?.quantity} x {currencyFormat(item?.unit_nett, false)}
              </p>
            </div>
            <p style={{ marginBlock: 2, fontSize: 11 }}>
              {currencyFormat(item?.quantity * item?.unit_nett, false)}
            </p>
          </div>
          {item?.addons?.map((addon, idx) => (
            <div
              key={idx}
              style={{ display: 'flex', alignItems: '', justifyContent: 'space-between' }}
            >
              <p style={{ marginBlock: 2, fontSize: 9, textTransform: 'capitalize' }}>
                + {addon?.catalog_name || '-'}{' '}
                {/* catalog_name langsung, catalog?.name fallback struktural */}{' '}
                {addon?.addon_group?.type === 'options'
                  ? ''
                  : `${addon?.quantity > 0 ? `(${addon?.quantity} x ${currencyFormat(addon?.unit_nett)})` : ''}`}
              </p>
              <p style={{ marginBlock: 2, fontSize: 9 }}>
                {currencyFormat(addon?.quantity * addon?.unit_nett, false)}
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

        {data?.category_discounts
          ?.filter(d => (d?.total_discount || d?.discount_value || 0) > 0)
          ?.map((d, i) => (
            <div
              key={i}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <p style={{ marginBlock: 2, fontSize: 11 }}>
                Discount Category {d?.category?.name || '-'}
              </p>
              <p style={{ marginBlock: 2, fontSize: 11 }}>-{currencyFormat(d?.total_discount)}</p>
            </div>
          ))}
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
        {data?.service_charge_value > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ marginBlock: 2, fontSize: 11 }}>Service</p>
            <p style={{ marginBlock: 2, fontSize: 11 }}>
              {currencyFormat(data?.service_charge_value)}
            </p>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ marginBlock: 2, fontSize: 11 }}>Total</p>
          <p style={{ marginBlock: 2, fontSize: 11 }}>{currencyFormat(data?.total_charges)}</p>
        </div>
        {data?.total_payment > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ marginBlock: 2, fontSize: 11 }}>{data?.payment_method?.name || 'Cash'}</p>
            <p style={{ marginBlock: 2, fontSize: 11 }}>{currencyFormat(data?.total_payment)}</p>
          </div>
        )}
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
        {data?.status === 'completed' && data?.payment_method?.is_nfc == 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ marginBlock: 2, fontSize: 11 }}>Saldo Member</p>
            <p style={{ marginBlock: 2, fontSize: 11 }}>
              {currencyFormat(data?.membership?.saldo, false)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Receipt;
