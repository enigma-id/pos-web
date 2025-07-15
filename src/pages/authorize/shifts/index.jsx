import React from 'react';
import { useNavigate } from 'react-router-dom';

import createTableConfig from './table.config';
import useTable from '../../../components/ui/table';
import useSession from '../../../services/sales/session/hook';

const OrderScreen = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = React.useState(null);

  const { triggerShow, showResult } = useSession();

  const tableConfig = React.useMemo(() => {
    return createTableConfig(navigate, {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const Table = useTable('orders', tableConfig);

  React.useEffect(() => {
    if (selected?.id) {
      triggerShow({ id: selected?.id });
    }

    console.log('detail', selected);
  }, [selected]);

  let data = showResult?.data?.data;

  return (
    <div className="flex">
      <div className="bg-base-100 border-base-200 w-100 border-s">
        <Table.Tools />
        <Table.Carding onSelected={v => setSelected(v)} selected={selected} />
        <Table.PaginationLite />
      </div>
      <div className="border-base-200 h-screen border-s">
        {showResult?.isFetching ? <div>loading</div> : ''}

        <div>{data?.status}</div>
        <div>{data?.id}</div>
      </div>
    </div>
  );
};

export default OrderScreen;
