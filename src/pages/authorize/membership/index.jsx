import React from 'react';
import createTableConfig from './table.config';
import useTable from '../../../components/ui/table';
import useDrawer from '../../../utils/drawer';

const MembershipScreen = () => {
  const { drawerRef, open, close } = useDrawer();

  const tableConfig = React.useMemo(() => {
    return createTableConfig({
      onClick: v => {
        console.log(v);
        open();
      },
    });
  }, []);

  const { Tools, Card, Pagination } = useTable('membership', tableConfig);

  return (
    <div>
      <input id="drawer" type="checkbox" ref={drawerRef} className="peer hidden" />

      <div className="relative">
        <div>
          <Tools />
          <Card />
          <Pagination />
        </div>

        <label
          htmlFor="drawer"
          className="bg-opacity-40 fixed inset-0 z-40 hidden bg-black peer-checked:block"
          onClick={close}
        />

        <div className="fixed top-0 right-0 z-50 h-full w-[24rem] translate-x-full transform bg-white shadow-lg transition-transform peer-checked:translate-x-0">
          <div className="p-6">halo</div>
        </div>
      </div>
    </div>
  );
};

export default MembershipScreen;
