import { dateFormat } from '../../utils/common';

const Kitchen = ({ data }) => {
  if (!data) return;

  // Prioritaskan new_items (tambahan baru) — fallback ke items (semua)
  const displayItems = data?.new_items?.length > 0 ? data?.new_items : data?.items || [];

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
            {dateFormat(data?.created_at, 'DD-MM-YYYY')}
          </p>
          <p style={{ marginBlock: 2, fontSize: 12 }}>{dateFormat(data?.created_at, 'HH:mm')}</p>
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
          <p style={{ marginBlock: 2, fontSize: 11 }}>
            {data?.session?.cashier?.name || data?.session?.name}
          </p>
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

        {data?.bill_name && (
          <div
            style={{
              marginBottom: 5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <p style={{ marginBlock: 2, fontSize: 11 }}>Bill Name</p>
            <p style={{ marginBlock: 2, fontSize: 11 }}>{data?.bill_name}</p>
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

      {displayItems?.map((item, i) => (
        <div key={i} style={{ marginBottom: 5 }}>
          <div style={{ display: 'flex', alignItems: '', justifyContent: 'space-between' }}>
            <div>
              <p style={{ marginBlock: 2, fontSize: 12, textTransform: 'capitalize' }}>
                {item?.catalog?.name || item?.catalog_name || item?.description}
              </p>
            </div>
            <p style={{ marginBlock: 2, fontSize: 12 }}>{item?.quantity}</p>
          </div>
          {item?.addons?.map((addon, idx) => (
            <div key={idx}>
              <p style={{ marginBlock: 2, fontSize: 11, textTransform: 'capitalize' }}>
                + {addon?.catalog_name}{' '}
                {/* {addon?.addon?.type === 'quantity' || addon?.addon?.type === 'checkbox'
                  ? `(${addon?.quantity / item?.quantity})`
                  : ''} */}
                {addon?.quantity > 0 ? `(${addon?.quantity})` : ''}
              </p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default Kitchen;
