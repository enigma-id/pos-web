import { currencyFormat, dateFormat } from '../../utils/common';

const TopupReceipt = ({ data }) => {
  const finalSaldo =
    Number(data?.membership?.saldo || 0) +
    Number(data?.topup?.nominal || 0) +
    Number(data?.bonus?.nominal || 0);

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

      <div style={{ textAlign: 'center', marginBottom: 15 }}>
        <p style={{ marginBlock: 2, fontSize: 14, fontWeight: 'bold' }}>TOPUP RECEIPT</p>
      </div>

      <div style={{ paddingBottom: 5, marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ marginBlock: 2, fontSize: 11 }}>Date</p>
          <p style={{ marginBlock: 2, fontSize: 11 }}>
            {dateFormat(data?.topup?.created_at, 'DD-MM-YYYY')}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ marginBlock: 2, fontSize: 11 }}>Time</p>
          <p style={{ marginBlock: 2, fontSize: 11 }}>
            {dateFormat(data?.topup?.created_at, 'HH:mm')}
          </p>
        </div>
      </div>

      <div
        style={{
          borderTop: '1px dashed #000',
          borderBottom: '1px dashed #000',
          paddingBlock: 8,
          marginBottom: 5,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ marginBlock: 2, fontSize: 11, textTransform: 'capitalize' }}>Member</p>
          <p style={{ marginBlock: 2, fontSize: 11, textTransform: 'uppercase' }}>
            {data?.membership?.name || '-'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ marginBlock: 2, fontSize: 11 }}>Phone Number</p>
          <p style={{ marginBlock: 2, fontSize: 11, textTransform: 'uppercase' }}>
            {data?.membership?.reff_code || '-'}
          </p>
        </div>
      </div>

      <div style={{ paddingBlock: 5, marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ marginBlock: 2, fontSize: 11 }}>Previous Balance</p>
          <p style={{ marginBlock: 2, fontSize: 11 }}>{currencyFormat(data?.membership?.saldo)}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ marginBlock: 2, fontSize: 11 }}>Topup Amount</p>
          <p style={{ marginBlock: 2, fontSize: 11, fontWeight: 'bold' }}>
            {currencyFormat(data?.topup?.nominal)}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ marginBlock: 2, fontSize: 11 }}>Payment</p>
          <p style={{ marginBlock: 2, fontSize: 11, textTransform: 'capitalize' }}>
            {data?.topup?.payment_type || '-'}
          </p>
        </div>
        {data?.bonus && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ marginBlock: 2, fontSize: 11 }}>Bonus Topup</p>
              <p style={{ marginBlock: 2, fontSize: 11, fontWeight: 'bold' }}>
                {currencyFormat(data?.bonus?.nominal)}
              </p>
            </div>
          </>
        )}
      </div>

      <div
        style={{
          borderTop: '1px dashed #000',
          borderBottom: '1px dashed #000',
          paddingBlock: 5,
          marginBottom: 5,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ marginBlock: 2, fontSize: 13, fontWeight: 'bold' }}>New Balance</p>
          <p style={{ marginBlock: 2, fontSize: 13, fontWeight: 'bold' }}>
            {currencyFormat(finalSaldo)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TopupReceipt;
