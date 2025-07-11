import React from 'react';
import { useSelector } from 'react-redux';

import { currencyFormat } from '../../../utils/common';

const TableRender = ({ name, columns = {}, onSorted, onRowClick }) => {
  const StateTable = useSelector(state => state?.Table?.data[name]?.data);
  const StateSorting = useSelector(state => state?.Table?.data[name]?.sorting);
  const StateEmpty = useSelector(state => state?.Table?.data[name]?.isEmpty);

  const rows = Array.isArray(StateTable) ? StateTable : [];

  const checkSorted = () => {
    let result = { field: StateSorting, sort: 'asc' };

    if (StateSorting.charAt(0) === '-') {
      result.sort = 'desc';
      result.field = result.field.substring(1);
    }

    return result;
  };

  const onFieldSorted = (field, column) => {
    if (!column?.sortable) return;
    const sorting = checkSorted();

    let sortby = field;
    if (typeof column.alias !== 'undefined') {
      sortby = column.alias;
    }

    if (sortby === sorting.field) {
      if (sorting.sort === 'asc') {
        sortby = '-' + sortby;
      }
    }

    onSorted(sortby);
  };

  const Th = ({ field, column }) => {
    // let visible = true;

    // if (column?.visible) {
    //   const check = _.findWhere(privileges, { service: column.visible });
    //   if (!check) visible = false;
    // }

    // if (!visible) return null;
    const className = column?.headerClass ?? '';

    const sorting = checkSorted();

    const Sorting = () => {
      if (column?.sortable === false) return null;

      return <span className="sort" />;
    };

    return (
      <th
        className={`cursor-pointer px-4 py-4 text-left text-[14px] font-semibold tracking-wide text-black uppercase select-none ${
          column.sortable ? 'sorting' : ''
        } ${
          sorting.field === field || sorting.field === column?.alias
            ? 'sorting_' + sorting.sort
            : ''
        } ${className}`}
        style={{ width: column?.width }}
        onClick={() => onFieldSorted(field, column)}
      >
        {column?.title}
        <Sorting />
      </th>
    );
  };

  const Td = ({ field, column, data }) => {
    // let visible = true;

    // if (column?.visible) {
    //   const check = _.findWhere(privileges, { service: column.visible });
    //   if (!check) visible = false;
    // }

    // if (!visible) return null;

    const className = column?.class ?? '';

    if (column?.component && React.isValidElement(column.component(data))) {
      return (
        <td className={`px-4 py-2 text-sm ${className}`} style={{ width: column?.width }}>
          {column.component(data)}
        </td>
      );
    }

    const value = column?.format_number ? currencyFormat(data[field] || 0) : data[field];

    return (
      <td className={`px-4 py-2 text-sm ${className}`} style={{ width: column?.width }}>
        {value}
      </td>
    );
  };

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
      <div className="table-responsive m-0 flex h-[calc(100vh-260px)] flex-col">
        <div className="flex-1 overflow-auto">
          <table
            className="table-hover table-vcenter card-table datatable table-striped table"
            width="100%"
          >
            <thead className="border-secondary sticky top-0 z-10 border-b bg-white">
              <tr>
                {Object.keys(columns).map(key => (
                  <Th key={key} field={key} column={columns[key]} />
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr
                  className={`text-accent hover:!text-primary text-[13px] font-medium tracking-wide uppercase hover:cursor-pointer`}
                  key={rowIndex}
                  onClick={() => {
                    if (typeof onRowClick === 'function') {
                      onRowClick(row);
                    } else {
                      console.log(row); // fallback lama
                    }
                  }}
                >
                  {Object.keys(columns).map(key => (
                    <Td key={key} field={key} column={columns[key]} data={row} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return <HasData />;
};

export default TableRender;
