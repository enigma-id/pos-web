import { ArrowRightIcon } from '../../../components/ui/icon';
import config from '../../../services/table/const';
import { currencyFormat, dateFormat } from '../../../utils/common';

const createTableConfig = (navigate, filter = {}) => ({
  ...config,
  url: 'sales/session',
  filter,
  columns: {
    outlet: {
      alias: 'outlet.id',
      title: 'Outlet',
      sortable: true,
      width: 150,
      component: row => {
        return <div className="info">{row?.outlet?.alias}</div>;
      },
    },
    cashier: {
      alias: 'cashier.id',
      title: 'Cashier',
      sortable: true,
      width: 80,
      component: row => {
        return <div className="info">{row?.cashier?.name}</div>;
      },
    },
    transaction_date: {
      title: 'Date',
      sortable: true,
      width: 80,
      component: row => {
        return <div>{dateFormat(row?.transaction_date, 'DD/MM/YYYY') || '-'}</div>;
      },
    },

    started_at: {
      title: 'Session Time',
      sortable: true,
      width: 150,
      component: row => {
        return (
          <div>
            <div>
              Start:{' '}
              <span className="font-semibold tracking-wide capitalize">
                {dateFormat(row?.started_at, 'DD MMM YYYY')}
              </span>
            </div>
            <div>
              End:{' '}
              <span className="font-semibold tracking-wide capitalize">
                {dateFormat(row?.finished_at, 'DD MMM YYYY', '(ongoing)')}
              </span>
            </div>
          </div>
        );
      },
    },
    cash_started: {
      title: 'Cash Summary',
      sortable: true,
      width: 150,
      component: row => {
        return (
          <div>
            <div>
              Start:{' '}
              <span className="font-semibold tracking-wide capitalize">
                {currencyFormat(row?.cash_started)}
              </span>
            </div>
            <div>
              End:{' '}
              <span className="font-semibold tracking-wide capitalize">
                {currencyFormat(row?.cash_finished)}
              </span>
            </div>
            <div>
              Due:{' '}
              <span className="font-semibold tracking-wide capitalize">
                {currencyFormat(row?.cash_due)}
              </span>
            </div>
          </div>
        );
      },
    },
    subtotal_order: {
      title: 'Sales',
      sortable: true,
      format_number: true,
      class: 'text-end capitalize font-semibold tracking-wide',
      headerClass: '!text-end',
      width: 100,
    },
    status: {
      title: 'Status',
      sortable: true,
      class: 'place-items-center',
      headerClass: '!text-center',
      width: 80,
      component: row => {
        return (
          <div
            className={`${row?.status === 'active' ? 'bg-accent' : 'bg-success'} w-fit rounded-full px-4 py-1 text-[11px] text-white`}
          >
            {row?.status}
          </div>
        );
      },
    },
    action: {
      title: '',
      class: 'place-items-center',
      width: 20,
      component: () => <ArrowRightIcon />,
    },
  },
  onRowClick: row => {
    navigate(`/order/${row?.id}`);
  },
});

export default createTableConfig;
