import React from 'react';
import useTable from '../../../components/ui/table';
import createTableConfig from './table.config';
import { useNavigate } from 'react-router-dom';

const HistoryScreen = () => {
  const navigate = useNavigate();

  const tableConfig = React.useMemo(() => {
    return createTableConfig(navigate, { status: 'completed' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { Tools, Render, Pagination } = useTable('history', tableConfig);

  return (
    <div>
      <Tools />
      <Render />
      <Pagination />
    </div>
  );
};

export default HistoryScreen;
