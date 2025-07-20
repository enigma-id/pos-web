import { dateFormat } from '../../utils/common';

const Kitchen = ({ data }) => {
  if (!data) return;

  return (
    <div className="sheet page-break" style={{ padding: '10px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p style={{ fontSize: 20, fontWeight: 'bold' }}>** {data?.code} **</p>
      </div>

      <div style={{ paddingBlock: 5 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 5,
          }}
        >
          <p style={{ marginBlock: 2, fontSize: 12 }}>
            {dateFormat(data?.ordered_at, 'DD-MM-YYYY')}
          </p>
          <p style={{ marginBlock: 2, fontSize: 12 }}>{dateFormat(data?.ordered_at, 'HH:mm')}</p>
        </div>
        <div
          style={{
            marginBottom: 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <p style={{ marginBlock: 2, fontSize: 12 }}>Cashier</p>
          <p style={{ marginBlock: 2, fontSize: 12 }}>{data?.session?.cashier?.name}</p>
        </div>
        {data?.note && (
          <div
            style={{
              marginBottom: 5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <p style={{ marginBlock: 2, fontSize: 11 }}>Bill Name</p>
            <p style={{ marginBlock: 2, fontSize: 11 }}>{data?.note}</p>
          </div>
        )}

        {data?.membership && (
          <div
            style={{
              marginBottom: 5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <p style={{ marginBlock: 2, fontSize: 11 }}>Member</p>
            <p style={{ marginBlock: 2, fontSize: 11 }}>{data?.membership?.name}</p>
          </div>
        )}

        {data?.ticket && (
          <div
            style={{
              marginBottom: 5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
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
        <p style={{ marginBlock: 2, fontSize: 12, fontWeight: 'bold', textAlign: 'center' }}>
          # ITEM #
        </p>
      </div>

      {data?.items?.map((item, i) => (
        <div key={i} style={{ marginBottom: 5 }}>
          <div style={{ display: 'flex', alignItems: '', justifyContent: 'space-between' }}>
            <div>
              <p style={{ marginBlock: 2, fontSize: 12, textTransform: 'capitalize' }}>
                {item?.catalog?.name || item?.description}
              </p>
            </div>
            <p style={{ marginBlock: 2, fontSize: 12 }}>{item?.quantity}</p>
          </div>
          {item?.additionals?.map((addon, idx) => (
            <div key={idx}>
              <p style={{ marginBlock: 2, fontSize: 11, textTransform: 'capitalize' }}>
                + {addon?.catalog?.name} {`x (${addon?.quantity > 0 ? addon?.quantity : 1})`}
              </p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default Kitchen;
