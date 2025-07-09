import React from 'react';
import { useNavigate } from 'react-router-dom';

import useTable from '../../../components/ui/table';
import createTableConfig from './table.config';

const OrderScreen = () => {
  const navigate = useNavigate();

  const tableConfig = React.useMemo(() => {
    return createTableConfig(navigate, {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { Tools, Render, Pagination } = useTable('orders', tableConfig);

  return (
    <div>
      <Tools />
      <Render />
      <Pagination />
    </div>
  );
};

export default OrderScreen;
