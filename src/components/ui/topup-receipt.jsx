import { currencyFormat, dateFormat } from '../../utils/common';

const TopupReceipt = ({ member, nominal, paymentMethod, createdAt }) => {
  const oldSaldo = (member?.saldo || 0);
  const finalSaldo = oldSaldo + nominal

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

      <div style={{ textAlign: 'center', marginBottom: 15 }}>
        <p style={{ marginBlock: 2, fontSize: 14, fontWeight: 'bold' }}>TOPUP RECEIPT</p>
      </div>

      <div style={{ paddingBottom: 5, marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ marginBlock: 2, fontSize: 11 }}>Date</p>
          <p style={{ marginBlock: 2, fontSize: 11 }}>{dateFormat(createdAt, 'DD-MM-YYYY')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ marginBlock: 2, fontSize: 11 }}>Time</p>
          <p style={{ marginBlock: 2, fontSize: 11 }}>{dateFormat(createdAt, 'HH:mm')}</p>
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
          <p style={{ marginBlock: 2, fontSize: 11, textTransform: 'uppercase' }}>{member?.name || '-'}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ marginBlock: 2, fontSize: 11 }}>Code</p>
          <p style={{ marginBlock: 2, fontSize: 11, textTransform: 'uppercase' }}>{member?.reff_code || '-'}</p>
        </div>
        {member?.card_id && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ marginBlock: 2, fontSize: 11 }}>Card ID</p>
            <p style={{ marginBlock: 2, fontSize: 11 }}>{member?.card_id}</p>
          </div>
        )}
      </div>

      <div style={{ paddingBlock: 5, marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ marginBlock: 2, fontSize: 11 }}>Previous Balance</p>
          <p style={{ marginBlock: 2, fontSize: 11 }}>{currencyFormat(oldSaldo)}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ marginBlock: 2, fontSize: 11 }}>Topup Amount</p>
          <p style={{ marginBlock: 2, fontSize: 11, fontWeight: 'bold' }}>{currencyFormat(nominal)}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ marginBlock: 2, fontSize: 11 }}>Payment</p>
          <p style={{ marginBlock: 2, fontSize: 11, textTransform: 'capitalize' }}>{paymentMethod || '-'}</p>
        </div>
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
          <p style={{ marginBlock: 2, fontSize: 13, fontWeight: 'bold' }}>{currencyFormat(finalSaldo)}</p>
        </div>
      </div>
    </div>
  );
};

export default TopupReceipt;
