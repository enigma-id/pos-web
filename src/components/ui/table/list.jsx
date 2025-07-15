import React from 'react';
import { useSelector } from 'react-redux';

import { dateFormat } from '../../../utils/common';
import { ReceiptIcon } from '../icon';

const CardList = ({ name, onClick, onSelected, selected }) => {
  const StateTable = useSelector(state => state?.Table?.data[name]?.data);
  const StateEmpty = useSelector(state => state?.Table?.data[name]?.isEmpty);

  const rows = React.useMemo(() => (Array.isArray(StateTable) ? StateTable : []), [StateTable]);

  const EmptyData = () => (
    <div className="h-[calc(100vh-160px)] w-full py-20 text-center">
      <h3 className="text-lg font-semibold">Hasil tidak ditemukan</h3>
      <p className="text-sm text-gray-500">
        Coba sesuaikan pencarian atau filter Anda untuk menemukan apa yang Anda cari.
        <br />
        Atau mungkin belum ada datanya!
      </p>
    </div>
  );

  React.useEffect(() => {
    if (selected) return;
    onSelected(rows[0]);
  }, [onSelected, rows, selected]);

  const HasData = () => {
    if (StateEmpty) return <EmptyData />;

    return (
      <div className="flex h-[calc(100vh-160px)] flex-col">
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-1">
            {rows?.map((row, rowIndex) => (
              <div
                key={rowIndex}
                className={`${onClick === 'function' ? 'hover:!border-primary' : ''} ${selected?.id === row?.id ? 'bg-primary/10 border-primary text-primary' : ''} border-base-200 cursor-pointer border-b p-4`}
                onClick={() => onSelected(row)}
              >
                <div className="flex place-content-between gap-2">
                  <div className="flex place-items-center gap-2">
                    <ReceiptIcon />
                    <div>
                      <div>{row?.cashier?.name}</div>
                      <small>{dateFormat(row?.transaction_date)}</small>
                    </div>
                  </div>
                  <div>{row?.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return <HasData />;
};

export default CardList;
