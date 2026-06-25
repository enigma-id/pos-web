import React from 'react';

import { currencyFormat, dateFormat } from '../../utils/common';

const Summary = ({ data }) => {
  if (!data) return;

  console.log(data)

  const formatFinishedAt = dateString => {
    const date = new Date(dateString);
    const year = date.getFullYear();

    // Jika tahun adalah 1 (karena 0001 dianggap 1)
    if (year === 1) {
      return dateFormat(new Date(), 'DD-MM-YYYY HH:mm');
    }

    return dateFormat(date, 'DD-MM-YYYY HH:mm');
  };

  return (
    <div className="sheet page-break" style={{ padding: '10px' }}>
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
        <p style={{ marginBlock: 2, fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>
          # CASHIER REPORT #
        </p>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            marginBottom: 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <p style={{ marginBlock: 2, fontSize: 11 }}>Cashier</p>
          <p style={{ marginBlock: 2, fontSize: 11 }}>{data?.cashier?.name}</p>
        </div>
        <div
          style={{
            marginBottom: 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <p style={{ marginBlock: 2, fontSize: 11 }}>Start Session</p>
          <p style={{ marginBlock: 2, fontSize: 11 }}>
            {dateFormat(data?.started_at, 'DD-MM-YYYY HH:mm')}
          </p>
        </div>
        <div
          style={{
            marginBottom: 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <p style={{ marginBlock: 2, fontSize: 11 }}>End Session</p>
          <p style={{ marginBlock: 2, fontSize: 11 }}>{formatFinishedAt(data?.finished_at)}</p>
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
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
          <p style={{ marginBlock: 2, fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>
            ## CASHFLOW SUMMARY ##
          </p>
        </div>
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 5,
            }}
          >
            <p style={{ marginBlock: 2, fontSize: 11 }}>Starting Cash</p>
            <p style={{ marginBlock: 2, fontSize: 11 }}>
              {currencyFormat(data?.cash_started, false)}
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 5,
            }}
          >
            <p style={{ marginBlock: 2, fontSize: 11 }}>Ending Cash</p>
            <p style={{ marginBlock: 2, fontSize: 11 }}>
              {currencyFormat(data?.cash_finished, false)}
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 5,
            }}
          >
            <p style={{ marginBlock: 2, fontSize: 11 }}>Expected Cash</p>
            <p style={{ marginBlock: 2, fontSize: 11 }}>{currencyFormat(data?.summary?.cash?.expected_cash, false)}</p>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 5,
            }}
          >
            <p style={{ marginBlock: 2, fontSize: 11 }}>Topup Cash</p>
            <p style={{ marginBlock: 2, fontSize: 11 }}>
              {currencyFormat(data?.summary?.cash?.topup_cash, false)}
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 5,
            }}
          >
            <p style={{ marginBlock: 2, fontSize: 11 }}>Outstanding Bill</p>
            <p style={{ marginBlock: 2, fontSize: 11 }}>
              {currencyFormat(data?.summary?.sales?.outstanding_bill, false)}
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 5,
            }}
          >
            <p style={{ marginBlock: 2, fontSize: 11 }}>Outstanding Bill Payments</p>
            <p style={{ marginBlock: 2, fontSize: 11 }}>
              {currencyFormat(data?.summary?.sales?.outstanding_bill_payment, false)}
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 5,
            }}
          >
            <p style={{ marginBlock: 2, fontSize: 11 }}>Total Sales</p>
            <p style={{ marginBlock: 2, fontSize: 11 }}>
              {currencyFormat(data?.summary?.sales?.total_sales, false)}
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 5,
            }}
          >
            <p style={{ marginBlock: 2, fontSize: 11 }}>Total Discount</p>
            <p style={{ marginBlock: 2, fontSize: 11 }}>
              {currencyFormat(data?.summary?.sales?.total_discount, false)}
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 5,
            }}
          >
            <p style={{ marginBlock: 2, fontSize: 11 }}>After Discount</p>
            <p style={{ marginBlock: 2, fontSize: 11 }}>
              {currencyFormat(
                data?.summary?.sales?.total_after_discount,
                false
              )}
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 5,
            }}
          >
            <p style={{ marginBlock: 2, fontSize: 11 }}>Total Service</p>
            <p style={{ marginBlock: 2, fontSize: 11 }}>
              {currencyFormat(data?.summary?.sales?.total_service, false)}
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 5,
            }}
          >
            <p style={{ marginBlock: 2, fontSize: 11 }}>Grand Total</p>
            <p style={{ marginBlock: 2, fontSize: 11 }}>
              {currencyFormat(data?.summary?.sales?.grand_total, false)}
            </p>
          </div>
        </div>
      </div>

      {data?.summary?.topups?.length > 0 ? (
        <div style={{ marginBottom: 10 }}>
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
            <p style={{ marginBlock: 2, fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>
              ## TOPUP ##
            </p>
          </div>
          {data?.summary?.topups?.map((t, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 5,
              }}
            >
              <p style={{ marginBlock: 2, fontSize: 11, textTransform: 'uppercase' }}>{t?.type}</p>
              <p style={{ marginBlock: 2, fontSize: 11 }}>{currencyFormat(t?.total_nominal, false)}</p>
            </div>
          ))}
        </div>
      ) : null}

      {data?.summary?.payment_methods?.length > 0 ? (
        <div style={{ marginBottom: 10 }}>
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
            <p style={{ marginBlock: 2, fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>
              ## PAYMENTS ##
            </p>
          </div>
          {data?.summary?.payment_methods?.map((cat, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 5,
              }}
            >
              <p style={{ marginBlock: 2, fontSize: 11 }}>{cat?.name}</p>
              <p style={{ marginBlock: 2, fontSize: 11 }}>{currencyFormat(cat?.total_paid, false)}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* {data?.sales_channels && data?.sales_channels !== null ? (
        <div style={{ marginBottom: 10 }}>
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
            <p style={{ marginBlock: 2, fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>
              ## SALES CHANNEL ##
            </p>
          </div>
          {data?.sales_channels?.map((cat, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 5,
              }}
            >
              <p style={{ marginBlock: 2, fontSize: 11 }}>{cat?.channel_name}</p>
              <p style={{ marginBlock: 2, fontSize: 11 }}>
                ({cat?.transaction_count}) {currencyFormat(cat?.subtotal, false)}
              </p>
            </div>
          ))}
        </div>
      ) : null} */}

      {data?.summary?.category_solds?.length > 0 ? (
        <div style={{ marginBottom: 10 }}>
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
            <p style={{ marginBlock: 2, fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>
              ## CATEGORY SOLD ##
            </p>
          </div>
          {data?.summary?.category_solds?.map((cat, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 5,
              }}
            >
              <p style={{ marginBlock: 2, fontSize: 11 }}>{cat?.category_name}</p>
              <p style={{ marginBlock: 2, fontSize: 11 }}>
                ({cat?.total_qty}) {currencyFormat(cat?.total_charges, false)}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default Summary;
