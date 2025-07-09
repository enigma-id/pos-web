import React from 'react';
import { useSelector } from 'react-redux';

const CardRender = ({ name, columns = {}, onClick }) => {
  const StateTable = useSelector(state => state?.Table?.data[name]?.data);
  const StateEmpty = useSelector(state => state?.Table?.data[name]?.isEmpty);

  const rows = Array.isArray(StateTable) ? StateTable : [];

  const EmptyData = () => (
    <div className="h-[calc(100vh-260px)] w-full py-20 text-center">
      <h3 className="text-lg font-semibold">Hasil tidak ditemukan</h3>
      <p className="text-sm text-gray-500">
        Coba sesuaikan pencarian atau filter Anda untuk menemukan apa yang Anda cari.
        <br />
        Atau mungkin belum ada datanya!
      </p>
    </div>
  );

  const HasData = () => {
    if (StateEmpty) return <EmptyData />;

    return (
      <div className="flex h-[calc(100vh-260px)] flex-col">
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {rows?.map((row, rowIndex) => (
              <div
                key={rowIndex}
                className={`${onClick === 'function' ? 'hover:!border-primary' : ''} border-secondary h-50 cursor-pointer overflow-auto rounded-xl border bg-white p-4`}
                onClick={() => {
                  if (typeof onClick === 'function') {
                    onClick(row);
                  }
                }}
              >
                {Object.keys(columns).map(key => {
                  if (columns[key].component && React.isValidElement(columns[key].component(row)))
                    return <div key={key}>{columns[key].component(row)}</div>;
                })}
              </div>
            ))}
            {/* {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-white p-4 shadow">
                Card {i + 1}
              </div>
            ))} */}
          </div>
        </div>
      </div>
    );
  };

  return <HasData />;
};

export default CardRender;
