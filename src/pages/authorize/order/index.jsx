import React from 'react';
import { useNavigate } from 'react-router-dom';

import createTableConfig from './table.config';
import useTable from '../../../components/ui/table';

const OrderScreen = () => {
  const navigate = useNavigate();

  const tableConfig = React.useMemo(() => {
    return createTableConfig(navigate, {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const Table = useTable('orders', tableConfig);

  return (
    <div>
      <Table.Tools />
      <Table.Render />
      <Table.Pagination />
    </div>
  );
};

export default OrderScreen;
