import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import _ from 'underscore';

import CardRender from './card';
import CardList from './list';
import TablePagination from './pagination';
import TablePaginationLite from './pagination-lite';
import TableRender from './table';
import TableTool from './tools';
import TableWrapper from './wrapper';
import {
  useLazyDownloadTableDataQuery,
  useLazyGetTableDataQuery,
} from '../../../services/table/action';
import {
  initialized,
  setTable,
  setPage,
  setLimit,
  setSearch,
  setSorting,
  setFilter,
} from '../../../services/table/slice';

const useTable = (name, config) => {
  const dispatch = useDispatch();
  const tableState = useSelector(state => state?.Table?.data[name]);

  const [triggerFetch] = useLazyGetTableDataQuery();
  const [triggerDownload] = useLazyDownloadTableDataQuery();

  const fetchData = async state => {
    try {
      const res = await triggerFetch({ url: state.url, table: state }).unwrap();

      const isSuccess = res?.message === 'success';
      const data = isSuccess && Array.isArray(res?.data) ? res?.data : [];
      const total =
        isSuccess && typeof res?.meta?.total === 'number'
          ? res?.meta?.total
          : isSuccess && typeof res?.total === 'number'
            ? res?.total
            : data?.length;
      const isEmpty = data?.length === 0;

      dispatch(
        setTable({
          name,
          table: {
            ...state,
            ...res,
            data,
            total,
            isEmpty,
          },
        })
      );
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('fetchData error:', error);
      }

      dispatch(
        setTable({
          name,
          table: {
            ...state,
            data: [],
            total: 0,
            isEmpty: true,
          },
        })
      );
    }
  };

  const boot = () => {
    const merged = {
      ..._.clone(config),
      ...(tableState || {}),
      filter: {
        ...(tableState?.filter || {}),
        ...(config?.filter || {}), // config override tableState
      },
    };

    dispatch(initialized({ name, config: merged }));
    fetchData(merged);
  };

  useEffect(() => {
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const refetch = () => {
    if (!tableState) return;
    fetchData(tableState);
  };

  const updateAndFetch = updates => {
    const newState = { ...tableState, ...updates };
    fetchData(newState);
  };

  const onPageChange = page => {
    dispatch(setPage({ name, page }));
    updateAndFetch({ page });
  };

  const onLimitChange = limit => {
    dispatch(setLimit({ name, limit }));
    updateAndFetch({ limit });
  };

  const onSorted = sorting => {
    dispatch(setSorting({ name, sorting }));
    updateAndFetch({ sorting });
  };

  const onSearched = textSearch => {
    dispatch(setSearch({ name, textSearch }));
    updateAndFetch({ textSearch });
  };

  const onFilter = (field, value) => {
    dispatch(setFilter({ name, field, value }));
    refetch();
  };

  const onDownload = () => {
    if (!tableState) return;
    triggerDownload({ url: tableState.url, table: tableState });
  };

  const Render = () => {
    if (!tableState) return null;

    return (
      <TableWrapper name={name}>
        <TableRender
          name={name}
          columns={config?.columns}
          onSorted={onSorted}
          onRowClick={config?.onRowClick}
        />
      </TableWrapper>
    );
  };

  const Card = () => {
    if (!tableState) return null;

    return (
      <TableWrapper name={name}>
        <CardRender name={name} columns={config?.columns} onRowClick={config?.onRowClick} />
      </TableWrapper>
    );
  };

  const Carding = ({ onSelected, selected }) => {
    if (!tableState) return null;

    return (
      <TableWrapper name={name}>
        <CardList
          name={name}
          onSelected={onSelected}
          selected={selected}
          onRowClick={config?.onRowClick}
        />
      </TableWrapper>
    );
  };

  const Pagination = () => (
    <TablePagination name={name} onChangePage={onPageChange} onChangeLimit={onLimitChange} />
  );

  const PaginationLite = () => <TablePaginationLite name={name} onChangePage={onPageChange} />;

  const Tools = ({ children, downloadable }) => (
    <TableTool
      name={name}
      onSearch={onSearched}
      children={children}
      downloadable={downloadable}
      onDownload={onDownload}
    />
  );

  return {
    Render,
    Card,
    Carding,
    Tools,
    Pagination,
    PaginationLite,
    filter: onFilter,
    boot,
    State: tableState,
  };
};

export default useTable;
